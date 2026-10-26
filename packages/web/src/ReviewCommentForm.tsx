import { Button } from "@astryxdesign/core/Button";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Document } from "uraeda-binding";
import { CommentForm, quoteOf } from "./CommentForm.tsx";
import type { useFile } from "./data.ts";
import type { Unsaved } from "./fields/unsaved.ts";
import { useTextField } from "./fields/useTextField.ts";
import { CommentNote } from "./ReviewComments.tsx";
import { placeOfLines } from "./reviewField.ts";
import type { Refusals } from "./ReviewVerdict.tsx";
import { selectable } from "./Selection.tsx";
import { plain } from "./Spans.tsx";
import type { Range, useCommentDraft } from "./useCommentDraft.ts";
import type { Adding, useReviewActions } from "./useReviewActions.ts";
import { ReviewImagesContext, useReviewImages } from "./useReviewImages.ts";
import { CommentBox } from "./layout/CommentBox.tsx";

type File = NonNullable<ReturnType<typeof useFile>>;
type Draft = ReturnType<typeof useCommentDraft>;
type Images = ReturnType<typeof useReviewImages>;

/**
 * The comment's field: its key in the unsaved store, its text as saved, and its lines, or, for an
 * edit, where the comment edited points.
 */
export type ReviewField = {
  extra?: Unsaved["extra"];
  key: string;
  saved: string;
  subject?: string;
};

/**
 * Where a comment on lines goes, as the review writes it: `Lines 4–6, under "Rules"`, or, on a
 * decision's lines, `Decision git, lines 15–16 removed, under "Rules"`.
 */
export function anchor(range: Range) {
  const where = placeOfLines(range);
  return `${where[0]!.toUpperCase()}${where.slice(1)}, under "${range.heading}"`;
}

/** A block's text, a row's cells included. */
export function textOf(tree: Document, block: Document["blocks"][number]) {
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
 * Where the comment form shows: the page draws the form once, in `container`, and each place it
 * may show, under a block, in the review's end, or in the phone's sheet, holds a slot that takes
 * the container while drawn. The form never renders with the document, and keeps its state as it
 * moves.
 */
export function FormSlot({ boxed, container }: { boxed: boolean; container: HTMLElement }) {
  const slot = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = slot.current;
    element?.append(container);
    return () => {
      if (container.parentElement === element) {
        container.remove();
      }
    };
  }, [container]);
  const box = <div ref={slot} />;
  return boxed ? <CommentBox>{box}</CommentBox> : box;
}

/**
 * The comment being written, apart from the document: its text, its images, and its form, drawn
 * in `container`. Each keystroke renders it, the form, and what reads its images, like the
 * verdict, through `ReviewImagesContext`; `children`, the page, are not rendered again.
 */
export function CommentHost({
  actions,
  children,
  container,
  draft,
  field,
  file,
  refusals,
  tree,
  wide,
}: {
  actions: ReturnType<typeof useReviewActions>;
  children: ReactNode;
  container: HTMLElement;
  draft: Draft;
  field: ReviewField;
  file: File;
  refusals: Refusals;
  tree: Document;
  wide: boolean;
}) {
  // The form's own field says whether it is drawn: a comment left in the closed sheet is not.
  const text = useTextField(field.key, field.saved, {
    drawn: false,
    extra: field.extra,
    subject: field.subject,
  });
  const images = useReviewImages(file, draft, refusals, wide, text);
  return (
    <ReviewImagesContext value={images}>
      {children}
      {draft.draft &&
        createPortal(
          <ReviewForm actions={actions} draft={draft} field={field} images={images} tree={tree} />,
          container,
        )}
    </ReviewImagesContext>
  );
}

/** The comment field of a review, on the selected lines, the whole file, or a comment edited. */
function ReviewForm({
  actions: { ask, send },
  draft: { close, draft, selection },
  field,
  images,
  tree,
}: {
  actions: ReturnType<typeof useReviewActions>;
  draft: Draft;
  field: ReviewField;
  images: Images;
  tree: Document;
}) {
  if (!draft) {
    return undefined;
  }
  // The selected lines' first block, quoted in the comment field: a decision's lines quote none of
  // the file's blocks.
  const first =
    selection &&
    !selection.decision &&
    tree.blocks
      .filter((b) => selectable(b) && b.startLine >= selection.start && b.endLine <= selection.end)
      .sort((a, b) => a.startLine - b.startLine)[0];
  return (
    <CommentForm
      action={
        ask &&
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
      extra={field.extra}
      field={field.key}
      images={images.images}
      key={field.key}
      notice={images.notice}
      onCancel={close}
      onSubmit={send}
      quote={draft.kind === "lines" && first ? quoteOf(textOf(tree, first)) : undefined}
      saved={field.saved}
      subject={field.subject}
      submitLabel={draft.kind === "edit" ? "Save comment" : "Add comment"}
    />
  );
}

/** A new comment shown where it goes as it is added, marked "saving…" until the file holds it. */
export function AddingNote({ adding }: { adding: Adding }) {
  const where = adding.range ? placeOfLines(adding.range) : "general";
  const name = `${where[0]!.toUpperCase()}${where.slice(1)} · saving…`;
  return <CommentNote label={name} name={name} text={adding.text} />;
}
