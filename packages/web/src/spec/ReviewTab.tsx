// The Review tab of the spec's and the plan's column, and the phone's Review sheet: the pending
// comments by their places, a tap bringing each one's block to the top, a general comment, and the
// verdict's buttons, which commit what the page's end set: the summary, the risk tier, and the plan
// review.
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { use } from "react";
import type { CommentItem, Document } from "uraeda-binding";
import { statusStyles } from "../Question.tsx";
import type { Review } from "../review/useReview.tsx";
import { commentId, where } from "../ReviewComments.tsx";
import { holderOf } from "../reviewField.ts";
import { linesMark, sideMark } from "../Selection.tsx";
import { toVerdict, useVerdict, VERDICT_ID, VerdictNotices, Verdicts } from "../ReviewVerdict.tsx";
import { ReviewImagesContext } from "../useReviewImages.ts";
import type { File } from "./parts.ts";
import { useColumnGo } from "./columnGo.ts";

const styles = stylex.create({
  text: {
    // A comment's text wraps: none is cut.
    overflowWrap: "anywhere",
    whiteSpace: "normal",
  },
});

/**
 * The selectable element a comment is under, found by its lines: a block's, the innermost holding
 * its last line, or a decision's part's on its side; none for a general comment.
 */
function holderElement(tree: Document, comment: CommentItem) {
  if (comment.general) {
    return undefined;
  }
  if (comment.decision === undefined) {
    const block = holderOf(tree, comment.endLine);
    return block
      ? document.querySelector<HTMLElement>(
          `[data-lines="${linesMark(block.startLine, block.endLine)}"]`,
        )
      : undefined;
  }
  const side = sideMark({ name: comment.decision, removed: comment.removed });
  return [...document.querySelectorAll<HTMLElement>("[data-lines]")].find((element) => {
    const mark = element.dataset["lines"] ?? "";
    const [start = 0, end = 0] = mark.slice(side.length).split("-").map(Number);
    return mark.startsWith(side) && start <= comment.endLine && comment.endLine <= end;
  });
}

/**
 * Brings a pending comment's block to the middle of the screen, its comment under it, and focuses
 * the block's toggle, its first: a table row's is in its first cell. A comment under no block, a
 * general one, is brought into view alone.
 */
export function jumpToComment(tree: Document, comment: CommentItem) {
  const holder = holderElement(tree, comment);
  const toggle = holder?.querySelector<HTMLElement>("button[aria-pressed]");
  (toggle ? holder : document.getElementById(commentId(comment.number)))?.scrollIntoView?.({
    block: "center",
  });
  toggle?.focus({ preventScroll: true });
}

/**
 * Brings the comment's form, `container`, once drawn, into view, its field focused: a general
 * comment's form is at the page's end, far from the column.
 */
function toField(container: HTMLElement) {
  const field = container.querySelector<HTMLElement>("textarea");
  field?.scrollIntoView?.({ block: "center" });
  field?.focus({ preventScroll: true });
}

/** "N comments, unsent", or what a comment is, before the first. */
function Summary({ count }: { count: number }) {
  if (count === 0) {
    return (
      <Text color="secondary" type="supporting">
        Tap any block of the page to comment on it. Comments gather here, and go with your verdict.
      </Text>
    );
  }
  return (
    <Text weight="semibold">
      {count} {count === 1 ? "comment" : "comments"}, unsent
    </Text>
  );
}

/** The pending comments, each a button named by its place, its text under it. */
function Comments({ comments, tree }: { comments: ReadonlyArray<CommentItem>; tree: Document }) {
  const go = useColumnGo();
  return (
    comments.length > 0 && (
      <List aria-label="Comments" density="compact">
        {comments.map((comment) => (
          <ListItem
            description={<span {...stylex.props(styles.text)}>{comment.text}</span>}
            key={comment.number}
            label={where(comment)}
            onClick={() => go(() => jumpToComment(tree, comment))}
          />
        ))}
      </List>
    )
  );
}

/**
 * The Review tab: the comments, "General comment", what holds the verdict back, its buttons, the
 * review's message, and where the rest of the verdict is.
 */
export function ReviewTab({ file, review }: { file: File; review: Review }) {
  const go = useColumnGo();
  const images = use(ReviewImagesContext);
  const { choices, commentDraft, comments, container, refusals } = review;
  const { retry, verdict } = useVerdict(file, choices, refusals);
  const hold = images?.hold;
  const { error, message } = refusals;
  return (
    <VStack gap={3}>
      <Summary count={comments.length} />
      <Comments comments={comments} tree={review.tree} />
      <Divider />
      <HStack>
        <Button
          label="General comment"
          onClick={() =>
            go(() => {
              commentDraft.start({ kind: "general" });
              requestAnimationFrame(() => toField(container));
            })
          }
        />
      </HStack>
      <VerdictNotices error={error} file={file} retry={retry} />
      <Verdicts
        comments={comments.length}
        file={file}
        onVerdict={async (approve, next) => (hold?.() ? false : verdict(approve, next))}
      />
      {message && !images?.hides?.(message) && (
        <span {...stylex.props(message.ok ? statusStyles.saved : statusStyles.error)}>
          {message.text}
        </span>
      )}
      <Text color="secondary" type="supporting">
        Risk tier, plan review, and your summary are with the verdict at{" "}
        <Link
          hasUnderline
          href={`#${VERDICT_ID}`}
          onClick={(event: React.MouseEvent) => {
            event.preventDefault();
            go(toVerdict);
          }}
        >
          the page&apos;s end
        </Link>
        .
      </Text>
    </VStack>
  );
}
