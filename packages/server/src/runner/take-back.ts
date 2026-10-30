import { type Live, REFUSALS, refused, type SessionContext, TAKEN_BACK } from "./session-state.ts";

/**
 * Takes back a message of the session the agent has not read: a queued turn's at once, which ends
 * it, or a message written to the agent through its own take-back, which ends with its `cancelled`
 * event. Refused once the agent read it, or once the session no longer keeps it.
 */
export function takeBack(context: SessionContext, live: Live, message: string): void {
  const { adapter, turns } = context;
  const sent = live.messages.get(message);
  // A message no longer kept belongs to a turn that ended with nothing left to read.
  if (!sent) {
    throw refused(REFUSALS.read);
  }
  if (sent.item.state === "taken-back") {
    return;
  }
  if (sent.item.state === "read" || live.turn?.first === message) {
    throw refused(REFUSALS.read);
  }
  const queued = live.queue.findIndex((turn) => turn.message.id === message);
  if (queued >= 0) {
    live.queue.splice(queued, 1);
    turns.mark(live, sent, "taken-back");
    turns.end(live, sent.turn, { reason: TAKEN_BACK, state: "stopped" });
    return;
  }
  if (!adapter.capabilities.takeBack) {
    throw new Error(`${adapter.name} cannot take a message back`);
  }
  live.proc?.agent.takeBack(message);
}
