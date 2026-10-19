import { randomUUID } from "node:crypto";
import type { SessionCache } from "./cache.ts";
import type { Item } from "./events.ts";
import { retryMessage } from "./message.ts";
import { type Live, REFUSALS, refused, type SessionContext } from "./session-state.ts";

type DenialItem = Extract<Item, { kind: "denial" }>;

/** A blocked action that can be allowed: it has a rule, and the rule is one line. */
export type Covered = DenialItem & { rule: string; seq: number };

/** A rule is one line: the turn stores its rules a line each. Rows written before may hold more. */
const isUsable = (rule: string | undefined): rule is string =>
  rule !== undefined && !rule.includes("\n");

/**
 * The turn's blocked actions that are not allowed yet and have a rule: what "Allow all" allows, and
 * what the session's `allowable` counts, so the button's number and the press cannot differ.
 */
export function coveredDenials(cache: SessionCache, turn: number): Array<Covered> {
  return cache
    .itemsOf(turn, "denial")
    .filter((denial): denial is Covered => !denial.allowed && isUsable(denial.rule));
}

/**
 * Allows the blocked action of item `seq` of `turn`: reopens the session's process with its rule,
 * for that process only, and asks the agent to try again, in a turn of its own. Called inside the
 * session's serial section.
 */
export async function allowDenial(
  context: SessionContext,
  live: Live,
  turn: number,
  seq: number,
): Promise<{ turn: number }> {
  const { cache } = context;
  const denial = cache.itemsOf(turn, "denial").find((item) => item.seq === seq);
  if (cache.turn(turn)?.sessionId !== live.id || !denial) {
    throw new Error(`no blocked action ${seq} in turn ${turn}`);
  }
  if (!isUsable(denial.rule)) {
    throw refused(REFUSALS.noRule);
  }
  return allowDenials(context, live, turn, [{ ...denial, rule: denial.rule }]);
}

/**
 * Allows every covered blocked action of the session's latest turn at once, in one reopen of the
 * process and one retry turn. Called inside the session's serial section.
 */
export async function allowAll(context: SessionContext, live: Live): Promise<{ turn: number }> {
  const { cache } = context;
  if (live.turn || live.queue.length > 0) {
    throw refused(REFUSALS.working);
  }
  const latest = cache.turns(live.id).at(-1);
  const covered = latest === undefined ? [] : coveredDenials(cache, latest.id);
  if (latest === undefined || covered.length === 0) {
    throw refused(REFUSALS.nothingToAllow);
  }
  return allowDenials(context, live, latest.id, covered);
}

/**
 * The one path that allows: refuses while a turn runs or waits, reopens the process with the
 * rules, which throws before anything is marked, begins the retry turn, then marks each denial
 * allowed. The rules go once each, in the order first seen.
 */
async function allowDenials(
  context: SessionContext,
  live: Live,
  turn: number,
  denials: Array<Covered>,
): Promise<{ turn: number }> {
  const { cache, changed, processes, turns } = context;
  if (live.turn || live.queue.length > 0) {
    throw refused(REFUSALS.working);
  }
  const rules = [...new Set(denials.map((denial) => denial.rule))];
  const { line } = await processes.open(live, { allowed: rules });
  const id = randomUUID();
  const text = retryMessage(
    rules.map((rule) => denials.find((denial) => denial.rule === rule) as Covered),
  );
  const started = turns.begin(live, {
    allowed: rules.join("\n"),
    item: { id, kind: "message", origin: "human", state: "pending", text },
    kind: "allow",
    message: { id, images: [], text, when: "queue" },
    ...(line === undefined ? {} : { line }),
    step: null,
    trigger: null,
  });
  for (const { rule, seq, target, tool } of denials) {
    cache.updateItem(turn, seq, {
      kind: "denial",
      tool,
      ...(target === undefined ? {} : { target }),
      allowed: true,
      rule,
    });
  }
  changed(live, turn);
  return { turn: started };
}
