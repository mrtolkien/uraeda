// The agent's offers to move a session up, as its messages hold them, and what the page keeps of
// them while it is open: the offers closed with "Not now", the card opened from the session's "…",
// and the lines a move leaves on its session, like "Started as the change …". Kept for the page,
// not the component: a session that becomes a change draws again as the change's session.
import { useSyncExternalStore } from "react";

/** What an offer moves: a session to a change, or a change to a feature. */
export type OfferKind = "change" | "feature";

/**
 * An offer block, ` ```uraeda-offer change ` or ` ```uraeda-offer feature `: its body is the
 * change's proposal, `# Title` first, or the reason to make the change a feature.
 */
export type Offer = { body: string; kind: OfferKind };

/** The fence's language, before the kind. */
export const OFFER_LANGUAGE = "uraeda-offer";

/** An offer block, closed: its kind, then its body. */
const BLOCK = /^```uraeda-offer[ \t]+(change|feature)[ \t]*\n([\s\S]*?)\n```[ \t]*$/gmu;

/** The kind an offer block's info string names after its language, or `undefined`. */
export function offerKind(meta: string): OfferKind | undefined {
  const kind = meta.trim();
  return kind === "change" || kind === "feature" ? kind : undefined;
}

/** The last closed offer block of a message's text: a block still open is text. */
export function lastOffer(text: string): Offer | undefined {
  let last: Offer | undefined;
  for (const match of text.matchAll(BLOCK)) {
    last = { body: match[2].trim(), kind: match[1] as OfferKind };
  }
  return last;
}

/** Whether an offer applies to a session of `kind`: a session only moves up, one step at a time. */
export function applies(offer: OfferKind, kind: "change" | "feature" | "session"): boolean {
  return offer === "change" ? kind === "session" : kind === "change";
}

/** A proposal's title: its first line, without the heading's `#`. */
export function proposalTitle(proposal: string): string {
  const first = proposal.trim().split("\n")[0] ?? "";
  return first.replace(/^#+\s*/u, "").trim();
}

/** A line a move left on its session's page. */
export type MoveNote = { status: "info" | "warning"; title: string };

const closed = new Set<string>();
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

/** Opens the card of `kind` at the session's end, as its "…" does, or closes it, with `undefined`. */
export function openOffer(session: string, kind: OfferKind | undefined) {
  if (kind === undefined) {
    opened.delete(session);
  } else {
    opened.set(session, kind);
  }
  changed();
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
