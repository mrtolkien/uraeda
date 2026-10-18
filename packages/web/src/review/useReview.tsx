// A review's machinery, shared by the spec page and the plan's review page: its pending comments,
// the comment being written and its field, the folds its comments open, the selection of blocks,
// the comments on embedded stories, and what the page draws around the file: its intro, its end
// with the general comments and the verdict, and on the phone the comment's sheet.
import { Code } from "@astryxdesign/core/Code";
import { Text } from "@astryxdesign/core/Text";
import { type ReactNode, useMemo, useState } from "react";
import type { Block, CommentItem, Document } from "uraeda-binding";
import type { useFile } from "../data.ts";
import { type Fold, foldOf } from "../Folds.tsx";
import { AddingNote, CommentHost, type ReviewField } from "../ReviewCommentForm.tsx";
import { usePlacedComments } from "../ReviewComments.tsx";
import { placeOf, reviewEditKey, reviewKey } from "../reviewField.ts";
import { useRefusals } from "../ReviewVerdict.tsx";
import type { Range, useCommentDraft } from "../useCommentDraft.ts";
import { useSpecFolds } from "../useOpenKeys.ts";
import { useReviewActions } from "../useReviewActions.ts";
import { StaleBanner, YourReview } from "../YourReview.tsx";
import { CommentSheet } from "./CommentSheet.tsx";
import { useReviewDraft } from "./useReviewDraft.ts";
import { useReviewSelection } from "./useReviewSelection.tsx";
import { useStoryComments } from "./useStoryComments.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

/**
 * The folds a review opens: those holding a pending comment's block, or a block of the selection.
 */
function shownFolds(tree: Document, placed: ReadonlyMap<number, unknown>, selection?: Range) {
  const selected = (block: Block | undefined) =>
    !!block && !!selection && block.startLine <= selection.end && block.endLine >= selection.start;
  return (folds: ReadonlyArray<Fold>) => {
    const holders = new Set([...placed.keys()].map((id) => foldOf(tree, folds, tree.blocks[id])));
    return folds
      .filter((fold) => holders.has(fold) || fold.ids.some((id) => selected(tree.blocks[id])))
      .map((fold) => fold.key);
  };
}

/** The field of the comment being written: an edit of a pending comment, or a new one. */
function fieldOf(
  file: File,
  comments: ReadonlyArray<CommentItem>,
  { draft, selection }: Pick<ReturnType<typeof useCommentDraft>, "draft" | "selection">,
): ReviewField {
  if (draft?.kind === "edit") {
    const comment = comments.find((c) => c.number === draft.number);
    return {
      key: reviewEditKey(file.path, draft.number),
      saved: comment?.text ?? "",
      subject: comment && placeOf(comment),
    };
  }
  const extra =
    draft?.kind === "lines" && selection ? { ...selection, commit: file.tip ?? "" } : undefined;
  return { extra, key: reviewKey(file.path), saved: "" };
}

/**
 * A spec or a plan's review, as committed at its branch's tip: its pending comments, the comment
 * being written, which opens again with its unsaved text, the folds holding a comment or the
 * selection, and the blocks' selection, `selection`, which a tap starts a comment with.
 */
export function useReview(file: File, wide: boolean) {
  const version = file.committed ?? file.current;
  const tree = version.document;
  const review = file.review?.review;
  const comments = useMemo(() => (review?.verdict === "pending" ? review.comments : []), [review]);
  const refusals = useRefusals();
  const commentDraft = useReviewDraft(file, comments, wide, refusals);
  // The comment form's element, which each place it shows takes in turn.
  const [container] = useState(() => document.createElement("div"));
  const actions = useReviewActions(file, commentDraft, refusals);
  const placed = usePlacedComments(comments, tree);
  const folds = useSpecFolds(version.items.spec, shownFolds(tree, placed, commentDraft.selection));
  const field = fieldOf(file, comments, commentDraft);
  const storyComments = useStoryComments(file);
  const blocks = useReviewSelection({
    actions,
    commentDraft,
    comments,
    container,
    placed,
    tree,
    wide,
  });
  return {
    ...blocks,
    actions,
    commentDraft,
    comments,
    container,
    field,
    folds,
    refusals,
    storyComments,
    tree,
    version,
    wide,
  };
}

export type Review = ReturnType<typeof useReview>;

/**
 * The page of a review, around `children`, the file: the comment's field drawn apart from it by
 * `CommentHost`, so typing renders the field alone.
 */
export function ReviewHost({
  children,
  file,
  review,
}: {
  children: ReactNode;
  file: File;
  review: Review;
}) {
  return (
    <CommentHost
      actions={review.actions}
      container={review.container}
      draft={review.commentDraft}
      field={review.field}
      file={file}
      refusals={review.refusals}
      tree={review.tree}
      wide={review.wide}
    >
      {children}
    </CommentHost>
  );
}

/** What a review says before its file: that it changed under pending comments, and its version. */
export function ReviewIntro({ file, review }: { file: File; review: Review }) {
  return (
    <>
      {file.reviewStale && review.comments.length > 0 && (
        <StaleBanner
          count={review.comments.length}
          kind={file.kind}
          onStartOver={review.actions.startOver}
        />
      )}
      <Text color="secondary" type="supporting">
        Tap a block to comment on it. Showing the version committed at <Code>{file.tip}</Code>
        {file.committed && ", which differs from the file on disk"}.
      </Text>
    </>
  );
}

/**
 * The end of a review's page: its comments, a general comment's field, and the verdict unless
 * `hasVerdict` is false; on the phone, the comment's sheet.
 */
export function ReviewEnd({
  file,
  hasVerdict = true,
  review,
}: {
  file: File;
  hasVerdict?: boolean;
  review: Review;
}) {
  const { actions, commentDraft, comments, container, inPage, pendingNote, refusals, wide } =
    review;
  const { adding } = actions;
  const { draft, start } = commentDraft;
  return (
    <>
      <YourReview
        comments={comments}
        file={file}
        general={
          <>
            {adding && !adding.range && <AddingNote adding={adding} />}
            {inPage(draft?.kind === "general")}
          </>
        }
        hasVerdict={hasVerdict}
        onGeneral={() => start({ kind: "general" })}
        pendingNote={pendingNote}
        refusals={refusals}
        wide={wide}
      />
      {!wide && (
        <CommentSheet
          container={container}
          draft={commentDraft}
          isOpen={draft !== undefined && !adding}
        />
      )}
    </>
  );
}
