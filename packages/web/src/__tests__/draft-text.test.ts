// @vitest-environment node
// A draft's text as its edit box holds it: cut after the frontmatter, which a save joins back.
import { expect, test } from "vite-plus/test";
import { splitDraft, storedBody } from "../pane/draftText.ts";

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
