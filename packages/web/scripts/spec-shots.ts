/**
 * The screenshots' views of the spec page, over the spec page's feature that `addSpecFeature` builds
 * from `fixtures/spec-page/`: waiting for review, its opening; with every fold open, its decisions,
 * a story, and how it is built; approved; and a decision's own page on the feature's branch.
 */
import type { Page } from "playwright";
import { addSpecFeature, SPEC_FEATURE } from "uraeda-binding/test-utils";
import { type Each, forget, settle, show, wait } from "./shots.ts";

const APPROVED = `${SPEC_FEATURE}-approved`;
const WAITING_PAGE = `/f/${SPEC_FEATURE}/spec.md`;
const APPROVED_PAGE = `/f/${APPROVED}/spec.md`;
const DECISION_PAGE = `/f/${SPEC_FEATURE}/decisions/task-storage`;

/** Adds the spec page's features to `repo`: its spec waiting for review, and approved. */
export function addSpecPages(repo: string) {
  addSpecFeature(repo);
  addSpecFeature(repo, { folder: APPROVED, status: "approved" });
}

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

/** Every view of the spec page, each at both sizes and in both themes. */
export async function takeSpecPage(each: Each) {
  await each("spec-page", ({ page }) => open(page, WAITING_PAGE));
  await each("spec-page-decisions", async ({ page }) => {
    await openAll(page);
    await toTop(page, "Task storage");
    await settle(page);
  });
  await each("spec-page-story", async ({ page }) => {
    await openAll(page);
    await toTop(page, "Complete a repeating task");
    await settle(page);
  });
  await each("spec-page-built", async ({ page }) => {
    await openAll(page);
    await toTop(page, "Edge cases");
    await settle(page);
  });
  await each("spec-page-approved", ({ page }) => open(page, APPROVED_PAGE));
  await each("spec-decision", async ({ page }) => {
    await forget(page);
    await show(page, DECISION_PAGE, "Task storage");
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page);
  });
}
