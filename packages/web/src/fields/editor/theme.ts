// The editor's look, a terminal's text after `mockups/editor.css`: the theme's monospace font, a 1 px
// frame, square corners, no inner shadow. CodeMirror styles the elements it creates itself, which
// StyleX cannot reach, so the look is CodeMirror's `EditorView.theme` over the Astryx theme's tokens,
// read as CSS variables: it follows the light and dark themes, and no global stylesheet is added.
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/** A line's height, in the field's font. */
const LINE = 1.5;
/** The room above and below the text, and before and after it. */
const PAD_BLOCK = "var(--spacing-1-5)";
const PAD_INLINE = "var(--spacing-2)";

/** The height of `lines` lines of text, with the room around them. */
const linesHigh = (lines: number) => `calc(${lines} * ${LINE}em + 2 * ${PAD_BLOCK})`;

/** The look every field shares. */
export const editorTheme: Extension = EditorView.theme({
  "&": {
    backgroundColor: "var(--color-background-surface)",
    border: "var(--border-width, 1px) solid var(--color-border)",
    borderRadius: "0",
    color: "var(--color-text-primary)",
    fontSize: "var(--font-size-base)",
  },
  // A disabled field, as Astryx's: its text dimmed.
  "&:has(.cm-content[contenteditable='false'])": { color: "var(--color-text-disabled)" },
  "&.cm-focused": { borderColor: "var(--color-accent)", outline: "none" },
  // The selection, the browser's own, or drawn by a layer like Vim's.
  ".cm-content": {
    caretColor: "var(--color-text-primary)",
    padding: `${PAD_BLOCK} 0`,
  },
  ".cm-content ::selection, .cm-selectionBackground": {
    backgroundColor: "var(--color-background-gray)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--color-text-primary)",
    borderLeftWidth: "2px",
  },
  ".cm-line": { padding: `0 ${PAD_INLINE}` },
  ".cm-placeholder": { color: "var(--color-syntax-comment)" },
  ".cm-scroller": { fontFamily: "var(--font-family-code)", lineHeight: String(LINE) },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "var(--color-background-gray)",
  },
});

/** The sizes made so far, one theme each, shared by the fields of the same size. */
const sizes = new Map<string, Extension>();

/**
 * A field's height: a one-line field grows with its text up to 9 lines, as tall as the phone's
 * composer, then scrolls inside; a several-lines field is `rows` lines tall, scrolling past them.
 * Neither ever scrolls sideways: the editor wraps its lines.
 */
export function sizeTheme(variant: "line" | "lines", rows: number): Extension {
  const key = `${variant}:${rows}`;
  let theme = sizes.get(key);
  if (!theme) {
    theme = EditorView.theme(
      variant === "line"
        ? { ".cm-scroller": { maxHeight: linesHigh(9), overflow: "auto" } }
        : { ".cm-scroller": { height: linesHigh(rows), overflow: "auto" } },
    );
    sizes.set(key, theme);
  }
  return theme;
}
