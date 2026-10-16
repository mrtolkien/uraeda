/**
 * The screenshots' views of the settings page: its categories, the Server category with the
 * settings file's values, a refused host name, and a flag and a variable in force, Appearance,
 * Sign-in and its confirmation, a category of later settings, a search, and the navigation's footer
 * with Settings. The flag and the variable are a second server's, started with them in its
 * environment, since a server reads them once.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "playwright";
import { type Each, type Size, settle, show } from "./shots.ts";

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

/** The Server category, its file's values shown. */
const server = (page: Page) => show(page, "/settings/server", "mac.tail1234.ts.net");

/** The Sign-in category. */
const signIn = (page: Page) => show(page, "/settings/sign-in", "Sign out everywhere…");

/** The settings page with the navigation open on the phone, its footer's Settings selected. */
async function footer(page: Page, size: Size) {
  await show(page, "/settings", "Host names, port, and start");
  if (size === "phone") {
    await page.getByRole("button", { name: "Open navigation" }).click();
    // The drawer's footer, under its sessions: scrolled to.
    const item = page.getByRole("link", { exact: true, name: "Settings" });
    await item.scrollIntoViewIfNeeded();
    await settle(page);
  }
}

/** Every view of the settings page, at both sizes and in both themes. */
export async function takeSettings(each: Each, configDir: string, serve: Serve, prefix: string) {
  writeFileSync(join(configDir, "config.toml"), FILE);
  await each("settings", ({ page }) => show(page, "/settings", "Host names, port, and start"));
  await each("settings-server", ({ page }) => server(page));
  await each("settings-host-refused", async ({ page }) => {
    await server(page);
    await page.getByRole("button", { name: "＋ Add a host name" }).click();
    await page.getByRole("textbox", { name: "New host name" }).fill("https://mac.tail1234.ts.net");
    await page.keyboard.press("Enter");
    await page
      .getByText(/is not a host name/)
      .first()
      .waitFor();
    await settle(page);
  });
  await each("settings-appearance", ({ page }) =>
    show(page, "/settings/appearance", "Kept on this browser only"),
  );
  await each("settings-sign-in", ({ page }) => signIn(page));
  await each("settings-sign-in-confirm", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: "Sign out everywhere…" }).click();
    await page.getByRole("dialog", { name: "Sign out every device?" }).waitFor();
    await settle(page);
  });
  await each("settings-runs", ({ page }) =>
    show(page, "/settings/runs", "Sub-agents during the implementation"),
  );
  await each("settings-search", async ({ page }) => {
    await show(page, "/settings", "Host names, port, and start");
    await page.getByRole("textbox", { name: "Search settings" }).fill("model");
    await page.getByRole("list", { name: "Settings found" }).waitFor();
    await settle(page);
  });
  await each("settings-search-none", async ({ page }) => {
    await show(page, "/settings", "Host names, port, and start");
    await page.getByRole("textbox", { name: "Search settings" }).fill("xyz");
    await page.getByText("No setting matches “xyz”.").waitFor();
    await settle(page);
  });
  await each("settings-footer", ({ page, size }) => footer(page, size));

  // Last: a second server, its host names and port given by a variable, opening no browser.
  const second = await serve({
    URAEDA_ALLOWED_HOSTS: "build.tail1234.ts.net",
    URAEDA_PORT: "4400",
  });
  try {
    await each("settings-server-overridden", async ({ page }) => {
      await page.goto(`${second.url}${prefix}/settings/server`);
      await page.getByText("Set by URAEDA_ALLOWED_HOSTS for this run").first().waitFor();
      await settle(page);
    });
  } finally {
    await second.close();
  }
}
