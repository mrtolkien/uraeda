import { randomUUID } from "node:crypto";
import type { Outgoing } from "./adapter.ts";
import type { TurnKind } from "./events.ts";
import { chatTitle } from "./message.ts";
import { type checkSend, messageItem, openingOf, sendPlace } from "./send-input.ts";
import {
  type Live,
  type Message,
  ofDropped,
  REFUSALS,
  refused,
  rowOf,
  type SessionContext,
} from "./session-state.ts";

/** The steps whose run starts a fresh agent session by default: the first after a spec's approval. */
const FRESH_STEPS = new Set(["approval", "plan"]);

type Checked = ReturnType<typeof checkSend>;
type Place = Awaited<ReturnType<typeof sendPlace>>;

/**
 * Sends a checked message to the session, under its lock, and returns the session it went to and
 * its turn. A run that starts a fresh agent session goes to a new session of the change or the
 * feature, which becomes its latest: queued there while the session it was sent to works.
 * `available` refuses once the agent is gone. A session of a dropped change or feature is refused:
 * its worktree is gone, and stays gone.
 */
export async function sendTo(
  context: SessionContext,
  live: Live,
  checked: Checked,
  available: () => void,
): Promise<{ session: string; turn: number }> {
  if (ofDropped(rowOf(context.cache, live))) {
    throw refused(REFUSALS.dropped);
  }
  const place = await sendPlace(context.binding, live, checked.workflow);
  available();
  const workflow = place.asChat === undefined ? checked.workflow : undefined;
  // The run after a spec's approval follows the setting unless the message says (the agents
  // decision): a composer may send it before it read the setting.
  const fresh =
    workflow?.fresh ??
    (place.step !== null && FRESH_STEPS.has(place.step) && (workflow?.freshByDefault ?? true));
  // A session that never ran is as new as a new one.
  if (!fresh || live.folder === null || context.cache.turns(live.id).length === 0) {
    return deliver(context, live, checked, place, false);
  }
  const { adapter, binding, cache } = context;
  const behind = live.turn !== undefined || live.queue.length > 0;
  // Refused before the new session exists: a refused run leaves no empty session as the latest.
  if (context.live.moving(live)) {
    throw refused(REFUSALS.agentWorking);
  }
  if (!behind && context.live.otherWorking(live, { queued: true })) {
    const { kind } = await binding.readFeature(live.repo, live.folder);
    throw refused(REFUSALS.otherWorking(kind));
  }
  const row = cache.createSession({
    agent: adapter.kind,
    folder: live.folder,
    nativeId: randomUUID(),
    repo: live.repo,
    title: null,
  });
  const next = context.live.of(row);
  return context.live.serial(next, () => deliver(context, next, checked, place, behind));
}

/**
 * Sends the message in this session: steered into its turn, queued after it, or starting one. A
 * session whose change or feature works in another session is refused, or, `behind` it, queued;
 * one that a move or a drop holds, or that a drop archived, is refused.
 */
async function deliver(
  context: SessionContext,
  live: Live,
  { held, opening: given, paths, text, workflow: sent }: Checked,
  { asChat, branch, step }: Place,
  behind: boolean,
): Promise<{ session: string; turn: number }> {
  const { adapter, binding, cache, changed, processes, turns } = context;
  const workflow = asChat === undefined ? sent : undefined;
  // A move or a drop of the session, or of its folder, holds it: checked again after each wait.
  const unmoved = () => {
    if (context.live.moving(live)) {
      throw refused(REFUSALS.agentWorking);
    }
    if (ofDropped(rowOf(cache, live))) {
      throw refused(REFUSALS.dropped);
    }
  };
  unmoved();
  const busy = () =>
    live.turn !== undefined ||
    live.queue.length > 0 ||
    context.live.otherWorking(live, { queued: true });
  if (!behind && live.turn === undefined && live.queue.length === 0 && busy()) {
    const { kind } = await binding.readFeature(live.repo, live.folder as string);
    throw refused(REFUSALS.otherWorking(kind));
  }
  const row = rowOf(cache, live);
  if (row.folder === null && row.title === null) {
    cache.updateSession(row.id, { title: chatTitle(text, paths.length > 0) });
  }
  // An archived chat comes back with a message: a dropped change's session was refused above.
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
    return { session: live.id, turn: live.turn.id };
  }

  const opening = given ?? (workflow ? undefined : await openingOf(context, live, branch));
  unmoved();
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
  const kind: TurnKind = workflow ? "workflow" : "chat";
  const turn = { allowed: null, kind, step, trigger: workflow?.trigger ?? null };

  // A busy session queues the turn: Uraeda writes its message once the running turn ends, or once
  // the other session of its folder is idle, which wakes it. Checked with the push, at once.
  if (busy()) {
    const queued = cache.addTurn({ sessionId: live.id, ...turn, state: "queued" });
    turns.track(queued);
    const seq = cache.appendItem(queued, item);
    if (asChat !== undefined) {
      cache.appendItem(queued, { kind: "system", text: asChat });
    }
    live.messages.set(id, { item, seq, turn: queued, written: false });
    // Checked again as it starts: the running turn may move its step on.
    live.queue.push({ id: queued, message, ...(workflow ? { workflow } : {}) });
    changed(live, queued, "queued");
    return { session: live.id, turn: queued };
  }

  live.starting = true;
  try {
    const { line } = await processes.open(live);
    const started = turns.begin(live, { ...turn, item, line, message });
    if (asChat !== undefined) {
      cache.appendItem(started, { kind: "system", text: asChat });
    }
    return { session: live.id, turn: started };
  } finally {
    live.starting = false;
    // A start that failed lets the sessions waiting for it go.
    if (live.turn === undefined) {
      turns.wake(live);
    }
  }
}
