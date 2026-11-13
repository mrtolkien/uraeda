// What the app does before its first frame: it reads what this device keeps, and shows the theme
// it showed last, or the default of the system's mode, with the fonts picked here.
import { colorScheme, effect, host, lifecycle } from "nsh";
import { device } from "../../store";
import { restoreUnsaved } from "../../ui/text";
import { applyFonts, applyTheme, followSystem, pickTheme } from "../../ui/theme";
import { DEFAULT_THEMES, type Mode } from "../../ui/tokens";

/** The mode the host names, as a picture of each theme does: none for the app itself. */
const asked = (): Mode | undefined =>
  host.params.theme === "light" || host.params.theme === "dark" ? host.params.theme : undefined;

/** The system's mode, unless the host names one. */
export function scheme(): Mode {
  return asked() ?? (colorScheme() === "light" ? "light" : "dark");
}

/**
 * The theme this device picked, and whether the theme shown is kept for the next start. A picture
 * names its mode and shows that mode's default theme: it neither reads this device's choice, which
 * a mode picked here would override, nor keeps what it shows, which the next start would open in.
 * The device's storage is the machine's, shared by every run of the app and of its tests.
 */
export const deviceTheme = () => (asked() === undefined ? device.get("theme") : undefined);
export const keepsShownTheme = () => asked() === undefined;

/** Whether this device follows the system's appearance: its owner's choice, "System" until one. */
export const followsSystem = () =>
  asked() === undefined && (deviceTheme()?.mode ?? "system") === "system";

export async function boot() {
  await device.load();
  followSystem(followsSystem());
  const named = keepsShownTheme() ? device.get("theme.shown") : undefined;
  applyTheme(named ?? pickTheme(Object.values(DEFAULT_THEMES), deviceTheme(), scheme()));
  applyFonts(device.get("fonts"));
  // Unsaved text older than 30 days goes before a field shows it, and a text the app closed on
  // while sending is back in its field.
  restoreUnsaved(new Date());
  // What waits for a pause in the typing is written as the app leaves the front, or closes.
  effect(() => {
    if (lifecycle() !== "active") device.flush();
  });
}
