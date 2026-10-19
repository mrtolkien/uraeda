import { dirname } from "node:path";
import type { Adapter } from "uraeda-server/runner/adapter";
import { git } from "./git.ts";
import type { HumanResult, HumanTurn } from "./loop.ts";
import { InvalidRun, runSession } from "./session.ts";

/** The most the human may request changes in one run: the guidelines say it, and this checks it. */
export const MAX_CHANGE_REQUESTS = 2;

/** The session's first message: the guidelines, the proposal, and the file waiting. */
export function humanMessage(options: {
  file: string | null;
  guidelines: string;
  proposal: string;
}): string {
  const waiting = options.file === null ? "" : `\nThe file waiting for you is ${options.file}.\n`;
  return `${options.guidelines.trimEnd()}\n\n## Your proposal\n\n${options.proposal.trimEnd()}\n\n## Now\n${waiting}\nOpen it, then act as the guidelines say.\n`;
}

/** What the human did at a gate, from the subject of the commit `ura` made. */
export function gateOf(subject: string): string {
  if (/approve/i.test(subject)) {
    return "approved";
  }
  if (/request changes/i.test(subject)) {
    return "changes requested";
  }
  return /answer/i.test(subject) ? "answered" : subject;
}

/**
 * The simulated human: a fresh session at each gate, which sees the repository's working folder and
 * nothing else, with the guidelines and the proposal as its only knowledge. After its turn it checks
 * that its commits touched only the files of the feature's folder, and that it asked for changes at
 * most twice: else the run is invalid.
 */
export function makeHuman(options: {
  adapter: Adapter;
  guidelines: string;
  now?: () => number;
  proposal: string;
}): (turn: HumanTurn) => Promise<HumanResult> {
  let requests = 0;
  return async (turn) => {
    const before = (await git(turn.repo, ["rev-parse", "HEAD"])).trim();
    const session = await runSession({
      adapter: options.adapter,
      cwd: turn.repo,
      message: humanMessage({
        file: turn.file,
        guidelines: options.guidelines,
        proposal: options.proposal,
      }),
      ...(options.now ? { now: options.now } : {}),
    });
    const after = (await git(turn.repo, ["rev-parse", "HEAD"])).trim();
    if (after === before) {
      return { gate: "no action", session };
    }
    const folder = turn.file === null ? "specs" : dirname(turn.file);
    const files = (await git(turn.repo, ["diff", "--name-only", `${before}..${after}`]))
      .split("\n")
      .filter(Boolean);
    const outside = files.find((file) => !file.startsWith(`${folder}/`));
    if (outside !== undefined) {
      throw new InvalidRun(`the human's commit touched ${outside}, outside ${folder}/`);
    }
    const gate = gateOf((await git(turn.repo, ["log", "-1", "--format=%s"])).trim());
    if (gate === "changes requested" && ++requests > MAX_CHANGE_REQUESTS) {
      throw new InvalidRun(`the human requested changes more than ${MAX_CHANGE_REQUESTS} times`);
    }
    return { commit: after, gate, session };
  };
}
