/**
 * The screenshots' views of the feature page and the session's composer, over the feature page's
 * features that `.storybook/featurePages.ts` builds, their times read in UTC: each state of the
 * page, a done feature's record, decisions, and questions, the notes open, and the composer with its
 * recommended message, inserted, or none. The agent at work is taken last: its run stays open.
 */
import type { Page } from "playwright";
import type { FakeAdapter } from "uraeda-server/testing";
import { FEATURE_PAGES } from "../.storybook/checkouts.ts";
import { type Each, forget, type Shot, settle, show, wait } from "./shots.ts";

const page = (folder: string) => `/f/${folder}`;
const COMMENTS = "Insert: Address the pull request's comments";

/** Opens a page at its top, as new, whatever position the last view left. */
async function open(at: Page, folder: string, text: string) {
  await forget(at);
  await show(at, page(folder), text);
  await at.evaluate(() => window.scrollTo(0, 0));
  await settle(at);
}

/** Opens every fold of the page's main region. */
async function openFolds(at: Page) {
  const folded = at.getByRole("main").getByRole("button", { expanded: false });
  for (let left = 10; left > 0 && (await folded.count()) > 0; left -= 1) {
    await folded.first().click();
  }
  await settle(at);
}

/** Scrolls the page so a region starts near its top, below the phone's top bar. */
async function toTop(at: Page, name: string) {
  await at
    .getByRole("region", { exact: true, name })
    .first()
    .evaluate((element) =>
      window.scrollBy(0, element.getBoundingClientRect().top - (window.innerWidth < 768 ? 64 : 16)),
    );
  await wait(300);
}

/** The done feature, with every fold open, scrolled to one of its regions. */
async function doneAt(at: Page, region: string) {
  await open(at, FEATURE_PAGES.done, "What and why");
  await openFolds(at);
  await toTop(at, region);
  await settle(at);
}

/** Every state of the feature page, then the composer, then the agent at work. */
export async function takeFeaturePage(each: Each, shots: Array<Shot>, adapter: FakeAdapter) {
  const first = shots[0]!.page;
  await each("feature-waiting", ({ page: at }) =>
    open(at, FEATURE_PAGES.waiting, "You review the spec"),
  );
  await each("feature-blocked", ({ page: at }) =>
    open(at, FEATURE_PAGES.blocked, "This feature cannot go on"),
  );
  await each("feature-pull-request", ({ page: at }) =>
    open(at, FEATURE_PAGES.pullRequest, "Your review on pull request #31"),
  );
  await each("feature-done", ({ page: at }) => open(at, FEATURE_PAGES.done, "What it produced"));
  // At 1200 px, the sidebar open: the stages a column, where their row would not hold (R22).
  await each(
    "feature-done-1200",
    async ({ page: at }) => {
      await at.setViewportSize({ height: 900, width: 1200 });
      await open(at, FEATURE_PAGES.done, "What it produced");
    },
    "desktop",
  );
  for (const { page: at, size } of shots) {
    if (size === "desktop") {
      await at.setViewportSize({ height: 900, width: 1440 });
    }
  }
  await each("feature-done-record", ({ page: at }) => doneAt(at, "What it produced"));
  await each("feature-done-decisions", ({ page: at }) => doneAt(at, "Decisions"));
  await each("feature-done-questions", ({ page: at }) => doneAt(at, "Questions"));
  await each("feature-done-change", ({ page: at }) =>
    open(at, FEATURE_PAGES.doneChange, "What it produced"),
  );
  await each("feature-notes", async ({ page: at }) => {
    await open(at, FEATURE_PAGES.working, "The agent is building");
    await openFolds(at);
    await at.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await settle(at);
  });
  await each("composer-recommended", ({ page: at }) =>
    show(at, `${page(FEATURE_PAGES.pullRequest)}/session`, COMMENTS),
  );
  await each("composer-filled", async ({ page: at }) => {
    await show(at, `${page(FEATURE_PAGES.pullRequest)}/session`, COMMENTS);
    await at.getByRole("button", { name: COMMENTS }).click();
    await at.getByRole("button", { name: "Start the agent" }).first().waitFor();
    await settle(at);
  });
  await forget(first);
  await each("composer-nothing", ({ page: at }) =>
    show(at, `${page(FEATURE_PAGES.waiting)}/session`, "No recommended message"),
  );
  // The agent started on the feature being built, from its recommended message, and at work.
  await show(first, `${page(FEATURE_PAGES.working)}/session`, /^Insert: /);
  const sent = adapter.sent.length;
  await first.getByRole("button", { name: /^Insert: / }).click();
  await first.getByRole("button", { name: "Start the agent" }).first().click();
  while (adapter.sent.length === sent) {
    await wait(50);
  }
  adapter.emit({ id: adapter.sent.at(-1)!.id, type: "accepted" });
  adapter.emit({ text: "Building task 7: the session column.", type: "text" });
  await each("feature-working", ({ page: at }) =>
    open(at, FEATURE_PAGES.working, "The agent is building"),
  );
}
