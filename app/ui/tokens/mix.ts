// How two colours are mixed. The rule lives in Rust, `crates/app/src/theme/colour.rs`, which the
// contrast test of the shipped themes measures: the tokens mix nothing themselves.
import { fadeColour, mixColours } from "uraeda/native";

/** `share` of `a`, the rest of `b`, mixed in sRGB as CSS's `color-mix` does: `#rrggbb`. */
export function mix(a: string, b: string, share: number): string {
  return mixColours(a, b, share);
}

/** A colour at an opacity, of its own when it has one already: `rgba(r, g, b, a)`. */
export function alpha(colour: string, opacity: number): string {
  return fadeColour(colour, opacity);
}
