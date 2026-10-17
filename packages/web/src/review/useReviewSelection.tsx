import type { ReactNode } from "react";
import type { CommentItem, Document } from "uraeda-binding";
import { AddingNote, FormSlot } from "../ReviewCommentForm.tsx";
import { PendingComment, type usePlacedComments } from "../ReviewComments.tsx";
import { holderOf } from "../reviewField.ts";
import type { Selection } from "../Selection.tsx";
import type { useCommentDraft } from "../useCommentDraft.ts";
import type { useReviewActions } from "../useReviewActions.ts";

/**
 * What a review's blocks show and do: tapping one selects its lines, and under it come its pending
 * comments, the comment being added, and the comment field on wide screens. Also gives the field in
 * the page, and a pending comment's note, which the general comments use too.
 */
export function useReviewSelection({
  actions,
  commentDraft: { draft, last, selection, start, tap },
  container,
  placed,
  tree,
  wide,
}: {
  actions: ReturnType<typeof useReviewActions>;
  commentDraft: ReturnType<typeof useCommentDraft>;
  container: HTMLElement;
  placed: ReturnType<typeof usePlacedComments>;
  tree: Document;
  wide: boolean;
}) {
  const { adding } = actions;
  const addingUnder = adding?.range && holderOf(tree, adding.range.end)?.id;

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
  };
  return { inPage, pendingNote, selection: blocks };
}
