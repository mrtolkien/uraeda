// The theme shown and the fonts picked: what the app's shell, the settings, and the gallery call
// to change what `tokens` gives. A choice is kept per device, in `app/store/device.ts`, by who
// calls these: the library keeps nothing.
import { type Accessor, setColorScheme, signal } from "nsh";
import { showTheme } from "uraeda/native";
import {
  DEFAULT_THEMES,
  type Fonts,
  fontOf,
  type Mode,
  showTokens,
  type ThemeSource,
  tokensOf,
  wholeFonts,
} from "./tokens";
import { showFaces } from "./tokens/faces";
import { wholeRoles } from "./tokens/roles";

/** The themes picked on a device: which mode it shows, and the theme of each mode, by its id. */
export type ThemeChoice = {
  /** `system` follows the device's appearance. */
  mode: Mode | "system";
  dark: string;
  light: string;
};

/** What a device shows until its owner picks: the system's mode, in Catppuccin. */
export const DEFAULT_THEME_CHOICE: ThemeChoice = {
  mode: "system",
  dark: DEFAULT_THEMES.dark.id,
  light: DEFAULT_THEMES.light.id,
};

const theme = signal<ThemeSource>(DEFAULT_THEMES.dark);
const fonts = signal<Fonts>(wholeFonts(undefined));

/** The theme shown. */
export const shownTheme: Accessor<ThemeSource> = theme;

/** The fonts picked, one bundled font's id for each part. */
export const pickedFonts: Accessor<Fonts> = fonts;

/** Draws what Native Shell draws itself, its own text views, editors, and menus, as the tokens. */
function showNative(next: ThemeSource, picked: Fonts) {
  setColorScheme(next.mode === "light" ? "light" : "dark");
  const families = [fontOf("body", picked.body).family, fontOf("code", picked.code).family];
  showTheme(JSON.stringify(wholeRoles(next)), families[0]!, families[1]!).catch(
    (error: unknown) => {
      console.warn(
        `The theme ${next.id} did not reach Native Shell's own colours: ${String(error)}`,
      );
    },
  );
}

/**
 * Shows `next`: `tokens` gives its colours from now on, and Native Shell's own tokens take its
 * roles. A role it lacks comes from the default theme of its mode. A theme whose colours cannot
 * be read changes nothing: the theme shown stays, and the answer is `false`.
 */
export function applyTheme(next: ThemeSource): boolean {
  try {
    showTokens(tokensOf(next, fonts()));
  } catch (error) {
    console.warn(`The theme ${next.id} cannot be shown: ${String(error)}`);
    return false;
  }
  theme.set(next);
  showNative(next, fonts());
  return true;
}

/** Shows the fonts `picked`, the default for each part it leaves out or names no bundled font for. */
export function applyFonts(picked: Partial<Fonts> | undefined) {
  const next = wholeFonts(picked);
  showFaces(Object.values(next));
  fonts.set(next);
  showTokens(tokensOf(theme(), next));
  showNative(theme(), next);
}

/**
 * The theme a device's `choice` shows among `themes`, where the system's appearance is `scheme`:
 * the one picked for the mode, else that mode's default.
 */
export function pickTheme(
  themes: ReadonlyArray<ThemeSource>,
  choice: ThemeChoice | undefined,
  scheme: Mode,
): ThemeSource {
  const picked = choice ?? DEFAULT_THEME_CHOICE;
  const mode = picked.mode === "system" ? scheme : picked.mode;
  const found = themes.find((one) => one.id === picked[mode] && one.mode === mode);
  return found ?? themes.find((one) => one.id === DEFAULT_THEMES[mode].id) ?? DEFAULT_THEMES[mode];
}
