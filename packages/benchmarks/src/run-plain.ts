import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Case } from "./case.ts";
import type { Deps, RunTarget } from "./deps.ts";
import { finalDiff, runVerifier } from "./grader.ts";
import { git } from "./git.ts";
import type { Outcome } from "./record.ts";
import type { Suite } from "./suite.ts";
import { runFolderPath, writeRun } from "./recorder.ts";
import {
  baseRecord,
  copyTranscripts,
  nextRunFolder,
  requireApproval,
  stateOf,
} from "./run-common.ts";
import { isUpstream } from "./loop.ts";
import { runSession, stepOf } from "./session.ts";

/** The plain arm's prompt: the case's proposal, and one line saying where to work. */
export function plainPrompt(proposal: string): string {
  return `${proposal.trimEnd()}\n\nImplement this in the repository in the current directory.\n`;
}

/**
 * The plain arm: one Claude Code session on the case, with the proposal as its prompt, no skill, no
 * human, in the same image, model, and effort. Its work is committed on the host, then graded like
 * the flow's. The same code makes the screening runs, in a suite folder named `screening`.
 */
export async function runPlain(
  deps: Deps,
  options: RunTarget & { case: Case; suite: Pick<Suite, "effort" | "human" | "model"> },
): Promise<{
  folder: string;
  outcome: Outcome;
  tests: { passed: number; resolved: boolean; total: number };
}> {
  const approvedBy = requireApproval(options.approvedBy);
  const { case: found, suite } = options;
  const started = deps.now();
  const repository = await stateOf(deps.repository);
  const work = mkdtempSync(join(tmpdir(), "benchmarks-plain-"));
  const sandbox = await deps.prepareSandbox({
    case: found,
    claude: deps.claude,
    constitution: "",
    effort: suite.effort,
    model: suite.model,
    specs: false,
    work: join(work, "sandbox"),
  });
  try {
    const emptyPlugin = join(work, "plugin-none");
    mkdirSync(join(emptyPlugin, ".claude-plugin"), { recursive: true });
    writeFileSync(join(emptyPlugin, ".claude-plugin", "plugin.json"), '{ "name": "none" }\n');
    const adapter = deps.adapter("agent", sandbox, emptyPlugin);
    const session = await runSession({
      adapter,
      cwd: sandbox.repo,
      message: plainPrompt(readFileSync(found.proposal, "utf8")),
    });
    await git(sandbox.repo, ["add", "-A"]);
    await git(sandbox.repo, ["commit", "-q", "--allow-empty", "-m", "plain run"]);
    const tests = await runVerifier({
      case: found,
      ...(deps.docker ? { docker: deps.docker } : {}),
      fetchTests: deps.fetchTests,
      patch: await finalDiff(sandbox.repo, sandbox.base),
    });
    const wrong = session.models.find((model) => model !== suite.model);
    const outcome: Outcome = session.usageLimit
      ? "usage-limit"
      : wrong !== undefined || !session.ok
        ? "failed"
        : "finished";
    const folder = runFolderPath(
      deps.root,
      nextRunFolder(deps, { arm: "plain", case: found.id, suite: options.suiteName }),
    );
    copyTranscripts(sandbox, [{ nativeId: session.nativeId, role: "plain" }], folder);
    writeRun(folder, {
      diff: await finalDiff(sandbox.repo, sandbox.base),
      record: {
        ...(await baseRecord({
          adapter,
          approvedBy,
          effort: suite.effort,
          guidelines: suite.human.commit,
          model: suite.model,
          repository,
          skill: { commit: "none", dirty: false },
          started,
          task: { id: found.task, image: found.image, source: found.source },
        })),
        blocked: session.denials.map((denial) => ({
          rule: "none",
          tool: denial.tool,
          ...(typeof denial.input.command === "string" ? { target: denial.input.command } : {}),
        })),
        ended: deps.now().toISOString(),
        ...(session.urls.some((url) => isUpstream(url, found.upstream))
          ? { flags: ["leak-suspected" as const] }
          : {}),
        models: { answered: session.models, asked: suite.model },
        outcome,
        ...(outcome === "finished"
          ? {}
          : {
              reason:
                session.errors.join("; ") || session.exit?.stderr || "the session did not finish",
            }),
        steps: [stepOf("plain", "plain", session)],
        urls: session.urls,
      },
      scores: { tests },
    });
    return { folder, outcome, tests };
  } finally {
    await sandbox.close();
  }
}
