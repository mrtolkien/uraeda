/**
 * Checks, in a real Chromium, that one unlayered rule over the built theme's tokens, the rule the
 * colour themes apply, wins in every surface that draws Uraeda's colours: the page, a pane, a
 * dialog Astryx portals, a Selector's popover, the sandbox bar, and a story in Storybook's preview,
 * its own document. Prints a line per surface and mode, `ok` or what it read, and exits non-zero on
 * any miss. With `--first-paint`, it checks instead that a reload paints the picked theme in its
 * first frame, before React mounts, and once the page shows, on Home and on the sign-in page
 * (SC-003): the first paint's script in `index.html` draws the cache of the picked themes. Run by
 * hand, not by `ready`:
 *
 *     nix develop -c node packages/web/scripts/palette-probe.ts
 *     nix develop -c node packages/web/scripts/palette-probe.ts --first-paint
 */
import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, chromium, type Locator, type Page } from "playwright";
import { addRepository } from "uraeda-binding";
import { FakeAdapter } from "uraeda-server/testing";
import { repository } from "./screenshot-repository.ts";
import { serveUi, settle, wait } from "./shots.ts";

type Mode = "light" | "dark";

/** The tokens the rule sets, and the colours it sets them to: none of them in Catppuccin. */
const TOKENS = {
  "--color-background-body": "#ff0000",
  // What the page draws beside and between its panes.
  "--color-background-surface": "#ff00ff",
  "--color-border": "#0000ff",
  "--color-text-primary": "#00ff00",
} as const;

/** The same colours, as the browser computes a painted property. */
const PAINTED = {
  background: "rgb(255, 0, 0)",
  border: "rgb(0, 0, 255)",
  surface: "rgb(255, 0, 255)",
  text: "rgb(0, 255, 0)",
} as const;

/** The selector of the rule, which later tasks' `applyPalette` writes. */
const selector = (mode: Mode) => `[data-astryx-theme="uraeda"][data-theme="${mode}"]`;

/** The rule, a block per mode, unlayered. */
const RULE = (["dark", "light"] as const)
  .map(
    (mode) =>
      `${selector(mode)} {\n${Object.entries(TOKENS)
        .map(([name, value]) => `  ${name}: ${value};`)
        .join("\n")}\n}`,
  )
  .join("\n");

const web = fileURLToPath(new URL("..", import.meta.url));
const root = fileURLToPath(new URL("../../..", import.meta.url));

/** The surfaces that missed, each with what it read. */
const misses: Array<string> = [];

/** Prints a surface's line, and notes a miss. */
function report(surface: string, mode: Mode, wrong: Array<string>, read: string) {
  const name = `${surface} (${mode})`;
  if (wrong.length === 0) {
    process.stdout.write(`ok    ${name}: ${read}\n`);
  } else {
    misses.push(name);
    process.stdout.write(`MISS  ${name}: ${wrong.join("; ")}\n`);
  }
}

/** Adds the rule to a page's document, as one `<style>` at the end of its head. */
async function addRule(page: Page) {
  await page.evaluate((css) => {
    const style = document.createElement("style");
    style.id = "uraeda-palette";
    style.textContent = css;
    document.head.append(style);
  }, RULE);
}

/** What an element computes: the three tokens, and the painted properties named. */
async function computed(locator: Locator, painted: Record<string, string>) {
  return locator.evaluate(
    (element, { names, painted }) => {
      const style = getComputedStyle(element);
      return {
        painted: Object.fromEntries(
          Object.entries(painted).map(([key, property]) => [key, style.getPropertyValue(property)]),
        ),
        tokens: Object.fromEntries(
          names.map((name) => [name, style.getPropertyValue(name).trim()]),
        ),
      };
    },
    { names: Object.keys(TOKENS), painted },
  );
}

/**
 * Checks a surface: the three tokens as the rule sets them on `locator`, and each painted property
 * named, `background`, `border`, or `text`, in the rule's colour.
 */
async function check(
  surface: string,
  mode: Mode,
  locator: Locator,
  painted: Partial<Record<keyof typeof PAINTED, string>>,
) {
  const read = await computed(locator, painted as Record<string, string>);
  const wrong: Array<string> = [];
  for (const [name, value] of Object.entries(TOKENS)) {
    if (read.tokens[name] !== value) {
      wrong.push(`${name} = ${read.tokens[name] || "(unset)"}`);
    }
  }
  for (const [key, property] of Object.entries(painted)) {
    if (read.painted[key] !== PAINTED[key as keyof typeof PAINTED]) {
      wrong.push(`${property} = ${read.painted[key]}`);
    }
  }
  const shown = Object.entries(painted)
    .map(([key, property]) => `${property} ${read.painted[key]}`)
    .join(", ");
  report(surface, mode, wrong, `tokens set${shown ? `, ${shown}` : ""}`);
}

/** Which elements carry the theme's attributes: `<html>`, Astryx's wrapper, or both. */
async function attributes(page: Page, mode: Mode, where: string) {
  const carriers = await page.evaluate(() =>
    [...document.querySelectorAll("[data-astryx-theme]")].map(
      (element) =>
        `<${element.localName}${element.id ? `#${element.id}` : ""}> data-astryx-theme=${element.getAttribute("data-astryx-theme")} data-theme=${element.getAttribute("data-theme") ?? "(none)"}`,
    ),
  );
  process.stdout.write(`      ${where} (${mode}), theme attributes on: ${carriers.join(", ")}\n`);
}

/**
 * The element that paints the point at `x`, `y` of the viewport: the first, from the topmost
 * element there up, whose background is not transparent, marked for its locator.
 */
async function painter(page: Page, x: number, y: number): Promise<Locator> {
  const found = await page.evaluate(
    ([x, y]) => {
      for (
        let element = document.elementFromPoint(x!, y!);
        element;
        element = element.parentElement
      ) {
        if (getComputedStyle(element).backgroundColor !== "rgba(0, 0, 0, 0)") {
          element.setAttribute("data-probe-painter", "");
          return `<${element.localName}>`;
        }
      }
      return null;
    },
    [x, y],
  );
  process.stdout.write(`      painted at ${x}, ${y} by ${found ?? "nothing"}\n`);
  return page.locator(found ? "[data-probe-painter]" : "html").last();
}

/** The page's background, a pane, and the text in it, on Home. */
async function checkHome(page: Page, mode: Mode) {
  // The page's right edge, beside the panes: what paints it is the page's background.
  await check("page background", mode, await painter(page, 1436, 450), {
    surface: "background-color",
  });
  await check(
    "app root (Theme's wrapper)",
    mode,
    page.locator("body div[data-astryx-theme]").first(),
    {
      text: "color",
    },
  );
  const pane = page.locator("section[aria-labelledby]").first();
  await check("pane border", mode, pane, {
    background: "background-color",
    border: "border-top-color",
  });
  await check("pane text", mode, pane, { text: "color" });
}

/** A dialog Astryx portals: the font picker, `Space u f i`. */
async function checkDialog(page: Page, mode: Mode) {
  for (const key of ["Space", "u", "f", "i"]) {
    await page.keyboard.press(key);
  }
  const dialog = page.getByRole("dialog").first();
  await dialog.waitFor();
  await page.getByRole("option").first().waitFor();
  await settle(page);
  await check("dialog (font picker)", mode, dialog, {});
  await check("dialog's option", mode, dialog.getByRole("option").first(), { text: "color" });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
}

/** A Selector's popover: the first font's, on the settings page. */
async function checkPopover(page: Page, mode: Mode, at: string) {
  await page.goto(`${at}/settings/fonts`);
  const trigger = page.locator('[aria-haspopup="listbox"]').first();
  await trigger.waitFor({ timeout: 20_000 });
  await settle(page);
  await addRule(page);
  await trigger.click();
  const list = page.getByRole("listbox").first();
  await list.waitFor();
  await settle(page);
  await check("Selector popover", mode, list, {});
  await check("Selector option", mode, list.getByRole("option").first(), { text: "color" });
  await page.keyboard.press("Escape");
}

/** The sandbox bar, mounted in the page's document as the sandbox page mounts it. */
async function checkSandboxBar(page: Page, mode: Mode) {
  await page.addScriptTag({
    content: `import { mountSandboxBar } from "/src/sandbox/mountSandboxBar.tsx";
mountSandboxBar({ document, window });`,
    type: "module",
  });
  const bar = page.locator('[popover="manual"] > div[data-astryx-theme]');
  await bar.waitFor({ state: "attached", timeout: 20_000 });
  await settle(page);
  await check("sandbox bar", mode, bar, { text: "color" });
}

/** Every surface of the app, in a mode. */
async function checkApp(browser: Browser, url: string, at: string, mode: Mode) {
  const context = await browser.newContext({
    baseURL: url,
    colorScheme: mode,
    reducedMotion: "reduce",
    viewport: { height: 900, width: 1440 },
  });
  await context.addInitScript(() =>
    window.localStorage.setItem("uraeda.notifications", "dismissed"),
  );
  const page = await context.newPage();
  await page.goto(`${at}/`);
  await page.getByText("Overview").first().waitFor({ timeout: 30_000 });
  await settle(page);
  await addRule(page);
  await attributes(page, mode, "app");
  await checkHome(page, mode);
  await checkDialog(page, mode);
  await checkSandboxBar(page, mode);
  await checkPopover(page, mode, at);
  await context.close();
}

/** Uraeda's Storybook, started in its own process, and the address it serves at. */
async function startStorybook(): Promise<{ process: ChildProcess; url: string }> {
  const port = 6190;
  const child = spawn(
    join(web, "node_modules/.bin/storybook"),
    ["dev", "--ci", "--no-open", "--host", "127.0.0.1", "--port", String(port)],
    { cwd: web, detached: true, stdio: "ignore" },
  );
  const url = `http://127.0.0.1:${port}`;
  for (let tries = 0; tries < 300; tries++) {
    const ready = await fetch(`${url}/index.json`).then(
      (response) => response.ok,
      () => false,
    );
    if (ready) {
      return { process: child, url };
    }
    await wait(1000);
  }
  throw new Error("Storybook did not start within 5 minutes.");
}

/**
 * A story in Storybook's preview, its own document: the rule added there, given the mode as an
 * embedding page sends it, `{ uraeda: "mode", mode }`.
 */
async function checkStory(browser: Browser, url: string, mode: Mode) {
  const context = await browser.newContext({ colorScheme: mode, reducedMotion: "reduce" });
  const page = await context.newPage();
  const id = "sandbox-bar--idle";
  await page.goto(`${url}/iframe.html?id=${id}&viewMode=story`);
  await page
    .locator("#storybook-root div[data-astryx-theme]")
    .first()
    .waitFor({ timeout: 120_000 });
  // The preview takes a message from its parent, which a page loaded on its own is itself.
  await page.evaluate((mode) => window.postMessage({ mode, uraeda: "mode" }, "*"), mode);
  await page.waitForFunction((mode) => document.documentElement.dataset.theme === mode, mode);
  await settle(page);
  await addRule(page);
  await attributes(page, mode, "story");
  // No element paints a story's background, with the built theme as with the rule: the frame's
  // canvas shows. The tokens are read on the root element, which declares them.
  await painter(page, 5, 5);
  await check("story's root element", mode, page.locator("html"), {});
  await check(
    "story's wrapper",
    mode,
    page.locator("#storybook-root div[data-astryx-theme]").first(),
    {
      text: "color",
    },
  );
  await context.close();
}

/** Dracula's page, as the drawn cache holds it and as the browser computes it. */
const DRACULA = { cached: "#282a36", painted: "rgb(40, 42, 54)" } as const;

/**
 * What the first frame read: `<html>`'s background and mode, the rule, and whether React mounted.
 */
type FirstFrame = { background: string; mode: string; mounted: boolean; palette: boolean };

/**
 * Reloads a page with Dracula picked for the mode Dark, in a light system, its colours cached as
 * the provider caches them, and reads `<html>` in the first frame, then once the page shows.
 */
async function checkFirstFrame(browser: Browser, url: string, path: string, signedOut: boolean) {
  const surface = signedOut ? "sign-in page" : "Home";
  const context = await browser.newContext({ baseURL: url, colorScheme: "light" });
  const drawn = JSON.stringify({
    dark: {
      "--color-background-body": DRACULA.cached,
      "--color-background-surface": DRACULA.cached,
    },
  });
  await context.addInitScript((drawn) => {
    window.localStorage.setItem("uraeda.notifications", "dismissed");
    window.localStorage.setItem("uraeda.theme", "dark");
    window.localStorage.setItem("uraeda.theme.dark", "dracula");
    window.localStorage.setItem("uraeda.theme.drawn", drawn);
    // Added before any script of the page: the first frame's callbacks run before it paints.
    requestAnimationFrame(() => {
      const html = document.documentElement;
      (window as unknown as { firstFrame: FirstFrame }).firstFrame = {
        background: getComputedStyle(html).backgroundColor,
        mode: html.dataset.theme ?? "(none)",
        mounted: (document.getElementById("root")?.childElementCount ?? 0) > 0,
        palette: document.getElementById("uraeda-palette") !== null,
      };
    });
  }, drawn);
  const page = await context.newPage();
  if (signedOut) {
    // A server with sign-in answers a browser without a session so: fate's requests, not its
    // modules.
    await page.route(
      (address) => /\/fate(\/live)?$/.test(address.pathname),
      (route) => route.fulfill({ json: { error: "Sign in to Uraeda." }, status: 401 }),
    );
  }
  await page.goto(path);
  await page
    .getByText(signedOut ? "Sign in to Uraeda" : "Overview")
    .first()
    .waitFor({ timeout: 30_000 });
  await settle(page);
  const first = await page.evaluate(
    () => (window as unknown as { firstFrame: FirstFrame }).firstFrame,
  );
  const shown = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );
  const wrong = [
    first.background !== DRACULA.painted && `first frame's background ${first.background}`,
    first.mode !== "dark" && `first frame's mode ${first.mode}`,
    first.mounted && "React had mounted in the first frame",
    !first.palette && "no palette rule in the first frame",
    shown !== DRACULA.painted && `shown page's background ${shown}`,
  ].filter((miss): miss is string => typeof miss === "string");
  report(`first frame, ${surface}`, "dark", wrong, `background ${first.background}, then ${shown}`);
  await context.close();
}

async function main() {
  const repo = repository(root);
  const data = mkdtempSync(join(tmpdir(), "uraeda-data-"));
  const config = mkdtempSync(join(tmpdir(), "uraeda-config-"));
  Object.assign(process.env, {
    URAEDA_CONFIG_DIR: config,
    URAEDA_DATA_DIR: data,
    URAEDA_REPO: repo,
  });
  const { repository: listed } = await addRepository(data, repo);
  const server = await serveUi(new FakeAdapter(), 4391);
  const url = server.resolvedUrls?.local[0]?.replace(/\/$/, "") ?? "";
  const at = `/r/${encodeURIComponent(listed.name)}`;
  let storybook: ChildProcess | undefined;
  const browser = await chromium.launch();
  try {
    if (process.argv.includes("--first-paint")) {
      await checkFirstFrame(browser, url, `${at}/`, false);
      await checkFirstFrame(browser, url, "/", true);
    } else {
      for (const mode of ["dark", "light"] as const) {
        await checkApp(browser, url, at, mode);
      }
      const started = await startStorybook();
      storybook = started.process;
      for (const mode of ["dark", "light"] as const) {
        await checkStory(browser, started.url, mode);
      }
    }
  } finally {
    await browser.close();
    await server.close();
    if (storybook?.pid) {
      // Its whole process group: Storybook starts the fixture's server beside it.
      process.kill(-storybook.pid);
    }
    for (const folder of [data, config, repo]) {
      rmSync(folder, { force: true, recursive: true });
    }
  }
  process.stdout.write(misses.length === 0 ? "Every surface: ok\n" : `${misses.length} missed\n`);
  process.exitCode = misses.length === 0 ? 0 : 1;
}

await main();
