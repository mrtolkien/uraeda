// The Monaspace faces again, their ascent and descent set so a line's box centres on the capitals.
// Monaspace's own metrics put 0.78 em above the baseline and 0.22 below, for capitals 0.73 em tall:
// centred in its line, a label's capitals sat 0.085 em above the middle, so the icon beside every
// label, centred on the line's box, read as too low, and its text as top aligned (1 to 2 px). 86.5%
// and 13.5% keep the line as tall, and centre the capitals: a face added here comes after the
// stylesheets' of the same family and weight, so it is the one the page uses. The other bundled
// fonts measure within 0.01 em already.
import neon400 from "@fontsource/monaspace-neon/files/monaspace-neon-latin-400-normal.woff2?url";
import neon500 from "@fontsource/monaspace-neon/files/monaspace-neon-latin-500-normal.woff2?url";
import neon600 from "@fontsource/monaspace-neon/files/monaspace-neon-latin-600-normal.woff2?url";
import neon700 from "@fontsource/monaspace-neon/files/monaspace-neon-latin-700-normal.woff2?url";
import neon400i from "@fontsource/monaspace-neon/files/monaspace-neon-latin-400-italic.woff2?url";
import argon400 from "@fontsource/monaspace-argon/files/monaspace-argon-latin-400-normal.woff2?url";
import argon500 from "@fontsource/monaspace-argon/files/monaspace-argon-latin-500-normal.woff2?url";
import argon600 from "@fontsource/monaspace-argon/files/monaspace-argon-latin-600-normal.woff2?url";
import argon700 from "@fontsource/monaspace-argon/files/monaspace-argon-latin-700-normal.woff2?url";
import argon400i from "@fontsource/monaspace-argon/files/monaspace-argon-latin-400-italic.woff2?url";
import xenon400 from "@fontsource/monaspace-xenon/files/monaspace-xenon-latin-400-normal.woff2?url";
import xenon500 from "@fontsource/monaspace-xenon/files/monaspace-xenon-latin-500-normal.woff2?url";
import xenon600 from "@fontsource/monaspace-xenon/files/monaspace-xenon-latin-600-normal.woff2?url";
import xenon700 from "@fontsource/monaspace-xenon/files/monaspace-xenon-latin-700-normal.woff2?url";
import xenon400i from "@fontsource/monaspace-xenon/files/monaspace-xenon-latin-400-italic.woff2?url";
import radon400 from "@fontsource/monaspace-radon/files/monaspace-radon-latin-400-normal.woff2?url";
import radon500 from "@fontsource/monaspace-radon/files/monaspace-radon-latin-500-normal.woff2?url";
import radon600 from "@fontsource/monaspace-radon/files/monaspace-radon-latin-600-normal.woff2?url";
import radon700 from "@fontsource/monaspace-radon/files/monaspace-radon-latin-700-normal.woff2?url";
import radon400i from "@fontsource/monaspace-radon/files/monaspace-radon-latin-400-italic.woff2?url";
import krypton400 from "@fontsource/monaspace-krypton/files/monaspace-krypton-latin-400-normal.woff2?url";
import krypton500 from "@fontsource/monaspace-krypton/files/monaspace-krypton-latin-500-normal.woff2?url";
import krypton600 from "@fontsource/monaspace-krypton/files/monaspace-krypton-latin-600-normal.woff2?url";
import krypton700 from "@fontsource/monaspace-krypton/files/monaspace-krypton-latin-700-normal.woff2?url";
import krypton400i from "@fontsource/monaspace-krypton/files/monaspace-krypton-latin-400-italic.woff2?url";

/** Above and below the baseline, of the line's height: the capitals' centre is the box's. */
const CAPS_CENTRED = { ascentOverride: "86.5%", descentOverride: "13.5%" } as const;

const FACES: ReadonlyArray<readonly [string, string, string, string]> = [
  ["Neon", "400", "normal", neon400],
  ["Neon", "500", "normal", neon500],
  ["Neon", "600", "normal", neon600],
  ["Neon", "700", "normal", neon700],
  ["Neon", "400", "italic", neon400i],
  ["Argon", "400", "normal", argon400],
  ["Argon", "500", "normal", argon500],
  ["Argon", "600", "normal", argon600],
  ["Argon", "700", "normal", argon700],
  ["Argon", "400", "italic", argon400i],
  ["Xenon", "400", "normal", xenon400],
  ["Xenon", "500", "normal", xenon500],
  ["Xenon", "600", "normal", xenon600],
  ["Xenon", "700", "normal", xenon700],
  ["Xenon", "400", "italic", xenon400i],
  ["Radon", "400", "normal", radon400],
  ["Radon", "500", "normal", radon500],
  ["Radon", "600", "normal", radon600],
  ["Radon", "700", "normal", radon700],
  ["Radon", "400", "italic", radon400i],
  ["Krypton", "400", "normal", krypton400],
  ["Krypton", "500", "normal", krypton500],
  ["Krypton", "600", "normal", krypton600],
  ["Krypton", "700", "normal", krypton700],
  ["Krypton", "400", "italic", krypton400i],
];

/** Adds every Monaspace face, centred on its capitals, to the page's fonts, once. */
export function centreMonaspaceCaps() {
  if (typeof FontFace === "undefined" || typeof document === "undefined") {
    return;
  }
  for (const [face, weight, style, url] of FACES) {
    document.fonts.add(
      new FontFace(`Monaspace ${face}`, `url(${url}) format("woff2")`, {
        ...CAPS_CENTRED,
        display: "swap",
        style,
        weight,
      }),
    );
  }
}

centreMonaspaceCaps();
