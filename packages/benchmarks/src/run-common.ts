import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Adapter } from "uraeda-server/runner/adapter";
import type { Deps } from "./deps.ts";
import { git } from "./git.ts";
import type { Commit, RunRecord, Step } from "./record.ts";
import { type RunFolder, runFolderPath } from "./recorder.ts";
import type { Sandbox } from "./sandbox.ts";

/** Refuses to start a run no human allowed. */
export function requireApproval(approvedBy: string | undefined): string {
  if (approvedBy === undefined || approvedBy.trim() === "") {
    throw new Error("a run needs a human's approval: pass --approved-by <name>");
  }
  return approvedBy;
}

/** A repository's commit, and whether its tree has changes. */
export async function stateOf(repository: string): Promise<Commit> {
  const commit = (await git(repository, ["rev-parse", "HEAD"])).trim();
  const dirty = (await git(repository, ["status", "--porcelain"])).trim() !== "";
  return { commit, dirty };
}

/** The next free run folder of a case and arm, from the clock's date. */
export function nextRunFolder(deps: Deps, target: Omit<RunFolder, "date" | "n">): RunFolder {
  const date = deps.now().toISOString().slice(0, 10);
  let n = 1;
  while (existsSync(runFolderPath(deps.root, { ...target, date, n }))) {
    n++;
  }
  return { ...target, date, n };
}

/** Copies each session's raw transcript out of the configuration folder, named by role and ID. */
export function copyTranscripts(
  sandbox: Sandbox,
  sessions: Array<{ nativeId: string; role: Step["role"] }>,
  into: string,
): void {
  mkdirSync(join(into, "transcripts"), { recursive: true });
  for (const configDir of [sandbox.configDir, sandbox.hostConfigDir]) {
    const projects = join(configDir, "projects");
    if (!existsSync(projects)) {
      continue;
    }
    for (const { nativeId, role } of sessions) {
      for (const folder of readdirSync(projects)) {
        const file = join(projects, folder, `${nativeId}.jsonl`);
        if (existsSync(file)) {
          copyFileSync(file, join(into, "transcripts", `${role}-${nativeId}.jsonl`));
        }
      }
    }
  }
}

/** The record's fields that do not depend on the arm. */
export async function baseRecord(
  deps: Deps,
  options: {
    adapter: Adapter;
    approvedBy: string;
    effort: string;
    guidelines: string;
    model: string;
    skill: Commit;
    started: Date;
    task: RunRecord["task"];
  },
): Promise<
  Omit<RunRecord, "blocked" | "ended" | "models" | "outcome" | "steps" | "transcripts" | "urls">
> {
  return {
    "approved-by": options.approvedBy,
    effort: options.effort,
    harness: {
      name: options.adapter.kind,
      version: (await options.adapter.version()) ?? "unknown",
    },
    human: { guidelines: options.guidelines, model: options.model },
    repository: await stateOf(deps.repository),
    skill: options.skill,
    started: options.started.toISOString(),
    task: options.task,
    version: 1,
  };
}
