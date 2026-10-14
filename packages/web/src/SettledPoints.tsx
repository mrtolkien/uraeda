import { Heading } from "@astryxdesign/core/Heading";
import {
  borderVars,
  colorVars,
  radiusVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import { useFateClient } from "react-fate";
import type { Block, SettledComment, SettledPoint } from "uraeda-binding";
import { Blocks } from "./Blocks.tsx";
import { CommentForm } from "./CommentForm.tsx";
import type { useFile } from "./data.ts";
import { refusal } from "./errors.ts";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import { dropUnsaved, readUnsaved, unsavedKey, useUnsaved } from "./fields/unsaved.ts";
import { Overlay } from "./layout/Overlay.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { CommentNote } from "./ReviewComments.tsx";
import { useRepositoryPath } from "./routes.tsx";
import { FileView } from "./views.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

/** The comment form open on a point: a new comment on it, or one of its comments edited. */
type Open =
  | { kind: "new"; point: SettledPoint }
  | { comment: SettledComment; kind: "edit"; point: SettledPoint };

const styles = stylex.create({
  inline: {
    // The comment form under its point on wide screens.
    borderColor: colorVars["--color-border"],
    borderRadius: radiusVars["--radius-container"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    marginBlock: spacingVars["--spacing-2"],
    padding: spacingVars["--spacing-3"],
  },
  title: {
    marginBlockEnd: spacingVars["--spacing-3"],
  },
});

/** The field keys of a round's settled comments: a new one on a subject, or comment `number`. */
const newKey = (path: string, subject: string) => `${path}#settled:${subject}`;
const editKey = (path: string, number: number) => `${path}#settled-edit:${number}`;

/** The form that held unsaved text when the page was drawn, opened again to restore it. */
function restoredForm(
  repo: string,
  path: string,
  points: ReadonlyArray<SettledPoint>,
  comments: ReadonlyArray<SettledComment>,
): Open | undefined {
  const kept = (field: string) => readUnsaved(unsavedKey(repo, field)) !== undefined;
  for (const comment of comments) {
    const point = points.find((p) => p.block === comment.point);
    if (point && kept(editKey(path, comment.number))) {
      return { comment, kind: "edit", point };
    }
  }
  const point = points.find((p) => kept(newKey(path, p.subject)));
  return point && { kind: "new", point };
}

/**
 * The writes of a round's settled comments: `add` and `edit` resolve with nothing once written,
 * after `onWritten`, or with the error to show; a removal's error shows under its comment.
 */
function useSettledWrites(file: File, onWritten: () => void) {
  const fate = useFateClient();
  const [removal, setRemoval] = useState<{ message: string; number: number }>();
  const written = (result: { error?: unknown }) => {
    if (result.error) {
      return refusal(result.error).message;
    }
    onWritten();
    return undefined;
  };
  const add = async (subject: string, text: string) =>
    written(
      await fate.mutations.settled.comment({
        input: { folder: file.folder, subject, text },
        view: FileView,
      }),
    );
  const edit = async (comment: SettledComment, text: string) =>
    written(
      await fate.mutations.settled.edit({
        input: { folder: file.folder, number: comment.number, previous: comment.text, text },
        view: FileView,
      }),
    );
  const remove = async (comment: SettledComment) => {
    setRemoval(undefined);
    const result = await fate.mutations.settled.remove({
      input: { folder: file.folder, number: comment.number, previous: comment.text },
      view: FileView,
    });
    if (result.error) {
      setRemoval({ message: refusal(result.error).message, number: comment.number });
    }
  };
  const removeError = (comment: SettledComment) =>
    removal?.number === comment.number ? removal.message : undefined;
  return { add, edit, remove, removeError };
}

/**
 * Saves the settled comments typed and not saved, as Submit does before it submits: each comment
 * edited, then each new one, whose text the store keeps, open or not, unless it is blank. Resolves
 * with whether every one was written, stopping at the first refused.
 */
export function useSaveSettled(file: File) {
  const repo = useRepositoryPath();
  const writes = useSettledWrites(file, () => undefined);
  /** The text kept for a field, unless it is blank. */
  const typed = (field: string) => {
    const key = unsavedKey(repo, field);
    const text = readUnsaved(key)?.text;
    return text?.trim() ? { key, text } : undefined;
  };
  return async () => {
    const round = file.current.items.clarifications;
    const saves = [
      ...(round?.settledComments ?? []).map((comment) => ({
        kept: typed(editKey(file.path, comment.number)),
        write: (text: string) => writes.edit(comment, text),
      })),
      // A subject used twice is one field, for its first point.
      ...[...new Set((round?.settledPoints ?? []).map((point) => point.subject))].map(
        (subject) => ({
          kept: typed(newKey(file.path, subject)),
          write: (text: string) => writes.add(subject, text),
        }),
      ),
    ];
    for (const { kept, write } of saves) {
      if (kept) {
        if ((await write(kept.text)) !== undefined) {
          return false;
        }
        dropUnsaved(kept.key);
      }
    }
    return true;
  };
}

/** The comment form open on a point, keyed by what it writes: a new comment, or an edit. */
function SettledForm({
  onClose,
  path,
  shown,
  writes,
}: {
  onClose: () => void;
  path: string;
  shown: Open;
  writes: ReturnType<typeof useSettledWrites>;
}) {
  return (
    <CommentForm
      anchor={`On "${shown.point.subject}"`}
      key={shown.kind === "edit" ? `edit-${shown.comment.number}` : `new-${shown.point.subject}`}
      onCancel={onClose}
      {...(shown.kind === "edit"
        ? {
            field: editKey(path, shown.comment.number),
            onSubmit: (text: string) => writes.edit(shown.comment, text),
            saved: shown.comment.text,
            submitLabel: "Save comment",
          }
        : {
            field: newKey(path, shown.point.subject),
            onSubmit: (text: string) => writes.add(shown.point.subject, text),
          })}
    />
  );
}

/**
 * The points a round settled without the human, with their comments under them. While the round
 * awaits the human, a point that starts in bold is tapped to comment on it, in a form under it on
 * wide screens and in a sheet on the phone, and its comments have Edit and Remove. Each form's
 * text is kept in the unsaved store; the one holding text when the page is drawn opens again.
 */
export function SettledPoints({ file, readOnly }: { file: File; readOnly: boolean }) {
  const wide = useWidthClass() === "wide";
  const repo = useRepositoryPath();
  const round = file.current.items.clarifications;
  const points = round?.settledPoints ?? [];
  const comments = round?.settledComments ?? [];
  const [open, setOpen] = useState<Open | undefined>(() =>
    readOnly ? undefined : restoredForm(repo, file.path, points, comments),
  );
  const writes = useSettledWrites(file, () => setOpen(undefined));
  if (!round || round.settled.length === 0) {
    return null;
  }
  const shown = readOnly ? undefined : open;

  const form = shown && (
    <SettledForm
      onClose={() => setOpen(undefined)}
      path={file.path}
      shown={shown}
      writes={writes}
    />
  );
  const inPage = (here: boolean) =>
    wide && here && <div {...stylex.props(styles.inline)}>{form}</div>;
  const pointOf = (block: Block) => points.find((p) => p.block === block.id);
  /** Whether the new comment's form is open on this block's point: by subject, as blocks move. */
  const newOn = (block: Block) =>
    shown?.kind === "new" && pointOf(block)?.subject === shown.point.subject;
  // A point that left the round while its form was open: the form stays, after the points.
  const gone = shown !== undefined && !points.some((p) => p.subject === shown.point.subject);

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
                onEdit={() => setOpen({ comment, kind: "edit", point })}
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

  return (
    <>
      <Heading level={2} xstyle={styles.title}>
        Settled without you
      </Heading>
      <Blocks
        document={file.current.document}
        ids={round.settled}
        selection={{
          after,
          canSelect: (block) => !readOnly && pointOf(block) !== undefined,
          isSelected: newOn,
          onTap: (block) => {
            const point = pointOf(block);
            if (point && !newOn(block)) {
              setOpen({ kind: "new", point });
            }
          },
        }}
      />
      {inPage(gone)}
      {!wide && !readOnly && (
        <Overlay
          isOpen={shown !== undefined}
          label="Comment"
          onClose={() => setOpen(undefined)}
          sheetHeight="capped"
        >
          {form}
        </Overlay>
      )}
    </>
  );
}

/** A comment under its point, with Edit and Remove while the round awaits the human. */
function SettledNote({
  comment,
  onEdit,
  point,
  readOnly,
  writes,
}: {
  comment: SettledComment;
  onEdit: () => void;
  point: SettledPoint;
  readOnly: boolean;
  writes: ReturnType<typeof useSettledWrites>;
}) {
  return (
    <CommentNote
      label="Your comment"
      name={`Your comment on "${point.subject}"`}
      text={comment.text}
      {...(readOnly
        ? {}
        : {
            error: writes.removeError(comment),
            onEdit,
            onRemove: () => void writes.remove(comment),
          })}
    />
  );
}

/**
 * The unsaved comments on a point of a round answered meanwhile, each with the notice saying so
 * and its Discard: a new comment on the point, and an edit of each of its comments.
 */
function AnsweredNotices({
  comments,
  path,
  point,
}: {
  comments: ReadonlyArray<SettledComment>;
  path: string;
  point: SettledPoint;
}) {
  return [
    newKey(path, point.subject),
    ...comments.filter((c) => c.point === point.block).map((c) => editKey(path, c.number)),
  ].map((field) => <AnsweredNotice field={field} key={field} />);
}

function AnsweredNotice({ field }: { field: string }) {
  const key = unsavedKey(useRepositoryPath(), field);
  const entry = useUnsaved(key);
  return (
    entry && (
      <RestoreNotice
        answered
        changed=""
        onDiscard={() => dropUnsaved(key)}
        restored={{ at: entry.at, changed: false }}
      />
    )
  );
}
