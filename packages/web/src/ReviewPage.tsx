import { Code } from "@astryxdesign/core/Code";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useMemo, useState } from "react";
import type { Block, CommentItem, Document } from "uraeda-binding";
import { Blocks } from "./Blocks.tsx";
import { Crumbs } from "./Crumbs.tsx";
import { type Fold, type Folds, foldOf } from "./Folds.tsx";
import type { useFile } from "./data.ts";
import { Page } from "./layout/Page.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { AddingNote, CommentHost, type ReviewField } from "./ReviewCommentForm.tsx";
import { usePlacedComments } from "./ReviewComments.tsx";
import { placeOf, reviewEditKey, reviewKey } from "./reviewField.ts";
import { reviewHeadings } from "./ReviewHeadings.tsx";
import { ReviewMockups } from "./ReviewMockups.tsx";
import { useRefusals } from "./ReviewVerdict.tsx";
import { CommentSheet } from "./review/CommentSheet.tsx";
import { useReviewDraft } from "./review/useReviewDraft.ts";
import { useReviewSelection } from "./review/useReviewSelection.tsx";
import { useStoryComments } from "./review/useStoryComments.ts";
import { StoriesProvider } from "./stories.tsx";
import type { Range, useCommentDraft } from "./useCommentDraft.ts";
import { useSpecFolds } from "./useOpenKeys.ts";
import { useReviewActions } from "./useReviewActions.ts";
import { StaleBanner, YourReview } from "./YourReview.tsx";

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

/**
 * What a review says before its file: that the file changed under pending comments, its mockups,
 * and which version it shows.
 */
function ReviewIntro({
  comments,
  file,
  folds,
  onStartOver,
  wide,
}: {
  comments: number;
  file: File;
  folds: Folds | undefined;
  onStartOver: () => Promise<void>;
  wide: boolean;
}) {
  const version = file.committed ?? file.current;
  return (
    <>
      {file.reviewStale && comments > 0 && (
        <StaleBanner count={comments} kind={file.kind} onStartOver={onStartOver} />
      )}
      <ReviewMockups
        document={version.document}
        folder={file.folder}
        folds={folds}
        mockups={version.items.spec?.mockups}
        stories={version.stories}
        wide={wide}
      />
      <Text color="secondary" type="supporting">
        Tap a block to comment on it. Showing the version committed at <Code>{file.tip}</Code>
        {file.committed && ", which differs from the file on disk"}.
      </Text>
    </>
  );
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
 * A spec or a plan to review, as committed at its branch's tip: tapping blocks selects lines to
 * comment on, pending comments show under their blocks, and the end of the page holds the verdict.
 * The comment field opens under the last tapped block on wide screens, and in a sheet on the phone,
 * the block kept in view above it. The field is drawn apart from the document, by `CommentHost`, so
 * typing renders the field alone; the comment holding unsaved text when the page is drawn opens
 * again.
 */
export function ReviewPage({ file }: { file: File }) {
  const wide = useWidthClass() === "wide";
  const version = file.committed ?? file.current;
  const tree = version.document;
  const review = file.review?.review;
  const comments = useMemo(() => (review?.verdict === "pending" ? review.comments : []), [review]);
  const refusals = useRefusals();
  const commentDraft = useReviewDraft(file, comments, wide, refusals);
  // The comment form's element, which each place it shows takes in turn.
  const [container] = useState(() => document.createElement("div"));
  const { draft, selection, start } = commentDraft;
  const actions = useReviewActions(file, commentDraft, refusals);
  const { adding } = actions;
  const placed = usePlacedComments(comments, tree);
  const folds = useSpecFolds(version.items.spec, shownFolds(tree, placed, selection));
  const field = fieldOf(file, comments, commentDraft);
  const storyComments = useStoryComments(file);
  const {
    inPage,
    pendingNote,
    selection: blocksSelection,
  } = useReviewSelection({
    actions,
    commentDraft,
    container,
    placed,
    tree,
    wide,
  });

  return (
    <CommentHost
      actions={actions}
      container={container}
      draft={commentDraft}
      field={field}
      file={file}
      refusals={refusals}
      tree={tree}
      wide={wide}
    >
      <Page>
        <Crumbs current={file.name} folder={file.folder} />
        <VStack gap={3}>
          <ReviewIntro
            comments={comments.length}
            file={file}
            folds={folds}
            onStartOver={actions.startOver}
            wide={wide}
          />
          <StoriesProvider comment={storyComments} folder={file.folder} stories={version.stories}>
            <Blocks
              document={tree}
              folds={folds}
              override={reviewHeadings(version.items, wide)}
              selection={blocksSelection}
            />
          </StoriesProvider>
          <YourReview
            comments={comments}
            file={file}
            general={
              <>
                {adding && !adding.range && <AddingNote adding={adding} />}
                {inPage(draft?.kind === "general")}
              </>
            }
            onGeneral={() => start({ kind: "general" })}
            pendingNote={pendingNote}
            refusals={refusals}
            wide={wide}
          />
        </VStack>
        {!wide && (
          <CommentSheet
            container={container}
            draft={commentDraft}
            isOpen={draft !== undefined && !adding}
          />
        )}
      </Page>
    </CommentHost>
  );
}
