// The looks of the buttons, in each state: a lamp for the main action, a tube for every other, a
// red tube for a dangerous one, from `tokens.button`. `Button` and `IconButton` draw them.
import type { ViewStyle } from "nsh";
import type { Looks } from "./press";
import { tokens } from "../tokens";

export type Variant = "main" | "tube" | "danger";

/** A tube, dark glass with a thin edge; under the pointer or the focus its edge takes `tone`. */
function tube(tone: string, danger: boolean): Looks {
  const b = tokens.button;
  const hot: ViewStyle = {
    backgroundColor: b.tube.hotFill(tone),
    backgroundImage: b.tube.hotLight(tone),
    borderColor: tone,
    boxShadow: b.tube.hot(tone),
  };
  return {
    disabled: disabledLook(),
    focus: hot,
    hover: hot,
    pressed: {
      backgroundColor: b.tube.pressedFill,
      backgroundImage: "none",
      boxShadow: b.tube.pressed,
    },
    rest: {
      backgroundColor: b.tube.fill,
      backgroundImage: danger ? b.tube.dangerLight : "none",
      borderColor: danger ? b.tube.dangerBorder : b.tube.border,
      boxShadow: "none",
    },
  };
}

/** A lamp: filled with the accent, lighter at its top, with a glow under it. */
function lamp(tone: string): Looks {
  const m = tokens.button.main;
  const hot: ViewStyle = { boxShadow: m.hot(tone), filter: `brightness(${m.hotBrightness})` };
  const flat = tokens.button.main.look === "glow";
  return {
    disabled: disabledLook(),
    focus: hot,
    hover: hot,
    pressed: { boxShadow: m.pressed, filter: `brightness(${m.pressedBrightness})` },
    rest: {
      backgroundColor: flat ? tone : undefined,
      backgroundImage: flat ? "none" : m.fill(tone),
      borderColor: tone,
      boxShadow: m.rest(tone),
    },
  };
}

/** What every disabled button looks like: a dashed, quiet edge, and nothing lit. */
export function disabledLook(): ViewStyle {
  return {
    backgroundColor: "transparent",
    backgroundImage: "none",
    borderColor: tokens.button.disabledBorder,
    borderStyle: "dashed",
    boxShadow: "none",
    filter: "none",
  };
}

/** Whether a main action is drawn as a lamp here: on glass nothing is a filled block. */
export const isLamp = (variant: Variant, onGlass: boolean) =>
  variant === "main" && !onGlass && tokens.button.main.look !== "tube";

/** The tone a button is drawn in: the accent, or red for a dangerous one. */
export const toneOf = (variant: Variant) =>
  variant === "danger" ? tokens.role.removed : tokens.role.action;

/** A button's looks, by its variant and whether it sits on glass. */
export function buttonLooks(variant: Variant, onGlass: boolean): Looks {
  const tone = toneOf(variant);
  if (isLamp(variant, onGlass)) {
    return lamp(tone);
  }
  const looks = tube(tone, variant === "danger");
  // The main action as a tube keeps its accent edge: it is still the one to press.
  return variant === "main" ? { ...looks, rest: { ...looks.rest, borderColor: tone } } : looks;
}

/** The colour of a button's words. */
export function inkOfButton(variant: Variant, onGlass: boolean, disabled: boolean): string {
  if (disabled) {
    return tokens.role.inkFaint;
  }
  if (isLamp(variant, onGlass)) {
    return tokens.role.onAction;
  }
  if (variant === "danger") {
    return tokens.role.removed;
  }
  // The main action as a tube: its words in the accent, bold. Text never glows.
  return variant === "main" ? tokens.role.action : tokens.role.ink;
}
