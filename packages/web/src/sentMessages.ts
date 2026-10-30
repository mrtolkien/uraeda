// The messages sent to a session and not in its transcript yet: each shows at the transcript's end
// at once, as the human's message the agent has not read, until the transcript can draw the
// server's own. Its turn, its place, and its ID are the server's: none is made up here.
import { useSyncExternalStore } from "react";
import type { useFateClient } from "react-fate";
import type { ChatImage } from "uraeda-server/fate";
import { sendMessage } from "./sessions.ts";
import { SessionView, TurnLogView, TurnView } from "./views.ts";

type Fate = ReturnType<typeof useFateClient>;

/** A message sent, by its temporary ID. */
export type Sent = { id: string; images: ReadonlyArray<ChatImage>; text: string };

const NONE: ReadonlyArray<Sent> = [];
const bySession = new Map<string, ReadonlyArray<Sent>>();
const listeners = new Set<() => void>();
let made = 0;

const changed = () => {
  for (const listener of listeners) {
    listener();
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The messages sent to `session` that its transcript does not draw yet, oldest first. */
export function useSent(session: string): ReadonlyArray<Sent> {
  return useSyncExternalStore(
    subscribe,
    () => bySession.get(session) ?? NONE,
    () => NONE,
  );
}

/** The turns of `session` as the browser holds them, none when it holds none. */
async function heldTurns(fate: Fate, session: string): Promise<ReadonlyArray<string>> {
  try {
    const { session: ref } = await fate.request(
      { session: { id: session, view: SessionView } },
      { mode: "cache-first" },
    );
    const { data } = await fate.readView(SessionView, ref);
    return (data as unknown as { turns: ReadonlyArray<string> }).turns;
  } catch {
    return [];
  }
}

/**
 * Reads the new turn a message went into, and its last page, for the transcript to draw it from
 * what the browser holds: nothing when the message went into a turn the transcript already draws,
 * which its live updates bring.
 */
async function readNewTurn(fate: Fate, session: string, before: ReadonlyArray<string>) {
  const turn = (await heldTurns(fate, session)).at(-1);
  if (turn === undefined || before.includes(turn)) {
    return;
  }
  const { turn: ref } = await fate.request(
    { turn: { id: turn, view: TurnView } },
    { mode: "network-only" },
  );
  const { data } = await fate.readView(TurnView, ref);
  const pages = (data as unknown as { pages: number }).pages;
  await fate.request(
    { turnLog: { id: `${turn}:${Math.max(pages - 1, 0)}`, view: TurnLogView } },
    { mode: "network-only" },
  );
}

/** Takes `sent` out of `session`'s transcript. */
function drop(session: string, sent: Sent) {
  const left = (bySession.get(session) ?? []).filter((one) => one !== sent);
  if (left.length === 0) {
    bySession.delete(session);
  } else {
    bySession.set(session, left);
  }
  changed();
}

/**
 * Sends a message as `sendMessage` does, shown at the end of the transcript of `showIn`, when
 * given, at once: until the transcript can draw the server's message, or until it is refused.
 */
export async function sendShowing(
  fate: Fate,
  input: Parameters<typeof sendMessage>[1],
  showIn: string | undefined,
) {
  if (showIn === undefined) {
    return sendMessage(fate, input);
  }
  made += 1;
  const sent: Sent = { id: `optimistic:${made}`, images: input.images ?? [], text: input.text };
  bySession.set(showIn, [...(bySession.get(showIn) ?? []), sent]);
  changed();
  const before = heldTurns(fate, showIn);
  try {
    const result = await sendMessage(fate, input);
    if (result.ok) {
      void before
        .then((turns) => readNewTurn(fate, showIn, turns))
        .catch(() => {})
        .finally(() => drop(showIn, sent));
    } else {
      drop(showIn, sent);
    }
    return result;
  } catch (error) {
    drop(showIn, sent);
    throw error;
  }
}
