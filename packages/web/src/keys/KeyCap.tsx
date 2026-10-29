// A key as the UI writes it, as typed, in the code's font and the key's colour: the status line's,
// the leader menu's, a row bar's, and a confirmation's. An Astryx gap (plan, Complexity tracking): `Kbd` writes keys in capitals, "J K".
import { colorVars, fontWeightVars, typographyVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { SpaceGlyph } from "./Glyphs.tsx";

const styles = stylex.create({
  key: {
    color: colorVars["--color-text-orange"],
    // The code's font, where a browser sets a `kbd` in its own monospace one: the UI's too, with
    // the current fonts, and Monaspace's Krypton with the Monaspace experiment's (`theme/fonts.ts`).
    fontFamily: typographyVars["--font-family-code"],
    fontWeight: fontWeightVars["--font-weight-bold"],
  },
});

/** The keys, as typed: "j k", "⏎". Space, written "space", is its narrow glyph. */
export function KeyCap({ children }: { children: ReactNode }) {
  return (
    <kbd {...stylex.props(styles.key)}>{children === "space" ? <SpaceGlyph /> : children}</kbd>
  );
}
