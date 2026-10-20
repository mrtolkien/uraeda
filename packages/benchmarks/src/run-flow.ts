import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter } from "uraeda-server/runner/adapter";
import { baselineFor } from "./baseline.ts";
import type { Case } from "./case.ts";
import type { Deps, RunTarget } from "./deps.ts";
import { countRounds } from "./count.ts";
import { featureSnapshot } from "./feature-folder.ts";
import { finalDiff, runVerifier } from "./grader.ts";
import { git } from "./git.ts";
import { makeHuman } from "./human.ts";
import { judgeRequirements } from "./judge.ts";
import { runLoop } from "./loop.ts";
import type { Scores } from "./record.ts";
import type { Sandbox } from "./sandbox.ts";
import { runPlain } from "./run-plain.ts";
import {
  baseRecord,
  copyTranscripts,
  nextRunFolder,
  requireApproval,
  stateOf,
} from "./run-common.ts";
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

/** The approved spec of the feature, from its folder, when the flow wrote one. */
function readSpec(specs: string, feature: string): string | undefined {
  try {
    return readFileSync(join(specs, feature, "spec.md"), "utf8");
  } catch {
    return undefined;
  }
}

type Graded = {
  models: Array<string>;
  scores: Scores;
  sessions: Array<{ nativeId: string; role: "judge" }>;
  steps: Array<ReturnType<typeof stepOf>>;
};

/**
 * Runs one case through the whole flow: the sandbox, the feature, the loop of agent and human
 * sessions, the grading, and the run's folder. Nothing starts without an approval. The flow run
 * is paired with the case's baseline: one is run first when the case has none. A run that breaks
 * on an error still writes its record, with the outcome `failed` and the error as its reason.
 */
export async function runFlow(
  deps: Deps,
  options: RunTarget & { case: Case; suite: Suite },
): Promise<string> {
  const approvedBy = requireApproval(options.approvedBy);
  const { case: found, suite } = options;
  if (suite.arms.includes("plain") && baselineFor(deps.root, found, suite) === undefined) {
    await runPlain(deps, { approvedBy, case: found, suite, suiteName: options.suiteName });
  }
  const started = deps.now();
  const repository = await stateOf(deps.repository);
  const work = mkdtempSync(join(tmpdir(), "benchmarks-flow-"));
  let sandbox: Sandbox | undefined;
  try {
    const skill = await snapshotSkill({
      commit: deps.skillCommit ?? "HEAD",
      into: join(work, "plugin"),
      repository: deps.repository,
    });
    sandbox = await deps.prepareSandbox({
      case: found,
      claude: deps.claude,
      constitution: join(deps.root, "constitution.md"),
      effort: suite.effort,
      host: { effort: suite.human.effort, model: suite.human.model },
      model: suite.model,
      work: join(work, "sandbox"),
    });
    const proposal = readFileSync(found.proposal, "utf8");
    const feature = await startFeature(sandbox.repo, found.id, proposal);
    const emptyPlugin = join(work, "plugin-none");
    mkdirSync(join(emptyPlugin, ".claude-plugin"), { recursive: true });
    writeFileSync(join(emptyPlugin, ".claude-plugin", "plugin.json"), '{ "name": "none" }\n');
    const agent = deps.adapter("agent", sandbox, skill.pluginDir);
    const host = deps.adapter("host", sandbox, emptyPlugin);
    // The persona is read from the commit the record names, never from the working tree.
    const guidelines = await git(deps.repository, [
      "show",
      `${suite.human.commit}:${suite.human.path}`,
    ]);
    const loop = await runLoop({
      adapter: agent,
      ...(deps.loop ? { deps: deps.loop } : {}),
      feature,
      human: makeHuman({ adapter: host, guidelines, proposal }),
      humanModel: suite.human.model,
      maxSteps: suite.maxSteps,
      model: suite.model,
      repo: sandbox.repo,
      upstream: found.upstream,
    });
    const specs = await featureSnapshot(sandbox.repo, feature, join(work, "snapshot"));
    const graded = await grade(deps, { feature, found, host, loop, proposal, sandbox, specs });
    // A session of any role, the judge's too, that named another model fails the run.
    const answered = [...new Set([...loop.models, ...graded.models])];
    const wrong = graded.models.find((model) => model !== suite.human.model);
    const outcome = wrong === undefined || loop.outcome !== "finished" ? loop.outcome : "failed";
    const reason =
      wrong !== undefined && loop.outcome === "finished"
        ? `the judge was answered by ${wrong}, not ${suite.human.model}`
        : loop.reason;
    const folder = runFolderPath(
      deps.root,
      nextRunFolder(deps, { arm: "uraeda", case: found.id, suite: options.suiteName }),
    );
    copyTranscripts(sandbox, [...loop.sessions, ...graded.sessions], folder);
    writeRun(folder, {
      diff: await finalDiff(sandbox.repo, sandbox.base),
      record: {
        ...(await baseRecord({
          adapter: host,
          approvedBy,
          effort: suite.effort,
          guidelines: suite.human.commit,
          model: suite.human.model,
          repository,
          skill: { commit: skill.commit, dirty: skill.dirty },
          started,
          task: { id: found.task, image: found.image, source: found.source },
        })),
        blocked: loop.blocked,
        ended: deps.now().toISOString(),
        ...(loop.flags.length > 0 ? { flags: loop.flags } : {}),
        models: { answered, asked: suite.model },
        outcome,
        ...(reason === undefined ? {} : { reason }),
        steps: [...loop.steps, ...graded.steps],
        urls: loop.urls,
      },
      scores: graded.scores,
      specs,
    });
    return folder;
  } finally {
    await sandbox?.close();
    rmSync(work, { force: true, recursive: true });
  }
}

/** The hidden tests on the final diff, and the judge's verdicts on the approved spec. */
async function grade(
  deps: Deps,
  context: {
    feature: string;
    found: Case;
    host: Adapter;
    loop: Awaited<ReturnType<typeof runLoop>>;
    proposal: string;
    sandbox: Sandbox;
    specs: string;
  },
): Promise<Graded> {
  const { found, loop, sandbox } = context;
  const tests = await runVerifier({
    case: found,
    ...(deps.docker ? { docker: deps.docker } : {}),
    fetchTests: deps.fetchTests,
    patch: await finalDiff(sandbox.repo, sandbox.base),
  });
  const counts = countRounds(join(context.specs, context.feature), loop.steps);
  const spec = readSpec(context.specs, context.feature);
  const ungraded: Graded = { models: [], scores: { ...counts, tests }, sessions: [], steps: [] };
  if (spec === undefined) {
    return ungraded;
  }
  try {
    const judged = await judgeRequirements({
      adapter: context.host,
      proposal: context.proposal,
      spec,
    });
    return {
      models: judged.session.models,
      scores: { ...counts, requirements: judged.requirements, tests },
      sessions: [{ nativeId: judged.session.nativeId, role: "judge" }],
      steps: [stepOf("judge", "judge", judged.session)],
    };
  } catch {
    // A judge that failed leaves the requirements ungraded: the page says "not graded".
    return ungraded;
  }
}
