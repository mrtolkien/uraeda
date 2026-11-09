// Where the run map's cursor is, and where its keys move it: along the track, a step's tile or the
// joint after it, by ← → (h l); down from Build to its implementers and from Review to its reviewers
// by ↓ (j), and back up by ↑ (k). The row under the track holds the implementers, each reviewer,
// the reviewer to add, and where reviews happen, in that order.
import { STEPS, type StepId } from "./runOptions.ts";

/** A place on the map: the track's `index`, even for a tile and odd for a joint, or the row under. */
export type Pos = { index: number; row: "track" } | { index: number; row: "below" };

/** What sits at each place of the row under the track. */
export type Below = "implementers" | { reviewer: number } | "add" | "depth";

const BUILD = STEPS.indexOf("build") * 2;
const REVIEW = STEPS.indexOf("review") * 2;
const TRACK_END = STEPS.length * 2 - 2;

/** The row under the track, for `reviewers` reviewers. */
export function belowItems(reviewers: number): Array<Below> {
  return [
    "implementers",
    ...Array.from({ length: reviewers }, (_, reviewer) => ({ reviewer })),
    "add",
    "depth",
  ];
}

/** The step a track's place is the tile of, else `undefined` for a joint. */
export const stepAt = (index: number) => (index % 2 === 0 ? index / 2 : undefined);

/** The step after a joint's place. */
export const stepAfterJoint = (index: number) => (index + 1) / 2;

/** A position's key, as its button's `data-pos`. */
export const posKey = (pos: Pos) => `${pos.row}-${pos.index}`;

/** The position a button's `data-pos` names, else `undefined`. */
export function posOf(key: string | undefined): Pos | undefined {
  const match = /^(track|below)-(\d+)$/.exec(key ?? "");
  return match ? { index: Number(match[2]), row: match[1] as Pos["row"] } : undefined;
}

/** `index` kept between 0 and `end`. */
const clamp = (index: number, end: number) => Math.max(0, Math.min(end, index));

/** Whether a track's place is shown: a shown step's tile, or the joint before one, not the first. */
function isShown(index: number, shown: ReadonlyArray<StepId>): boolean {
  const step = stepAt(index) ?? stepAfterJoint(index);
  const at = shown.indexOf(STEPS[step]!);
  return at >= 0 && (stepAt(index) !== undefined || at > 0);
}

/**
 * Where `key` moves the cursor from `pos`, or `pos` itself when it goes nowhere; along a change's
 * track, over the steps it shows only.
 */
export function moved(
  pos: Pos,
  key: string,
  reviewers: number,
  shown: ReadonlyArray<StepId> = STEPS,
): Pos {
  let next = movedOnce(pos, key, reviewers);
  // Over a hidden place, keep going the same way; at the end of the track, stay.
  while (next.row === "track" && !isShown(next.index, shown)) {
    const further = movedOnce(next, key, reviewers);
    if (posKey(further) === posKey(next)) {
      return pos;
    }
    next = further;
  }
  return next;
}

function movedOnce(pos: Pos, key: string, reviewers: number): Pos {
  const below = belowItems(reviewers);
  if (pos.row === "track") {
    switch (key) {
      case "ArrowLeft":
      case "h":
        return { index: clamp(pos.index - 1, TRACK_END), row: "track" };
      case "ArrowRight":
      case "l":
        return { index: clamp(pos.index + 1, TRACK_END), row: "track" };
      case "ArrowDown":
      case "j":
        if (pos.index === BUILD) {
          return { index: 0, row: "below" };
        }
        return pos.index === REVIEW ? { index: 1, row: "below" } : pos;
      default:
        return pos;
    }
  }
  switch (key) {
    case "ArrowLeft":
    case "h":
      return { index: clamp(pos.index - 1, below.length - 1), row: "below" };
    case "ArrowRight":
    case "l":
      return { index: clamp(pos.index + 1, below.length - 1), row: "below" };
    case "ArrowUp":
    case "k":
      return { index: pos.index === 0 ? BUILD : REVIEW, row: "track" };
    default:
      return pos;
  }
}
