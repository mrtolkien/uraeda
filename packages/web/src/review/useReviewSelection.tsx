import type { ReactNode } from "react";
import type { CommentItem, Document } from "uraeda-binding";
import { AddingNote, FormSlot } from "../ReviewCommentForm.tsx";
import { PendingComment, type usePlacedComments } from "../ReviewComments.tsx";
import { holderOf } from "../reviewField.ts";
import type { DecisionRange, PartSelection, Selection } from "../Selection.tsx";
import type { Last, Range, useCommentDraft } from "../useCommentDraft.ts";
import type { Adding, useReviewActions } from "../useReviewActions.ts";

/**
 * What a review's blocks show and do: tapping one selects its lines, and under it come its pending
 * comments, the comment being added, and the comment field on wide screens. Also gives the field in
 * the page, and a pending comment's note, which the general comments use too.
 */
export function useReviewSelection({
  actions,
  commentDraft: { draft, last, selection, start, tap, tapPart },
  comments,
  container,
  placed,
  tree,
  wide,
}: {
  actions: ReturnType<typeof useReviewActions>;
  commentDraft: ReturnType<typeof useCommentDraft>;
  comments: ReadonlyArray<CommentItem>;
  container: HTMLElement;
  placed: ReturnType<typeof usePlacedComments>;
  tree: Document;
  wide: boolean;
}) {
  const { adding } = actions;
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
    after: (block) => (
      <>
        {placed.get(block.id)?.map(pendingNote)}
        {adding && addingUnder === block.id && <AddingNote adding={adding} />}
        {inPage(draft?.kind === "lines" && block.id === last)}
      </>
    ),
    isSelected: (block) =>
      selection !== undefined &&
      block.startLine >= selection.start &&
      block.endLine <= selection.end,
    onTap: tap,
    parts: partSelection({
      adding,
      comments,
      draft,
      inPage,
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
 * screens, as under a block of the file.
 */
function partSelection({
  adding,
  comments,
  draft,
  inPage,
  last,
  pendingNote,
  selection,
  tapPart,
}: {
  adding: Adding | undefined;
  comments: ReadonlyArray<CommentItem>;
  draft: ReturnType<typeof useCommentDraft>["draft"];
  inPage: (shown: boolean) => ReactNode;
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
    isSelected: (part) =>
      !!selection &&
      ofPart(part, selection.decision) &&
      part.start >= selection.start &&
      part.end <= selection.end,
    onTap: tapPart,
  };
}
