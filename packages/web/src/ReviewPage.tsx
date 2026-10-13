import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Code } from "@astryxdesign/core/Code";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import {
  borderVars,
  colorVars,
  radiusVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import type { Block, CommentItem, Document } from "uraeda-binding";
import { Blocks, selectable } from "./Blocks.tsx";
import { CommitActions } from "./CommitActions.tsx";
import { CommentForm, quoteOf } from "./CommentForm.tsx";
import { Crumbs } from "./Crumbs.tsx";
import { type useFile, useAgent } from "./data.ts";
import { type Refusal, refusal } from "./errors.ts";
import { Overlay } from "./layout/Overlay.tsx";
import { Page } from "./layout/Page.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { GrowingTextArea, statusStyles } from "./Question.tsx";
import { HookRefusal } from "./RoundPage.tsx";
import { askAbout, handOver, quoted } from "./sessions.ts";
import { plain } from "./Spans.tsx";
import { FileView } from "./views.ts";
import { Paragraph } from "./layout/Paragraph.tsx";

type File = NonNullable<ReturnType<typeof useFile>>;

/** Lines of the reviewed file, and the heading above them. */
type Range = { start: number; end: number; heading: string };

/** The comment being written: on the selected lines, on the whole file, or an edit of one. */
type Draft = { kind: "lines" } | { kind: "general" } | { kind: "edit"; number: number };

const styles = stylex.create({
  // A pending comment under its block: a bar down its side.
  pending: {
    marginBlockStart: spacingVars["--spacing-0-5"],
    marginBlockEnd: spacingVars["--spacing-2"],
    marginInlineStart: spacingVars["--spacing-6"],
    paddingInlineStart: spacingVars["--spacing-3"],
    borderInlineStartWidth: spacingVars["--spacing-1"],
    borderInlineStartStyle: "solid",
    borderInlineStartColor: colorVars["--color-warning"],
    overflowWrap: "anywhere",
  },
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

function where(comment: CommentItem) {
  if (comment.general) {
    return `C${comment.number} · general`;
  }
  return comment.startLine === comment.endLine
    ? `C${comment.number} · line ${comment.startLine}`
    : `C${comment.number} · lines ${comment.startLine}–${comment.endLine}`;
}

/** Where a comment on lines goes, as the review writes it. */
export function anchor(range: Range) {
  const lines =
    range.start === range.end ? `Line ${range.start}` : `Lines ${range.start}–${range.end}`;
  return `${lines}, under "${range.heading}"`;
}

/** A block's text, a row's cells included. */
export function textOf(document: Document, block: Block) {
  const own = plain(block.spans);
  if (own || block.kind !== "row") {
    return own;
  }
  return document.blocks
    .filter((cell) => cell.parent === block.id)
    .map((cell) => plain(cell.spans))
    .join(" | ");
}

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/**
 * The top of the comment sheet once it has stopped moving, or after 5 seconds on a device too
 * slow to tell: the sheet slides in with a transition, which a read of its style starts.
 */
async function restingTop(sheet: RefObject<HTMLElement | null>) {
  const deadline = performance.now() + 5000;
  while (!sheet.current && performance.now() < deadline) {
    await frame();
  }
  const element = sheet.current;
  if (!element) {
    return undefined;
  }
  void getComputedStyle(element).transform;
  const moving = (document.getAnimations?.() ?? [])
    .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
    .map((animation) => animation.finished.catch(() => undefined));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise(
    (resolve) => (timer = setTimeout(resolve, deadline - performance.now())),
  );
  await Promise.race([Promise.all(moving), late]);
  clearTimeout(timer);
  return element.getBoundingClientRect().top;
}

/**
 * Brings a selected block into the space between the top bar and the comment sheet, once the sheet
 * has stopped moving: its bottom just above the sheet, or its top under the bar when it is taller
 * than that space.
 */
async function placeAboveSheet(element: HTMLElement, sheet: RefObject<HTMLElement | null>) {
  const top = await restingTop(sheet);
  if (top === undefined || !element.isConnected) {
    return;
  }
  const bar = document.querySelector('[role="banner"]')?.getBoundingClientRect().bottom ?? 0;
  const box = element.getBoundingClientRect();
  const by = box.height > top - bar ? box.top - bar : box.bottom - top;
  window.scrollBy({ top: by, behavior: reducedMotion() ? "auto" : "smooth" });
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
  const document = version.document;
  const isSpec = file.kind === "spec";
  const spec = version.items.spec;
  const tasks = version.items.plan?.tasks ?? [];
  const review = file.review?.review;
  const comments = useMemo(() => (review?.verdict === "pending" ? review.comments : []), [review]);
  const [selection, setSelection] = useState<Range>();
  const [draft, setDraft] = useState<Draft>();
  // The comment's text, kept here: the field moves under each tapped block on wide screens.
  const [text, setText] = useState("");
  const [last, setLast] = useState<number>();
  const lastElement = useRef<HTMLElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState("");
  const [tier, setTier] = useState(spec?.riskTier ?? spec?.tiers[0]?.value ?? "");
  const [planReview, setPlanReview] = useState<boolean>();
  const [error, setError] = useState<Refusal>();
  const [message, setMessage] = useState<{ text: string; ok: boolean }>();
  // The verdict last committed to start the agent, for its Try again.
  const continues = useRef<"approval" | "changes">(undefined);

  // Each comment shows under the smallest tappable block holding its last line.
  const placed = useMemo(() => {
    const map = new Map<number, Array<CommentItem>>();
    for (const comment of comments.filter((c) => !c.general)) {
      const holder = document.blocks
        .filter(
          (b) => selectable(b) && b.startLine <= comment.endLine && comment.endLine <= b.endLine,
        )
        .sort((a, b) => a.endLine - a.startLine - (b.endLine - b.startLine))[0];
      if (holder) {
        map.set(holder.id, [...(map.get(holder.id) ?? []), comment]);
      }
    }
    return map;
  }, [comments, document]);

  // On the phone, the last tapped block goes above the sheet, as it opens and at each tap.
  useEffect(() => {
    const element = lastElement.current;
    if (wide || draft?.kind !== "lines" || !element) {
      return;
    }
    void placeAboveSheet(element, sheet);
  }, [wide, draft?.kind, selection]);

  const stories = new Map(spec?.stories.map((story) => [story.headingBlock, story]) ?? []);
  const taskHeadings = new Map(tasks.map((task) => [task.headingBlock, task]));

  const run = async (call: () => Promise<{ error?: unknown }>) => {
    setError(undefined);
    setMessage(undefined);
    const result = await call();
    if (result.error) {
      const failed = refusal(result.error);
      if (failed.kind === "hook") {
        setError(failed);
      } else {
        setMessage({ text: failed.message, ok: false });
      }
      return false;
    }
    return true;
  };

  const tap = (block: Block, element: HTMLElement) => {
    const next = selection
      ? {
          start: Math.min(selection.start, block.startLine),
          end: Math.max(selection.end, block.endLine),
          heading: block.startLine < selection.start ? (block.heading ?? "") : selection.heading,
        }
      : { start: block.startLine, end: block.endLine, heading: block.heading ?? "" };
    setSelection(next);
    setLast(block.id);
    lastElement.current = element;
    if (draft?.kind !== "lines") {
      setDraft({ kind: "lines" });
    }
  };

  const close = () => {
    setDraft(undefined);
    setText("");
    setSelection(undefined);
    setLast(undefined);
    lastElement.current = null;
  };

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

  /** Hands the feature over to the agent, once the verdict is committed. */
  const proceed = (trigger: "approval" | "changes") => handOver(file.folder, trigger, file.name);

  const verdict = async (approve: boolean, next: boolean) => {
    const input = { folder: file.folder, file: file.name, summary: summary || undefined };
    const trigger = approve ? "approval" : "changes";
    continues.current = next ? trigger : undefined;
    const done = await run(() =>
      approve
        ? fate.mutations.review.approve({
            input: {
              ...input,
              ...(isSpec && tier !== spec?.riskTier ? { tier } : {}),
              ...(isSpec && planReview !== undefined ? { planReview } : {}),
            },
            view: FileView,
          })
        : fate.mutations.review.requestChanges({ input, view: FileView }),
    );
    if (done && next) {
      proceed(trigger);
    }
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
    document.blocks
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
      quote={draft.kind === "lines" && first ? quoteOf(textOf(document, first)) : undefined}
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
      <div
        key={comment.number}
        role="group"
        aria-label={where(comment)}
        {...stylex.props(styles.pending)}
      >
        <HStack justify="between" align="center" gap={2} wrap="wrap">
          <Text type="supporting" color="secondary">
            {where(comment)}
          </Text>
          <HStack gap={1}>
            <Button
              variant="ghost"
              size="sm"
              label="Edit"
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation();
                setSelection(undefined);
                setLast(undefined);
                setDraft({ kind: "edit", number: comment.number });
                setText(comment.text);
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              label="Remove"
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation();
                void run(() =>
                  fate.mutations.review.remove({
                    input: { folder: file.folder, file: file.name, number: comment.number },
                    view: FileView,
                  }),
                );
              }}
            />
          </HStack>
        </HStack>
        <Paragraph>{comment.text}</Paragraph>
      </div>
    );

  // The plan review the core gives the tier picked, unless the human set it.
  const plannedReview =
    planReview ?? spec?.tiers.find((choice) => choice.value === tier)?.planReview ?? false;

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
          document={document}
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
          <Button
            label="Add a general comment"
            onClick={() => {
              setSelection(undefined);
              setLast(undefined);
              setDraft({ kind: "general" });
            }}
          />
        </HStack>
        {inPage(draft?.kind === "general")}
        <GrowingTextArea
          label="Summary"
          value={summary}
          onChange={setSummary}
          placeholder="Optional"
        />
        {isSpec && (
          <>
            <SegmentedControl
              label="Risk tier"
              value={tier}
              onChange={(value: string) => setTier(value)}
            >
              {spec?.tiers.map((choice) => (
                <SegmentedControlItem
                  key={choice.value}
                  value={choice.value}
                  label={choice.value}
                />
              ))}
            </SegmentedControl>
            <Switch
              label="The plan waits for your review"
              value={plannedReview}
              onChange={(checked: boolean) => setPlanReview(checked)}
            />
          </>
        )}
        {error && (
          <HookRefusal
            error={error}
            what="Your review is saved, not committed."
            onRetry={async () => {
              const done = await run(() =>
                fate.mutations.commit.retry({
                  input: { folder: file.folder, file: file.name },
                  view: FileView,
                }),
              );
              if (done && continues.current) {
                proceed(continues.current);
              }
            }}
          />
        )}

        {file.committed && (
          <span {...stylex.props(statusStyles.error)}>
            {file.name} has changes not committed: the review is of the committed version. Commit or
            discard them first.
          </span>
        )}
        <CommitActions
          label="Request changes"
          variant="destructive"
          continueLabel="Request changes and start the agent"
          onlyLabel="Request changes only"
          isDisabled={comments.length === 0 || file.committed != null}
          tooltip={comments.length === 0 ? "Add a comment first" : undefined}
          onCommit={(next) => verdict(false, next)}
        />
        <CommitActions
          label="Approve"
          continueLabel="Approve and start the agent"
          onlyLabel="Approve only"
          isDisabled={file.committed != null}
          onCommit={(next) => verdict(true, next)}
        />
        {message && (
          <span {...stylex.props(message.ok ? statusStyles.saved : statusStyles.error)}>
            {message.text}
          </span>
        )}
        {comments.length === 0 && (
          <Text type="supporting" color="secondary">
            Request changes: Add a comment first
          </Text>
        )}
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
