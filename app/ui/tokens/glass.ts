// Glass: what the shader of `Glass` takes. The tint and its shares are mixed in Rust, where the
// contrast of text over glass is measured.
import { alpha } from "./mix";
import type { Source } from "./source";

export function glass({ dark, role, mixed }: Source) {
  return {
    /** The tint's colour, the theme's `glass-tint`. */
    tint: mixed.glassTint,
    /** The tint's share over a page far from it, and what it gains over one near it. */
    strength: mixed.glassStrength,
    thicken: mixed.glassThicken,
    /** The frost: a Gaussian blur of this deviation, so 14 px across. */
    frost: 7,
    /** The share of the frost left at the very edge, which is sharper than the middle. */
    edgeFrost: 0.35,
    saturate: mixed.glassSaturate,
    brightness: mixed.glassBrightness,
    /** The bent band: its width, and the pull at the very edge, in bands. */
    band: 22,
    bandMin: 12,
    pull: 1.6,
    fringe: 0.025,
    rim: role.glassRim,
    rimCorner: dark ? 0.6 : 1,
    rimBetween: dark ? 0.07 : 0.35,
    /** Light inside: the line under the top edge, the sheen, and the shade above the bottom. */
    line: dark ? 0.18 : 0.9,
    // In the light theme, white over a light tint reads as a white card, not glass: the tint
    // alone holds the contrast floor, so the light inside stays a hint there too.
    sheen: dark ? 0.07 : 0.18,
    glow: dark ? 0.035 : 0.1,
    shade: dark ? 0.45 : 0.12,
    grain: dark ? 0.05 : 0.015,
    /** A well in glass. */
    well: mixed.deeper,
    /** The plate an overlay's title sits on. */
    plate: alpha(role.page, 0.92),
    /** The line of light inside the plate's top edge, as a `boxShadow`. */
    plateLip: `inset 0 1px 0 ${alpha(role.glassRim, 0.12)}`,
  };
}
