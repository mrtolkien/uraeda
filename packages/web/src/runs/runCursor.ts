// Where the run map's cursor is, and where its keys move it: along the track, a step's tile or the
// joint after it, by ← → (h l); down from Build to its implementers and from Review to its reviewers
// by ↓ (j), and back up by ↑ (k). The row under the track holds the implementers, each reviewer,
// the reviewer to add, and where reviews happen, in that order. A change's start runs one step, its
// fix: its map is that step and, under it, its reviewers and the one to add.
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

/** The one step a change's start shows: its fix, the Build. */
export const CHANGE_STEPS: ReadonlyArray<StepId> = ["build"];

/**
 * The places of the row under the track the cursor goes over, from `first` to `last`: all of them,
 * or for a change's start (`isChange`) its reviewers and the one to add alone.
 */
export function belowSpan(reviewers: number, isChange = false): { first: number; last: number } {
  const end = belowItems(reviewers).length - 1;
  return isChange ? { first: 1, last: end - 1 } : { first: 0, last: end };
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

/** `index` kept between `start` and `end`. */
const clamp = (index: number, end: number, start = 0) => Math.max(start, Math.min(end, index));

/** Whether a track's place is shown: a shown step's tile, or the joint before one, not the first. */
function isShown(index: number, shown: ReadonlyArray<StepId>): boolean {
  const step = stepAt(index) ?? stepAfterJoint(index);
  const at = shown.indexOf(STEPS[step]!);
  return at >= 0 && (stepAt(index) !== undefined || at > 0);
}

/**
 * Where `key` moves the cursor from `pos`, or `pos` itself when it goes nowhere; along a change's
 * track, over the steps it shows only, and at a change's start (`isChange`), between its fix and
 * the reviewers under it.
 */
export function moved(
  pos: Pos,
  key: string,
  reviewers: number,
  shown: ReadonlyArray<StepId> = STEPS,
  isChange = false,
): Pos {
  let next = movedOnce(pos, key, reviewers, isChange);
  // Over a hidden place, keep going the same way; at the end of the track, stay.
  while (next.row === "track" && !isShown(next.index, shown)) {
    const further = movedOnce(next, key, reviewers, isChange);
    if (posKey(further) === posKey(next)) {
      return pos;
    }
    next = further;
  }
  return next;
}

function movedOnce(pos: Pos, key: string, reviewers: number, isChange: boolean): Pos {
  const { first, last } = belowSpan(reviewers, isChange);
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
          return { index: first, row: "below" };
        }
        return pos.index === REVIEW ? { index: 1, row: "below" } : pos;
      default:
        return pos;
    }
  }
  // At a change's start the reviewers stand in a column under the fix: ↓ and ↑ go along them too.
  const isBack = isChange && (key === "ArrowUp" || key === "k") && pos.index > first;
  const isOn = isChange && (key === "ArrowDown" || key === "j");
  switch (isBack ? "ArrowLeft" : isOn ? "ArrowRight" : key) {
    case "ArrowLeft":
    case "h":
      return { index: clamp(pos.index - 1, last, first), row: "below" };
    case "ArrowRight":
    case "l":
      return { index: clamp(pos.index + 1, last, first), row: "below" };
    case "ArrowUp":
    case "k":
      return { index: isChange || pos.index === 0 ? BUILD : REVIEW, row: "track" };
    default:
      return pos;
  }
}
