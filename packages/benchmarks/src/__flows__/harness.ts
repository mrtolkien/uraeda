import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentEvent } from "uraeda-server/runner/events";
import { FakeAdapter } from "uraeda-server/runner/fake";
import { type HumanResult, type HumanTurn, runLoop } from "../loop.ts";
import type { NextJson } from "../next.ts";
import type { SessionResult } from "../session.ts";

export const MODEL = "claude-sonnet-5-5";
export const UPSTREAM = "https://github.com/ansible/ansible";

export const temporary = (prefix = "flow-") => mkdtempSync(join(tmpdir(), prefix));

export function write(path: string, content: string): string {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
  return path;
}

/** A synchronous git, for fixtures. */
export const sh = (cwd: string, ...args: Array<string>) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

/** A repository on `branch` whose commits are made by a test user. */
export function repository(branch = "main"): string {
  const repo = temporary("flow-repo-");
  sh(repo, "init", "-q", "-b", branch);
  sh(repo, "config", "user.email", "t@example.com");
  sh(repo, "config", "user.name", "t");
  return repo;
}

/** A `PATH` whose `ura` can only `start`: it moves the draft to the feature's own branch. */
export function pathWithFakeUra(): string {
  const bin = temporary("flow-bin-");
  write(
    join(bin, "ura"),
    `#!/bin/sh
mkdir -p "specs/2026-10-19-$2" && git mv "specs/drafts/$2.md" "specs/2026-10-19-$2/proposal.md" \\
  && git checkout -q -b "2026-10-19-$2" && git commit -q -am proposal
`,
  );
  chmodSync(join(bin, "ura"), 0o755);
  return `${bin}:${process.env.PATH}`;
}

/** A `ura next --json` answer: who is up, at which step. */
export function view(waitsOn: "agent" | "human", name: string, implemented = false): NextJson {
  return {
    branch: "feature",
    feature: "2026-10-19-case",
    step: {
      file: waitsOn === "human" ? "clarifications-01.md" : null,
      implemented,
      name,
      "plan-review": null,
      reference: `skills/uraeda/references/${name}.md`,
      "waits-on": waitsOn,
    },
  };
}

/** A turn's closing `result` event. */
export function result(extra: Partial<Extract<AgentEvent, { type: "result" }>> = {}): AgentEvent {
  return {
    costUsd: 0.5,
    denials: [],
    errors: [],
    interrupted: false,
    models: [MODEL],
    ok: true,
    type: "result",
    ...extra,
  };
}

/** A turn where the agent fetches `target` with the web tool, or runs `command` in a shell. */
export const fetches = (target: string): Array<AgentEvent> => [
  { id: "t1", input: {}, kind: "fetch", name: "WebFetch", target, type: "toolStart" },
  result(),
];
export const runs = (command: string): Array<AgentEvent> => [
  {
    id: "t2",
    input: { command },
    kind: "execute",
    name: "Bash",
    target: command,
    type: "toolStart",
  },
  result(),
];

/** A turn where auto mode blocked `tool` with `input`. */
export const blocked = (tool: string, input: Record<string, unknown>): Array<AgentEvent> => [
  result({ denials: [{ input, tool }] }),
];

/** What a human turn gives back: a finished session in the human's own role. */
export const humanSession = (extra: Partial<SessionResult> = {}): SessionResult => ({
  denials: [],
  errors: [],
  models: [MODEL],
  nativeId: "human",
  ok: true,
  seconds: 1,
  text: "",
  tokens: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 },
  urls: [],
  usageLimit: false,
  ...extra,
});

export const answered = async (): Promise<HumanResult> => ({
  commit: "c1",
  gate: "answered",
  session: humanSession(),
});

/**
 * Runs the loop on the fake adapter. `views` are what `ura next` answers in turn (the last one
 * repeats), `turns` the events of each agent session, and the branch is pushed once `pushedAfter`
 * agent messages were sent.
 */
export async function runScripted(options: {
  human?: (turn: HumanTurn) => Promise<HumanResult>;
  humanModel?: string;
  maxSteps?: number;
  /** The call of `ura next`, from 1, that throws. */
  nextThrowsAt?: number;
  pushedAfter?: number;
  turns: Array<Array<AgentEvent>>;
  views: Array<NextJson>;
}) {
  const adapter = new FakeAdapter();
  for (const turn of options.turns) {
    adapter.script(turn);
  }
  let call = 0;
  const loop = await runLoop({
    adapter,
    deps: {
      isPushed: async () => adapter.sent.length >= (options.pushedAfter ?? Infinity),
      next: async () => {
        call++;
        if (call === options.nextThrowsAt) {
          throw new Error("ura exploded");
        }
        return options.views[Math.min(call - 1, options.views.length - 1)] as NextJson;
      },
    },
    feature: "2026-10-19-case",
    human: options.human ?? answered,
    maxSteps: options.maxSteps ?? 30,
    ...(options.humanModel ? { humanModel: options.humanModel } : {}),
    model: MODEL,
    repo: "/repo",
    upstream: UPSTREAM,
  });
  return { adapter, loop };
}
