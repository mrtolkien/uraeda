import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { baselineFor } from "./baseline.ts";
import type { Case } from "./case.ts";
import type { Deps, RunTarget } from "./deps.ts";
import { countRounds } from "./count.ts";
import { finalDiff, runVerifier } from "./grader.ts";
import { git } from "./git.ts";
import { makeHuman } from "./human.ts";
import { judgeRequirements } from "./judge.ts";
import { runLoop } from "./loop.ts";
import type { Scores } from "./record.ts";
import { runPlain } from "./run-plain.ts";
import { baseRecord, copyTranscripts, nextRunFolder, requireApproval } from "./run-common.ts";
import { runFolderPath, writeRun } from "./recorder.ts";
import { run } from "./run-command.ts";
import { snapshotSkill } from "./skill.ts";
import { stepOf } from "./session.ts";
import type { Suite } from "./suite.ts";

/** Starts the feature from the case's proposal, word for word: a draft, then `ura start`. */
export async function startFeature(repo: string, id: string, proposal: string): Promise<string> {
  const draft = join(repo, "specs/drafts", `${id}.md`);
  mkdirSync(join(repo, "specs/drafts"), { recursive: true });
  writeFileSync(draft, proposal);
  await git(repo, ["add", "-A"]);
  await git(repo, ["commit", "-q", "-m", "draft"]);
  await run("ura", ["start", id, "--slug", id, "--switch"], repo);
  return (await git(repo, ["branch", "--show-current"])).trim();
}

/** The approved spec of the feature, from the checkout, when the flow wrote one. */
function readSpec(repo: string, feature: string): string | undefined {
  try {
    return readFileSync(join(repo, "specs", feature, "spec.md"), "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Runs one case through the whole flow: the sandbox, the feature, the loop of agent and human
 * sessions, the grading, and the run's folder. Nothing starts without an approval. The flow run
 * is paired with the case's baseline: one is run first when the case has none.
 */
export async function runFlow(
  deps: Deps,
  options: RunTarget & { case: Case; suite: Suite },
): Promise<string> {
  const approvedBy = requireApproval(options.approvedBy);
  const { case: found, suite } = options;
  if (suite.arms.includes("plain") && baselineFor(deps.root, found) === undefined) {
    await runPlain(deps, { approvedBy, case: found, suite, suiteName: options.suiteName });
  }
  const started = deps.now();
  const work = mkdtempSync(join(tmpdir(), "benchmarks-flow-"));
  const skill = await snapshotSkill({
    commit: deps.skillCommit ?? "HEAD",
    into: join(work, "plugin"),
    repository: deps.repository,
  });
  const constitution = join(deps.root, "constitution.md");
  const sandbox = await deps.prepareSandbox({
    case: found,
    claude: deps.claude,
    constitution,
    effort: suite.effort,
    model: suite.model,
    work: join(work, "sandbox"),
  });
  try {
    const feature = await startFeature(
      sandbox.repo,
      found.id,
      readFileSync(found.proposal, "utf8"),
    );
    const emptyPlugin = join(work, "plugin-none");
    mkdirSync(join(emptyPlugin, ".claude-plugin"), { recursive: true });
    writeFileSync(join(emptyPlugin, ".claude-plugin", "plugin.json"), '{ "name": "none" }\n');
    const agent = deps.adapter("agent", sandbox, skill.pluginDir);
    const host = deps.adapter("host", sandbox, emptyPlugin);
    const proposal = readFileSync(found.proposal, "utf8");
    const guidelines = readFileSync(join(deps.repository, suite.human.path), "utf8");
    const loop = await runLoop({
      adapter: agent,
      ...(deps.loop ? { deps: deps.loop } : {}),
      feature,
      human: makeHuman({ adapter: host, guidelines, proposal }),
      maxSteps: suite.maxSteps,
      model: suite.model,
      repo: sandbox.repo,
      upstream: found.upstream,
    });
    const scores = await grade(deps, { feature, found, host, loop, proposal, sandbox, suite });
    const folder = runFolderPath(
      deps.root,
      nextRunFolder(deps, { arm: "uraeda", case: found.id, suite: options.suiteName }),
    );
    copyTranscripts(sandbox, loop.sessions, folder);
    const record = {
      ...(await baseRecord(deps, {
        adapter: host,
        approvedBy,
        effort: suite.effort,
        guidelines: suite.human.commit,
        model: suite.model,
        skill: { commit: skill.commit, dirty: skill.dirty },
        started,
        task: { id: found.task, image: found.image, source: found.source },
      })),
      blocked: loop.blocked,
      ended: deps.now().toISOString(),
      ...(loop.flags.length > 0 ? { flags: loop.flags } : {}),
      models: { answered: loop.models, asked: suite.model },
      outcome: loop.outcome,
      ...(loop.reason === undefined ? {} : { reason: loop.reason }),
      steps: [...loop.steps, ...scores.steps],
      urls: loop.urls,
    };
    writeRun(folder, {
      diff: await finalDiff(sandbox.repo, sandbox.base),
      record,
      scores: scores.scores,
      specs: join(sandbox.repo, "specs"),
    });
    return folder;
  } finally {
    await sandbox.close();
  }
}

/** The hidden tests on the final diff, and the judge's verdicts on the approved spec. */
async function grade(
  deps: Deps,
  context: {
    feature: string;
    found: Case;
    host: ReturnType<Deps["adapter"]>;
    loop: Awaited<ReturnType<typeof runLoop>>;
    proposal: string;
    sandbox: Awaited<ReturnType<Deps["prepareSandbox"]>>;
    suite: Suite;
  },
): Promise<{ scores: Scores; steps: Array<ReturnType<typeof stepOf>> }> {
  const { found, loop, sandbox } = context;
  const tests = await runVerifier({
    case: found,
    ...(deps.docker ? { docker: deps.docker } : {}),
    fetchTests: deps.fetchTests,
    patch: await finalDiff(sandbox.repo, sandbox.base),
  });
  const counts = countRounds(join(sandbox.repo, "specs", context.feature), loop.steps);
  const spec = readSpec(sandbox.repo, context.feature);
  if (spec === undefined) {
    return { scores: { ...counts, tests }, steps: [] };
  }
  try {
    const judged = await judgeRequirements({
      adapter: context.host,
      proposal: context.proposal,
      spec,
    });
    return {
      scores: { ...counts, requirements: judged.requirements, tests },
      steps: [stepOf("judge", "judge", judged.session)],
    };
  } catch {
    // A judge that failed leaves the requirements ungraded: the page says "not graded".
    return { scores: { ...counts, tests }, steps: [] };
  }
}
