/**
 * The screenshots' views of the questions page (`specs/done/2026-10-24-questions-page.md`), over its
 * spec's rounds that the sample builders' `addQuestionsPages` adds: the merge-chats round waiting,
 * its Q2 answered A, at its top with its column; Check these; Under the hood, opened; a question's
 * header held at the top mid-card, and Q4's Example and Why it matters, in the layout-look round;
 * the column's Session after "Ask the agent" on Q2, the session's page on the phone; the Notes tab,
 * a sheet on the phone; the round answered; and the inbox's triage. On the phone only: the outline's
 * sheet, and an option's points in boxes. Beyond the round, the documents whose paragraphs, lists,
 * selection, and pane titles changed with it: a spec, at its top and at its lists, a block of its
 * review selected on the phone, a plan's numbered list, home, and the decisions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Locator, Page } from "playwright";
import { QUESTIONS_PAGES } from "../samples/index.ts";
import { withFile } from "./inbox-shots.ts";
import { type Each, forget, settle, show, SPEC, wait } from "./shots.ts";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const round = (folder: string) => `/f/${folder}/clarifications-01.md`;
/** Each round's first question, which shows once the round is drawn. */
const MERGE_Q1 = "Who may move a chat up to a change, or a change up to a feature?";
const LAYOUT_Q4 = "Where should the session open on the questions page?";

/** Scrolls the page so an element is near its top, below the phone's top bar. */
async function toTop(page: Page, locator: Locator) {
  await locator.evaluate((element) =>
    window.scrollBy(0, element.getBoundingClientRect().top - (window.innerWidth < 768 ? 64 : 16)),
  );
  await settle(page);
}

/** Opens a round at its top, as new: no unsaved text, the column at its own width. */
async function open(page: Page, folder: string, text: string) {
  await forget(page);
  await show(page, round(folder), text);
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
}

/** The merge-chats round, waiting for answers. */
const waiting = (page: Page) => open(page, QUESTIONS_PAGES.waiting, MERGE_Q1);

/** The checkbox of a question's option, by its letter. */
const option = (page: Page, id: string, letter: string) =>
  page
    .locator(`[id="${id}"]`)
    .getByRole("checkbox", { name: new RegExp(String.raw`^Option ${letter}\b`) });

/** The round's views at the top of its page, and its settled panes. */
async function takeParts(each: Each) {
  await each("questions-waiting", ({ page }) => waiting(page));
  await each("questions-check-these", async ({ page }) => {
    await waiting(page);
    await toTop(page, page.locator("#check-these"));
  });
  await each("questions-under-the-hood", async ({ page }) => {
    await waiting(page);
    await page.getByRole("button", { name: "3 choices in the code only" }).click();
    await page.getByText(/^The branch/).waitFor();
    await toTop(page, page.locator("#behaviour"));
  });
}

/** The question cards: a header held at the top mid-card, Q4's panes, and the phone's points. */
async function takeCards(each: Each) {
  await each("questions-example", async ({ page }) => {
    await open(page, QUESTIONS_PAGES.layoutLook, LAYOUT_Q4);
    await toTop(page, page.locator("#Q4"));
  });
  await each("questions-sticky", async ({ page }) => {
    await open(page, QUESTIONS_PAGES.layoutLook, LAYOUT_Q4);
    await option(page, "Q4", "C").evaluate((box) =>
      box.parentElement!.scrollIntoView({ block: "start" }),
    );
    await settle(page);
  });
  await each(
    "questions-option-points",
    async ({ page }) => {
      await waiting(page);
      await toTop(page, option(page, "Q1", "A").locator(".."));
    },
    "phone",
  );
}

/** The column's tabs, or the phone's sheets and the session's page. */
async function takeColumn(each: Each) {
  // On the phone, asking opens the session's page with the quote.
  await each("questions-session", async ({ page }) => {
    await waiting(page);
    const q2 = page.locator("#Q2");
    await toTop(page, q2);
    await q2.getByRole("button", { name: "Ask the agent" }).first().click();
    await page
      .getByText("About Q2 of specs/2026-10-20-merge-chats/clarifications-01.md:")
      .waitFor();
    await wait(300);
    await settle(page);
  });
  await each("questions-notes", async ({ page, size }) => {
    await waiting(page);
    if (size === "phone") {
      await page.getByRole("button", { exact: true, name: "Notes" }).click();
      await page.getByRole("dialog", { name: "Notes" }).waitFor();
    } else {
      await page.getByRole("tab", { name: /^Notes/ }).click();
    }
    await page.getByRole("textbox", { name: "Anything else" }).fill("Check the spec page too.");
    await settle(page);
  });
  await each(
    "questions-outline-sheet",
    async ({ page }) => {
      await waiting(page);
      await page.getByRole("button", { name: "1/8 answered, outline" }).click();
      await page.getByRole("dialog", { name: "Outline" }).waitFor();
      await settle(page);
    },
    "phone",
  );
}

/** The round answered, and the inbox's triage. */
async function takeOthers(each: Each, repo: string) {
  await each("questions-answered", ({ page }) => open(page, QUESTIONS_PAGES.answered, MERGE_Q1));
  const triage = readFileSync(join(root, "fixtures/INBOX-TRIAGE.md"), "utf8");
  await withFile(repo, "specs/INBOX-TRIAGE.md", triage, () =>
    each("questions-triage", async ({ page }) => {
      await forget(page);
      await show(page, "/inbox/triage", "Inbox triage");
    }),
  );
}

/** The plan under review, whose Review focus is a numbered list. */
const PLAN = "/f/2026-10-13-plan-review/plan.md";

/** Opens a document at its top, as new, once `text` shows. */
async function openDocument(page: Page, path: string, text: string) {
  await forget(page);
  await show(page, path, text);
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
}

/** The pane of a document titled `name`, the region its title names. */
const region = (page: Page, name: string) =>
  page.getByRole("region", { exact: true, name }).first();

/**
 * The other documents, in the reading font, their lists hung on the phone: a spec at its top and at
 * its Architecture's list and a story's numbered scenarios, one of its blocks selected for a comment
 * on the phone, a plan's numbered list, home, and the decisions.
 */
async function takeDocuments(each: Each) {
  await each("documents-spec", ({ page }) => openDocument(page, SPEC, "Complete a repeating task"));
  await each("documents-spec-lists", async ({ page }) => {
    await openDocument(page, SPEC, "Complete a repeating task");
    await toTop(page, region(page, "Architecture"));
  });
  await each("documents-spec-story", async ({ page }) => {
    await openDocument(page, SPEC, "Complete a repeating task");
    await toTop(page, region(page, "Make a task repeat"));
  });
  await each(
    "documents-spec-selected",
    async ({ page }) => {
      await openDocument(page, SPEC, "Complete a repeating task");
      const block = page
        .getByRole("button", { name: /Date helpers/ })
        .and(page.locator("[aria-pressed]"));
      await block.evaluate((element) => element.scrollIntoView({ block: "center" }));
      await settle(page);
      await block.click({ force: true });
      await page.getByRole("form", { name: "Comment" }).waitFor();
      await wait(300);
      await settle(page);
    },
    "phone",
  );
  await each("documents-plan", async ({ page }) => {
    await openDocument(page, PLAN, "Task 5");
    await toTop(page, page.getByRole("heading", { exact: true, name: "Review focus" }).first());
  });
  await each("documents-home", ({ page }) => openDocument(page, "/", "Overview"));
  await each("documents-decisions", ({ page }) =>
    openDocument(page, "/decisions", "Humans stay in control"),
  );
  await each("documents-decision", ({ page }) =>
    openDocument(page, "/decisions/ui-behaviour", "Approved by"),
  );
}

/** Every view of the questions page, each at both sizes and in both themes, or on the phone. */
export async function takeQuestionsPage(each: Each, repo: string) {
  await takeParts(each);
  await takeCards(each);
  await takeColumn(each);
  await takeOthers(each, repo);
  await takeDocuments(each);
}
