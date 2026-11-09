import { randomUUID } from "node:crypto";
import type { Outgoing } from "./adapter.ts";
import type { TurnRow } from "./cache.ts";
import type { ContinueReason, TurnKind } from "./events.ts";
import { chatTitle, continueMessage } from "./message.ts";
import { isStepId, runSession } from "./run-session.ts";
import { type checkSend, messageItem, openingOf, sendPlace } from "./send-input.ts";
import {
  type Live,
  type Message,
  ofDropped,
  REFUSALS,
  refused,
  rowOf,
  runtimeOf,
  type SessionContext,
} from "./session-state.ts";

type Checked = ReturnType<typeof checkSend>;
type Place = Awaited<ReturnType<typeof sendPlace>>;

/**
 * Sends a checked message to the session, under its lock, and returns the session it went to and
 * its turn. A workflow run goes to the session `runSession` gives its run step: a new session of
 * the change or the feature becomes its latest, queued there while the session it was sent to
 * works. `available` refuses once the agent is gone. A session of a dropped change or feature is
 * refused: its worktree is gone, and stays gone.
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
  if (workflow === undefined || live.folder === null || !isStepId(place.runStep)) {
    return deliver(context, live, checked, place, false);
  }
  const behind = live.turn !== undefined || live.queue.length > 0;
  const next = await runSession(context, live, place.runStep, workflow.fresh);
  if (next === live) {
    return deliver(context, live, checked, place, false);
  }
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
  { asChat, branch, caughtUpTo, step }: Place,
  behind: boolean,
): Promise<{ session: string; turn: number }> {
  const { binding, cache, changed, processes, turns } = context;
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
  if (live.turn && !live.turn.stop && !sent && runtimeOf(context, live)?.capabilities.steer) {
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
  const turn = { allowed: null, caughtUpTo: caughtUpTo ?? null, kind, step };
  const trigger = workflow?.trigger ?? null;
  const line = workflow?.line;

  // A busy session queues the turn: Uraeda writes its message once the running turn ends, or once
  // the other session of its folder is idle, which wakes it. Checked with the push, at once.
  if (busy()) {
    const lines = { after: asChat, before: line };
    const { queued, seq } = addQueued(
      context,
      { ...turn, sessionId: live.id, trigger },
      item,
      lines,
    );
    turns.track(queued);
    live.messages.set(id, { item, seq, turn: queued, written: false });
    // Checked again as it starts: the running turn may move its step on.
    live.queue.push({ id: queued, message, ...(workflow ? { workflow } : {}) });
    changed(live, queued, "queued");
    return { session: live.id, turn: queued };
  }

  live.starting = true;
  try {
    const { line: opened } = await processes.open(live);
    const lines = [opened, line].filter((text) => text !== undefined);
    const started = turns.begin(live, { ...turn, item, lines, message, trigger });
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

/**
 * Adds a queued turn, its message, and its system lines before and after the message, as one, or
 * not at all; returns the turn and its message's seq.
 */
function addQueued(
  { cache }: SessionContext,
  turn: Omit<Parameters<SessionContext["cache"]["addTurn"]>[0], "state">,
  item: Message,
  lines: { after: string | undefined; before: string | undefined },
): { queued: number; seq: number } {
  return cache.atomically(() => {
    const queued = cache.addTurn({ ...turn, state: "queued" });
    if (lines.before !== undefined) {
      cache.appendItem(queued, { kind: "system", text: lines.before });
    }
    const seq = cache.appendItem(queued, item);
    if (lines.after !== undefined) {
      cache.appendItem(queued, { kind: "system", text: lines.after });
    }
    return { queued, seq };
  });
}

/**
 * Queues an automatic continue's turn in the session, at once, counts it, and returns it: the
 * message of `reason`, from the workflow, after `line`, in a turn of the stopped turn's kind, step,
 * and trigger, an `allow` turn's as a chat. The turn, its items, and the count are written as one,
 * or not at all. The session's queue starts it, behind another session of its change or feature
 * working, as any queued turn; it is not checked again as a workflow message. The continuer checks
 * its refusals before.
 */
export function deliverContinue(
  context: SessionContext,
  live: Live,
  { line, reason, stopped }: { line: string; reason: ContinueReason; stopped: TurnRow },
): number {
  const { cache, changed, turns } = context;
  const id = randomUUID();
  const text = continueMessage(reason);
  const item = messageItem(id, "workflow", text);
  const chat = stopped.kind === "allow" || stopped.kind === "chat";
  const { queued, seq } = cache.atomically(() => {
    const queued = cache.addTurn({
      allowed: null,
      // A continued catch-up, or retry of one, catches up with the same commit (R1, R18).
      caughtUpTo: stopped.caughtUpTo,
      kind: chat ? "chat" : stopped.kind,
      sessionId: live.id,
      state: "queued",
      step: chat ? null : stopped.step,
      trigger: chat ? null : stopped.trigger,
    });
    cache.appendItem(queued, { kind: "system", text: line });
    const seq = cache.appendItem(queued, item);
    cache.addContinue(live.id);
    return { queued, seq };
  });
  turns.track(queued);
  live.messages.set(id, { item, seq, turn: queued, written: false });
  live.queue.push({ id: queued, message: { id, images: [], text, when: "queue" } });
  changed(live, queued, "queued");
  turns.next(live);
  return queued;
}
