/**
 * What the screenshots' views are taken with: opening a page and waiting for it to settle, saving
 * a view at each size and theme, and the spec's folds, a group of views of their own.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BrowserContext, Page } from "playwright";
import { encodeImage } from "uraeda-binding";

export type Size = "phone" | "desktop";
type Mode = "light" | "dark";
export type Shot = { context: BrowserContext; mode: Mode; page: Page; size: Size };

export const SPEC = "/f/2026-10-06-recurring-tasks/spec.md";
const APPROVED = "/f/2026-10-13-plan-review/spec.md";

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The repository's prefix, `/r/<name>`, which every page's path starts with. */
let prefix = "";

/** Sets the repository's prefix, once it is listed. */
export function setPrefix(value: string) {
  prefix = value;
}

/** A page's path within the repository, from the page's URL. */
export const here = (page: Page) => new URL(page.url()).pathname.slice(prefix.length);

/** Opens a page of the repository, and waits for a text and for the page to settle. */
export async function show(page: Page, path: string, text: string | RegExp) {
  await page.goto(`${prefix}${path}`);
  await page.getByText(text).first().waitFor({ timeout: 20_000 });
  await settle(page);
}

/** Forgets the browser's unsaved text and choices, but the theme: the next view opens as new. */
export async function forget(page: Page) {
  // A page that has not opened the app yet has nothing kept, and no storage to reach.
  if (page.url() === "about:blank") {
    return;
  }
  await page.evaluate(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (key !== "uraeda.theme") {
        window.localStorage.removeItem(key);
      }
    }
  });
}

/** Waits for fonts, then for transitions to end. */
export async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await wait(500);
}

/** Saves a shot as WebP, re-encoded by the core as an attached image is: a quarter of a PNG. */
async function save(shot: Shot, out: string, view: string) {
  const name = `${view}-${shot.size}-${shot.mode}.webp`;
  const { bytes } = await encodeImage(await shot.page.screenshot(), name);
  writeFileSync(join(out, name), bytes);
  process.stdout.write(`  ${name}\n`);
}

/** Takes a view, at both sizes and in both themes, or on one size when only it shows it. */
export type Each = (view: string, act: (shot: Shot) => Promise<void>, only?: Size) => Promise<void>;

/**
 * What takes each view of the shots into `out`, unless `views` names others: every view when it is
 * empty.
 */
export function shooter(shots: Array<Shot>, out: string, views: Array<string>): Each {
  return async (view, act, only) => {
    if (views.length > 0 && !views.includes(view)) {
      return;
    }
    for (const shot of shots) {
      if (only && shot.size !== only) {
        continue;
      }
      await act(shot);
      await save(shot, out, view);
    }
  };
}

/** Scrolls a page so an element is near its top, below the phone's top bar. */
async function scrollToTop(page: Page, locator: ReturnType<Page["getByText"]>) {
  await locator.evaluate((element) =>
    window.scrollBy(0, element.getBoundingClientRect().top - (window.innerWidth < 768 ? 64 : 16)),
  );
  await wait(300);
}

/** A spec's first story: its band's text under review, its heading once approved. */
const story = (page: Page) => page.getByText(/^US1( ·|:)/).first();

/**
 * A spec under review at its top, its mockups first. A spec's folds: under review, closed, with
 * US2's scenarios open, and with Details opened from a link to its Data; an approved spec's,
 * closed, then with Details open.
 */
export async function takeFolds(each: Each) {
  await each("spec-mockups", ({ page }) => show(page, SPEC, "Open the mockup: Repeat"));
  await each("spec-folded", async ({ page }) => {
    await show(page, SPEC, "Complete a repeating task");
    await scrollToTop(page, story(page));
  });
  await each("spec-scenarios", async ({ page }) => {
    await show(page, SPEC, "Complete a repeating task");
    await page.getByRole("button", { exact: true, name: "Scenarios (4)" }).first().click();
    await scrollToTop(page, page.getByText("US2 · P1"));
  });
  await each("spec-details", ({ page }) => show(page, `${SPEC}#data`, "Complete a repeating task"));
  await each("spec-approved", async ({ page }) => {
    await show(page, APPROVED, "Complete a repeating task");
    await scrollToTop(page, story(page));
  });
  await each("spec-approved-details", async ({ page }) => {
    await show(page, APPROVED, "Complete a repeating task");
    const details = page.getByRole("button", { exact: true, name: "Details" });
    await details.click();
    await scrollToTop(page, details);
  });
}
