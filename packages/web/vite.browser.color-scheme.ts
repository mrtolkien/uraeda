// The browser tests' system settings, emulated: the colour scheme, which the UI's theme follows
// until the settings page brings a choice back (R5), and reduced motion.
import type { BrowserCommandContext } from "vite-plus/test/node";

type Media = { colorScheme?: "light" | "dark"; reducedMotion?: "reduce" | "no-preference" };

/** The context's page, which the Playwright provider gives. */
const pageOf = (context: BrowserCommandContext) =>
  (context as BrowserCommandContext & { page: { emulateMedia(media: Media): Promise<void> } }).page;

/** Sets the page's `prefers-color-scheme`, which the UI's theme follows. */
export async function setColorScheme(context: BrowserCommandContext, mode: "light" | "dark") {
  await pageOf(context).emulateMedia({ colorScheme: mode });
}

/** Sets the page's `prefers-reduced-motion`. */
export async function setReducedMotion(context: BrowserCommandContext, reduce: boolean) {
  await pageOf(context).emulateMedia({ reducedMotion: reduce ? "reduce" : "no-preference" });
}
