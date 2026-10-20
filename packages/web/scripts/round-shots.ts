/**
 * The screenshots' views of a round of questions, over the round page's mockup feature
 * (`fixtures/round-mockup/`) that the sample builders' `addRoundMockup` adds, its Q1 answered B: the round's opening, its verdict and its context;
 * Q1 with its diagram; the follow-up Q1.B after it; the settled points, every group open; and, on
 * the phone, the index of the questions.
 */
import type { Page } from "playwright";
import { ROUND_MOCKUPS } from "../samples/index.ts";
import { type Each, forget, settle, show, wait } from "./shots.ts";

const ROUND = `/f/${ROUND_MOCKUPS.waiting}/clarifications-01.md`;
const QUESTION = "When does the next occurrence appear?";

/** Scrolls the page so an element is near its top, below the phone's top bar. */
async function toTop(page: Page, locator: ReturnType<Page["locator"]>) {
  await locator.evaluate((element) =>
    window.scrollBy(0, element.getBoundingClientRect().top - (window.innerWidth < 768 ? 64 : 16)),
  );
  await wait(300);
}

/**
 * Opens the round at its top, whatever position the last view left, then waits for its diagram's
 * drawing.
 */
async function open(page: Page) {
  await forget(page);
  await show(page, ROUND, QUESTION);
  await page
    .getByLabel(/ diagram/)
    .first()
    .waitFor({ timeout: 20_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
}

/** Every view of the round, each at both sizes and in both themes, but the phone's index. */
export async function takeRound(each: Each) {
  await each("round", ({ page }) => open(page));
  await each("round-diagram", async ({ page }) => {
    await open(page);
    await toTop(page, page.locator("#Q1"));
    await page
      .getByLabel(/ diagram/)
      .first()
      .evaluate((element) => element.scrollIntoView({ block: "center" }));
    await settle(page);
  });
  await each("round-follow-up", async ({ page }) => {
    await open(page);
    await toTop(page, page.locator('[id="Q1.B"]'));
    await settle(page);
  });
  await each("round-settled", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: /^Show the \d+ points$/ }).click({ force: true });
    await page.getByText("Next dates are computed by date-fns").waitFor();
    await toTop(page, page.getByRole("heading", { name: "Settled without you" }));
    await settle(page);
  });
  await each(
    "round-index",
    async ({ page }) => {
      await open(page);
      await page.getByRole("button", { name: /^\d+\/\d+$/ }).click();
      await page.getByRole("dialog", { name: "Questions" }).waitFor();
      await settle(page);
    },
    "phone",
  );
}
