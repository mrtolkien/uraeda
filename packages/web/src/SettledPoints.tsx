import * as stylex from "@stylexjs/stylex";
import { type ReactNode, type RefObject, useEffect, useEffectEvent, useRef, useState } from "react";
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
 * asked for, and `focus` gives the field of the form open the focus back, on a wide screen or
 * after a key.
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
  // Each focus the human asked for, by opening the form or coming back to it: once, so the form
  // drawn again later, as its point moves or the window narrows, takes no focus, nor does the one
  // restored with the page.
  const [focusAsked, setFocusAsked] = useState(0);
  const wide = !isNarrow(useWidthClass());
  const box = useRef<HTMLDivElement>(null);
  useFocusAsked(box, focusAsked, wide);
  const close = () => setOpen(undefined);
  const writes = useSettledWrites(file, close, (number) => setOpen(afterRemoval(number)));
  const shown = readOnly ? undefined : open;
  const form = shown && (
    <div ref={box} {...stylex.props(styles.contents)}>
      <SettledForm
        onClose={close}
        {...(onAsk ? { onAsk } : {})}
        path={file.path}
        shown={shown}
        writes={writes}
      />
    </div>
  );
  // On the phone, a tap opens the sheet without raising the keyboard; a key types at once.
  const focus = () => {
    if (wide || isKeyInput()) {
      setFocusAsked((asked) => asked + 1);
    }
  };
  const openForm = (next: Open) => {
    setOpen(next);
    focus();
  };
  return { close, focus, form, open: openForm, shown, writes };
}

/** The frames the form's field is waited for, as the sheet or the form opens. */
const FOCUS_FRAMES = 10;

/**
 * Gives the field in `box` the focus once it is drawn, each time `asked` grows: the page keeps its
 * scroll on the phone, where the sheet shows the field; on a wide screen, the field comes into view.
 */
function useFocusAsked(box: RefObject<HTMLElement | null>, asked: number, wide: boolean) {
  const focusField = useEffectEvent((field: HTMLElement) => field.focus({ preventScroll: !wide }));
  useEffect(() => {
    // None asked yet, as the form restored with the page is drawn.
    if (asked === 0) {
      return undefined;
    }
    let frames = 0;
    let frame = requestAnimationFrame(function find() {
      const field = box.current?.querySelector<HTMLElement>('[role="textbox"]');
      if (field) {
        focusField(field);
      } else if (++frames < FOCUS_FRAMES) {
        frame = requestAnimationFrame(find);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [asked, box]);
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
    { bar: "⏎ i", keys: "Enter", label: "comment", run: () => onTap(block) },
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
                onEdit={() => open({ comment, kind: "edit", point })}
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
  const onTap = (block: Block) => {
    const point = pointOf(block);
    if (point && !newOn(block)) {
      open({ kind: "new", point });
    } else if (point) {
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
