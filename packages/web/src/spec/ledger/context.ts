// What a decision's ledger draws its parts with, and where a part's lines are: a comment on a part
// points to them, and a fold holding a commented or selected part opens.
import type { CommentItem, PartChange } from "uraeda-binding";
import type { DecisionRange, PartSelection } from "../../Selection.tsx";

/** What a section draws its parts with: the card's decision, its section, and the review. */
export type Context = {
  comments: ReadonlyArray<CommentItem>;
  /** Whether unchanged parts show unfolded. */
  full: boolean;
  /** The heading a comment's lines are under: the section's, or the decision's title. */
  heading: string;
  /** Whether the section is the intent, before the first `##`. */
  intent: boolean;
  name: string;
  parts: PartSelection | undefined;
  title: string;
  /** Whether the decision is new or removed whole: its parts take no pill of their own. */
  whole: boolean;
};

/** The lines a part points to: the merge base's for a removed part, the branch's otherwise. */
export function rangeOf(
  name: string,
  heading: string,
  part: PartChange,
): DecisionRange | undefined {
  const removed = part.kind === "removed";
  const lines = removed ? part.before : part.after;
  return lines && { decision: { name, removed }, end: lines.end, heading, start: lines.start };
}

/** Whether a pending comment is on a part: the part holds its last line, on the same side. */
export function holds(comments: ReadonlyArray<CommentItem>, range: DecisionRange | undefined) {
  return comments.some(
    (c) =>
      !!range &&
      c.decision === range.decision.name &&
      c.removed === range.decision.removed &&
      range.start <= c.endLine &&
      c.endLine <= range.end,
  );
}

/** A fold's key in the history entry: its decision, its section, and its kind. */
export function foldKeyOf(context: Context, kind: string) {
  return `decision:${context.name}:${context.heading}:${kind}`;
}
