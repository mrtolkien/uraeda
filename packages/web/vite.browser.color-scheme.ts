// The browser tests' system setting, emulated: the colour scheme, which the UI's theme follows
// until the settings page brings a choice back (R5).
import type { BrowserCommandContext } from "vite-plus/test/node";

/** The context's page, which the Playwright provider gives. */
const pageOf = (context: BrowserCommandContext) =>
  (
    context as BrowserCommandContext & {
      page: { emulateMedia(media: { colorScheme: "light" | "dark" }): Promise<void> };
    }
  ).page;

/** Sets the page's `prefers-color-scheme`, which the UI's theme follows. */
export async function setColorScheme(context: BrowserCommandContext, mode: "light" | "dark") {
  await pageOf(context).emulateMedia({ colorScheme: mode });
}
