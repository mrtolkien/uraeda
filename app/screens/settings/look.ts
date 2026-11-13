// What this device shows, picked here and by the leader's `Space u m`, `Space u t`, and `Space u f`:
// the mode, the theme of each mode, and each part's font. Kept on the device alone; the frame
// follows them (`app/screens/shell/Frame.tsx`). One home, so the settings and the pickers pick alike.
import { device } from "../../store";
import { DEFAULT_THEME_CHOICE, type ThemeChoice } from "../../ui/theme";
import { DEFAULT_FONTS, type FontRole } from "../../ui/tokens";

/** The device's themes: the system's mode in Catppuccin until its owner picks. */
export const themeChoice = (): ThemeChoice => device.get("theme") ?? DEFAULT_THEME_CHOICE;

/** Shows `mode`: `system` follows the device's appearance. */
export function chooseMode(mode: ThemeChoice["mode"]) {
  device.set("theme", { ...themeChoice(), mode });
}

/**
 * Picks `theme` for its mode. `show` switches to that mode too, so a theme picked from the
 * leader's list is seen at once; the settings pick each mode's theme without leaving the mode.
 */
export function chooseTheme(theme: { id: string; mode: string }, show: boolean) {
  const mode = theme.mode === "light" ? "light" : "dark";
  const choice = themeChoice();
  device.set("theme", { ...choice, [mode]: theme.id, mode: show ? mode : choice.mode });
}

/** The font picked for a part, its default unless picked. */
export const fontPicked = (role: FontRole): string =>
  device.get("fonts")?.[role] ?? DEFAULT_FONTS[role];

/** Picks a part's font, by a bundled font's id. */
export function chooseFont(role: FontRole, id: string) {
  device.set("fonts", { ...device.get("fonts"), [role]: id });
}
