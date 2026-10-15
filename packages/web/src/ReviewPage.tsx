import { Code } from "@astryxdesign/core/Code";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useLayoutEffect, useMemo, useState } from "react";
import type { Block, CommentItem, Document } from "uraeda-binding";
import { Blocks } from "./Blocks.tsx";
import { Crumbs } from "./Crumbs.tsx";
import { type Fold, foldOf } from "./Folds.tsx";
import type { useFile } from "./data.ts";
import { Overlay } from "./layout/Overlay.tsx";
import { Page } from "./layout/Page.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { AddingNote, CommentHost, FormSlot, type ReviewField } from "./ReviewCommentForm.tsx";
import { PendingComment, usePlacedComments } from "./ReviewComments.tsx";
import type { Selection } from "./Selection.tsx";
import {
  holderOf,
  reanchor,
  placeOf,
  restoredComment,
  reviewEditKey,
  reviewKey,
  writeStale,
} from "./reviewField.ts";
import { reviewHeadings } from "./ReviewHeadings.tsx";
import { ReviewMockups } from "./ReviewMockups.tsx";
import { useRefusals } from "./ReviewVerdict.tsx";
import { useRepositoryPath } from "./routes.tsx";
import { StoriesProvider } from "./stories.tsx";
import { unsavedKey } from "./fields/unsaved.ts";
import { type Range, useCommentDraft } from "./useCommentDraft.ts";
import { useSpecFolds } from "./useOpenKeys.ts";
import { useReviewActions } from "./useReviewActions.ts";
import { withoutCommentRefusal } from "./useReviewImages.ts";
import { StaleBanner, YourReview } from "./YourReview.tsx";

type File = NonNullable<ReturnType<typeof useFile>>;

const styles = stylex.create({
  sheetRoom: {
    // Room at the page's end, so the last block can rise above the comment sheet.
    height: "var(--size-viewport-height)",
  },
});

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
 * The comment being written, as `useCommentDraft` gives it: its lines kept with its unsaved text as
 * they change, the comment whose text the store kept opened again as the page is drawn, written
 * again as a general comment when its lines are of a commit no longer reviewed, and the verdict's
 * refusal for it gone once it closes.
 */
function useReviewDraft(
  file: File,
  comments: ReadonlyArray<CommentItem>,
  wide: boolean,
  { setMessage }: ReturnType<typeof useRefusals>,
) {
  const repo = useRepositoryPath();
  const tree = (file.committed ?? file.current).document;
  const commit = file.tip ?? "";
  const [restored] = useState(() => restoredComment(repo, file.path, commit, comments, tree));
  useLayoutEffect(() => {
    if (restored?.stale) {
      writeStale(restored.stale);
    }
  }, [restored]);
  const key = unsavedKey(repo, reviewKey(file.path));
  const typed = useCommentDraft(
    wide,
    (range) => reanchor(key, range && { ...range, commit }),
    restored,
  );
  return {
    ...typed,
    close: () => {
      setMessage(withoutCommentRefusal);
      typed.close();
    },
  };
}

/**
 * What a review says before its file: that the file changed under pending comments, its mockups,
 * and which version it shows.
 */
function ReviewIntro({
  comments,
  file,
  onStartOver,
  wide,
}: {
  comments: number;
  file: File;
  onStartOver: () => Promise<void>;
  wide: boolean;
}) {
  const version = file.committed ?? file.current;
  return (
    <>
      {file.reviewStale && comments > 0 && (
        <StaleBanner count={comments} kind={file.kind} onStartOver={onStartOver} />
      )}
      <ReviewMockups folder={file.folder} mockups={version.items.spec?.mockups} wide={wide} />
      <Text color="secondary" type="supporting">
        Tap a block to comment on it. Showing the version committed at <Code>{file.tip}</Code>
        {file.committed && ", which differs from the file on disk"}.
      </Text>
    </>
  );
}

/**
 * On the phone, the comment form's sheet, which leaves the last tapped block in view above it, and
 * room at the page's end, so the last block can rise above it.
 */
function CommentSheet({
  container,
  draft: { close, draft, sheet },
  isOpen,
}: {
  container: HTMLElement;
  draft: ReturnType<typeof useCommentDraft>;
  isOpen: boolean;
}) {
  return (
    <>
      {draft && <div {...stylex.props(styles.sheetRoom)} />}
      <Overlay
        isModal={false}
        isOpen={isOpen}
        label="Comment"
        onClose={close}
        sheetHeight="capped"
        sheetRef={sheet}
      >
        <FormSlot boxed={false} container={container} />
      </Overlay>
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
 * What a review's blocks show and do: tapping one selects its lines, and under it come its pending
 * comments, the comment being added, and the comment field on wide screens. Also gives the field in
 * the page, and a pending comment's note, which the general comments use too.
 */
function useReviewSelection({
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
            onStartOver={actions.startOver}
            wide={wide}
          />
          <StoriesProvider folder={file.folder} stories={version.stories}>
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
