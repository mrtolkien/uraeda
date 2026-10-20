import { randomUUID } from "node:crypto";
import type { Outgoing } from "./adapter.ts";
import type { TurnKind } from "./events.ts";
import { chatTitle } from "./message.ts";
import { type checkSend, messageItem, openingOf, sendPlace } from "./send-input.ts";
import { type Live, type Message, rowOf, type SessionContext } from "./session-state.ts";

/** The steps whose run starts a fresh agent session by default: the first after a spec's approval. */
const FRESH_STEPS = new Set(["approval", "plan"]);

/**
 * Sends a checked message to the session, under its lock, and returns its turn. Idle, it starts a
 * turn, opening the process when it is closed. During a turn, the human's message is steered into
 * it, and the workflow's is queued after it. `available` refuses once the agent is gone.
 */
export async function sendTo(
  context: SessionContext,
  live: Live,
  { held, paths, text, workflow: sent }: ReturnType<typeof checkSend>,
  available: () => void,
): Promise<{ turn: number }> {
  const { adapter, binding, cache, changed, processes, turns } = context;
  const { asChat, branch, step } = await sendPlace(binding, live, sent);
  const workflow = asChat === undefined ? sent : undefined;
  available();
  const row = rowOf(cache, live);
  if (row.folder === null && row.title === null) {
    cache.updateSession(row.id, { title: chatTitle(text, paths.length > 0) });
  }
  if (row.archivedAt !== null) {
    cache.updateSession(row.id, { archivedAt: null });
  }
  const id = randomUUID();
  const origin = workflow ? "workflow" : "human";
  // During a turn, a human message joins it, when the agent can steer and the turn is not ending.
  if (live.turn && !live.turn.stop && !sent && adapter.capabilities.steer) {
    const item: Message = { ...messageItem(id, origin, text), ...held };
    const seq = cache.appendItem(live.turn.id, item);
    live.messages.set(id, { item, seq, turn: live.turn.id, written: true });
    changed(live, live.turn.id);
    live.proc?.agent.send({ id, images: paths, text, when: "steer" });
    return { turn: live.turn.id };
  }

  const kind: TurnKind = workflow ? "workflow" : "chat";
  // The run after a spec's approval follows the setting unless the message says (the agents
  // decision): a composer may send it before it read the setting.
  const fresh =
    workflow?.fresh ??
    (step !== null && FRESH_STEPS.has(step) && (workflow?.freshByDefault ?? true));
  const opening = workflow ? undefined : await openingOf(context, live, branch);
  const item: Message = {
    ...messageItem(id, origin, text),
    ...(opening === undefined ? {} : { opening }),
    ...held,
  };
  const message: Outgoing = {
    id,
    images: paths,
    text: opening === undefined ? text : text === "" ? opening : `${opening}\n${text}`,
    when: "queue",
  };
  const turn = {
    allowed: null,
    kind,
    step,
    trigger: workflow?.trigger ?? null,
  };

  // A busy session queues the turn: Uraeda writes its message once the running turn ends.
  if (live.turn || live.queue.length > 0) {
    const queued = cache.addTurn({ sessionId: live.id, ...turn, state: "queued" });
    turns.track(queued);
    const seq = cache.appendItem(queued, item);
    if (asChat !== undefined) {
      cache.appendItem(queued, { kind: "system", text: asChat });
    }
    live.messages.set(id, { item, seq, turn: queued, written: false });
    live.queue.push({
      ...(fresh ? { fresh } : {}),
      id: queued,
      message,
      // Checked again as it starts: the running turn may move its step on.
      ...(workflow ? { workflow } : {}),
    });
    changed(live, queued, "queued");
    return { turn: queued };
  }

  const { line } = await processes.open(live, { fresh });
  const started = turns.begin(live, { ...turn, item, line, message });
  if (asChat !== undefined) {
    cache.appendItem(started, { kind: "system", text: asChat });
  }
  return { turn: started };
}
