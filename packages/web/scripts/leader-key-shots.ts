/**
 * The screenshots' views of the leader key (`specs/2026-10-26-leader-key`), each reached by
 * pressing the keys as a human does, in the real app: the leader menu at its top level and at
 * `Space n`, a pending `g` menu, the key picker (its preview on a desktop, its list alone in the
 * phone's sheet), the Continue picker, the Keyboard section with its switch on and off, and the
 * status line with its hints on a list page and on the questions page.
 */
import type { Page } from "playwright";
import { QUESTIONS_PAGES } from "../samples/index.ts";
import { type Each, forget, type Shot, settle, show, wait } from "./shots.ts";

/** Keys pressed one after the other, on a page that has the focus on nothing. */
async function press(page: Page, ...keys: Array<string>) {
  for (const key of keys) {
    await page.keyboard.press(key);
  }
}

/** The home page's own settled state, where the keys' presses start. */
const home = async (page: Page) => {
  await forget(page);
  await show(page, "/", "Overview");
};

/** The leader menus: the top level, its New group, and a pending `g`. */
async function takeMenus(each: Each) {
  await each("leader-menu", async ({ page }) => {
    await home(page);
    await press(page, "Space");
    await page.getByRole("group", { exact: true, name: "Space" }).waitFor();
    await settle(page);
  });
  await each("leader-menu-new", async ({ page }) => {
    await home(page);
    await press(page, "Space", "n");
    await page.getByRole("group", { exact: true, name: "Space n" }).waitFor();
    await settle(page);
  });
  // A pending `g` ends two seconds after its key: the shot is taken before that.
  await each("leader-menu-g", async ({ page }) => {
    await home(page);
    await press(page, "g");
    await page.getByRole("group", { exact: true, name: "g" }).waitFor();
    await wait(100);
  });
}

/** The key picker, over the decisions, and Continue's over what needs the human. */
async function takePickers(each: Each) {
  await each("key-picker", async ({ page }) => {
    await home(page);
    await press(page, "Space", "f", "d");
    await page.getByRole("dialog").waitFor();
    await page.getByRole("option").first().waitFor();
    await settle(page);
  });
  await each("continue-picker", async ({ page }) => {
    await home(page);
    await press(page, "Space", "c");
    await page.getByRole("dialog", { name: "Continue" }).waitFor();
    await page.getByRole("option").first().waitFor();
    await settle(page);
  });
}

const keyboard = (page: Page) => show(page, "/settings/keyboard", "Single-key shortcuts");
const single = (page: Page) => page.getByRole("switch", { name: "Single-key shortcuts" });

/** The Keyboard section's switch, on and off; the shortcuts on again after. */
async function takeKeyboard(each: Each, shots: Array<Shot>) {
  await each("settings-keyboard-on", async ({ page }) => {
    await keyboard(page);
    if (!(await single(page).isChecked())) {
      await single(page).click();
      await settle(page);
    }
  });
  await each("settings-keyboard-off", async ({ page }) => {
    await keyboard(page);
    if (await single(page).isChecked()) {
      await single(page).click();
      await settle(page);
    }
  });
  for (const { page } of shots) {
    await keyboard(page);
    if (!(await single(page).isChecked())) {
      await single(page).click();
      await settle(page);
    }
  }
}

/** The status line with its hints, on a list page and on the questions page. */
async function takeStatusLine(each: Each) {
  await each("status-line-list", async ({ page }) => {
    await forget(page);
    await show(page, "/priorities", "Git listener process");
  });
  await each("status-line-questions", async ({ page }) => {
    await forget(page);
    await show(
      page,
      `/f/${QUESTIONS_PAGES.waiting}/clarifications-01.md`,
      "Who may move a chat up to a change, or a change up to a feature?",
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page);
  });
}

/** Every view of the leader key; `leader-key` names them all on the command line. */
export async function takeLeaderKeys(each: Each, shots: Array<Shot>) {
  await takeMenus(each);
  await takePickers(each);
  await takeKeyboard(each, shots);
  await takeStatusLine(each);
}
