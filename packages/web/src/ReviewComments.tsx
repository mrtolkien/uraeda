import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useMemo } from "react";
import type { CommentItem, Document } from "uraeda-binding";
import { selectable } from "./Selection.tsx";
import { Paragraph } from "./layout/Paragraph.tsx";

const styles = stylex.create({
  pending: {
    // A pending comment under its block: a bar down its side.
    borderInlineStartColor: colorVars["--color-warning"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-1"],
    marginBlockEnd: spacingVars["--spacing-2"],
    marginBlockStart: spacingVars["--spacing-0-5"],
    marginInlineStart: spacingVars["--spacing-6"],
    overflowWrap: "anywhere",
    paddingInlineStart: spacingVars["--spacing-3"],
  },
});

/** Where a comment points: `C2 · lines 4–6`, or `C3 · general`. */
export function where(comment: CommentItem) {
  if (comment.general) {
    return `C${comment.number} · general`;
  }
  return comment.startLine === comment.endLine
    ? `C${comment.number} · line ${comment.startLine}`
    : `C${comment.number} · lines ${comment.startLine}–${comment.endLine}`;
}

/** The comments on lines, by the block each shows under: the smallest tappable block holding its last line. */
export function usePlacedComments(comments: ReadonlyArray<CommentItem>, tree: Document) {
  return useMemo(() => {
    const map = new Map<number, Array<CommentItem>>();
    for (const comment of comments.filter((c) => !c.general)) {
      const holder = tree.blocks
        .filter(
          (b) => selectable(b) && b.startLine <= comment.endLine && comment.endLine <= b.endLine,
        )
        .sort((a, b) => a.endLine - a.startLine - (b.endLine - b.startLine))[0];
      if (holder) {
        map.set(holder.id, [...(map.get(holder.id) ?? []), comment]);
      }
    }
    return map;
  }, [comments, tree]);
}

/** A pending comment, with Edit and Remove. */
export function PendingComment({
  comment,
  onEdit,
  onRemove,
}: {
  comment: CommentItem;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div aria-label={where(comment)} role="group" {...stylex.props(styles.pending)}>
      <HStack align="center" gap={2} justify="between" wrap="wrap">
        <Text color="secondary" type="supporting">
          {where(comment)}
        </Text>
        <HStack gap={1}>
          <Button
            label="Edit"
            onClick={(event: React.MouseEvent) => {
              event.stopPropagation();
              onEdit();
            }}
            size="sm"
            variant="ghost"
          />
          <Button
            label="Remove"
            onClick={(event: React.MouseEvent) => {
              event.stopPropagation();
              onRemove();
            }}
            size="sm"
            variant="ghost"
          />
        </HStack>
      </HStack>
      <Paragraph>{comment.text}</Paragraph>
    </div>
  );
}
