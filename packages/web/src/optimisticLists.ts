// What a write of the inbox or the priorities shows at once, as fate's `optimistic` result: the
// whole JSON field it changes, as the write asks for it, which fate shows until the server answers
// and takes back on a refusal. A row added gets a temporary id, and a key the outliners take for
// a row not written yet, until the answer's replace them; what only the core computes, as an id,
// a key, a note's lines, or a hash, is left to the answer.
import type { Inbox, Priorities, Proposal } from "uraeda-server/fate";
import { INBOX_ID, PRIORITIES_ID } from "./data.ts";
import { spansOf } from "./lists/outline.ts";

type Categories = Inbox["categories"];
type Note = Categories[number]["notes"][number];
type Sections = Priorities["sections"];

/** The temporary rows made so far: each gets its own id and key. */
let made = 0;

/** A row's temporary id, and its key, `pending:`, which no key or click acts on until written. */
function temporary() {
  made += 1;
  return { id: `optimistic:${made}`, key: `pending:optimistic-${made}` };
}

/** The inbox's record as a write leaves its notes: they, and their count. */
function inboxWith(categories: Categories) {
  const count = categories.reduce((total, category) => total + category.notes.length, 0);
  return { categories, count, id: INBOX_ID };
}

/** The priorities' record as a write leaves its proposals. */
function prioritiesWith(sections: Sections) {
  return { id: PRIORITIES_ID, sections };
}

/**
 * The notes of `category`, at `index` there, or at its end, given `note`. `undefined` for a
 * category not shown, as one without notes yet: where it goes among the others is the core's.
 */
function placed(
  categories: Categories,
  category: string | undefined,
  note: Note,
  index = Number.MAX_SAFE_INTEGER,
): Categories | undefined {
  const at = categories.findIndex((one) => one.name === category);
  if (at === -1) {
    return undefined;
  }
  const one = categories[at]!;
  return categories.toSpliced(at, 1, { ...one, notes: one.notes.toSpliced(index, 0, note) });
}

/** A note not written yet, with `text`, about the feature or change `about`. */
function noteOf(text: string, about?: string): Note {
  return {
    ...temporary(),
    agent: false,
    children: [],
    endLine: 0,
    images: [],
    lines: [],
    nested: [],
    nestedSpans: [],
    spans: spansOf(text),
    startLine: 0,
    text,
    ...(about === undefined ? {} : { about }),
  };
}

/**
 * The inbox with a note added at the end of `category`, or of the notes without one; `undefined`
 * when they show no notes yet.
 */
export function noteAdded(
  inbox: Pick<Inbox, "categories">,
  { about, category, text }: { about?: string; category?: string; text: string },
) {
  const categories = placed(inbox.categories, category, noteOf(text, about));
  return categories && inboxWith(categories);
}

/**
 * The inbox with `note` back at `index` of `category`, as an Undo writes its lines back; `undefined`
 * when they show no notes now.
 */
export function notePutBack(
  inbox: Pick<Inbox, "categories">,
  { category, index, note }: { category?: string; index: number; note: Note },
) {
  const back = { ...note, ...temporary() };
  const categories = placed(inbox.categories, category, back, index);
  return categories && inboxWith(categories);
}

/** The inbox without the notes `gone` tells: a category left without notes shows no more. */
export function notesRemoved(categories: Categories, gone: (note: Note) => boolean) {
  return inboxWith(
    categories.flatMap((category) => {
      const notes = category.notes.filter((note) => !gone(note));
      return notes.length === 0 ? [] : [{ ...category, notes }];
    }),
  );
}

/** Whether a note holds `lines` as written. */
const holding = (lines: ReadonlyArray<string>) => (note: Note) =>
  note.lines.length === lines.length && note.lines.every((line, at) => line === lines[at]);

/**
 * The inbox without the one note holding `lines` as written, as an Undo of an add takes it out:
 * as it was when two notes hold them, which the core refuses, never both gone.
 */
export function addUndone(categories: Categories, lines: ReadonlyArray<string>) {
  const held = categories.flatMap((category) => category.notes).filter(holding(lines));
  return notesRemoved(categories, (note) => held.length === 1 && note === held[0]);
}

/** The inbox with the image `path` gone from the note `id`'s images. */
export function imageRemoved(categories: Categories, id: string, path: string) {
  return inboxWith(
    categories.map((category) => ({
      ...category,
      notes: category.notes.map((note) =>
        note.id === id ? { ...note, images: note.images.filter((one) => one !== path) } : note,
      ),
    })),
  );
}

/** The inbox's categories after `name` is added, at the end; `undefined` for a name it has. */
export function categoryAdded(inbox: Pick<Inbox, "names">, name: string) {
  return inbox.names.includes(name) ? undefined : { id: INBOX_ID, names: [...inbox.names, name] };
}

/** The inbox's categories after `from` is renamed `to`; `undefined` when `to` is taken. */
export function categoryRenamed(
  inbox: Pick<Inbox, "categories" | "names">,
  from: string,
  to: string,
) {
  if (inbox.names.includes(to)) {
    return undefined;
  }
  return {
    categories: inbox.categories.map((one) => (one.name === from ? { ...one, name: to } : one)),
    id: INBOX_ID,
    names: inbox.names.map((one) => (one === from ? to : one)),
  };
}

/**
 * The inbox's categories after `name` is deleted with its notes; `undefined` when they stay, as
 * the core places them.
 */
export function categoryRemoved(
  inbox: Pick<Inbox, "categories" | "names">,
  name: string,
  keepNotes: boolean,
) {
  if (keepNotes) {
    return undefined;
  }
  return {
    ...inboxWith(inbox.categories.filter((one) => one.name !== name)),
    names: inbox.names.filter((one) => one !== name),
  };
}

/** The sections with `proposal` at `index` of `section`, or at its end. */
function proposalPlaced(
  sections: Sections,
  section: string,
  proposal: Proposal,
  index = Number.MAX_SAFE_INTEGER,
) {
  return sections.map((one) =>
    one.section === section
      ? { ...one, proposals: one.proposals.toSpliced(index, 0, proposal) }
      : one,
  );
}

/** The sections without the proposal `id`. */
function withoutProposal(sections: Sections, id: string) {
  return sections.map((one) => ({
    ...one,
    proposals: one.proposals.filter((proposal) => proposal.id !== id),
  }));
}

/** The priorities with a proposal of `text` added at the end of `section`. */
export function proposalAdded(sections: Sections, section: string, text: string) {
  const proposal: Proposal = {
    ...temporary(),
    children: [],
    endLine: 0,
    lines: [],
    nested: [],
    nestedSpans: [],
    spans: spansOf(text),
    startLine: 0,
    text,
  };
  return prioritiesWith(proposalPlaced(sections, section, proposal));
}

/** The priorities with `proposal` back at `index` of `section`, as an Undo writes its lines back. */
export function proposalPutBack(
  sections: Sections,
  { index, proposal, section }: { index: number; proposal: Proposal; section: string },
) {
  return prioritiesWith(proposalPlaced(sections, section, { ...proposal, ...temporary() }, index));
}

/** The priorities without the proposal `id`. */
export function proposalRemoved(sections: Sections, id: string) {
  return prioritiesWith(withoutProposal(sections, id));
}

/** The priorities with the proposal `id`'s text `text`, its key as it was until the answer's. */
export function proposalEdited(sections: Sections, id: string, text: string) {
  return prioritiesWith(
    sections.map((one) => ({
      ...one,
      proposals: one.proposals.map((proposal) =>
        proposal.id === id ? { ...proposal, spans: spansOf(text), text } : proposal,
      ),
    })),
  );
}

/** The priorities with the proposal `id` at `index` of `section`, or at its end. */
export function proposalMoved(sections: Sections, id: string, section: string, index: number) {
  const proposal = sections.flatMap((one) => one.proposals).find((one) => one.id === id);
  return proposal
    ? prioritiesWith(proposalPlaced(withoutProposal(sections, id), section, proposal, index))
    : undefined;
}
