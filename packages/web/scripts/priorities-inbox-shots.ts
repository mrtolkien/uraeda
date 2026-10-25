/**
 * The screenshots' views of the redesigned lists (`specs/2026-10-25-inbox-priorities/`): the
 * priorities as columns, the inbox as panes, a priority's detail in its overlay over the columns
 * (a dialog, and on the phone a sheet), and a category's delete asking what becomes of its notes.
 * Each view is checked as the browser tests check a page: nothing scrolls the page sideways.
 */
import type { Page } from "playwright";
import { type Each, forget, settle, show } from "./shots.ts";

/** The first line of the priorities, which shows once the page is drawn. */
const PRIORITIES_LINE = "Git listener process";
/** The inbox's first note, which shows once the page is drawn. */
const FIRST = "Specs are still way too long and hard to read";

/** The page must not scroll sideways: the columns scroll inside their own row. */
async function checkPage(page: Page, view: string) {
  const { inner, scroll } = await page.evaluate(() => ({
    inner: window.innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  if (scroll > inner) {
    throw new Error(`${view}: the page scrolls sideways (${scroll} > ${inner})`);
  }
}

/** Opens a list as new, with no unsaved text. */
async function open(page: Page, path: string, text: string) {
  await forget(page);
  await show(page, path, text);
}

/** The priorities, a priority's overlay, the inbox, and a category's delete. */
export async function takePrioritiesInbox(each: Each) {
  await each("lists-priorities", async ({ page }) => {
    await open(page, "/priorities", PRIORITIES_LINE);
    await checkPage(page, "lists-priorities");
  });
  await each("lists-overlay", async ({ page }) => {
    await open(page, "/priorities/git-listener", "Open draft");
    await checkPage(page, "lists-overlay");
  });
  await each("lists-inbox", async ({ page }) => {
    await open(page, "/inbox", FIRST);
    await checkPage(page, "lists-inbox");
  });
  await each("lists-category-delete", async ({ page }) => {
    await open(page, "/inbox", FIRST);
    await page.getByRole("button", { name: "Actions of category UI" }).click();
    // A menu item in a popover, a button in the sheet of a narrow screen.
    await page
      .getByRole("menuitem", { name: "Delete" })
      .or(page.getByRole("dialog").getByRole("button", { exact: true, name: "Delete" }))
      .click();
    await page.getByRole("dialog", { name: "Delete the category UI" }).waitFor();
    await settle(page);
    await checkPage(page, "lists-category-delete");
  });
}
