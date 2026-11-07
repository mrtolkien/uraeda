import type { CommentItem } from "uraeda-binding";

/**
 * Lines of the reviewed file, and the heading above them; or, with `decision`, lines of a decision
 * the reviewed spec changes, `removed` for lines of a part the branch removed, at the merge base.
 */
export type Range = {
  decision?: { name: string; removed: boolean };
  end: number;
  heading: string;
  start: number;
};

/** The decision a review comment's lines are of, as a range names it: none for the reviewed file's. */
export const decisionOf = ({
  decision,
  removed,
}: Pick<CommentItem, "decision" | "removed">): Range["decision"] =>
  decision === undefined ? undefined : { name: decision, removed };

/** Whether two ranges are of the same file: the reviewed file, or the same side of a decision. */
export function sameFile(a: Pick<Range, "decision">, b: Pick<Range, "decision">) {
  return a.decision?.name === b.decision?.name && a.decision?.removed === b.decision?.removed;
}

/**
 * Whether the selection holds lines, as a block's or a decision part's: of the same file, and
 * within its own. A block shows selected then, and a held block's `s` asks about the selection.
 */
export function holds(
  selection: Range | undefined,
  lines: Pick<Range, "decision" | "end" | "start">,
) {
  return (
    selection !== undefined &&
    sameFile(selection, lines) &&
    selection.start <= lines.start &&
    lines.end <= selection.end
  );
}

/** The lines of two ranges of one file and all between, under the heading of the upper one. */
function joined(a: Range, b: Range): Range {
  return {
    ...a,
    end: Math.max(a.end, b.end),
    heading: b.start < a.start ? b.heading : a.heading,
    start: Math.min(a.start, b.start),
  };
}

/**
 * The selection once lines are tapped: the lines added to it, under the heading of the first, or a
 * new one with them when they are of another file than its.
 */
export function merged(selection: Range | undefined, range: Range): Range {
  if (!selection || !sameFile(selection, range)) {
    return range;
  }
  return joined(selection, range);
}

/**
 * The range the keys stretch, from the block they started on, `anchor`, to the one they reached,
 * `head`, in either order: it grows as the head leaves the anchor and shrinks as it comes back. A
 * range never spans two files, so a head in another file than the anchor's is a range of its own.
 */
export function spanned(anchor: Range, head: Range): Range {
  if (!sameFile(anchor, head)) {
    return head;
  }
  return joined(anchor, head);
}
