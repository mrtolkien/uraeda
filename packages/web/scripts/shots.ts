/**
 * What the screenshots' views are taken with: opening a page and waiting for it to settle, saving
 * a view at each size and theme, and the spec's folds, a group of views of their own.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser, BrowserContext, Page } from "playwright";
import { encodeImage } from "uraeda-binding";
import type { FakeAdapter } from "uraeda-server/testing";
import { createServer, type PluginOption } from "vite-plus";
import base, { uraedaServer } from "../vite.config.ts";

export type Size = "phone" | "desktop";
type Mode = "light" | "dark";
export type Shot = { context: BrowserContext; mode: Mode; page: Page; size: Size };

export const SPEC = "/f/2026-10-06-recurring-tasks/spec.md";
/** A question's comment field's label, which says a comment alone answers. */
export const COMMENT_FIELD = "Comment, or your own answer instead of a letter";
const APPROVED = "/f/2026-10-13-plan-review/spec.md";

const web = fileURLToPath(new URL("..", import.meta.url));

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** What the server calls once it has started, with its first request. */
type Started = NonNullable<Parameters<typeof uraedaServer>[0]>["started"];

/**
 * The UI served by Vite with the server's routes in process, on `adapter`, without sign-in, on
 * `port` or the next one free, with the settings of the environment as it is now; `started` is
 * called once its server has started.
 */
export async function serveUi(adapter: FakeAdapter, port: number, started?: Started) {
  const plugins = (base.plugins ?? []).filter(
    (plugin: PluginOption) => !(plugin && "name" in plugin && plugin.name === "uraeda-server"),
  );
  const server = await createServer({
    ...base,
    configFile: false,
    logLevel: "warn",
    plugins: [...plugins, uraedaServer({ adapter, signIn: false, ...(started && { started }) })],
    root: web,
    server: { host: "127.0.0.1", port, strictPort: false },
  });
  await server.listen();
  return server;
}

/**
 * A page at each size, a phone's (402 × 874, with a touch screen) and a desktop's (1440 × 900), in
 * each theme, on the UI at `url`, with the banner that asks to notify dismissed.
 */
export async function openShots(browser: Browser, url: string): Promise<Array<Shot>> {
  const shots: Array<Shot> = [];
  for (const size of ["phone", "desktop"] as const) {
    for (const mode of ["light", "dark"] as const) {
      const context = await browser.newContext({
        baseURL: url,
        colorScheme: mode,
        viewport: size === "phone" ? { height: 874, width: 402 } : { height: 900, width: 1440 },
        // A touch screen, as a phone has.
        hasTouch: size === "phone",
        reducedMotion: "reduce",
        // The feature page's times, as its features' commits give them.
        timezoneId: "UTC",
      });
      // The banner that asks to notify shows above every page until dismissed: its own shot
      // names its tab "banner" to show it.
      await context.addInitScript(() => {
        if (window.name !== "banner") {
          window.localStorage.setItem("uraeda.notifications", "dismissed");
        }
      });
      shots.push({ context, mode, page: await context.newPage(), size });
    }
  }
  return shots;
}

/** The repository's prefix, `/r/<name>`, which every page's path starts with. */
let prefix = "";

/** Sets the repository's prefix, once it is listed. */
export function setPrefix(value: string) {
  prefix = value;
}

/** A page's path within the repository, from the page's URL. */
export const here = (page: Page) => new URL(page.url()).pathname.slice(prefix.length);

/**
 * The phone's Sessions tab, opened by its tab: its page holds what the column holds on a wider
 * screen, the ＋ buttons, the search, and the panes of sessions.
 */
export async function openSessionsTab(page: Page) {
  await page
    .getByRole("navigation", { name: "Tabs" })
    .getByRole("link", { name: /^Sessions/ })
    .click();
  await page.getByRole("heading", { level: 1, name: "Sessions" }).waitFor();
}

/**
 * The repository menu, from its trigger, "Uraeda" over the repository's name: in the column's
 * heading, or at the top of the phone's Sessions tab.
 */
export async function openRepositories(page: Page) {
  if (page.viewportSize()!.width < 768) {
    await openSessionsTab(page);
  }
  await page
    .getByRole("button", { name: /^Uraeda / })
    .first()
    .click();
  await page.getByRole("dialog", { name: "Repositories" }).waitFor();
}

/** Opens a page of the repository, and waits for a text and for the page to settle. */
export async function show(page: Page, path: string, text: string | RegExp) {
  await page.goto(`${prefix}${path}`);
  await page.getByText(text).first().waitFor({ timeout: 20_000 });
  await settle(page);
}

/**
 * What only each kind's form on New shows, once drawn: the cards' sentences show whatever the kind,
 * so they do not say the form drew.
 */
const NEW_FORMS = {
  change: (page: Page) => page.getByText("Describe the bug or the change."),
  feature: (page: Page) => page.getByText("Or start from a note or a priority"),
  session: (page: Page) => page.getByRole("textbox", { name: "Message Claude Code" }),
};

/** Opens New with `kind` picked, and waits for its form and for the page to settle. */
export async function showNew(page: Page, kind: keyof typeof NEW_FORMS = "session") {
  await page.goto(`${prefix}${kind === "session" ? "/new" : `/new?kind=${kind}`}`);
  await NEW_FORMS[kind](page).first().waitFor({ timeout: 20_000 });
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

/** The shots that failed, by name and first line of their error, which the run reports at its end. */
const failed: Array<string> = [];

process.on("exit", () => {
  if (failed.length > 0) {
    process.stdout.write(`${failed.length} shots failed:\n  ${failed.join("\n  ")}\n`);
    process.exitCode = 1;
  }
});

/**
 * What takes each view of the shots into `out`, unless `views` names others: every view when it is
 * empty. A shot that fails is noted in `failed`, and the run goes on to the next, so one view the
 * UI changed under it does not cost every view after it.
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
      try {
        await act(shot);
        await save(shot, out, view);
      } catch (error) {
        const line = String(error instanceof Error ? error.message : error).split("\n")[0];
        failed.push(`${view}-${shot.size}-${shot.mode}: ${line}`);
        process.stdout.write(`  FAILED ${view}-${shot.size}-${shot.mode}: ${line}\n`);
      }
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

/** A spec's first story: its card's title. */
const story = (page: Page) => page.getByRole("heading", { name: "Make a task repeat" }).first();

/**
 * A spec's folds: under review, closed, and with US2's more scenarios open; an approved spec's,
 * closed.
 */
export async function takeFolds(each: Each) {
  await each("spec-folded", async ({ page }) => {
    await show(page, SPEC, "Complete a repeating task");
    await scrollToTop(page, story(page));
  });
  await each("spec-scenarios", async ({ page }) => {
    await show(page, SPEC, "Complete a repeating task");
    await page.getByRole("button", { exact: true, name: "2 more scenarios" }).first().click();
    await scrollToTop(page, page.getByRole("heading", { name: "Complete a repeating task" }));
  });
  await each("spec-approved", async ({ page }) => {
    await show(page, APPROVED, "Complete a repeating task");
    await scrollToTop(page, story(page));
  });
}
