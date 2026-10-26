// An add with an image whose answer is lost: the note it wrote is found in the inbox, once, by its
// words, so pressing Add again cannot add it twice.
import type { InboxNote } from "uraeda-binding";
import { expect, test } from "vite-plus/test";
import { addedNote, lostAnswerNote, type Notes } from "../NoteImage.tsx";

/** A note of the inbox, by its lines and, for a note added as a draft, the draft and its title. */
function note(lines: Array<string>, draft?: { path: string; title: string }): InboxNote {
  return {
    ...(draft ? { draft: draft.path, draftTitle: draft.title } : {}),
    lines,
  } as unknown as InboxNote;
}

/** An inbox of one category per list of notes. */
const inbox = (...categories: Array<Array<InboxNote>>): Notes =>
  categories.map((notes) => ({ notes }));

const FLAT = note(["- [Headings are flat](specs/drafts/headings-are-flat/draft.md)"], {
  path: "specs/drafts/headings-are-flat/draft.md",
  title: "Headings are flat",
});
const OLD = note(["- An older note"]);

test.each([
  { added: FLAT, after: inbox([OLD, FLAT]), before: inbox([OLD]), what: "a note after the others" },
  { added: FLAT, after: inbox([OLD], [FLAT]), before: inbox([OLD], []), what: "another category" },
  { added: undefined, after: inbox([OLD]), before: inbox([OLD]), what: "nothing added" },
  {
    added: OLD,
    after: inbox([OLD, OLD]),
    before: inbox([OLD]),
    what: "a second note with the lines of one the inbox held: it is found once, not twice",
  },
  {
    added: undefined,
    after: inbox([OLD, OLD]),
    before: inbox([OLD, OLD]),
    what: "twins both held",
  },
])("the note an add wrote is found with $what", ({ added, after, before }) => {
  expect(addedNote(before, after)).toBe(added);
});

test.each([
  {
    found: true,
    text: "Headings are flat",
    title: "Headings are flat",
    what: "the same words",
  },
  {
    found: true,
    text: "The `[x]`  heading is flat",
    title: "The `[x]` heading is flat",
    what: "the words spaced differently, inline code and brackets included",
  },
  {
    found: true,
    text: " Headings\n are   flat ",
    title: "Headings are flat",
    what: "spaces and line breaks around and between the words",
  },
  { found: false, text: "Headings are flat", title: "Headings are bold", what: "other words" },
  { found: false, text: "Headings are flat", title: "Headings are", what: "fewer words" },
  { found: false, text: "Headings are flat", title: "headings are flat", what: "other case" },
])("a lost answer's note is found with $what: $found", ({ found, text, title }) => {
  const added = note(["- added"], { path: "specs/drafts/headings-are-flat-2/draft.md", title });

  const result = lostAnswerNote(inbox([OLD]), inbox([OLD, added]), text);

  expect(result).toEqual(
    found ? { draft: "specs/drafts/headings-are-flat-2/draft.md", note: added } : undefined,
  );
});

test("a note added in the inbox without a draft is not the lost answer's", () => {
  expect(
    lostAnswerNote(inbox([OLD]), inbox([OLD, note(["- Headings are flat"])]), "Headings are flat"),
  ).toBeUndefined();
});

test("a lost answer's note is not found when the inbox gained nothing", () => {
  expect(lostAnswerNote(inbox([FLAT]), inbox([FLAT]), "Headings are flat")).toBeUndefined();
});
