import type { SettledComment, SettledPoint } from "uraeda-binding";
import { CommentForm } from "./CommentForm.tsx";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import { dropUnsaved, readUnsaved, unsavedKey, useUnsaved } from "./fields/unsaved.ts";
import { CommentNote } from "./ReviewComments.tsx";
import { useRepositoryPath } from "./routes.tsx";
import { editKey, editOf, newKey, type SettledWrites } from "./settledWrites.ts";

/** The comment form open on a point: a new comment on it, or one of its comments edited. */
export type Open =
  | { kind: "new"; point: SettledPoint }
  | { comment: SettledComment; kind: "edit"; point: SettledPoint };

/** The form that held unsaved text when the page was drawn, opened again to restore it. */
export function restoredForm(
  repo: string,
  path: string,
  points: ReadonlyArray<SettledPoint>,
  comments: ReadonlyArray<SettledComment>,
): Open | undefined {
  const kept = (field: string) => readUnsaved(unsavedKey(repo, field));
  for (const comment of comments) {
    const point = points.find((p) => p.block === comment.point);
    if (point && editOf(kept(editKey(path, comment.number)), comment)) {
      return { comment, kind: "edit", point };
    }
  }
  const point = points.find((p) => kept(newKey(path, p.subject)) !== undefined);
  return point && { kind: "new", point };
}

/** The comment form open on a point, keyed by what it writes: a new comment, or an edit. */
export function SettledForm({
  onClose,
  path,
  shown,
  writes,
}: {
  onClose: () => void;
  path: string;
  shown: Open;
  writes: SettledWrites;
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
            subject: shown.comment.subject,
            submitLabel: "Save comment",
          }
        : {
            field: newKey(path, shown.point.subject),
            onSubmit: (text: string) => writes.add(shown.point.subject, text),
          })}
    />
  );
}

/** The form open once comment `number` is removed: an edit of a comment after it follows it. */
export const afterRemoval =
  (number: number) =>
  (shown: Open | undefined): Open | undefined => {
    if (shown?.kind !== "edit" || shown.comment.number < number) {
      return shown;
    }
    return shown.comment.number === number
      ? undefined
      : { ...shown, comment: { ...shown.comment, number: shown.comment.number - 1 } };
  };

/** A comment under its point, with Edit and Remove while the round awaits the human. */
export function SettledNote({
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
  writes: SettledWrites;
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
export function AnsweredNotices({
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
