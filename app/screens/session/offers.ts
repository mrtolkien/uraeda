// The agent's offers to move a session up, and what the app keeps of them while it runs: the
// cards closed with "Not now", the card the human opened themself, and where a session went once
// it moved, which its page then says (rule 9). An offer is a fenced block of the agent's message,
// ` ```uraeda-offer change ` or ` ```uraeda-offer feature `: the core's document tree gives it
// as a code block of the language `uraeda-offer`, so the app reads no Markdown to find it.
import { signal } from "nsh";
import type { Block } from "../../store/protocol";

export type OfferKind = "change" | "feature";

/**
 * The kind of an offer block, `uraeda-offer <kind>`. The core's tree keeps a fence's first word
 * alone, `uraeda-offer`, so the kind is told by the body, as the offer's grammar shapes it: a
 * change's proposal opens with its `# Title`, a feature's reason is a sentence.
 */
export function offerOf(block: Block): OfferKind | undefined {
  if (block.kind !== "code" || block.language !== "uraeda-offer") return undefined;
  return (block.text ?? "").trimStart().startsWith("# ") ? "change" : "feature";
}

/**
 * Whether an offer moves a session of this kind: a session only moves up, one step at a time, a
 * chat to a change, a change to a feature.
 */
export const applies = (offer: OfferKind, session: "chat" | "change" | "feature") =>
  offer === "change" ? session === "chat" : session === "change";

/** The cards closed with "Not now", by their row. */
const closed = signal<ReadonlySet<string>>(new Set());

export const isClosed = (row: string) => closed().has(row);

export function closeOffer(row: string) {
  closed.set(new Set([...closed(), row]));
}

/** The card the human opened from the session's own keys, by session: its kind. */
const opened = signal<Readonly<Record<string, OfferKind>>>({});

export const openedOffer = (session: string): OfferKind | undefined => opened()[session];

export function openOffer(session: string, kind: OfferKind | undefined) {
  const { [session]: _, ...rest } = opened();
  opened.set(kind === undefined ? rest : { ...rest, [session]: kind });
}

/** Where a session went once it moved: its new folder, and what it became. */
export type Moved = { folder: string; to: OfferKind };

const moved = signal<Readonly<Record<string, Moved>>>({});

export const movedOf = (session: string): Moved | undefined => moved()[session];

export function markMoved(session: string, to: Moved) {
  moved.set({ ...moved(), [session]: to });
}
