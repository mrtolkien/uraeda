import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Code } from "@astryxdesign/core/Code";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
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
import { useFateClient } from "react-fate";
import type { Block, CommentItem, Document } from "uraeda-binding";
import { Blocks, selectable } from "./Blocks.tsx";
import { CommentForm, quoteOf } from "./CommentForm.tsx";
import { Crumbs } from "./Crumbs.tsx";
import { type useFile, useAgent } from "./data.ts";
import { Overlay } from "./layout/Overlay.tsx";
import { Page } from "./layout/Page.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { PendingComment, usePlacedComments, where } from "./ReviewComments.tsx";
import { ReviewVerdict, useRefusals } from "./ReviewVerdict.tsx";
import { askAbout, quoted } from "./sessions.ts";
import { plain } from "./Spans.tsx";
import { type Range, useCommentDraft } from "./useCommentDraft.ts";
import { refusal } from "./errors.ts";
import { FileView } from "./views.ts";
import { Paragraph } from "./layout/Paragraph.tsx";

type File = NonNullable<ReturnType<typeof useFile>>;

const styles = stylex.create({
  // The comment field under the block on wide screens.
  inline: {
    marginBlockEnd: spacingVars["--spacing-4"],
    padding: spacingVars["--spacing-3"],
    borderWidth: borderVars["--border-width"],
    borderStyle: "solid",
    borderColor: colorVars["--color-border"],
    borderRadius: radiusVars["--radius-container"],
  },
  // A story's heading, after a band to the screen's edges on the phone.
  band: {
    height: spacingVars["--spacing-2"],
    marginBlock: spacingVars["--spacing-5"],
    backgroundColor: colorVars["--color-background-muted"],
  },
  bandBleed: {
    marginInline: `calc(-1 * ${spacingVars["--spacing-4"]})`,
  },
  task: {
    marginBlock: spacingVars["--spacing-4"],
  },
  // Room at the page's end, so the last block can rise above the comment sheet.
  sheetRoom: {
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
 * A spec, a plan, or an assessment to review, as committed at its branch's tip: tapping blocks
 * selects lines to comment on, pending comments show under their blocks, and the end of the page
 * holds the verdict. The comment field opens under the last tapped block on wide screens, and in
 * a sheet on the phone, the block kept in view above it.
 */
export function ReviewPage({ file }: { file: File }) {
  const fate = useFateClient();
  const agent = useAgent();
  const wide = useWidthClass() === "wide";
  const version = file.committed ?? file.current;
  const tree = version.document;
  const spec = version.items.spec;
  const tasks = version.items.plan?.tasks ?? [];
  const review = file.review?.review;
  const comments = useMemo(() => (review?.verdict === "pending" ? review.comments : []), [review]);
  const { selection, draft, text, setText, last, sheet, tap, start, close } = useCommentDraft(wide);
  const refusals = useRefusals();
  const { run } = refusals;
  const placed = usePlacedComments(comments, tree);

  const stories = new Map(spec?.stories.map((story) => [story.headingBlock, story]) ?? []);
  const taskHeadings = new Map(tasks.map((task) => [task.headingBlock, task]));

  const send = async (written: string) => {
    if (!draft) {
      return undefined;
    }
    const input = { folder: file.folder, file: file.name };
    const result =
      draft.kind === "edit"
        ? await fate.mutations.review.edit({
            input: { ...input, number: draft.number, text: written },
            view: FileView,
          })
        : await fate.mutations.review.comment({
            input: {
              ...input,
              text: written,
              ...(draft.kind === "lines" && selection
                ? { startLine: selection.start, endLine: selection.end }
                : {}),
            },
            view: FileView,
          });
    if (result.error) {
      return refusal(result.error).message;
    }
    close();
    return undefined;
  };

  /** Opens the feature's session with the selected lines quoted, as they read in the file. */
  const ask = (range: Range) => {
    const lines = version.text.split("\n").slice(range.start - 1, range.end);
    const where =
      range.start === range.end ? `line ${range.start}` : `lines ${range.start}–${range.end}`;
    askAbout(file.folder, quoted(`About ${file.path}, ${where}:`, lines));
  };

  // The selected lines' first block, quoted in the comment field.
  const first =
    selection &&
    tree.blocks
      .filter((b) => selectable(b) && b.startLine >= selection.start && b.endLine <= selection.end)
      .sort((a, b) => a.startLine - b.startLine)[0];
  const form = draft && (
    <CommentForm
      key={draft.kind === "edit" ? `edit-${draft.number}` : draft.kind}
      anchor={
        draft.kind === "lines" && selection
          ? anchor(selection)
          : draft.kind === "edit"
            ? `Editing C${draft.number}`
            : "General"
      }
      quote={draft.kind === "lines" && first ? quoteOf(textOf(tree, first)) : undefined}
      text={text}
      onTextChange={setText}
      submitLabel={draft.kind === "edit" ? "Save comment" : "Add comment"}
      onSubmit={send}
      onCancel={close}
      action={
        agent?.available &&
        draft.kind === "lines" &&
        selection && <Button label="Ask the agent" onClick={() => ask(selection)} />
      }
    />
  );
  /** The comment field, in the page on wide screens: on the phone, it is in the sheet. */
  const inPage = (shown: boolean) =>
    wide && shown && <div {...stylex.props(styles.inline)}>{form}</div>;

  const pendingNote = (comment: CommentItem): ReactNode =>
    draft?.kind === "edit" && draft.number === comment.number && wide ? (
      <div key={comment.number}>{inPage(true)}</div>
    ) : (
      <PendingComment
        key={comment.number}
        comment={comment}
        onEdit={() => start({ kind: "edit", number: comment.number, text: comment.text })}
        onRemove={() =>
          void run(() =>
            fate.mutations.review.remove({
              input: { folder: file.folder, file: file.name, number: comment.number },
              view: FileView,
            }),
          )
        }
      />
    );

  return (
    <Page>
      <Crumbs folder={file.folder} current={file.name} />
      <VStack gap={3}>
        {file.reviewStale && comments.length > 0 && (
          <Banner
            status="warning"
            title={`The ${file.kind} changed since your comments: your ${comments.length} pending ${
              comments.length === 1 ? "comment is" : "comments are"
            } on the previous version. Adding a comment replaces it.`}
            endContent={
              <Button
                label="Start over"
                clickAction={async () => {
                  await run(() =>
                    fate.mutations.review.startOver({
                      input: { folder: file.folder, file: file.name },
                      view: FileView,
                    }),
                  );
                }}
              />
            }
          />
        )}
        <Text type="supporting" color="secondary">
          Tap a block to comment on it. Showing the version committed at <Code>{file.tip}</Code>
          {file.committed && ", which differs from the file on disk"}.
        </Text>
        <Blocks
          document={tree}
          selection={{
            isSelected: (block) =>
              selection !== undefined &&
              block.startLine >= selection.start &&
              block.endLine <= selection.end,
            onTap: tap,
            after: (block) => (
              <>
                {placed.get(block.id)?.map(pendingNote)}
                {inPage(draft?.kind === "lines" && block.id === last)}
              </>
            ),
          }}
          override={(block) => {
            const story = stories.get(block.id);
            if (story) {
              return (
                <div key={block.id} id={block.anchor}>
                  <div {...stylex.props(styles.band, !wide && styles.bandBleed)} />
                  <Text type="supporting" color="secondary" weight="semibold">
                    {story.id} · {story.priority}
                  </Text>
                  <Heading level={3}>{story.title}</Heading>
                </div>
              );
            }
            const task = taskHeadings.get(block.id);
            if (task) {
              return (
                <div key={block.id} id={block.anchor} {...stylex.props(styles.task)}>
                  <Heading level={3}>
                    Task {task.number}: {task.title}{" "}
                    <Badge
                      variant={task.done === task.total ? "success" : "neutral"}
                      label={`${task.done}/${task.total}`}
                    />
                  </Heading>
                </div>
              );
            }
            return undefined;
          }}
        />
        <div {...stylex.props(styles.band, !wide && styles.bandBleed)} />
        <Heading level={2}>Your review</Heading>
        {comments.length === 0 && (
          <Text type="supporting" color="secondary">
            No comment yet.
          </Text>
        )}
        {comments.map((comment) =>
          // A general comment has no block to show under: it is edited and removed here.
          comment.general ? (
            pendingNote(comment)
          ) : (
            <VStack key={comment.number} gap={0}>
              <Text type="supporting" color="secondary">
                {where(comment)}
              </Text>
              <Paragraph>{comment.text}</Paragraph>
            </VStack>
          ),
        )}
        <HStack gap={2}>
          <Button label="Add a general comment" onClick={() => start({ kind: "general" })} />
        </HStack>
        {inPage(draft?.kind === "general")}
        <ReviewVerdict file={file} comments={comments.length} refusals={refusals} />
      </VStack>
      {!wide && draft && <div {...stylex.props(styles.sheetRoom)} />}
      {!wide && (
        <Overlay
          label="Comment"
          isOpen={draft !== undefined}
          onClose={close}
          isModal={false}
          sheetHeight="capped"
          sheetRef={sheet}
        >
          {form}
        </Overlay>
      )}
    </Page>
  );
}
