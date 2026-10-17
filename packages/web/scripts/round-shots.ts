/**
 * The screenshots' views of a round of questions, over the round page's mockup feature
 * (`fixtures/round-mockup/`), its Q1 answered B: the round's opening, its verdict and its context;
 * Q1 with its diagram; the follow-up Q1.B after it; the settled points, every group open; and, on
 * the phone, the index of the questions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright";
import { commitOnBranch, git } from "uraeda-binding/test-utils";
import { type Each, forget, settle, show, wait } from "./shots.ts";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const FOLDER = "2026-10-17-round-mockup";
const ROUND = `/f/${FOLDER}/clarifications-01.md`;
const QUESTION = "When does the next occurrence appear?";

/** A file of the round page's mockup feature. */
const mockupFile = (name: string) =>
  readFileSync(join(root, "fixtures/round-mockup", name), "utf8");

/**
 * Adds the round page's mockup feature to `repo`, on its own branch from `main`, its Q1 answered B,
 * which asks its follow-up.
 */
export function addRoundMockup(repo: string) {
  git(repo, "branch", FOLDER, "main");
  commitOnBranch(repo, FOLDER, {
    // Q1's answer line is the round's first.
    [`specs/${FOLDER}/clarifications-01.md`]: mockupFile("clarifications-01.md").replace(
      "**Answer:**\n",
      "**Answer:** B\n",
    ),
    [`specs/${FOLDER}/proposal.md`]: mockupFile("proposal.md"),
  });
}

/** Scrolls the page so an element is near its top, below the phone's top bar. */
async function toTop(page: Page, locator: ReturnType<Page["locator"]>) {
  await locator.evaluate((element) =>
    window.scrollBy(0, element.getBoundingClientRect().top - (window.innerWidth < 768 ? 64 : 16)),
  );
  await wait(300);
}

/**
 * Opens the round at its top, whatever position the last view left, then waits for its diagram's
 * frame.
 */
async function open(page: Page) {
  await forget(page);
  await show(page, ROUND, QUESTION);
  await page.locator('iframe[title="Diagram"]').waitFor({ timeout: 20_000 });
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
      .locator('iframe[title="Diagram"]')
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
