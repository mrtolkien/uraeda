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

/** The rule's text: a block per given mode, each setting its tokens. */
export function paletteCss(tokens: { dark?: Tokens; light?: Tokens }): string {
  return (["dark", "light"] as const satisfies Array<Mode>)
    .flatMap((mode) => {
      const declarations = Object.entries(tokens[mode] ?? {})
        .filter(([name, colour]) => NAME.test(name) && COLOUR.test(colour))
        .map(([name, colour]) => `  ${name}: ${colour};\n`);
      return declarations.length === 0
        ? []
        : [`[data-astryx-theme="uraeda"][data-theme="${mode}"] {\n${declarations.join("")}}\n`];
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
