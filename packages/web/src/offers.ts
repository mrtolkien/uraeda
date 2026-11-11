// The agent's offers to move a session up, as its messages hold them, and what the page keeps of
// them while it is open: the offers closed with "Not now", the card opened from the session's "…",
// the changes and features dropped, and the lines a move leaves on its session, like "Started as the change …". Kept for the page,
// not the component: a session that becomes a change draws again as the change's session.
import { useSyncExternalStore } from "react";
import { OFFER_LANGUAGE } from "uraeda-server/instructions";
import type { OfferKind } from "uraeda-server/offers";

// The offer's grammar has one home, the server's, which also reads it to start a job's change.
export {
  lastOffer,
  type Offer,
  offerBody,
  type OfferKind,
  proposalTitle,
} from "uraeda-server/offers";

/** The fence's language, before the kind, as the server's instructions teach it to the agent. */
export { OFFER_LANGUAGE };

/** The kind an offer block's info string names after its language, or `undefined`. */
export function offerKind(meta: string): OfferKind | undefined {
  const kind = meta.trim();
  return kind === "change" || kind === "feature" ? kind : undefined;
}

/** Whether an offer applies to a session of `kind`: a session only moves up, one step at a time. */
export function applies(offer: OfferKind, kind: "change" | "feature" | "session"): boolean {
  return offer === "change" ? kind === "session" : kind === "change";
}

/** A line a move left on its session's page. */
export type MoveNote = { status: "info" | "warning"; title: string };

const closed = new Set<string>();
const dropped = new Set<string>();
/** The kind of the agent's card showing with its buttons, by session. */
const live = new Map<string, OfferKind>();
/** How many times the session's "…" asked for a card: each ask focuses it. */
const asks = new Map<string, number>();
/** The sessions whose "…" takes the focus back, once a card closed. */
const giveBack = new Set<string>();
const opened = new Map<string, OfferKind>();
const notes = new Map<string, ReadonlyArray<MoveNote>>();
const listeners = new Set<() => void>();
const NO_NOTES: ReadonlyArray<MoveNote> = [];

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

/** Closes the offer at `key`, `<turn>:<seq>` of its message: it reads as text from then on. */
export function closeOffer(key: string) {
  closed.add(key);
  changed();
}

/** Whether the offer at `key` was closed. */
export function useOfferClosed(key: string): boolean {
  return useSyncExternalStore(subscribe, () => closed.has(key));
}

/**
 * Opens the card of `kind` at the session's end, as its "…" does, and focuses it, or closes it, with
 * `undefined`. While the agent's card of that kind shows with its buttons, it focuses that one
 * instead: a session has one live card.
 */
export function openOffer(session: string, kind: OfferKind | undefined) {
  if (kind === undefined) {
    opened.delete(session);
  } else {
    if (live.get(session) !== kind) {
      opened.set(session, kind);
    }
    asks.set(session, (asks.get(session) ?? 0) + 1);
  }
  changed();
}

/**
 * Counts the agent's card of `kind` as the session's live card, until the returned call: a card of
 * that kind the "…" opened closes, as the session has one live card, the latest.
 */
export function showLive(session: string, kind: OfferKind) {
  live.set(session, kind);
  if (opened.get(session) === kind) {
    opened.delete(session);
    changed();
  }
  return () => {
    if (live.get(session) === kind) {
      live.delete(session);
    }
  };
}

/** How many times the session's "…" asked for a card. */
export function useAsks(session: string): number {
  return useSyncExternalStore(subscribe, () => asks.get(session) ?? 0);
}

/** Gives the focus back to the session's "…", as a card closes. */
export function returnFocus(session: string) {
  giveBack.add(session);
  changed();
}

/** Whether the session's "…" takes the focus back: `took` says it did. */
export function useFocusBack(session: string) {
  const back = useSyncExternalStore(subscribe, () => giveBack.has(session));
  const took = () => {
    giveBack.delete(session);
    changed();
  };
  return { back, took };
}

/** The card opened at the session's end, if any. */
export function useOpened(session: string): OfferKind | undefined {
  return useSyncExternalStore(subscribe, () => opened.get(session));
}

/** Adds a line to the session's page, after its transcript. */
export function addNote(session: string, ...added: Array<MoveNote>) {
  notes.set(session, [...(notes.get(session) ?? []), ...added]);
  changed();
}

/** The lines moves left on the session's page. */
export function useNotes(session: string): ReadonlyArray<MoveNote> {
  return useSyncExternalStore(subscribe, () => notes.get(session) ?? NO_NOTES);
}

/** Marks the change or the feature of `session` dropped from its page: the session moves it no more. */
export function markDropped(session: string) {
  dropped.add(session);
  changed();
}

/** Whether the change or the feature of `session` was dropped from its page. */
export function useDropped(session: string): boolean {
  return useSyncExternalStore(subscribe, () => dropped.has(session));
}

/** The key Home's notes are kept under, as a session's are kept under its ID: what a drop from a feature's page says. */
export const HOME_NOTES = "home";

/** Removes the line at `index` of the notes kept under `key`, once the human dismissed it. */
export function dismissNote(key: string, index: number) {
  notes.set(
    key,
    (notes.get(key) ?? []).filter((_, at) => at !== index),
  );
  changed();
}

/** Forgets the notes of every session, and Home's: a test's lines do not reach the next. */
export function forgetNotes() {
  notes.clear();
  changed();
}
