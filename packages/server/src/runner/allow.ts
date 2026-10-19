import { randomUUID } from "node:crypto";
import { retryMessage } from "./message.ts";
import { type Live, REFUSALS, refused, type SessionContext } from "./session-state.ts";

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
  const { cache, changed, processes, turns } = context;
  const denial = cache.itemsOf(turn, "denial").find((item) => item.seq === seq);
  if (cache.turn(turn)?.sessionId !== live.id || !denial) {
    throw new Error(`no blocked action ${seq} in turn ${turn}`);
  }
  const { rule } = denial;
  if (rule === undefined) {
    throw refused(REFUSALS.noRule);
  }
  if (live.turn || live.queue.length > 0) {
    throw refused(REFUSALS.working);
  }
  const { line } = await processes.open(live, { allowed: rule });
  const id = randomUUID();
  const text = retryMessage(denial);
  const started = turns.begin(live, {
    allowed: rule,
    item: { id, kind: "message", origin: "human", state: "pending", text },
    kind: "allow",
    message: { id, images: [], text, when: "queue" },
    ...(line === undefined ? {} : { line }),
    step: null,
    trigger: null,
  });
  cache.updateItem(turn, seq, {
    kind: "denial",
    tool: denial.tool,
    ...(denial.target === undefined ? {} : { target: denial.target }),
    allowed: true,
    rule,
  });
  changed(live, turn);
  return { turn: started };
}
