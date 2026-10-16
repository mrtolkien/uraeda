// The shell's new states, for the interface's redesign: the folded rail, a card's settings, the
// banner that asks to notify, and the add form's suggestion the arrows are on.
import type { Page } from "playwright";
import { type Each, type Size, settle, show } from "./shots.ts";

export async function takeShell(each: Each, sidebar: (page: Page, size: Size) => Promise<void>) {
  await each(
    "sidebar-folded",
    async ({ page }) => {
      await show(page, "/", "Waiting on you");
      await page.keyboard.press("[");
      await page.getByRole("button", { name: "Expand sidebar" }).waitFor();
      await settle(page);
    },
    "desktop",
  );
  await each("feature-settings", async ({ page, size }) => {
    // Unfolded again: the folded rail's shot left its state in the browser.
    await show(page, "/", "Waiting on you");
    await page.evaluate(() => {
      for (const key of Object.keys(window.localStorage)) {
        if (key.includes("uraeda.nav")) {
          window.localStorage.removeItem(key);
        }
      }
    });
    await sidebar(page, size);
    await page.getByRole("button", { name: "Settings of cli-tuis" }).click();
    const dialog = page.getByRole("dialog", { name: "Feature settings" });
    await dialog.getByRole("textbox", { name: "Name in the sidebar" }).fill("Terminal UIs");
    await dialog.getByRole("radio", { name: "Purple" }).click();
    await settle(page);
  });
  await each("notify-banner", async ({ page }) => {
    await page.evaluate(() => {
      window.name = "banner";
      window.localStorage.removeItem("uraeda.notifications");
    });
    await show(page, "/", "Get notified when an agent needs you");
    await page.evaluate(() => {
      window.name = "";
    });
  });
  await each("repositories-add-active", async ({ page }) => {
    await show(page, "/", "Waiting on you");
    await page
      .getByRole("button", { name: /^Uraeda / })
      .first()
      .click();
    await page.getByText("Add a repository…").click();
    const field = page.getByRole("textbox", { name: "Folder" });
    await field.fill("/");
    await page.getByRole("list", { name: "Folders" }).waitFor();
    await field.press("ArrowDown");
    await settle(page);
  });
}
