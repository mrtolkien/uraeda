// What the app does before its first frame: it reads what this device keeps, and shows the theme
// it showed last, or the default of the system's mode, with the fonts picked here.
import { colorScheme, host } from "nsh";
import { device } from "../../store";
import { pruneUnsaved } from "../../ui/text";
import { applyFonts, applyTheme, pickTheme } from "../../ui/theme";
import { DEFAULT_THEMES, type Mode } from "../../ui/tokens";

/** The system's mode, unless the host names one, as a picture of each theme does. */
export function scheme(): Mode {
  const asked = host.params.theme;
  if (asked === "light" || asked === "dark") return asked;
  return colorScheme() === "light" ? "light" : "dark";
}

export async function boot() {
  await device.load();
  const named = host.params.theme === undefined ? device.get("theme.shown") : undefined;
  applyTheme(named ?? pickTheme(Object.values(DEFAULT_THEMES), device.get("theme"), scheme()));
  applyFonts(device.get("fonts"));
  // Unsaved text older than 30 days goes before a field shows it.
  pruneUnsaved(new Date());
}
