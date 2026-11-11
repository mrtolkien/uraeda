// The tokens: the only source of colours, radii, blur, and glow for the component library, and
// through it for every screen. They are the design language's values,
// `specs/ui/design-language.md`, made from the theme shown and the fonts picked.
//
// `tokens` is live: reading one of its parts inside a style, a memo, or an effect follows the
// theme, so `style={{ backgroundColor: tokens.height.raised.fill }}` is drawn again when
// `applyTheme` (`app/ui/theme.ts`) shows another theme. Read it there, never in a component's
// body, which runs once.
import { type Accessor, signal } from "nsh";
import { backdrop } from "./backdrop";
import { button, key } from "./button";
import { choices } from "./choices";
import { control } from "./control";
import { DEFAULT_FONTS, type Fonts } from "./fonts";
import { glass } from "./glass";
import { height, pane } from "./height";
import { light, row } from "./light";
import { motion } from "./motion";
import { DEFAULT_THEMES, type ThemeSource } from "./roles";
import { sourceOf } from "./source";
import { radius, space, status } from "./space";
import { type } from "./type";

export { choices } from "./choices";
export type { Tone } from "./control";
export {
  DEFAULT_FONTS,
  FONT_ROLES,
  FONTS,
  type Font,
  type FontRole,
  type Fonts,
  fontOf,
  wholeFonts,
} from "./fonts";
export type { Glow, Height, HeightName } from "./height";
export { alpha, mix } from "./mix";
export { DEFAULT_THEMES, type Mode, type Roles, type ThemeSource } from "./roles";

/** The tokens of `theme` with the fonts `fonts`. It throws when one of the theme's roles is no colour. */
export function tokensOf(theme: ThemeSource, fonts: Fonts = DEFAULT_FONTS) {
  const source = sourceOf(theme);
  return {
    /** The theme's id, and its mode. */
    theme: theme.id,
    mode: source.mode,
    /** Every role of the theme, `role.inkFaint` for `ink-faint`. */
    role: source.role,
    /** What shade and shadows are made of: black, or a light theme's dark ink. */
    black: source.black,
    type: type(fonts),
    space,
    radius,
    backdrop: backdrop(source),
    height: height(source),
    pane: pane(source),
    light: light(source),
    row: row(source),
    glass: glass(source),
    button: button(source),
    key: key(source),
    control: control(source),
    status,
    motion,
    choices,
  };
}

export type Tokens = ReturnType<typeof tokensOf>;

const shown = signal<Tokens>(tokensOf(DEFAULT_THEMES.dark));

/** The tokens shown, whole: `tokens` reads them part by part. */
export const shownTokens: Accessor<Tokens> = shown;

/** Shows `next` everywhere `tokens` is read: `applyTheme` and `applyFonts` are its only callers. */
export function showTokens(next: Tokens) {
  shown.set(next);
}

/** An object whose parts are read from `read` each time, so who reads one follows it. */
function live<Value extends object>(read: Accessor<Value>): Value {
  const parts = {};
  for (const part of Object.keys(read())) {
    Object.defineProperty(parts, part, {
      enumerable: true,
      get: () => read()[part as keyof Value],
    });
  }
  return parts as Value;
}

/** The tokens of the theme shown. */
export const tokens: Tokens = live(shown);
