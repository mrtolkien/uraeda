// Markdown's fonts, in the editor and in a sent message: code, its marks too, in the code font,
// headings in the heading font, and the rest in markdown prose's, as the fonts picked say.
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { type Tag, tags } from "@lezer/highlight";
import { afterEach, expect, test } from "vite-plus/test";
import { colourClass, fontClass, fontRuns, isMarkdownPath, markdown } from "./markdown.ts";

const TEXT = [
  "# A `title`",
  "",
  "Some `code` in prose.",
  "",
  "```ts",
  "const a = 1;",
  "```",
  "",
  "Title too",
  "---",
  "",
].join("\n");

/** The text of each run in `font`, joined, a run of another font cutting it. */
function inFont(font: string | undefined) {
  return fontRuns(TEXT)
    .filter((run) => run.font === font)
    .map((run) => run.text);
}

// Break: drop `/...` from a rule in `fontTags`.
test("code and its marks are in the code font, headings in the heading font", () => {
  expect(inFont("code")).toEqual(["`title`", "`code`", "```ts", "const a = 1;", "```"]);
  expect(inFont("heading")).toEqual(["# A ", "Title too", "---"]);
  expect(inFont(undefined).join("|")).toContain("Some | in prose.");
});

test("a message's runs hold its whole text, in order", () => {
  expect(
    fontRuns(TEXT)
      .map((run) => run.text)
      .join(""),
  ).toBe(TEXT);
});

let view: EditorView | undefined;
afterEach(() => view?.destroy());

test("the editor draws its code and headings in their fonts", () => {
  view = new EditorView({
    parent: document.body,
    state: EditorState.create({ doc: TEXT, extensions: markdown() }),
  });
  const textIn = (font: "code" | "heading") =>
    [...view!.dom.querySelectorAll(`.${fontClass(font).split(" ").join(".")}`)].map(
      (span) => span.textContent,
    );
  expect(textIn("code")).toContain("const a = 1;");
  // A code span's backticks and its text, each in a span of its colour.
  expect(textIn("code")).toEqual(expect.arrayContaining(["`", "code"]));
  expect(textIn("heading")).toContain("Title too");
});

// Break: give `markdown(true)` the fonts' highlighting.
test("a file's code has no heading or code font of markdown's", () => {
  view = new EditorView({
    parent: document.body,
    state: EditorState.create({ doc: "# a shell comment\n", extensions: markdown(true) }),
  });
  expect(view.dom.querySelector(`.${fontClass("heading").split(" ").join(".")}`)).toBeNull();
});

test("a markdown file is told from a file of code by its name", () => {
  expect(isMarkdownPath("specs/proposals/a.md")).toBe(true);
  expect(isMarkdownPath("README.markdown")).toBe(true);
  expect(isMarkdownPath("packages/web/src/App.tsx")).toBe(false);
});

// Break: build `markdown()`'s extension on each call, as a field's every prop change then reparses
// its whole text, and adds CSS rules that stay.
test("each field reuses the same language and themes", () => {
  expect(markdown()).toBe(markdown());
  expect(markdown(true)).toBe(markdown(true));
});

// Break: drop `tags.monospace` from `InlineCode/...`'s rule, which replaces markdown's own.
test("the fonts' rules keep the highlighting's colours", () => {
  view = new EditorView({
    parent: document.body,
    state: EditorState.create({ doc: TEXT, extensions: markdown() }),
  });
  const textIn = (tag: Tag) =>
    [...view!.dom.querySelectorAll(`.${colourClass(tag).split(" ").join(".")}`)].map(
      (span) => span.textContent,
    );
  expect(textIn(tags.monospace)).toContain("code");
  expect(textIn(tags.heading1)).toContain(" A ");
  // A mark's dimmed colour, after the others: a backtick and a `#`.
  expect(textIn(tags.processingInstruction)).toEqual(expect.arrayContaining(["`", "#"]));
});
