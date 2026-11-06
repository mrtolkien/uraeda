// The phone's safe areas, as a home-screen app sees them (`viewport-fit=cover` in `index.html`):
// the status bar's at the top, the home indicator's and the rounded corners' at the bottom. Bars
// pad by them so no control sits where the system takes the touch. None on a desktop.
import * as stylex from "@stylexjs/stylex";

export const safeAreaVars = stylex.defineVars({
  "--safe-area-bottom": "env(safe-area-inset-bottom, 0px)",
  "--safe-area-top": "env(safe-area-inset-top, 0px)",
  // How far Astryx's bottom sheet runs on under the screen's bottom edge, its `margin-bottom:
  // -48px`, so a drag up shows no gap under it.
  "--sheet-bleed": "48px",
});
