// Markdown highlighting in every field, Vim on or off (Text editing decision): the structure in the
// theme's Catppuccin colours, its marks (`#`, `**`, `[`, `` ` ``) dimmed, after `mockups/editor.css`.
// Its fonts follow the ones picked (`theme/fonts.ts`): code, its marks too, in the code font,
// headings in the heading font, and the rest in markdown prose's, which the field's theme sets. A
// message sent in a session draws its text in the same fonts, through `fontRuns`.
import { markdown as markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { highlightCode, styleTags, Tag, tagHighlighter, tags } from "@lezer/highlight";

/** What sets code apart, in a code span or block: its fence and backticks too. */
const codeFont = Tag.define();
/** What sets a heading apart: its `#` too, and a Setext heading's underline. */
const headingFont = Tag.define();

/**
 * Markdown's own tags, with the font's on the whole node, passed on to each part inside it (`/...`):
 * without it, a part with a tag of its own, as a backtick or a `#`, would lose the node's.
 */
const fontTags = styleTags({
  "ATXHeading1/... SetextHeading1/...": [tags.heading1, headingFont],
  "ATXHeading2/... SetextHeading2/...": [tags.heading2, headingFont],
  "ATXHeading3/...": [tags.heading3, headingFont],
  "ATXHeading4/...": [tags.heading4, headingFont],
  "ATXHeading5/...": [tags.heading5, headingFont],
  "ATXHeading6/...": [tags.heading6, headingFont],
  "CodeBlock/... FencedCode/...": codeFont,
  "InlineCode/...": [tags.monospace, codeFont],
});

/** Each Markdown part's look, through the theme's tokens: they follow the light and dark themes. */
const style = HighlightStyle.define([
  {
    color: "var(--color-text-purple)",
    fontWeight: "700",
    tag: [tags.heading1, tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6],
  },
  { fontStyle: "italic", tag: tags.emphasis },
  { fontWeight: "700", tag: tags.strong },
  { color: "var(--color-text-orange)", tag: tags.monospace },
  { color: "var(--color-text-blue)", tag: tags.link, textDecoration: "underline" },
  { color: "var(--color-syntax-comment)", tag: tags.url },
  { color: "var(--color-text-secondary)", fontStyle: "italic", tag: tags.quote },
  { color: "var(--color-text-secondary)", tag: [tags.comment, tags.contentSeparator] },
  // The marks: a heading's `#`, emphasis's `*`, a link's brackets, code's backticks, a quote's `>`,
  // a list's bullet. Last: a rule after wins, so a heading's or a link's mark is dimmed too.
  { color: "var(--color-syntax-comment)", tag: tags.processingInstruction },
]);

/** The fonts, apart from the colours, as a message draws them too. Code last: it wins in a heading. */
const fontStyle = HighlightStyle.define([
  { fontFamily: "var(--font-family-heading)", tag: headingFont },
  { fontFamily: "var(--font-family-code)", tag: codeFont },
]);

/** A font markdown sets apart from its prose. */
export type MarkdownFont = "code" | "heading";

/** The class the editor draws text in `font` with: a test reads it. */
export const fontClass = (font: MarkdownFont) =>
  fontStyle.style([font === "code" ? codeFont : headingFont]) ?? "";

/** Markdown's language, with the fonts' tags. */
const language = () =>
  // Its own keys stay off: Enter adds a plain line, as the fields did before the editor, rather
  // than continuing a list.
  markdownLanguage({ addKeymap: false, extensions: { props: [fontTags] } });

/** The field's text in one family: markdown prose's, or code's. */
const textIn = (family: string) =>
  EditorView.theme({ ".cm-scroller": { fontFamily: `var(--font-family-${family})` } });

/**
 * Markdown's language, its highlighting, and its fonts; or, for a file's code, as a buffer of a
 * TypeScript file, all of it in the code font, as a `#` there starts no heading.
 */
export const markdown = (isCode = false): Extension => [
  language(),
  syntaxHighlighting(style),
  isCode ? textIn("code") : [textIn("markdown"), syntaxHighlighting(fontStyle)],
];

/** Whether the file at `path` is markdown, whose text the editor draws in markdown's fonts. */
export const isMarkdownPath = (path: string) => /\.(md|markdown)$/i.test(path);

/** A stretch of a message's text, in the font markdown sets it in, or prose's. */
export type FontRun = { font?: MarkdownFont; text: string };

/** Names a stretch's font by the classes it has: code's wins, as in the editor. */
const fonts = tagHighlighter([
  { class: "code", tag: codeFont },
  { class: "heading", tag: headingFont },
]);

const fontOf = (classes: string): MarkdownFont | undefined =>
  classes.includes("code") ? "code" : classes.includes("heading") ? "heading" : undefined;

/** `text`, cut where its font changes, as the editor draws it: its line breaks in prose's font. */
export function fontRuns(text: string): Array<FontRun> {
  const runs: Array<FontRun> = [];
  const put = (part: string, font: MarkdownFont | undefined) => {
    const last = runs.at(-1);
    if (last && last.font === font) {
      last.text += part;
    } else {
      runs.push(font ? { font, text: part } : { text: part });
    }
  };
  const tree = language().language.parser.parse(text);
  highlightCode(
    text,
    tree,
    fonts,
    (part, classes) => put(part, fontOf(classes)),
    () => put("\n", undefined),
  );
  return runs;
}
