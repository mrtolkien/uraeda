/**
 * The check of an agent's own review that `validate-claude.ts` and `validate-codex.ts` share: a
 * reviewer's session, without Uraeda's tools as a sub-session has, given the message
 * `reviewMessage` makes for a range of commits that adds a bug, ends its turn well, and its last
 * message, its section of the findings, names the bug.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, OpenOptions } from "../src/runner/adapter.ts";
import type { AgentEvent } from "../src/runner/events.ts";
import { toolsCheck } from "./validate-tools.ts";

/** A review that has not ended after this long is stopped, and its check fails. */
const REVIEW_TIMEOUT_MS = 600_000;

type Report = (name: string, ok: boolean, got: unknown) => void;

const git = (cwd: string, ...args: Array<string>) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

/** A repository whose last commit adds `mul`, which adds: the range of that commit, and its path. */
function buggyRepo(): { base: string; cwd: string; head: string } {
  const cwd = join(mkdtempSync(join(tmpdir(), "uraeda-review-")), "repo");
  mkdirSync(cwd);
  git(cwd, "init", "-q", "-b", "main");
  git(cwd, "config", "user.name", "Uraeda Validation");
  git(cwd, "config", "user.email", "validation@uraeda.invalid");
  writeFileSync(join(cwd, "maths.py"), "def add(a, b):\n    return a + b\n");
  git(cwd, "add", "maths.py");
  git(cwd, "commit", "-q", "-m", "add");
  const base = git(cwd, "rev-parse", "HEAD");
  writeFileSync(
    join(cwd, "maths.py"),
    "def add(a, b):\n    return a + b\n\n\ndef mul(a, b):\n    return a + b\n",
  );
  git(cwd, "commit", "-q", "-am", "mul multiplies two numbers");
  return { base, cwd, head: git(cwd, "rev-parse", "HEAD") };
}

/** Whether only the last checks run: with `--tools` or `--review`. */
export const lastOnly = (argv: ReadonlyArray<string>) =>
  argv.includes("--tools") || argv.includes("--review");

/**
 * The checks every validation ends with, as `argv` asks: the check of Uraeda's tool, `toolsCheck`,
 * but with `--review`, then the review's, `reviewCheck`, but with `--tools` alone.
 */
export async function lastChecks(
  adapter: Adapter,
  argv: ReadonlyArray<string>,
  tools: Parameters<typeof toolsCheck>[1],
  review: Parameters<typeof reviewCheck>[1],
) {
  const reviewOnly = argv.includes("--review");
  if (!reviewOnly) {
    await toolsCheck(adapter, tools);
  }
  if (reviewOnly || !argv.includes("--tools")) {
    await reviewCheck(adapter, review);
  }
}

/**
 * The check: a session on `pick` reviews the commit that adds the bug through the agent's own
 * review, at `effort`; its turn ends well, and its last message names `mul`. `reviewedOn`, when
 * given, reads what the review ran on by the agent's session ID, checked against the pick.
 */
export async function reviewCheck(
  adapter: Adapter,
  {
    effort,
    pick,
    report,
    reviewedOn,
  }: {
    effort?: string;
    pick: Partial<OpenOptions>;
    report: Report;
    reviewedOn?: (sessionId: string) => { effort?: string; model?: string } | undefined;
  },
) {
  const { base, cwd, head } = buggyRepo();
  try {
    const message = adapter.reviewMessage?.({ base, head, ...(effort ? { effort } : {}) });
    if (message === undefined) {
      report(`${adapter.name} has a review of its own`, false, "no reviewMessage");
      return;
    }
    const options = { cwd, nativeId: randomUUID(), resume: false, skills: [], ...pick };
    const events = await reviewTurn(adapter, { ...options, tools: "none" }, message);
    const result = events.find((event) => event.type === "result");
    const last = events.findLast((event) => event.type === "text");
    const said = last?.type === "text" ? last.text : "";
    report(
      `${adapter.name}'s own review ends well, its last message naming the bug`,
      result?.type === "result" && result.ok && /\bmul\b/.test(said),
      {
        message,
        result,
        said,
        summary: events
          .filter((event) => !["textDelta", "activity", "usage", "tokens"].includes(event.type))
          .slice(0, 40),
      },
    );
    const init = events.find((event) => event.type === "init");
    if (reviewedOn !== undefined && init?.type === "init") {
      const ran = reviewedOn(init.sessionId);
      report(
        `${adapter.name}'s review runs on the reviewer's model and effort`,
        ran?.model === pick.model && ran?.effort === pick.effort,
        { pick: { effort: pick.effort, model: pick.model }, ran },
      );
    }
  } finally {
    rmSync(join(cwd, ".."), { force: true, recursive: true });
  }
}

/** Opens the reviewer's session, sends the review, and reads its turn. */
async function reviewTurn(
  adapter: Adapter,
  options: OpenOptions,
  message: { review?: boolean; text: string },
): Promise<Array<AgentEvent>> {
  const agent = adapter.open(options);
  const timeout = setTimeout(() => agent.kill("SIGKILL"), REVIEW_TIMEOUT_MS);
  const events: Array<AgentEvent> = [];
  agent.send({ id: randomUUID(), images: [], when: "queue", ...message });
  try {
    for await (const event of agent.events) {
      events.push(event);
      if (event.type === "result" || (event.type === "init" && event.problem !== undefined)) {
        agent.close();
      }
    }
  } finally {
    clearTimeout(timeout);
  }
  return events;
}
