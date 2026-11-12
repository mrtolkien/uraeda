// The session panels' words: an Activity row's line, a run's head, a sub-agent's card. Pure: the
// server says what happened, these only put it in words.
import type { Item, SubSession, Subagent, Turn } from "../../../store/protocol";
import type { IconName } from "../../../ui/controls";
import { serverTime } from "../../../store/time";
import type { CardState, CardTime } from "../../../ui/lists";
import { stepOfTurn } from "../../runs/history";
import { STEP_LOOKS } from "../../runs/options";
import { lineWords, type LineWords, took } from "../words";

/** Whether the Activity lists an item: what the agent does, not what it says. */
export const isActivity = (item: Item) =>
  item.kind === "tool" || item.kind === "thought" || item.kind === "denial";

/** Whether a call is Uraeda's `run_agent`, which starts an implementer's sub-session. */
export const startsSub = (item: Item) => item.kind === "tool" && item.name.endsWith("__run_agent");

/**
 * The implementer a call of `run_agent` started, by its target, which is its task: the latest
 * about it, as a task tried again starts another.
 */
export function subOf(item: Item, subs: ReadonlyArray<SubSession>): SubSession | undefined {
  if (item.kind !== "tool" || !startsSub(item) || item.target === null) return undefined;
  return subs.findLast((sub) => sub.role === "implementer" && sub.about === item.target);
}

/** A sub-session's role, as a person says it. */
export const roleWord = (role: SubSession["role"]) =>
  role === "implementer" ? "Implementer" : "Reviewer";

/** A sub-session's state as a card says it, with its tone. */
export function subState(state: SubSession["state"]): CardState {
  switch (state) {
    case "working":
      return { label: "Working", running: true, tone: "live" };
    case "done":
      return { label: "Done", tone: "done" };
    case "failed":
      return { label: "Failed", tone: "danger" };
    default:
      return { label: "Stopped", tone: "quiet" };
  }
}

/** What a sub-session runs on, "Opus 5.5 · High", its model "Default" before its agent said. */
export const subRunsOn = (sub: Pick<SubSession, "effort" | "model">) =>
  [sub.model, sub.effort].filter((part): part is string => part !== null).join(" · ");

/** A count of tokens, short: "41 k", "1.2 M". */
export function tokenWords(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")} M`;
  return count >= 1000 ? `${Math.round(count / 1000)} k` : `${count}`;
}

/**
 * How long something ran from `started` to `ended`, or to `now` while it goes on: the clock is
 * read only then, so a row of what ended does not draw again as it ticks.
 */
export const ranFor = (started: number, ended: number | null, now: () => number) =>
  took(Math.max(0, (ended ?? now()) - started));

/**
 * When a run ran, as every card of a run says it: when it started, in the server's zone, and how
 * long it has gone on, "14:02 · 12 min", or when it ended, "14:02 → 14:20 · 18 min". Nothing for
 * a turn not read yet, or queued.
 */
export function runTime(
  turn: Pick<Turn, "endedAt" | "startedAt"> | null | undefined,
  now: () => number,
): CardTime | undefined {
  if (turn === null || turn === undefined || turn.startedAt === null) return undefined;
  return {
    ended: turn.endedAt === null ? undefined : serverTime(turn.endedAt),
    started: serverTime(turn.startedAt),
    took: ranFor(turn.startedAt, turn.endedAt, now),
  };
}

/** The sub-sessions in the order they started, the first first, as things that happen are read. */
export const inStartOrder = (subs: ReadonlyArray<SubSession>): Array<SubSession> =>
  subs.toSorted((a, b) => a.startedAt - b.startedAt);

/** The sub-agents the main agent started, of a turn's at work: not their own. */
export const topLevel = (subagents: ReadonlyArray<Subagent>) =>
  subagents.filter((one) => one.parent === null);

/** What an Activity row shows: its line, and for a sub-session's start, the sub-session's own. */
export type ActivityLine = LineWords & {
  /** A sub-agent's own call, drawn under the call that started it. */
  nested: boolean;
  /** The sub-session it started, on a line under it: its state, what it runs on, how long. */
  sub?: string;
  /** Whether `Enter` opens something: the sub-session's page. */
  opens: boolean;
};

/** The line of an Activity row of `item`: a call, a thought, or an action auto mode blocked. */
export function activityLine(
  item: Item,
  sub: SubSession | undefined,
  now: () => number,
): ActivityLine | undefined {
  if (item.kind === "denial") {
    return {
      code: item.target !== null,
      hue: "caution",
      icon: "shield",
      ink: "quiet",
      meta: item.allowed ? "allowed" : "blocked",
      nested: false,
      opens: false,
      words: item.target === null ? item.tool : `${item.tool} ${item.target}`,
    };
  }
  const line = lineWords(item);
  if (line === undefined) return undefined;
  const nested = (item.kind === "tool" || item.kind === "thought") && item.parent !== null;
  if (item.kind !== "tool" || !startsSub(item)) return { ...line, nested, opens: false };
  return {
    ...line,
    nested,
    opens: sub !== undefined,
    sub:
      sub === undefined
        ? undefined
        : [subState(sub.state).label, subRunsOn(sub), ranFor(sub.startedAt, sub.endedAt, now)].join(
            " · ",
          ),
  };
}

/** What a turn was: a step of the workflow, a message, or a retry once allowed. */
export function turnWhat(turn: Pick<Turn, "kind" | "step">): string {
  if (turn.kind === "allow") return "Retry";
  if (turn.kind !== "workflow") return "Message";
  const step = stepOfTurn(turn.step);
  return step === undefined ? "Workflow" : STEP_LOOKS[step].name;
}

/** A run's head: "Run 3 · Build", and its state and length: "running", "46 min", "failed". */
export function runHead(
  turn: Turn | null | undefined,
  number: number,
  now: () => number,
): { icon: IconName; meta: string; words: string } {
  const words = turn ? `Run ${number} · ${turnWhat(turn)}` : `Run ${number}`;
  if (!turn || turn.startedAt === null) {
    return { icon: "history", meta: turn?.state === "queued" ? "queued" : "", words };
  }
  const length = ranFor(turn.startedAt, turn.endedAt, now);
  switch (turn.state) {
    case "running":
      return { icon: "play", meta: `running · ${length}`, words };
    case "failed":
      return { icon: "circle-x", meta: `failed after ${length}`, words };
    case "stopped":
      return { icon: "square", meta: `stopped after ${length}`, words };
    default:
      return { icon: "circle-check", meta: length, words };
  }
}
