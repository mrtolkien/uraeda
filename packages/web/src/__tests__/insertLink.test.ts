// R43 and R44: where links go in a text, and how a place follows the edits typed around it.
import { expect, test } from "vite-plus/test";
import { editBetween, followEdit, followEdits, insertLinks } from "../attach/insertLink.ts";

test.each([
  // [text, at, links, the text with them]
  ["", 0, ["![a](images/a.webp)"], "![a](images/a.webp)\n"],
  ["Hi", 2, ["![a](images/a.webp)"], "Hi\n\n![a](images/a.webp)\n"],
  ["Hi\n", 3, ["![a](images/a.webp)"], "Hi\n\n![a](images/a.webp)\n"],
  ["A\n\nB", 1, ["![a](images/a.webp)"], "A\n\n![a](images/a.webp)\n\nB"],
  [
    "A\n\nB",
    0,
    ["![a](images/a.webp)", "![b](images/b.webp)"],
    "![a](images/a.webp)\n![b](images/b.webp)\n\nA\n\nB",
  ],
])("insertLinks(%j, %i) puts the links in a paragraph of their own", (text, at, links, linked) => {
  const result = insertLinks(text, at, links);
  expect(result.text).toBe(linked);
  expect(result.text.slice(...result.selection)).toBe("a");
});

test.each([
  // [before, after, caret, the edit]
  // `hel|lo`, an `l` typed at 2: a diff of the texts places it at 4, the caret at 2.
  ["hello", "helllo", 3, { start: 2, removed: 0, inserted: 1 }],
  ["hello", "helllo", undefined, { start: 4, removed: 0, inserted: 1 }],
  // A backspace after the second `l`.
  ["hello", "helo", 3, { start: 3, removed: 1, inserted: 0 }],
  // A selection, `cd`, replaced by `X`.
  ["abcdef", "abXef", 3, { start: 2, removed: 2, inserted: 1 }],
  // A caret the texts disagree with, as after a text replaced from elsewhere: the diff.
  ["abc", "abXc", 0, { start: 2, removed: 0, inserted: 1 }],
])("editBetween(%j, %j, %j)", (before, after, caret, edit) => {
  expect(editBetween(before, after, caret)).toEqual(edit);
});

test.each([
  // [at, edit, after, the place once edited]
  // Typed before the place: it moves.
  [5, { start: 0, removed: 0, inserted: 3 }, false, 8],
  // Typed at the place itself: the typing goes after the links (R44).
  [5, { start: 5, removed: 0, inserted: 3 }, false, 5],
  // Links an earlier batch inserted at the same place: the later batch's go after them.
  [5, { start: 5, removed: 0, inserted: 3 }, true, 8],
  // Typed after it, or removed after it: it stays.
  [5, { start: 6, removed: 0, inserted: 3 }, false, 5],
  [5, { start: 5, removed: 2, inserted: 0 }, false, 5],
  // A backspace just before it.
  [5, { start: 4, removed: 1, inserted: 0 }, false, 4],
  // A selection around it replaced: it goes after the replacement.
  [5, { start: 3, removed: 4, inserted: 1 }, false, 4],
])("followEdit(%i, %j, %j) is %i", (at, edit, after, moved) => {
  expect(followEdit(at, edit, after)).toBe(moved);
});

test("a place next to a repeated character follows the typing by the caret", () => {
  // The place is after `hel`; an `l` is typed at 2, before it.
  expect(followEdits("hello", "helllo", 3, 3)).toBe(4);
  // An `l` typed at the place itself, the caret after it: the place stays.
  expect(followEdits("hello", "helllo", 3, 4)).toBe(3);
});
