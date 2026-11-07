import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type Ref, type RefObject, useMemo, useRef } from "react";
import type { CommentItem, Document } from "uraeda-binding";
import { useHeldElement } from "./cursor/held.ts";
import { HeldKeys, type StopKey } from "./cursor/StopKeys.tsx";
import { stopProps, stopsOf } from "./cursor/stops.ts";
import { focusStop } from "./cursor/useCursor.ts";
import { pickedStyles } from "./layout/picked.ts";
import { Paragraph } from "./layout/Paragraph.tsx";
import { StatusText } from "./fields/StatusText.tsx";
import { holderOf, placeOf } from "./reviewField.ts";
import { useHolder } from "./Selection.tsx";
import { ruleStyles } from "./layout/rules.ts";

const styles = stylex.create({
  pending: {
    // A pending comment under its block: a bar down its side.
    borderInlineStartColor: colorVars["--color-warning"],
    marginBlockEnd: spacingVars["--spacing-2"],
    marginBlockStart: spacingVars["--spacing-0-5"],
    marginInlineStart: spacingVars["--spacing-6"],
    overflowWrap: "anywhere",
  },
  // A comment the cursor stops on shows it held by its tint and its edge alone, as a pane by its
  // ring: the focus draws no outline of its own over them.
  stop: {
    outlineStyle: "none",
  },
});

/**
 * Where a comment points: `C2 · lines 4–6`, `C3 · general`, or, on lines of a decision's file,
 * `C4 · decision git, lines 15–16`, with ` removed` after a removed part's lines.
 */
export function where(comment: CommentItem) {
  return `C${comment.number} · ${placeOf(comment)}`;
}

/**
 * The comments on lines of the file, by the block each shows under: the smallest tappable block
 * holding its last line. A comment on a decision's lines is not on the file's: it is left out.
 */
export function usePlacedComments(comments: ReadonlyArray<CommentItem>, tree: Document) {
  return useMemo(() => {
    const map = new Map<number, Array<CommentItem>>();
    for (const comment of comments.filter((c) => !c.general && c.decision === undefined)) {
      const holder = holderOf(tree, comment.endLine);
      if (holder) {
        map.set(holder.id, [...(map.get(holder.id) ?? []), comment]);
      }
    }
    return map;
  }, [comments, tree]);
}

/** The element id of a pending comment's note, by its number: where the phone's Review sheet jumps. */
export const commentId = (number: number) => `comment-${number}`;

/** A pending comment, with Edit and Remove, its note's id `commentId`. */
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
    <CommentNote
      id={commentId(comment.number)}
      label={where(comment)}
      name={where(comment)}
      onEdit={onEdit}
      onRemove={onRemove}
      text={comment.text}
    />
  );
}

/** Whether an element shows in the window, wholly or in part. */
function isOnScreen(element: HTMLElement) {
  const { bottom, top } = element.getBoundingClientRect();
  return bottom > 0 && top < window.innerHeight;
}

/**
 * Where the cursor goes when the comment `note` holds is deleted: the stop of what it is under,
 * `holder`, else, for a comment under nothing, as a general one, the stop just before it or just
 * after it, if on screen. `undefined` when none is: the cursor is cleared rather than jump away.
 */
function stopAfterRemoval(note: HTMLElement, holder: HTMLElement | null | undefined) {
  if (holder?.isConnected) {
    return holder;
  }
  const stops = stopsOf();
  const index = stops.indexOf(note);
  return [stops[index - 1], stops[index + 1]].find(
    (stop) => stop !== undefined && isOnScreen(stop),
  );
}

/**
 * A comment's keys while the keyboard's cursor holds it: Enter edits it, and `d` removes it, the
 * cursor going first to the stop of what it is under, so it stays where the comment was rather than
 * leave the page.
 */
function noteKeys(
  note: HTMLElement,
  holder: RefObject<HTMLElement | null> | null,
  onEdit: (() => void) | undefined,
  onRemove: (() => void) | undefined,
): ReadonlyArray<StopKey> {
  const keys: Array<StopKey> = [];
  if (onEdit) {
    keys.push({ bar: "⏎", keys: "Enter", label: "edit", run: onEdit });
  }
  if (onRemove) {
    const remove = () => {
      const next = stopAfterRemoval(note, holder?.current);
      if (next) {
        focusStop(next, note);
      } else {
        note.blur();
      }
      onRemove();
    };
    keys.push({ bar: "d", keys: "d", label: "delete", run: remove });
  }
  return keys;
}

/** What a comment note says and does, but where it sits. */
type NoteProps = {
  error?: string;
  id?: string;
  label: string;
  name: string;
  onEdit?: () => void;
  onRemove?: () => void;
  text: string;
};

/**
 * A comment under what it is on, a bar down its side: `label` above its text, the group named
 * `name`, and Edit and Remove when given, as a pending review comment or a comment on a settled
 * point has. `error` is what refused its removal. With either, it is a stop of the keyboard's
 * cursor, which edits it with Enter and deletes it with `d`, their bar under it; without, as the
 * comment being added, it is drawn alone.
 */
export function CommentNote(props: NoteProps) {
  return props.onEdit || props.onRemove ? <StopNote {...props} /> : <NoteBody {...props} />;
}

/** A comment note the keyboard's cursor stops on, its keys and their bar only while it holds it. */
function StopNote(props: NoteProps) {
  const ref = useRef<HTMLDivElement>(null);
  const held = useHeldElement(ref);
  const holder = useHolder();
  return (
    <>
      <NoteBody {...props} isHeld={held !== null} noteRef={ref} />
      {held && <HeldKeys keys={noteKeys(held, holder, props.onEdit, props.onRemove)} />}
    </>
  );
}

function NoteBody({
  error,
  id,
  isHeld = false,
  label,
  name,
  noteRef,
  onEdit,
  onRemove,
  text,
}: NoteProps & { isHeld?: boolean; noteRef?: Ref<HTMLDivElement> }) {
  return (
    <div
      aria-label={name}
      id={id}
      ref={noteRef}
      role="group"
      {...(onEdit || onRemove ? stopProps("comment") : {})}
      {...stylex.props(
        ruleStyles.bar,
        styles.pending,
        (onEdit || onRemove) && styles.stop,
        isHeld && pickedStyles.picked,
      )}
    >
      <HStack align="center" gap={2} justify="between" wrap="wrap">
        <Text color="secondary" type="supporting">
          {label}
        </Text>
        <HStack gap={1}>
          {onEdit && (
            <Button
              label="Edit"
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation();
                onEdit();
              }}
              size="sm"
              variant="ghost"
            />
          )}
          {onRemove && (
            <Button
              label="Remove"
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation();
                onRemove();
              }}
              size="sm"
              variant="ghost"
            />
          )}
        </HStack>
      </HStack>
      <Paragraph>{text}</Paragraph>
      {error && <StatusText tone="error">{error}</StatusText>}
    </div>
  );
}
