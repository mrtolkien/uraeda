// The conflict bar's parser: each block git wrote between its markers is found, and each choice
// replaces it with its side's lines, the base section of `diff3` dropped, the file's line endings
// kept.
import { expect, test } from "vite-plus/test";
import { conflictsIn, resolveBlock } from "./conflicts.ts";

const MERGE = [
  "- Basic git UI",
  "<<<<<<< origin/main",
  "- Review the UI guidelines, with the phone first",
  "=======",
  "- Review the UI guidelines",
  ">>>>>>> main",
  "- Global undo",
  "",
].join("\n");

const DIFF3 = [
  "start",
  "<<<<<<< ours",
  "ours line",
  "||||||| base",
  "base line",
  "=======",
  "theirs line",
  ">>>>>>> theirs",
  "end",
  "",
].join("\n");

const TWO = [
  "<<<<<<< a",
  "first a",
  "=======",
  "first b",
  ">>>>>>> b",
  "middle",
  "<<<<<<< a",
  "second a",
  "=======",
  "second b",
  ">>>>>>> b",
  "",
].join("\n");

const CRLF = ["top", "<<<<<<< a", "a1", "=======", "b1", ">>>>>>> b", "bottom", ""].join("\r\n");

/** A file whose last line is the block's closing marker, with no line break after it. */
const AT_END = ["top", "<<<<<<< a", "a1", "=======", "b1", ">>>>>>> b"].join("\n");

test.each([
  {
    choice: "ours",
    expected: "- Basic git UI\n- Review the UI guidelines, with the phone first\n- Global undo\n",
    text: MERGE,
    what: "ours, on a merge's block",
  },
  {
    choice: "theirs",
    expected: "- Basic git UI\n- Review the UI guidelines\n- Global undo\n",
    text: MERGE,
    what: "theirs, on a merge's block",
  },
  {
    choice: "both",
    expected:
      "- Basic git UI\n- Review the UI guidelines, with the phone first\n- Review the UI guidelines\n- Global undo\n",
    text: MERGE,
    what: "both, on a merge's block",
  },
  {
    choice: "both",
    expected: "start\nours line\ntheirs line\nend\n",
    text: DIFF3,
    what: "both, on a diff3 block, its base dropped",
  },
  {
    choice: "theirs",
    expected: "<<<<<<< a\nfirst a\n=======\nfirst b\n>>>>>>> b\nmiddle\nsecond b\n",
    index: 1,
    text: TWO,
    what: "the second of two blocks, the first left",
  },
  {
    choice: "both",
    expected: "top\r\na1\r\nb1\r\nbottom\r\n",
    text: CRLF,
    what: "both, on CRLF lines",
  },
  {
    choice: "ours",
    expected: "top\na1",
    text: AT_END,
    what: "ours, on a block that ends the file",
  },
  {
    choice: "both",
    expected: "top\na1\nb1",
    text: AT_END,
    what: "both, on a block that ends the file",
  },
] as const)("each choice resolves its block: $what", ({ choice, expected, text, ...rest }) => {
  const blocks = conflictsIn(text);
  const index = "index" in rest ? (rest.index ?? 0) : 0;
  expect(resolveBlock(text, blocks[index]!, choice)).toBe(expected);
});

test("each block is found, with its sides", () => {
  expect(conflictsIn(TWO).map(({ ours, theirs }) => ({ ours, theirs }))).toEqual([
    { ours: "first a\n", theirs: "first b\n" },
    { ours: "second a\n", theirs: "second b\n" },
  ]);
  expect(conflictsIn(DIFF3).map(({ ours, theirs }) => ({ ours, theirs }))).toEqual([
    { ours: "ours line\n", theirs: "theirs line\n" },
  ]);
});

test.each([
  { text: "no conflict here\n", what: "a file with no block" },
  { text: "<<<<<<< a\nnever closed\n=======\n", what: "a block never closed" },
  { text: "a line\n=======\nanother\n", what: "a separator alone" },
])("$what gives no block", ({ text }) => {
  expect(conflictsIn(text)).toEqual([]);
});
