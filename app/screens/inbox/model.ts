// The inbox as the list draws it: one row per category, then its notes, the notes without a
// category first, every category of `INBOX.md` in the file's order, an empty one too, and last the
// row that adds a category. Pure: the panes read it from the `Inbox` record.
import type { Inbox, InboxNote, Span } from "../../store/protocol";

export type InboxRow =
  | {
      readonly id: string;
      readonly kind: "category";
      readonly name: string;
      readonly count: number;
    }
  | {
      readonly id: string;
      readonly kind: "note";
      readonly note: InboxNote;
      /** Its category: `null` for the notes without one. */
      readonly category: string | null;
    }
  | { readonly id: typeof NEW_CATEGORY; readonly kind: "new-category" };

/** The id of the last row, which adds a category. */
export const NEW_CATEGORY = "+new-category";

/** A category row's id: a note's id is its key, a slug, which never holds a colon. */
export const categoryRow = (name: string) => `category:${name}`;

/**
 * The rows of the inbox: the notes without a category, with no row of their own, then each
 * category by its name in the file's order, with its notes, an empty one with none, then the
 * row that adds a category. `rows` keeps a row's object while its note is the same object, so a
 * list redraws only what changed.
 */
export function rowsOf(inbox: Inbox, before: ReadonlyArray<InboxRow> = []): Array<InboxRow> {
  const kept = new Map(before.map((row) => [row.id, row]));
  const same = <R extends InboxRow>(row: R): R => {
    const old = kept.get(row.id);
    if (old === undefined || old.kind !== row.kind) return row;
    if (row.kind === "note" && old.kind === "note") {
      return (old.note === row.note && old.category === row.category ? old : row) as R;
    }
    if (row.kind === "category" && old.kind === "category") {
      return (old.count === row.count ? old : row) as R;
    }
    return old as R;
  };
  const notesOf = (name: string | null) =>
    inbox.categories.find((category) => category.name === name)?.notes ?? [];
  const rows: Array<InboxRow> = notesOf(null).map((note) =>
    same({ category: null, id: note.key, kind: "note", note }),
  );
  for (const name of inbox.names) {
    const notes = notesOf(name);
    rows.push(same({ count: notes.length, id: categoryRow(name), kind: "category", name }));
    for (const note of notes) {
      rows.push(same({ category: name, id: note.key, kind: "note", note }));
    }
  }
  rows.push(same({ id: NEW_CATEGORY, kind: "new-category" }));
  return rows;
}

/** A note by its key, with its category. */
export function noteOf(
  inbox: Inbox | null | undefined,
  key: string,
): { note: InboxNote; category: string | null } | undefined {
  for (const category of inbox?.categories ?? []) {
    const note = category.notes.find((one) => one.key === key);
    if (note !== undefined) return { category: category.name, note };
  }
  return undefined;
}

/** The category of the row at `id`: a category's own, a note's, or none. */
export function categoryAt(rows: ReadonlyArray<InboxRow>, id: string | undefined): string | null {
  const row = rows.find((one) => one.id === id);
  if (row?.kind === "category") return row.name;
  if (row?.kind === "note") return row.category;
  return null;
}

/** Spans as plain words: what a row and a title say. */
export const plain = (spans: ReadonlyArray<Span>) =>
  spans
    .map((span) => span.text)
    .join("")
    .trim();

/** A note's text, short enough to quote in a sentence. */
export function quoted(text: string, most = 60): string {
  const one = text.replace(/\s+/g, " ").trim();
  return `“${one.length > most ? `${one.slice(0, most - 1).trimEnd()}…` : one}”`;
}

/** "1 image", "3 images". */
export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** The quiet facts after a note's text: who wrote it, what it is about, its images. */
export function marksOf(note: InboxNote): string | undefined {
  const marks = [
    ...(note.agent ? ["agent"] : []),
    ...(note.about === null ? [] : [note.about]),
    ...(note.images.length > 0 ? [plural(note.images.length, "image")] : []),
    ...(note.children.length > 0 ? [plural(note.children.length, "sub-item")] : []),
  ];
  return marks.length === 0 ? undefined : marks.join(" · ");
}
