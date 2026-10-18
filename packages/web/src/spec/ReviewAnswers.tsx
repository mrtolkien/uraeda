// "Your review, answered": each comment of the review that asked for this revision, its quote and
// your words, beside the spec's answer to it, done or declined. The quote and the words come from
// that review as the revision's first commit had it, which the core reads: once a new review
// starts, or the spec is approved, the review file holds other comments, never shown here.
import { Badge } from "@astryxdesign/core/Badge";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { CommentItem } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { Paragraph } from "../layout/Paragraph.tsx";
import { Selectable } from "../Selection.tsx";
import { Spans } from "../Spans.tsx";
import { Panel } from "./Panel.tsx";
import { UnreadItems } from "./UnreadItems.tsx";
import {
  type File,
  GROUPS,
  groupId,
  type PartProps,
  partOf,
  type SpecItems,
  unreadItems,
} from "./parts.ts";

const styles = stylex.create({
  quote: {
    borderInlineStartColor: colorVars["--color-border"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-0-5"],
    paddingInlineStart: spacingVars["--spacing-3"],
  },
  row: {
    // An answer, set apart from the one before by a hairline.
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: spacingVars["--spacing-0-5"],
    display: "grid",
    gap: spacingVars["--spacing-3"],
    paddingBlockStart: spacingVars["--spacing-3"],
  },
  rowWide: {
    // On a wide screen, your comment on the left, its answer on the right.
    columnGap: spacingVars["--spacing-6"],
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  },
});

/** The comments whose quotes the answers show: those of the review the revision answers. */
export function answeredComments(file: File): ReadonlyArray<CommentItem> {
  return file.answered?.comments ?? [];
}

/** Your comment: its number and summary, its quote, and your words, when the file still has them. */
function YourComment({
  comment,
  number,
  summary,
}: {
  comment: CommentItem | undefined;
  number: number;
  summary: string;
}) {
  return (
    <VStack gap={1}>
      <Text color="secondary" type="supporting" weight="semibold">
        C{number} · {summary}
      </Text>
      {comment && comment.quote.length > 0 && (
        <div {...stylex.props(styles.quote)}>
          <Text color="secondary" type="supporting">
            {comment.quote.join(" ")}
          </Text>
        </div>
      )}
      {comment && <Paragraph>{comment.text}</Paragraph>}
    </VStack>
  );
}

/**
 * Each answer of `## Your review`: on the left, your comment with its quote and words, matched by
 * its number; on the right, a "done" or "declined" badge, and the answer as the spec writes it,
 * which takes a comment. The section's other blocks follow.
 */
export function ReviewAnswers({
  comments,
  document,
  items,
  selection,
  wide,
}: Pick<PartProps, "document" | "selection" | "wide"> & {
  /** The comments of the review the answers answer: see `answeredComments`. */
  comments: ReadonlyArray<CommentItem>;
  items: SpecItems;
}) {
  const lists = new Set(items.answers.map((answer) => document.blocks[answer.block]?.parent));
  const unread = unreadItems(
    document,
    items.answers.map((answer) => answer.block),
  );
  const rest = partOf(items, "Your review")?.blocks.filter((id) => !lists.has(id)) ?? [];
  return (
    <Panel crumbs={[]} id={groupId(items, GROUPS.answers)} title={GROUPS.answers.title}>
      {items.answers.map(({ block, number, summary, verdict }) => {
        const item = document.blocks[block];
        return (
          item && (
            <div key={block} {...stylex.props(styles.row, wide && styles.rowWide)}>
              <YourComment
                comment={comments.find((c) => c.number === number)}
                number={number}
                summary={summary}
              />
              <VStack gap={1}>
                <HStack>
                  <Badge label={verdict} variant={verdict === "done" ? "success" : "warning"} />
                </HStack>
                <Selectable block={item} selection={selection}>
                  <Text display="block" type="inherit">
                    <Spans spans={item.spans} />
                  </Text>
                </Selectable>
              </VStack>
            </div>
          )
        );
      })}
      <UnreadItems document={document} ids={unread} selection={selection} />
      {rest.length > 0 && <Blocks document={document} ids={rest} selection={selection} />}
    </Panel>
  );
}
