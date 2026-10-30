/**
 * The benchmark's pages: each drawn by a click (SC-001, and SC-006 after a start), by a key, `g`
 * and a letter or `j` `k` and `Enter` on the lists, and by a reload (SC-002).
 */
import type { Locator } from "playwright";
import { MAIN, measure, measureReload, pagePattern } from "./performance-probe.ts";
import type { Criterion, Run } from "./performance-report.ts";

/** A page's path within its repository, as the table shows it. */
const local = (path: string) => path.replace(/^\/r\/[^/]+/, "") || "/";

/** The page's path now. */
const here = (run: Run) => new URL(run.page.url()).pathname;

/** The paths every page drawn by a click went to, for the reloads. */
export const visited = new Set<string>();

/** Clicks a link and times its page, unless it is the page shown already. */
export async function clickTo(run: Run, criterion: Criterion, link: Locator) {
  const href = await link.getAttribute("href");
  if (href === null) {
    return;
  }
  const path = new URL(href, run.page.url()).pathname;
  if (path === here(run)) {
    return;
  }
  const conditions = [{ kind: "navigate" as const, name: "page", pattern: pagePattern(path) }];
  const measured = await measure(run.page, run.server, conditions, () => link.click());
  run.report.add(criterion, run.project, `click ${local(path)}`, measured);
  visited.add(path);
}

/** The links of the navigation column, in its order, each once. */
async function columnLinks(run: Run): Promise<Array<string>> {
  const hrefs = await run.page
    .getByRole("navigation", { name: "Navigation" })
    .locator("a[href]")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  return [...new Set(hrefs.filter((href) => href !== ""))];
}

/** A link of the page's main content whose path starts with `prefix`, the first one. */
function mainLink(run: Run, prefix: string, suffix = ""): Locator {
  return run.page.locator(`:is(${MAIN}) a[href^="${prefix}"]${suffix}`).first();
}

/**
 * Clicks every link of the navigation column, and from each feature its first file, and from the
 * decisions their first decision: `limit` links at most.
 */
export async function clickColumn(run: Run, criterion: Criterion, limit = Infinity) {
  const column = run.page.getByRole("navigation", { name: "Navigation" });
  for (const href of (await columnLinks(run)).slice(0, limit)) {
    await clickTo(run, criterion, column.locator(`a[href="${href}"]`).first());
    const path = here(run);
    const file = /\/f\/[^/]+$/.test(path)
      ? mainLink(run, `${path}/`, '[href$=".md"]')
      : path.endsWith("/decisions")
        ? mainLink(run, `${path}/`)
        : undefined;
    if (file !== undefined && (await file.count()) > 0) {
      await clickTo(run, criterion, file);
    }
  }
}

/** Presses `g` then `letter`, and times the page it goes to, `path` within the repository. */
export async function goKey(run: Run, letter: string, path: string, prefix: string) {
  const full = `${prefix}${path}`;
  if (here(run) === full) {
    return;
  }
  await run.page.keyboard.press("g");
  const conditions = [{ kind: "navigate" as const, name: "page", pattern: pagePattern(full) }];
  const measured = await measure(run.page, run.server, conditions, () =>
    run.page.keyboard.press(letter),
  );
  run.report.add("SC-001", run.project, `g ${letter} → ${path}`, measured);
}

/**
 * A row selected: `href` is the page it opens, "" when it opens one by a button, or null when it
 * opens none, as a row edited in place.
 */
type Selected = { href: string | null; key: string } | null;

/** The row the selection is on: a list's row, or a card holding the focus. */
function selected(run: Run): Promise<Selected> {
  return run.page.evaluate(() => {
    const row = document.querySelector('[data-row][aria-current="true"]');
    if (row !== null) {
      const link = row.querySelector("[data-row-link]");
      const href =
        link === null ? null : (link.querySelector("a[href]")?.getAttribute("href") ?? "");
      return { href, key: row.getAttribute("data-row-key") ?? "" };
    }
    const card = document.activeElement?.closest("a[href]");
    const href = card?.getAttribute("href");
    return card?.closest("nav") === null && href ? { href, key: href } : null;
  });
}

/** Leaves the focus to the page: the keys act on it, not on the link a click left focused. */
const blur = (run: Run) =>
  run.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

/**
 * Walks a list with `j`, then back one row with `k`, and opens with `Enter` the rows that open a
 * page, `opens` at most, timing each; Back returns to the list between them, and the walk goes
 * on from the row it opened.
 */
async function walkList(run: Run, list: string, rows: number, opens: number) {
  const listPath = here(run);
  await blur(run);
  const seen = new Set<string>();
  let at = 0;
  let opened = 0;
  for (let step = 1; step <= rows && opened < opens; step++) {
    const key = step === rows ? "k" : "j";
    await run.page.keyboard.press(key);
    at += key === "j" ? 1 : -1;
    await run.page.waitForTimeout(150);
    const row = await selected(run);
    // An Add row opens a new row to write, no page.
    if (row === null || row.href === null || seen.has(row.key) || row.key.startsWith("add:")) {
      continue;
    }
    if (row.href !== "" && !row.href.startsWith("/r/")) {
      continue;
    }
    seen.add(row.key);
    const pattern =
      row.href === ""
        ? `(?!${pagePattern(listPath)}$).+`
        : pagePattern(new URL(row.href, run.page.url()).pathname);
    const conditions = [{ kind: "navigate" as const, name: "page", pattern }];
    const measured = await measure(run.page, run.server, conditions, () =>
      run.page.keyboard.press("Enter"),
    );
    // A row whose Enter opened no page, as one that opens its own pane, is not a page's time.
    if (measured.times.page === null && here(run) === listPath) {
      await run.page.keyboard.press("Escape");
      continue;
    }
    run.report.add("SC-001", run.project, `${list}: ${key}, Enter → ${local(here(run))}`, measured);
    opened += 1;
    await run.page.goBack();
    await run.page.waitForTimeout(300);
    // Back keeps the selection; where it did not, the keys select the row again.
    if ((await selected(run))?.key !== row.key) {
      await blur(run);
      for (let again = 0; again < at; again++) {
        await run.page.keyboard.press("j");
      }
    }
  }
}

/** The lists walked by key: home, priorities, inbox, each reached by `g` and its letter. */
const LISTS = [
  ["h", "/", "home"],
  ["p", "/priorities", "priorities"],
  ["i", "/inbox", "inbox"],
] as const;

/** Every page by key: `g` and a letter, then each list's rows. */
export async function keyPages(run: Run, prefix: string) {
  await goKey(run, "d", "/decisions", prefix);
  for (const [letter, path, list] of LISTS) {
    await goKey(run, letter, path, prefix);
    await run.page.waitForTimeout(300);
    await walkList(run, list, 8, 3);
    await run.page.keyboard.press("Escape");
    if (here(run) !== `${prefix}${path}`) {
      await run.page.goto(`${prefix}${path}`);
      await run.page.waitForFunction(() => window.__perf.loaded);
      await run.page.waitForTimeout(500);
    }
  }
}

/** Reloads each page `paths` names, and times each against SC-002. */
export async function reloads(run: Run, paths: Iterable<string>) {
  for (const path of paths) {
    await run.page.goto(path);
    await run.page.waitForFunction(() => window.__perf.loaded);
    run.report.add(
      "SC-002",
      run.project,
      `reload ${local(path)}`,
      await measureReload(run.page, run.server),
    );
  }
}
