// Buttons and keys. The main action is a lamp, every other button a tube, and a key a chip. The
// functions take a tone, the role a button is drawn in: the accent, or red for a dangerous one.
import { choices } from "./choices";
import { alpha, mix } from "./mix";
import type { Source } from "./source";

export function button({ role }: Source) {
  return {
    /** A line of the reading size, 3 px over and under it, and its two 1 px edges. */
    height: 32,
    padding: 14,
    main: {
      look: choices["button.main.look"],
      /** Whether a view's one main action breathes: its glow swells and settles. */
      motion: choices["button.main.motion"],
      fill: (tone: string) =>
        `linear-gradient(180deg, ${mix(tone, "#ffffff", 0.86)}, ${tone} 55%, ${mix(tone, "#000000", 0.9)})`,
      rest: (tone: string) =>
        `inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 5px 14px -2px ${alpha(tone, 0.45)}`,
      hot: (tone: string) =>
        `inset 0 1px 0 rgba(255, 255, 255, 0.34), 0 6px 24px 0 ${alpha(tone, 0.68)}`,
      pressed: "inset 0 2px 4px rgba(0, 0, 0, 0.35)",
      /** The two ends of a breath, which takes `motion.breath`. */
      breathLow: (tone: string) =>
        `inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 4px 10px -2px ${alpha(tone, 0.32)}`,
      breathHigh: (tone: string) => `0 6px 26px 2px ${alpha(tone, 0.7)}`,
      hotBrightness: 1.07,
      pressedBrightness: 0.9,
    },
    tube: {
      fill: alpha(role.well, 0.72),
      border: role.rule,
      hotFill: (tone: string) => mix(tone, role.well, 0.1),
      hotText: (tone: string) => mix(tone, role.ink, 0.75),
      /** Light fills a hot tube from its two long edges, and spills round it. */
      hotLight: (tone: string) =>
        `linear-gradient(180deg, ${alpha(tone, 0.24)}, ${alpha(tone, 0.06)} 50%, ${alpha(tone, 0.24)})`,
      hot: (tone: string) => `0 0 16px ${alpha(tone, 0.5)}`,
      pressedFill: role.well,
      pressed: "inset 0 2px 4px rgba(0, 0, 0, 0.45)",
      dangerBorder: alpha(role.removed, 0.75),
      /** A dangerous tube is lit a little even at rest. */
      dangerLight: `linear-gradient(180deg, ${alpha(role.removed, 0.13)}, ${alpha(role.removed, 0.03)} 50%, ${alpha(role.removed, 0.13)})`,
    },
    disabledBorder: role.ruleQuiet,
    focusRing: (tone: string) => mix(tone, "#ffffff", 0.7),
    focusOffset: 3,
  };
}

export function key({ role, mixed }: Source) {
  return {
    look: choices["key.look"],
    /** The block's side: 2 px less than a line, so a key never makes its line taller. */
    size: 22,
    padding: 6,
    text: role.action,
    /** The block: dark in a dark theme, the lightest in a light one, so the letter reads anywhere. */
    fill: mixed.keyFill,
    hot: mixed.keyHot,
    pressed: mixed.keyPressed,
    /** On the main button: the letter in the button's text colour, on a faint block. */
    onMain: alpha(role.onAction, 0.14),
  };
}
