// What is under the panes: the theme's darkest colour, a still wash of its two accents, a grain.
import { choices } from "./choices";
import { alpha } from "./mix";
import type { Source } from "./source";

export function backdrop({ dark, role, black }: Source) {
  return {
    fill: role.backdrop,
    /** The two colours of the wash, and the share of each at its heart. */
    wash1: role.backdropWash1,
    wash2: role.backdropWash2,
    wash: choices["backdrop.wash"] ? (dark ? [0.11, 0.1] : [0.05, 0.04]) : [0, 0],
    grain: dark ? 0.05 : 0.035,
    /** How much the page dims behind an overlay that takes the focus. */
    dim: alpha(black, dark ? 0.2 : 0.1),
  };
}
