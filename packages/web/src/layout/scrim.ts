// The dim behind a dialog, without the blur Astryx gives it: a blurred backdrop covers the whole
// window, and the browser draws it again on every frame the dialog changes, about 45 ms of
// compositing per key typed in its field. The page is dimmed only, as a terminal's popup does.
import * as stylex from "@stylexjs/stylex";

export const scrimStyles = stylex.create({
  // On a `Dialog`'s `xstyle`: its `::backdrop` keeps its colour, and loses its blur.
  unblurred: {
    "::backdrop": {
      backdropFilter: "none",
      // oxlint-disable-next-line stylex/valid-styles -- WebKit's own spelling, which Safari still needs
      WebkitBackdropFilter: "none",
    },
  },
});
