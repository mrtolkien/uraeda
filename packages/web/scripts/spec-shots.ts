/**
 * The screenshots' views of the spec and plan pages, over the spec page's features that the sample
 * builders' `addSpecPages` builds from `fixtures/spec-page/`: the spec at revision 2 waiting for
 * review, its opening with "Since your review", a changed part, and, with every fold open, its
 * decisions, a story, a live window in full screen, and how it is built; asking about a rule, the
 * column's Session tab or the phone's session page holding its quote; the Review tab, a comment
 * added; approved; a decision's own page on the feature's branch; the data model alone; and the
 * plan, auto-approved and waiting.
 */
import type { Page } from "playwright";
import { SPEC_PAGES } from "../samples/index.ts";
import { type Each, forget, settle, show, wait } from "./shots.ts";

const WAITING_PAGE = `/f/${SPEC_PAGES.waiting}/spec.md`;
const APPROVED_PAGE = `/f/${SPEC_PAGES.approved}/spec.md`;
const DECISION_PAGE = `/f/${SPEC_PAGES.waiting}/decisions/task-storage`;
const DATA_PAGE = `/f/${SPEC_PAGES.waiting}/data-model.md`;
const PLAN_PAGE = `/f/${SPEC_PAGES.plan}/plan.md`;
const PLAN_WAITING_PAGE = `/f/${SPEC_PAGES.planWaiting}/plan.md`;
/** The plan's first task's pane. */
const FIRST_TASK = "Task 1 · The session's view, scrolling in the round's column";

/**
 * Scrolls the page so a part starts near its top, below the phone's top bar: the part's region, as
 * its title may already stick there.
 */
async function toTop(page: Page, name: string) {
  await page
    .getByRole("region", { exact: true, name })
    .first()
    .evaluate((element) =>
      window.scrollBy(0, element.getBoundingClientRect().top - (window.innerWidth < 768 ? 64 : 16)),
    );
  await wait(300);
}

/** Opens a spec at its top, as new, whatever position the last view left. */
async function open(page: Page, path: string) {
  await forget(page);
  await show(page, path, "Complete a repeating task");
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
}

/** Opens the waiting spec, then every fold of its page, as the accessibility test does. */
async function openAll(page: Page) {
  await open(page, WAITING_PAGE);
  const folded = page.getByRole("main").getByRole("button", { expanded: false });
  for (let left = 30; left > 0 && (await folded.count()) > 0; left -= 1) {
    await folded.first().click();
  }
  await settle(page);
}

/** Whether the window is a phone's: no column, the status line instead. */
const isPhone = (page: Page) => page.viewportSize()!.width < 768;

/** Taps a rule of Task storage, then "Ask the agent", which writes its quote in the composer. */
async function ask(page: Page) {
  await openAll(page);
  await toTop(page, "Task storage");
  await page
    .getByRole("region", { exact: true, name: "Task storage" })
    .getByText(/^Data MUST be stored in IndexedDB/)
    .click();
  await page.getByRole("button", { name: "Ask the agent" }).click();
  await page.getByRole("textbox", { name: "Message Claude Code" }).waitFor();
  await settle(page);
}

/**
 * A comment on US2's first scenario, added once, by the first window: it is committed to the
 * feature's branch, so every window shows it.
 */
let commented = false;

/** Adds the comment, once, then opens the Review tab, or on the phone its sheet. */
async function review(page: Page) {
  await open(page, WAITING_PAGE);
  if (!commented) {
    const block = page.getByRole("button", { name: /instead of marking it done/, pressed: false });
    await block.first().click({ force: true });
    await page
      .getByRole("textbox", { name: "Comment text" })
      .fill("Say what the row shows once the 5 seconds are over.");
    await page.getByRole("button", { name: "Add comment" }).click();
    await page.locator("#comment-1").waitFor();
    commented = true;
    await open(page, WAITING_PAGE);
  }
  await (isPhone(page)
    ? page.getByRole("button", { name: "1 comment" }).click()
    : page.getByRole("tab", { name: /^Review/ }).click());
  await page.getByRole("button", { name: "Approve" }).first().waitFor();
  await settle(page);
}

/** The spec's views that read it waiting, before a comment is added, then the Review tab. */
async function takeWaiting(each: Each) {
  await each("spec-page", ({ page }) => open(page, WAITING_PAGE));
  await each("spec-page-changed", async ({ page }) => {
    await open(page, WAITING_PAGE);
    await page.getByRole("list", { name: "Places changed" }).getByRole("button").first().click();
    await settle(page);
  });
  await each("spec-page-decisions", async ({ page }) => {
    await openAll(page);
    await toTop(page, "Task storage");
    await settle(page);
  });
  await each("spec-page-story", async ({ page }) => {
    await openAll(page);
    await toTop(page, "US2 · Complete a repeating task");
    await settle(page);
  });
  await each("spec-page-built", async ({ page }) => {
    await openAll(page);
    await toTop(page, "Edge cases");
    await settle(page);
  });
  await each("spec-page-live", async ({ page }) => {
    await openAll(page);
    // US4's HTML mockup, live once its window is seen.
    const window = page.getByRole("figure", { name: "Title with a repeat phrase" });
    await window.scrollIntoViewIfNeeded();
    await window.getByRole("button", { name: "Full screen" }).click();
    await page.getByRole("button", { name: "Leave full screen" }).waitFor();
    await wait(1000);
  });
  await each("spec-page-session", ({ page }) => ask(page));
  await each("spec-page-review", ({ page }) => review(page));
}

/** Every view of the spec page and the plan page, each at both sizes and in both themes. */
export async function takeSpecPage(each: Each) {
  await takeWaiting(each);
  await each("spec-page-approved", ({ page }) => open(page, APPROVED_PAGE));
  await each("spec-decision", async ({ page }) => {
    await forget(page);
    await show(page, DECISION_PAGE, "Task storage");
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page);
  });
  await each("spec-data-model", async ({ page }) => {
    await forget(page);
    await show(page, DATA_PAGE, "Task");
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page);
  });
  await each("plan-page", async ({ page }) => {
    await forget(page);
    await show(page, PLAN_PAGE, FIRST_TASK);
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page);
  });
  await each("plan-page-tasks", async ({ page }) => {
    await forget(page);
    await show(page, PLAN_PAGE, FIRST_TASK);
    await toTop(page, FIRST_TASK);
    await settle(page);
  });
  await each("plan-page-waiting", async ({ page }) => {
    await forget(page);
    await show(page, PLAN_WAITING_PAGE, FIRST_TASK);
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page);
  });
}
