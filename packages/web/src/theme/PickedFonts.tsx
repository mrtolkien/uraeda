// The fonts picked (`fonts.ts`), over the theme's own, for all it holds: the app's root, inside
// Astryx's `Theme`, and a story's in Storybook. It draws no box of its own.
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { fontRoot, useFontStyle } from "./fonts.ts";

export function PickedFonts({ children }: { children: ReactNode }) {
  return <div {...stylex.props(fontRoot, useFontStyle())}>{children}</div>;
}
