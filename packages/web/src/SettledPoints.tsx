import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useRef, useState } from "react";
import type { Block, Document, SettledGroup, SettledPoint } from "uraeda-binding";
import { topBlock } from "./Folds.tsx";
import { Blocks } from "./Blocks.tsx";
import { isKeyInput } from "./cursor/held.ts";
import type { StopKey } from "./cursor/StopKeys.tsx";
import type { useFile } from "./data.ts";
import { Overlay } from "./layout/Overlay.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { useRepositoryPath } from "./routes.tsx";
import {
  AnsweredNotices,
  afterRemoval,
  type Open,
  restoredForm,
  SettledForm,
  SettledNote,
} from "./SettledForm.tsx";
import { type SettledPart, SettledGroups } from "./SettledGroups.tsx";
import { useSettledWrites } from "./settledWrites.ts";
import { CommentBox } from "./layout/CommentBox.tsx";

type File = NonNullable<ReturnType<typeof useFile>>;

const styles = stylex.create({
  // A box only to find the form's field in: the form is laid out by what holds it.
  contents: { display: "contents" },
});

/**
 * The comment form open on some of a round's settled points, `points`, `shown` while the round
 * awaits the human, and the writes it makes: the one holding unsaved text when the page is drawn
 * opens again, and a write done or a removal closes or follows it. `open` opens a form the human
 * asked for, its field focused as it is drawn when `takesFocus` says so; `focus` gives the focus
 * back to the field of the form open.
 */
function useSettledForm(
  file: File,
  readOnly: boolean,
  points: ReadonlyArray<SettledPoint>,
  onAsk?: (subject: string, text: string) => Promise<string | undefined>,
) {
  const repo = useRepositoryPath();
  const round = file.current.items.clarifications;
  const [open, setOpen] = useState<Open | undefined>(() =>
    readOnly ? undefined : restoredForm(repo, file.path, points, round?.settledComments ?? []),
  );
  // Whether the form's field takes the focus as it is drawn: not the one restored with the page,
  // nor an edit renumbered by a removal, which the human did not open.
  const [hasFocus, setHasFocus] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const close = () => {
    setOpen(undefined);
    setHasFocus(false);
  };
  const writes = useSettledWrites(file, close, (number) => {
    setOpen(afterRemoval(number));
    setHasFocus(false);
  });
  const shown = readOnly ? undefined : open;
  const form = shown && (
    <div ref={box} {...stylex.props(styles.contents)}>
      <SettledForm
        hasAutoFocus={hasFocus}
        onClose={close}
        {...(onAsk ? { onAsk } : {})}
        path={file.path}
        shown={shown}
        writes={writes}
      />
    </div>
  );
  const openForm = (next: Open, takesFocus: boolean) => {
    setOpen(next);
    setHasFocus(takesFocus);
  };
  const focus = () => box.current?.querySelector<HTMLElement>('[role="textbox"]')?.focus();
  return { close, focus, form, open: openForm, shown, writes };
}

/** The group a point lies in, if any. */
function groupOf(document: Document, groups: ReadonlyArray<SettledGroup>, point: SettledPoint) {
  const top = topBlock(document, document.blocks[point.block])?.id;
  return top === undefined ? undefined : groups.find((group) => group.blocks.includes(top));
}

/**
 * A part of a round's settled points, every group without one: its groups, and its points among
 * all the round's, with the round's comments.
 */
function partOf(file: File, part: SettledPart | undefined) {
  const round = file.current.items.clarifications;
  const groups = (round?.settledGroups ?? []).filter(
    (g) => part === undefined || (g.kind === "check") === (part === "check"),
  );
  const all = round?.settledPoints ?? [];
  const points = all.filter((p) => groupOf(file.current.document, groups, p) !== undefined);
  return { all, comments: round?.settledComments ?? [], groups, points };
}

/**
 * A settled point's keys while the keyboard's cursor holds its block: Enter, or `i`, comments on it,
 * as a tap does, and `s` asks the agent about it, with `onAskAbout`.
 */
function pointKeys(
  block: Block,
  onTap: (block: Block) => void,
  point: SettledPoint | undefined,
  onAskAbout: ((subject: string) => void) | undefined,
): ReadonlyArray<StopKey> {
  const comment: ReadonlyArray<StopKey> = [
    { bar: "⏎", keys: "Enter", label: "comment", run: () => onTap(block) },
    { keys: "i", label: "comment", run: () => onTap(block) },
  ];
  return point && onAskAbout
    ? [...comment, { bar: "s", keys: "s", label: "ask", run: () => onAskAbout(point.subject) }]
    : comment;
}

/**
 * The points a round settled without the human, in their groups, with their comments under them.
 * While the round awaits the human, a point that starts in bold is tapped to comment on it, in a
 * form under it on wide screens and in a sheet on the phone, and its comments have Edit and
 * Remove. A form the human opens, on a wide screen or by a key, takes the focus in its field; a tap
 * or a key on the point whose form is open gives its field the focus back. Each form's text is kept
 * in the unsaved store; the one holding text when the page is drawn opens again, "Under the hood"
 * opened for it. With `part`, only that part's points, with
 * a comment form of their own: "Check these", or the groups of the round's end. With `onAsk`, a new
 * comment's form has "Ask AI", which sends its text to the feature's session instead. A point's
 * block held by the keyboard's cursor comments on it with Enter or `i`, as a tap does, and with
 * `onAskAbout`, asks the agent about it with `s`.
 */
export function SettledPoints({
  file,
  onAsk,
  onAskAbout,
  part,
  readOnly,
}: {
  file: File;
  onAsk?: (subject: string, text: string) => Promise<string | undefined>;
  onAskAbout?: (subject: string) => void;
  part?: SettledPart;
  readOnly: boolean;
}) {
  const wide = !isNarrow(useWidthClass());
  const document = file.current.document;
  const { all, comments, groups, points } = partOf(file, part);
  const { close, focus, form, open, shown, writes } = useSettledForm(file, readOnly, points, onAsk);
  if (groups.length === 0) {
    return null;
  }

  const inPage = (here: boolean) => wide && here && <CommentBox>{form}</CommentBox>;
  const pointOf = (block: Block) => points.find((p) => p.block === block.id);
  /** Whether the new comment's form is open on this block's point: by subject, as blocks move. */
  const newOn = (block: Block) =>
    shown?.kind === "new" && pointOf(block)?.subject === shown.point.subject;
  // A point that left the round while its form was open: the form stays, after the points.
  const gone = shown !== undefined && !all.some((p) => p.subject === shown.point.subject);

  /** A point's comments, and its form on wide screens. */
  const after = (block: Block): ReactNode => {
    const point = pointOf(block);
    if (!point) {
      return null;
    }
    return (
      <>
        {comments
          .filter((comment) => comment.point === block.id)
          .map((comment) =>
            shown?.kind === "edit" && shown.comment.number === comment.number ? (
              <div key={comment.number}>{inPage(true)}</div>
            ) : (
              <SettledNote
                comment={comment}
                key={comment.number}
                onEdit={() => open({ comment, kind: "edit", point }, wide || isKeyInput())}
                point={point}
                readOnly={readOnly}
                writes={writes}
              />
            ),
          )}
        {readOnly && <AnsweredNotices comments={comments} path={file.path} point={point} />}
        {inPage(newOn(block))}
      </>
    );
  };
  // On the phone, a tap opens the sheet without raising the keyboard; a key types at once.
  const onTap = (block: Block) => {
    const point = pointOf(block);
    const takesFocus = wide || isKeyInput();
    if (!point) {
      return;
    }
    if (!newOn(block)) {
      open({ kind: "new", point }, takesFocus);
    } else if (takesFocus) {
      focus();
    }
  };
  const selection = {
    after,
    canSelect: (block: Block) => !readOnly && pointOf(block) !== undefined,
    isSelected: newOn,
    keys: (block: Block) => pointKeys(block, onTap, pointOf(block), onAskAbout),
    onTap,
  };

  return (
    <>
      <SettledGroups
        document={document}
        groups={groups}
        hoodForced={shown !== undefined && groupOf(document, groups, shown.point)?.kind === "hood"}
        part={part}
        points={(group) => (
          <Blocks document={document} ids={group.blocks} selection={selection} splitsItems />
        )}
      />
      {inPage(gone)}
      {!wide && !readOnly && (
        <Overlay isOpen={shown !== undefined} label="Comment" onClose={close} sheetHeight="capped">
          {form}
        </Overlay>
      )}
    </>
  );
}
