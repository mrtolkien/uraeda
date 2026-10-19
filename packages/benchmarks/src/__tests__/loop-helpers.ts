import type { AgentEvent, Denial } from "uraeda-server/runner/events";
import { FakeAdapter } from "uraeda-server/runner/fake";
import { type HumanResult, type HumanTurn, runLoop } from "../loop.ts";
import type { NextJson } from "../next.ts";
import { InvalidRun, type SessionResult } from "../session.ts";

export const MODEL = "claude-sonnet-5-5";
export const UPSTREAM = "https://github.com/ansible/ansible";

/** A `ura next --json` answer: who is up, at which step. */
export function view(
  waitsOn: "agent" | "human",
  name: string,
  extra: { implemented?: boolean } = {},
): NextJson {
  return {
    branch: "feature",
    feature: "2026-10-19-case",
    step: {
      file: waitsOn === "human" ? "specs/2026-10-19-case/clarifications-01.md" : null,
      implemented: extra.implemented ?? false,
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

export const blockedTurn = (command: string): Array<AgentEvent> => {
  const denial: Denial = { input: { command }, tool: "Bash" };
  return [result({ denials: [denial] })];
};

export const fetchTurn = (target: string): Array<AgentEvent> => [
  { id: "t1", input: {}, kind: "fetch", name: "WebFetch", target, type: "toolStart" },
  result(),
];

/** What a human turn gives back: a finished session, in the human's own role. */
export const humanSession = (extra: Partial<SessionResult> = {}): SessionResult => ({
  denials: [],
  errors: [],
  models: [MODEL],
  nativeId: "human",
  ok: true,
  seconds: 1,
  tokens: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 },
  urls: [],
  usageLimit: false,
  ...extra,
});

/**
 * Runs the loop on the fake adapter: `views` are what `ura next` answers in turn (the last one
 * repeats), `turns` the events of each agent session in turn, and the branch counts as pushed after
 * `pushedAfter` agent sessions. Returns what the loop gave, and what ran in order.
 */
export async function runScripted(options: {
  human?: (turn: HumanTurn, agentSessions: number) => Promise<HumanResult>;
  maxSteps?: number;
  /** The branch counts as pushed once this many agent sessions have run. */
  pushedAfter?: number;
  turns: Array<Array<AgentEvent>>;
  views: Array<NextJson>;
}) {
  const adapter = new FakeAdapter();
  for (const turn of options.turns) {
    adapter.script(turn);
  }
  const order: Array<string> = [];
  let call = 0;
  const loop = await runLoop({
    adapter,
    deps: {
      isPushed: async () => adapter.sent.length >= (options.pushedAfter ?? Infinity),
      next: async () => {
        const answer = options.views[Math.min(call++, options.views.length - 1)] as NextJson;
        order.push(`${answer.step["waits-on"]}:${answer.step.name}`);
        return answer;
      },
    },
    feature: "2026-10-19-case",
    human: (turn) =>
      options.human
        ? options.human(turn, adapter.sent.length)
        : Promise.resolve({ gate: "answered", session: humanSession() }),
    maxSteps: options.maxSteps ?? 30,
    model: MODEL,
    repo: "/repo",
    upstream: UPSTREAM,
  });
  return { adapter, loop, order };
}

export { InvalidRun };
