// @vitest-environment node
// A draft's text as its edit box holds it: cut after the frontmatter, which a save joins back.
import { expect, test } from "vite-plus/test";
import { asTyped, splitDraft, storedBody } from "../pane/draftText.ts";

/** A draft read as the core gives it: its text, and where its frontmatter ends. */
const draft = (text: string, end?: number) => ({
  document: { frontmatterLines: end === undefined ? null : { end } },
  text,
});

test("the text after the frontmatter and its blank lines is the body, the rest the head", () => {
  expect(splitDraft(draft("---\ndiscovery: low\n---\n\n# Title\n\nText.\n", 3))).toEqual({
    body: "# Title\n\nText.\n",
    head: "---\ndiscovery: low\n---\n\n",
  });
  expect(splitDraft(draft("# No frontmatter\n"))).toEqual({
    body: "# No frontmatter\n",
    head: "",
  });
});

/** A file that is only a frontmatter, ended by no newline: the head keeps one, so typing starts a line. */
test("a file of only a frontmatter without a final newline has a head ending its line", () => {
  const { body, head } = splitDraft(draft("---\ndiscovery: low\n---", 3));

  expect(body).toBe("");
  expect(`${head}${"Typed text"}`).toBe("---\ndiscovery: low\n---\nTyped text");
});

test("a file of only a frontmatter and its newline keeps its head as it is", () => {
  expect(splitDraft(draft("---\ndiscovery: low\n---\n", 3))).toEqual({
    body: "",
    head: "---\ndiscovery: low\n---\n",
  });
});

/** An entry stored before the box hid the frontmatter held the whole file. */
test("a stored text with a frontmatter loses it, and one without it is left alone", () => {
  expect(storedBody("---\ndiscovery: low\n---\n\n# Title\n")).toBe("# Title\n");
  expect(storedBody("# Title\n")).toBeUndefined();
  expect(storedBody("---\ndiscovery: low\n")).toBeUndefined();
});

/** A body that opens with a break of `---` lines is text, not a frontmatter. */
test("a stored body that opens with a thematic break keeps it", () => {
  expect(storedBody("---\nA break, then words.\n---\nMore.\n")).toBeUndefined();
});

/** A text field's value has LF line breaks, whatever the file has, and its cursor counts them so (R50). */
test.each([
  { expected: "one\ntwo\n", text: "one\r\ntwo\r\n", what: "CRLF line breaks" },
  { expected: "one\ntwo", text: "one\rtwo", what: "a lone CR line break" },
  { expected: "one\ntwo\n\nthree", text: "one\ntwo\r\n\r\nthree", what: "LF and CRLF mixed" },
  { expected: "one\ntwo\n", text: "one\ntwo\n", what: "LF line breaks, left as they are" },
])("typed or pasted text with $what is kept as LF", ({ expected, text }) => {
  expect(asTyped(text)).toBe(expected);
});

test("a draft's text with CRLF line breaks is split as LF", () => {
  expect(splitDraft(draft("---\r\ndiscovery: low\r\n---\r\n\r\n# Title\r\n", 3))).toEqual({
    body: "# Title\n",
    head: "---\ndiscovery: low\n---\n\n",
  });
});
