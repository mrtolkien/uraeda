/**
 * The screenshots' views of text inputs: a question's comment unsaved and one holding 12 lines, the
 * settled points with a comment and a form open, the notes restored with their notice, the "Leave
 * page?" and "Discard your comment?" confirmations, a line edited in place, the editor with its
 * Save, and the chat composer holding 10 lines.
 */
import type { Page } from "playwright";
import { COMMENT_FIELD, type Each, settle, show, wait } from "./shots.ts";

const ROUND = "/f/2026-10-11-web-ui/clarifications-01.md";
const FEATURE = "/f/2026-10-11-web-ui";
const QUESTION = "How does your iPhone reach the server?";
const COMMITS = "The actions' commits move into the core";
const ANSWER = "An answer is written";

/** Numbered lines of text, one a line. */
const lines = (count: number) =>
  Array.from({ length: count }, (_, index) => `Line ${index + 1}`).join("\n");

/** Pages answered once: a reload or a leave with unsaved text gets the browser's prompt. */
const prompted = new WeakSet<Page>();

/**
 * Opens a page with no unsaved text kept from an earlier view: the browser's leave prompt, if the
 * page left holds some, is accepted.
 */
async function fresh(page: Page, path: string, text: string | RegExp) {
  if (!prompted.has(page)) {
    prompted.add(page);
    page.on("dialog", (dialog) => void dialog.accept());
  }
  // A blank page, before the first view, has no storage of its own.
  await page
    .evaluate(() => {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith("uraeda:unsaved:")) {
          window.localStorage.removeItem(key);
        }
      }
    })
    .catch(() => undefined);
  await show(page, path, text);
}

/** Scrolls an element to the screen's middle. */
async function centre(page: Page, locator: ReturnType<Page["getByText"]>) {
  await locator.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await wait(300);
}

/** A settled point's toggle, by the bold subject its name starts with. */
function point(page: Page, subject: string) {
  return page.getByRole("button", { name: new RegExp(`^${subject}`) }).first();
}

/** Opens "Under the hood", which holds the round's settled points. */
const openHood = (page: Page) =>
  page.getByRole("button", { name: /^Show the \d+ points$/ }).click({ force: true });

/** The first question's comment field, not its follow-ups'. */
const comment = (page: Page, question = "Q1") =>
  page.locator(`#${question}`).getByRole("textbox", { name: COMMENT_FIELD }).first();

/** The round with a comment under its first settled point, added once, and the second's form open. */
async function settledComments(page: Page) {
  await fresh(page, ROUND, QUESTION);
  await openHood(page);
  const added = page.getByRole("group", { name: `Your comment on "${COMMITS}"` });
  if ((await added.count()) === 0) {
    await point(page, COMMITS).click({ force: true });
    await page
      .getByLabel("Comment text")
      .fill("Keep them in the core, but say so in the CLI's help.");
    await page.getByRole("button", { name: "Add comment" }).click();
    await added.waitFor();
    await page.getByRole("form", { name: "Comment" }).waitFor({ state: "detached" });
    await wait(300);
  }
  await point(page, ANSWER).click({ force: true });
  await page.getByLabel("Comment text").fill("Keep the comment after the letters.");
}

async function roundShots(each: Each) {
  await each("text-question-unsaved", async ({ page }) => {
    await fresh(page, ROUND, QUESTION);
    await comment(page).fill("Only from home, through Tailscale");
    await centre(page, comment(page));
  });
  await each("text-comment-full", async ({ page }) => {
    await fresh(page, ROUND, QUESTION);
    await comment(page).fill(lines(12));
    await centre(page, comment(page));
  });
  await each("text-settled", async ({ page, size }) => {
    await settledComments(page);
    if (size === "desktop") {
      await centre(page, page.getByRole("form", { name: "Comment" }));
    }
    await settle(page);
  });
  await each("text-notes", async ({ page }) => {
    await settledComments(page);
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Discard" }).click();
    // The sheet's and the confirmation's Backs done, which put the page's scroll back.
    await page.getByRole("form", { name: "Comment" }).waitFor({ state: "detached" });
    await settle(page);
    await page
      .getByRole("textbox", { name: "Anything else" })
      .fill("Overall fine, but say where answers go.");
    await centre(page, page.getByRole("textbox", { name: "Anything else" }));
  });
  await each("text-restored", async ({ page }) => {
    await fresh(page, ROUND, QUESTION);
    await page
      .getByRole("textbox", { name: "Anything else" })
      .fill("Overall fine, but say where answers go.");
    await page.reload();
    await page.getByText(/^Unsaved text restored from/).waitFor();
    await centre(page, page.getByRole("textbox", { name: "Anything else" }));
  });
}

async function dialogShots(each: Each) {
  await each("text-leave", async ({ page }) => {
    await fresh(page, ROUND, QUESTION);
    await comment(page, "Q3").fill("Neither, keep it simple");
    // A link to the feature's page, as in US5 4.
    await page.locator(`a[href$="${FEATURE}"]`).first().click();
    await page.getByRole("dialog", { name: "Leave page?" }).waitFor();
    await settle(page);
  });
  await each("text-discard", async ({ page }) => {
    await fresh(page, ROUND, QUESTION);
    await openHood(page);
    await point(page, ANSWER).click({ force: true });
    await page.getByLabel("Comment text").fill("Keep the comment after the letters.");
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("dialog", { name: "Discard your comment?" }).waitFor();
    await settle(page);
  });
}

async function fieldShots(each: Each) {
  await each("text-line", async ({ page }) => {
    await fresh(page, "/priorities/git-listener", "Open draft");
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("textbox", { name: "Line" }).fill("Git listener process, and a log");
    await settle(page);
  });
  await each("text-editor", async ({ page }) => {
    await fresh(page, "/edit/specs/drafts/git-listener.md", "Git listener");
    await page.getByRole("button", { name: "Edit" }).click();
    const text = page.getByLabel("Text");
    await text.fill(`${await text.inputValue()}\nRun it on every branch, not only main.\n`);
    await page
      .getByRole("button", { exact: true, name: "Save" })
      .evaluate((element) => element.scrollIntoView({ block: "end" }));
    await settle(page);
  });
  await each("text-composer", async ({ page }) => {
    await fresh(page, "/f/2026-10-12-cli-tuis/session", "CLI TUIs");
    await page.getByRole("textbox", { name: "Message Claude Code" }).fill(lines(10));
    await settle(page);
  });
}

/** Every view of text inputs, each at both sizes and in both themes. */
export async function takeTextInputs(each: Each) {
  await roundShots(each);
  await dialogShots(each);
  await fieldShots(each);
}
