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
  band: {
    // A story's heading, after a band to the screen's edges on the phone.
    backgroundColor: colorVars["--color-background-muted"],
    height: spacingVars["--spacing-2"],
    marginBlock: spacingVars["--spacing-5"],
  },
  bandBleed: {
    marginInline: `calc(-1 * ${spacingVars["--spacing-4"]})`,
  },
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
  task: {
    marginBlock: spacingVars["--spacing-4"],
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
  const { close, draft, last, selection, setText, sheet, start, tap, text } = useCommentDraft(wide);
  const refusals = useRefusals();
  const { run } = refusals;
  const placed = usePlacedComments(comments, tree);

  const stories = new Map(spec?.stories.map((story) => [story.headingBlock, story]) ?? []);
  const taskHeadings = new Map(tasks.map((task) => [task.headingBlock, task]));

  const send = async (written: string) => {
    if (!draft) {
      return undefined;
    }
    const input = { file: file.name, folder: file.folder };
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
                ? { endLine: selection.end, startLine: selection.start }
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
      key={draft.kind === "edit" ? `edit-${draft.number}` : draft.kind}
      onCancel={close}
      onSubmit={send}
      onTextChange={setText}
      quote={draft.kind === "lines" && first ? quoteOf(textOf(tree, first)) : undefined}
      submitLabel={draft.kind === "edit" ? "Save comment" : "Add comment"}
      text={text}
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
        comment={comment}
        key={comment.number}
        onEdit={() => start({ kind: "edit", number: comment.number, text: comment.text })}
        onRemove={() =>
          void run(() =>
            fate.mutations.review.remove({
              input: { file: file.name, folder: file.folder, number: comment.number },
              view: FileView,
            }),
          )
        }
      />
    );

  return (
    <Page>
      <Crumbs current={file.name} folder={file.folder} />
      <VStack gap={3}>
        {file.reviewStale && comments.length > 0 && (
          <Banner
            endContent={
              <Button
                clickAction={async () => {
                  await run(() =>
                    fate.mutations.review.startOver({
                      input: { file: file.name, folder: file.folder },
                      view: FileView,
                    }),
                  );
                }}
                label="Start over"
              />
            }
            status="warning"
            title={`The ${file.kind} changed since your comments: your ${comments.length} pending ${
              comments.length === 1 ? "comment is" : "comments are"
            } on the previous version. Adding a comment replaces it.`}
          />
        )}
        <Text color="secondary" type="supporting">
          Tap a block to comment on it. Showing the version committed at <Code>{file.tip}</Code>
          {file.committed && ", which differs from the file on disk"}.
        </Text>
        <Blocks
          document={tree}
          override={(block) => {
            const story = stories.get(block.id);
            if (story) {
              return (
                <div id={block.anchor} key={block.id}>
                  <div {...stylex.props(styles.band, !wide && styles.bandBleed)} />
                  <Text color="secondary" type="supporting" weight="semibold">
                    {story.id} · {story.priority}
                  </Text>
                  <Heading level={3}>{story.title}</Heading>
                </div>
              );
            }
            const task = taskHeadings.get(block.id);
            if (task) {
              return (
                <div id={block.anchor} key={block.id} {...stylex.props(styles.task)}>
                  <Heading level={3}>
                    Task {task.number}: {task.title}{" "}
                    <Badge
                      label={`${task.done}/${task.total}`}
                      variant={task.done === task.total ? "success" : "neutral"}
                    />
                  </Heading>
                </div>
              );
            }
            return undefined;
          }}
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
        <div {...stylex.props(styles.band, !wide && styles.bandBleed)} />
        <Heading level={2}>Your review</Heading>
        {comments.length === 0 && (
          <Text color="secondary" type="supporting">
            No comment yet.
          </Text>
        )}
        {comments.map((comment) =>
          // A general comment has no block to show under: it is edited and removed here.
          comment.general ? (
            pendingNote(comment)
          ) : (
            <VStack gap={0} key={comment.number}>
              <Text color="secondary" type="supporting">
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
        <ReviewVerdict comments={comments.length} file={file} refusals={refusals} />
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
