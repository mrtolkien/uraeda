// The editor's look, a terminal's text after `mockups/editor.css`: the fonts picked for markdown
// (`markdown.ts`), a 1 px frame, square corners, no inner shadow. CodeMirror styles the elements it
// creates itself, which StyleX cannot reach, so the look is CodeMirror's `EditorView.theme` over
// the Astryx theme's tokens, read as CSS variables: it follows the light and dark themes, and no
// global stylesheet is added.
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { Variant } from "./Editor.tsx";

/** A line's height, in the field's font. */
const LINE = 1.5;
/** The room above and below the text, and before and after it. */
const PAD_BLOCK = "var(--spacing-1-5)";
const PAD_INLINE = "var(--spacing-2)";

/** The drawn selection's colour: the accent, Catppuccin's mauve, at `percent` over the ground. */
const selection = (percent: number) =>
  `color-mix(in srgb, var(--color-accent) ${percent}%, transparent)`;

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
  // The text, and the browser's own selection, with Vim off.
  ".cm-content": {
    caretColor: "var(--color-text-primary)",
    padding: `${PAD_BLOCK} 0`,
  },
  ".cm-content ::selection": { backgroundColor: "var(--color-background-gray)" },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--color-text-primary)",
    borderLeftWidth: "2px",
  },
  ".cm-line": { padding: `0 ${PAD_INLINE}` },
  ".cm-placeholder": { color: "var(--color-syntax-comment)" },
  ".cm-scroller": { lineHeight: String(LINE) },
  // The selection CodeMirror's layer draws, which the Vim layer adds: Visual mode's mauve, faint
  // enough for the text to read on it, where the grey hardly showed on the field's ground; fainter
  // still in a field without the focus.
  ".cm-selectionBackground": { backgroundColor: selection(12) },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: selection(25),
  },
});

/** The sizes made so far, one theme each, shared by the fields of the same size. */
const sizes = new Map<string, Extension>();

/**
 * The composer's look: no frame of its own, since the composer's box is its frame, and its height
 * growing with its text from `rows` to `maxRows`, then scrolling inside. A change of `rows`, as the
 * phone's composer folds or opens, slides its height.
 */
const composerTheme = (rows: number, maxRows: number) =>
  EditorView.theme({
    ".cm-scroller": {
      maxHeight: linesHigh(maxRows),
      minHeight: linesHigh(rows),
      overflow: "auto",
      transition: "min-height 150ms",
    },
    "@media (prefers-reduced-motion: reduce)": { ".cm-scroller": { transition: "none" } },
    // Over the frame every field has: two classes, as the composer's box is the frame.
    "&.cm-editor": { backgroundColor: "transparent", border: "none" },
  });

/**
 * A field's height: a one-line field grows with its text up to 9 lines, as tall as the phone's
 * composer, then scrolls inside; a several-lines field is `rows` lines tall, scrolling past them;
 * the composer grows from `rows` to `maxRows`; a page's fills the room its page gives it, and
 * scrolls inside, as Vim's screen motions, like Ctrl+D or `H`, measure its scroller. None ever scrolls sideways: the editor wraps its
 * lines.
 */
export function sizeTheme(variant: Variant, rows: number, maxRows = rows): Extension {
  const key = `${variant}:${rows}:${maxRows}`;
  let theme = sizes.get(key);
  if (!theme) {
    theme =
      variant === "composer"
        ? composerTheme(rows, maxRows)
        : EditorView.theme(
            variant === "line"
              ? { ".cm-scroller": { maxHeight: linesHigh(9), overflow: "auto" } }
              : variant === "page"
                ? { ".cm-scroller": { overflow: "auto" }, "&": { height: "100%" } }
                : { ".cm-scroller": { height: linesHigh(rows), overflow: "auto" } },
          );
    sizes.set(key, theme);
  }
  return theme;
}
