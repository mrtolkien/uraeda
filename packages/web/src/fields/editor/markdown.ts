// Markdown highlighting in every field, Vim on or off (Text editing decision): the structure in the
// theme's Catppuccin colours, its marks (`#`, `**`, `[`, `` ` ``) dimmed, after `mockups/editor.css`.
import { markdown as markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { tags } from "@lezer/highlight";

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

/**
 * Markdown's language and its highlighting. Its own keys stay off: Enter adds a plain line, as the
 * fields did before the editor, rather than continuing a list.
 */
export const markdown = (): Extension => [
  markdownLanguage({ addKeymap: false }),
  syntaxHighlighting(style),
];
