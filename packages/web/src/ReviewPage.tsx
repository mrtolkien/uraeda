import { Button } from "@astryxdesign/core/Button";
import { Code } from "@astryxdesign/core/Code";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import {
  borderVars,
  colorVars,
  radiusVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useMemo } from "react";
import type { Block, CommentItem, Document } from "uraeda-binding";
import { Blocks } from "./Blocks.tsx";
import { CommentForm, quoteOf } from "./CommentForm.tsx";
import { Crumbs } from "./Crumbs.tsx";
import { type Fold, foldOf } from "./Folds.tsx";
import { type useFile, useAgent } from "./data.ts";
import { Overlay } from "./layout/Overlay.tsx";
import { Page } from "./layout/Page.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { PendingComment, usePlacedComments } from "./ReviewComments.tsx";
import { reviewHeadings } from "./ReviewHeadings.tsx";
import { ReviewMockups } from "./ReviewMockups.tsx";
import { useRefusals } from "./ReviewVerdict.tsx";
import { selectable } from "./Selection.tsx";
import { plain } from "./Spans.tsx";
import { type Range, useCommentDraft } from "./useCommentDraft.ts";
import { useSpecFolds } from "./useOpenKeys.ts";
import { useReviewActions } from "./useReviewActions.ts";
import { useReviewImages } from "./useReviewImages.ts";
import { StaleBanner, YourReview } from "./YourReview.tsx";

type File = NonNullable<ReturnType<typeof useFile>>;

type Draft = ReturnType<typeof useCommentDraft>;

const styles = stylex.create({
  inline: {
    // The comment field under the block on wide screens.
    borderColor: colorVars["--color-border"],
    borderRadius: radiusVars["--radius-container"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    marginBlockEnd: spacingVars["--spacing-4"],
    padding: spacingVars["--spacing-3"],
  },
  sheetRoom: {
    // Room at the page's end, so the last block can rise above the comment sheet.
    height: "var(--size-viewport-height)",
  },
});

/** Where a comment on lines goes, as the review writes it. */
export function anchor(range: Range) {
  const lines =
    range.start === range.end ? `Line ${range.start}` : `Lines ${range.start}–${range.end}`;
  return `${lines}, under "${range.heading}"`;
}

/** A block's text, a row's cells included. */
export function textOf(tree: Document, block: Block) {
  const own = plain(block.spans);
  if (own || block.kind !== "row") {
    return own;
  }
  return tree.blocks
    .filter((cell) => cell.parent === block.id)
    .map((cell) => plain(cell.spans))
    .join(" | ");
}

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

/** The comment field of a review, on the selected lines, the whole file, or a comment edited. */
function ReviewForm({
  actions: { ask, send },
  draft: { close, draft, selection, setText, text },
  images,
  tree,
}: {
  actions: ReturnType<typeof useReviewActions>;
  draft: Draft;
  images: ReturnType<typeof useReviewImages>;
  tree: Document;
}) {
  const agent = useAgent();
  if (!draft) {
    return undefined;
  }
  // The selected lines' first block, quoted in the comment field.
  const first =
    selection &&
    tree.blocks
      .filter((b) => selectable(b) && b.startLine >= selection.start && b.endLine <= selection.end)
      .sort((a, b) => a.startLine - b.startLine)[0];
  return (
    <CommentForm
      action={
        agent?.available &&
        draft.kind === "lines" &&
        selection && <Button label="Ask the agent" onClick={() => ask(selection)} />
      }
      anchor={
        draft.kind === "lines" && selection
          ? anchor(selection)
          : draft.kind === "edit"
            ? `Editing C${draft.number}`
            : "General"
      }
      images={images.images}
      key={draft.kind === "edit" ? `edit-${draft.number}` : draft.kind}
      notice={images.notice}
      onCancel={close}
      onSubmit={send}
      onTextChange={setText}
      quote={draft.kind === "lines" && first ? quoteOf(textOf(tree, first)) : undefined}
      submitLabel={draft.kind === "edit" ? "Save comment" : "Add comment"}
      text={text}
    />
  );
}

/**
 * A spec, a plan, or an assessment to review, as committed at its branch's tip: tapping blocks
 * selects lines to comment on, pending comments show under their blocks, and the end of the page
 * holds the verdict. The comment field opens under the last tapped block on wide screens, and in
 * a sheet on the phone, the block kept in view above it.
 */
export function ReviewPage({ file }: { file: File }) {
  const wide = useWidthClass() === "wide";
  const version = file.committed ?? file.current;
  const tree = version.document;
  const review = file.review?.review;
  const comments = useMemo(() => (review?.verdict === "pending" ? review.comments : []), [review]);
  const typed = useCommentDraft(wide);
  const refusals = useRefusals();
  const images = useReviewImages(file, typed, refusals, wide);
  // A comment closed takes its images' refusals with it.
  const commentDraft = {
    ...typed,
    close: () => {
      images.onClose();
      typed.close();
    },
  };
  const { close, draft, last, selection, sheet, start, tap } = commentDraft;
  const actions = useReviewActions(file, commentDraft, refusals);
  const placed = usePlacedComments(comments, tree);
  const folds = useSpecFolds(version.items.spec, shownFolds(tree, placed, selection));

  const form = (
    <ReviewForm actions={actions} draft={commentDraft} images={images} tree={tree} />
  );
  /** The comment field, in the page on wide screens: on the phone, it is in the sheet. */
  const inPage = (shown: boolean) =>
    wide && shown && <div {...stylex.props(styles.inline)}>{form}</div>;

  const pendingNote = (comment: CommentItem): ReactNode =>
    draft?.kind === "edit" && draft.number === comment.number && wide ? (
      <div key={comment.number}>{inPage(true)}</div>
    ) : (
      <PendingComment
        comment={comment}
        key={comment.number}
        onEdit={() => {
          images.onEdit();
          start({ kind: "edit", number: comment.number, text: comment.text });
        }}
        onRemove={() => actions.remove(comment.number)}
      />
    );

  return (
    <Page>
      <Crumbs current={file.name} folder={file.folder} />
      <VStack gap={3}>
        {file.reviewStale && comments.length > 0 && (
          <StaleBanner count={comments.length} kind={file.kind} onStartOver={actions.startOver} />
        )}
        <ReviewMockups folder={file.folder} mockups={version.items.spec?.mockups} wide={wide} />
        <Text color="secondary" type="supporting">
          Tap a block to comment on it. Showing the version committed at <Code>{file.tip}</Code>
          {file.committed && ", which differs from the file on disk"}.
        </Text>
        <Blocks
          document={tree}
          folds={folds}
          override={reviewHeadings(version.items, wide)}
          selection={{
            after: (block) => (
              <>
                {placed.get(block.id)?.map(pendingNote)}
                {inPage(draft?.kind === "lines" && block.id === last)}
              </>
            ),
            isSelected: (block) =>
              selection !== undefined &&
              block.startLine >= selection.start &&
              block.endLine <= selection.end,
            onTap: tap,
          }}
        />
        <YourReview
          comments={comments}
          file={file}
          general={inPage(draft?.kind === "general")}
          onGeneral={() => start({ kind: "general" })}
          pendingNote={pendingNote}
          refusals={{ ...refusals, hides: images.hides, hold: images.hold }}
          wide={wide}
        />
      </VStack>
      {!wide && draft && <div {...stylex.props(styles.sheetRoom)} />}
      {!wide && (
        <Overlay
          isModal={false}
          isOpen={draft !== undefined}
          label="Comment"
          onClose={close}
          sheetHeight="capped"
          sheetRef={sheet}
        >
          {form}
        </Overlay>
      )}
    </Page>
  );
}
