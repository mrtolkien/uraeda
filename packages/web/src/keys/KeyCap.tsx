// A key as the UI writes it, as typed, in the UI's font and the key's colour: the status line's and
// the leader menu's. An Astryx gap (plan, Complexity tracking): `Kbd` writes keys in capitals, "J K".
import { colorVars, fontWeightVars, typographyVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { SpaceGlyph } from "./Glyphs.tsx";

const styles = stylex.create({
  key: {
    color: colorVars["--color-text-orange"],
    // The UI's font, where a browser sets a `kbd` in its own monospace one.
    fontFamily: typographyVars["--font-family-body"],
    fontWeight: fontWeightVars["--font-weight-bold"],
  },
});

/** The keys, as typed: "j k", "⏎". Space, written "space", is its narrow glyph. */
export function KeyCap({ children }: { children: ReactNode }) {
  return <kbd {...stylex.props(styles.key)}>{children === "space" ? <SpaceGlyph /> : children}</kbd>;
}
