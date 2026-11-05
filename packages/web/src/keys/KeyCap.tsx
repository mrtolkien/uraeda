// A key as the UI writes it, as typed, in the code's font and the key's colour: the status line's,
// the leader menu's, a row bar's, and a confirmation's. An Astryx gap (plan, Complexity tracking): `Kbd` writes keys in capitals, "J K".
import { colorVars, fontWeightVars, typographyVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { ArrowGlyph, isArrow, SpaceGlyph } from "./Glyphs.tsx";

const styles = stylex.create({
  key: {
    color: colorVars["--color-text-orange"],
    // The code's font, where a browser sets a `kbd` in its own monospace one (`theme/fonts.ts`).
    fontFamily: typographyVars["--font-family-code"],
    fontWeight: fontWeightVars["--font-weight-bold"],
  },
});

/** What a key is drawn as: Space, written "space", and an arrow, as glyphs; the rest as typed. */
function drawn(children: ReactNode) {
  if (children === "space") {
    return <SpaceGlyph />;
  }
  return isArrow(children) ? <ArrowGlyph arrow={children} /> : children;
}

/** The keys, as typed: "j k", "⏎". Space, written "space", and an arrow are their glyphs. */
export function KeyCap({ children }: { children: ReactNode }) {
  return <kbd {...stylex.props(styles.key)}>{drawn(children)}</kbd>;
}
