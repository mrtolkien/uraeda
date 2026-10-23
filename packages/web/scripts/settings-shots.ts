/**
 * The screenshots' views of the settings page: the form with the settings file's values, a refused
 * host name, and a flag and a variable in force, Sign-in's confirmation, the form opened at its Runs
 * section, and a search with a match and without one; the form's shots show Settings selected, in
 * the column's foot or the phone's tabs. The flag and the variable are a second server's, started
 * with them in its environment, since a server reads them once.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "playwright";
import { type Each, settle, show } from "./shots.ts";

/** The settings file the views read, as a human would keep it. */
const FILE = `# Uraeda's settings. The settings page writes this file too, and keeps your comments.

[server]
allowed_hosts = [
  "mac.tail1234.ts.net",
  "uraeda.example.com", # the Caddy proxy
]
port = 4310
open_browser = true
`;

/** Starts a second server with `env` in its environment, giving its URL and a way to stop it. */
export type Serve = (
  env: Record<string, string>,
) => Promise<{ close: () => Promise<void>; url: string }>;

/** The form, its file's values shown. */
const form = (page: Page) => show(page, "/settings", "mac.tail1234.ts.net");

/** Every view of the settings page, at both sizes and in both themes. */
export async function takeSettings(each: Each, configDir: string, serve: Serve, prefix: string) {
  writeFileSync(join(configDir, "config.toml"), FILE);
  await each("settings", ({ page }) => form(page));
  await each("settings-host-refused", async ({ page }) => {
    await form(page);
    await page.getByRole("button", { name: "Add a host name" }).click();
    await page.getByRole("textbox", { name: "New host name" }).fill("https://mac.tail1234.ts.net");
    await page.keyboard.press("Enter");
    await page
      .getByText(/is not a host name/)
      .first()
      .waitFor();
    await settle(page);
  });
  await each("settings-sign-in-confirm", async ({ page }) => {
    await show(page, "/settings/sign-in", "Sign out everywhere…");
    await page.getByRole("button", { name: "Sign out everywhere…" }).click();
    await page.getByRole("dialog", { name: "Sign out every device?" }).waitFor();
    await settle(page);
  });
  await each("settings-runs", ({ page }) =>
    show(page, "/settings/runs", "Sub-agents during the implementation"),
  );
  await each("settings-search", async ({ page }) => {
    await form(page);
    await page.getByRole("textbox", { name: "Search settings" }).fill("port");
    await page.getByRole("region", { name: "Appearance" }).waitFor({ state: "detached" });
    await settle(page);
  });
  await each("settings-search-none", async ({ page }) => {
    await form(page);
    await page.getByRole("textbox", { name: "Search settings" }).fill("zzz");
    await page.getByText("No setting matches “zzz”.").waitFor();
    await settle(page);
  });

  // Last: a second server, its host names and port given by a variable, opening no browser.
  const second = await serve({
    URAEDA_ALLOWED_HOSTS: "build.tail1234.ts.net",
    URAEDA_PORT: "4400",
  });
  try {
    await each("settings-server-overridden", async ({ page }) => {
      await page.goto(`${second.url}${prefix}/settings`);
      await page.getByText("Set by URAEDA_ALLOWED_HOSTS for this run").first().waitFor();
      await settle(page);
    });
  } finally {
    await second.close();
  }
}
