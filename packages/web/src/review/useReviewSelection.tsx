import type { ReactNode } from "react";
import type { CommentItem, DecisionChange, Document } from "uraeda-binding";
import { AddingNote, FormSlot } from "../ReviewCommentForm.tsx";
import { PendingComment, type usePlacedComments } from "../ReviewComments.tsx";
import { holderOf } from "../reviewField.ts";
import type { DecisionRange, PartSelection, Selection } from "../Selection.tsx";
import { holds, type Range } from "../commentRange.ts";
import type { Last, useCommentDraft } from "../useCommentDraft.ts";
import type { Adding, useReviewActions } from "../useReviewActions.ts";
import { blockKeys, useKeyRange } from "./useKeyRange.ts";

/**
 * What a review's blocks show and do: tapping one selects its lines, and under it come its pending
 * comments, the comment being added, and the comment field on wide screens. Also gives the field in
 * the page, and a pending comment's note, which the general comments use too. Held by the
 * keyboard's cursor, a block or a decision's part has the keys of `blockKeys`, its range stretched
 * among the blocks of its file, the reviewed one's or its decision's side.
 */
export function useReviewSelection({
  actions,
  changes,
  commentDraft,
  comments,
  container,
  placed,
  tree,
  wide,
}: {
  actions: ReturnType<typeof useReviewActions>;
  changes: ReadonlyArray<DecisionChange>;
  commentDraft: ReturnType<typeof useCommentDraft>;
  comments: ReadonlyArray<CommentItem>;
  container: HTMLElement;
  placed: ReturnType<typeof usePlacedComments>;
  tree: Document;
  wide: boolean;
}) {
  const { draft, last, selection, start, tap, tapPart } = commentDraft;
  const { adding } = actions;
  const keyRange = useKeyRange(commentDraft, tree, changes);
  const addingUnder =
    adding?.range && !adding.range.decision && holderOf(tree, adding.range.end)?.id;

  /** The comment field, in the page on wide screens: on the phone, it is in the sheet. */
  const inPage = (shown: boolean) =>
    wide && shown && !adding && <FormSlot boxed container={container} />;

  const pendingNote = (comment: CommentItem): ReactNode =>
    draft?.kind === "edit" && draft.number === comment.number && wide ? (
      <div key={comment.number}>{inPage(true)}</div>
    ) : (
      <PendingComment
        comment={comment}
        key={comment.number}
        onEdit={() => start({ kind: "edit", number: comment.number })}
        onRemove={() => void actions.remove(comment.number)}
      />
    );

  const blocks: Selection = {
    // Nothing when nothing follows the block: a table row then has no row of its own after it.
    after: (block) => {
      const notes = placed.get(block.id) ?? [];
      const isAdding = adding !== undefined && addingUnder === block.id;
      const form = inPage(draft?.kind === "lines" && block.id === last);
      if (notes.length === 0 && !isAdding && !form) {
        return null;
      }
      return (
        <>
          {notes.map(pendingNote)}
          {isAdding && <AddingNote adding={adding} />}
          {form}
        </>
      );
    },
    isSelected: (block) => holds(selection, { end: block.endLine, start: block.startLine }),
    keys: (block, toggle) =>
      blockKeys(
        keyRange,
        toggle,
        { end: block.endLine, heading: block.heading ?? "", start: block.startLine },
        actions.ask,
      ),
    onTap: tap,
    parts: partSelection({
      adding,
      comments,
      draft,
      inPage,
      keys: (part, toggle) => blockKeys(keyRange, toggle, part, actions.ask),
      last,
      pendingNote,
      selection,
      tapPart,
    }),
  };

  return { inPage, pendingNote, selection: blocks };
}

/** Whether lines are of the same side of the same decision as a part's. */
function ofPart(part: DecisionRange, decision: Range["decision"]) {
  return decision?.name === part.decision.name && decision.removed === part.decision.removed;
}

/** Whether a line of a decision's side falls within a part's lines. */
function inPart(part: DecisionRange, decision: Range["decision"], line: number) {
  return ofPart(part, decision) && part.start <= line && line <= part.end;
}

/**
 * How a review selects a decision's parts: tapping one selects its lines, and under it come the
 * pending comments whose last line it holds, the comment being added, and the comment field on wide
 * screens, as under a block of the file; held by the keyboard's cursor, it has `keys`.
 */
function partSelection({
  adding,
  comments,
  draft,
  inPage,
  keys,
  last,
  pendingNote,
  selection,
  tapPart,
}: {
  adding: Adding | undefined;
  comments: ReadonlyArray<CommentItem>;
  draft: ReturnType<typeof useCommentDraft>["draft"];
  inPage: (shown: boolean) => ReactNode;
  keys: PartSelection["keys"];
  last: Last | undefined;
  pendingNote: (comment: CommentItem) => ReactNode;
  selection: Range | undefined;
  tapPart: ReturnType<typeof useCommentDraft>["tapPart"];
}): PartSelection {
  return {
    after: (part) => {
      const placed = comments.filter(
        (c) =>
          c.decision !== undefined &&
          inPart(part, { name: c.decision, removed: c.removed }, c.endLine),
      );
      const isLast =
        typeof last === "object" &&
        inPart(part, { name: last.decision, removed: last.removed }, last.line);
      return (
        <>
          {placed.map(pendingNote)}
          {adding?.range && inPart(part, adding.range.decision, adding.range.end) && (
            <AddingNote adding={adding} />
          )}
          {inPage(draft?.kind === "lines" && isLast)}
        </>
      );
    },
    isSelected: (part) => holds(selection, part),
    keys,
    onTap: tapPart,
  };
}
