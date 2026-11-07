// The palette rule: the picked themes' tokens (`roles.ts`), one block per mode, over the built
// theme. The built theme declares its tokens in `@layer astryx-theme`, so this rule, unlayered,
// wins on every element that carries the theme and the mode: the page, a pane, a portalled dialog,
// the sandbox bar, and a story's document (R7, checked by `scripts/palette-probe.ts`).
import type { Mode, Tokens } from "./roles.ts";

/** The id of the one `<style>` the rule lives in. */
const ID = "uraeda-palette";

/** A custom property's name, and a colour the core gives: nothing else reaches the stylesheet. */
const NAME = /^--[\w-]+$/;
const COLOUR = /^#[\da-f]{6}(?:[\da-f]{2})?$/i;

/** Whether a value is a colour the core gives, a hex one: what a stored cache may hold besides. */
export function isColour(value: unknown): value is string {
  return typeof value === "string" && COLOUR.test(value);
}

/**
 * The rule's text: a block per given mode, each setting its tokens, then painting the root element
 * in the page's colour, which shows before the app mounts and where it does not reach, such as a
 * phone's overscroll: nothing else paints `<html>`, so the first frame would show the browser's
 * canvas (R14). The first paint's script in `index.html` writes the same text.
 */
export function paletteCss(tokens: { dark?: Tokens; light?: Tokens }): string {
  return (["dark", "light"] as const satisfies Array<Mode>)
    .flatMap((mode) => {
      const declarations = Object.entries(tokens[mode] ?? {})
        .filter(([name, colour]) => NAME.test(name) && COLOUR.test(colour))
        .map(([name, colour]) => `  ${name}: ${colour};\n`);
      return declarations.length === 0
        ? []
        : [
            `[data-astryx-theme="uraeda"][data-theme="${mode}"] {\n${declarations.join("")}}\n`,
            `html[data-astryx-theme="uraeda"][data-theme="${mode}"] {\n  background-color: var(--color-background-body);\n}\n`,
          ];
    })
    .join("");
}

/** Writes the rule into `doc`'s head, replacing the one written before. */
export function applyPalette(tokens: { dark?: Tokens; light?: Tokens }, doc: Document = document) {
  let style = doc.getElementById(ID);
  if (style === null) {
    style = doc.createElement("style");
    style.id = ID;
    doc.head.append(style);
  }
  style.textContent = paletteCss(tokens);
}
