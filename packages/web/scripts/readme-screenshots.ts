/**
 * The README's screenshots: Home, a round of questions, and a spec under review, on the sandbox's
 * realistic project, each at a phone's size and a desktop's, in light and dark, saved as
 * `<home|questions|spec>-<phone|desktop>-<light|dark>.webp` in `docs/images/screenshots/`.
 *
 * Run it with `vp run readme:screenshots`, inside `nix develop` for WebKit. It builds the realistic
 * project in a fresh folder, seeds its live session in a fresh data folder, and serves the UI with
 * Vite on the sandbox's agent, as `screenshots.ts` does, its two turns at work started as the
 * sandbox starts them, so its sessions run and Home shows the usage they report. It removes its
 * folders at the end, failed or not.
 */
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, type Page, webkit } from "playwright";
import { addRepository } from "uraeda-binding";
import { buildRealistic, DATE, REALISTIC_FOLDERS } from "../samples/index.ts";
import { atWorkOnRealistic, sandboxAgent } from "../sandbox/agent.ts";
import { seedRealisticSession } from "../sandbox/sessions.ts";
import { openShots, serveUi, setPrefix, settle, shooter, show } from "./shots.ts";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const out = join(root, "docs", "images", "screenshots");

/** Opens a page at its top, and waits for its text and for it to settle. */
async function open(page: Page, path: string, text: string) {
  await show(page, path, text);
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
}

async function main() {
  const folder = mkdtempSync(join(tmpdir(), "uraeda-readme-"));
  const repo = join(folder, "realistic");
  const data = mkdtempSync(join(tmpdir(), "uraeda-data-"));
  // Settings of its own, none: the developer's never show in the screenshots.
  const config = mkdtempSync(join(tmpdir(), "uraeda-config-"));
  let server: Awaited<ReturnType<typeof serveUi>> | undefined;
  let browser: Browser | undefined;
  try {
    buildRealistic(repo);
    await seedRealisticSession(data, repo);
    process.env.URAEDA_REPO = repo;
    process.env.URAEDA_DATA_DIR = data;
    process.env.URAEDA_CONFIG_DIR = config;
    // "Today" as the sandbox has it, the day the project's commits are dated.
    process.env.URA_TODAY = DATE.slice(0, 10);
    // Listed now, as the server lists it when it starts: its pages are under `/r/<name>/`.
    const { repository: listed } = await addRepository(data, repo);
    // The project's two turns at work, started once its server has, with the first request: the
    // realistic project's folder is the one `atWorkOnRealistic` finds beside itself.
    let working: Promise<void> | undefined;
    server = await serveUi(sandboxAgent(), 4390, (started) => {
      working = atWorkOnRealistic(started.sessions, repo);
      // Its failure is thrown where it is awaited, below: never unhandled before then, which would
      // end the run without removing its folders.
      working.catch(() => {});
    });
    const url = server.resolvedUrls?.local[0]?.replace(/\/$/, "") ?? "";
    mkdirSync(out, { recursive: true });
    browser = await webkit.launch();
    const shots = await openShots(browser, url);
    setPrefix(`/r/${encodeURIComponent(listed.name)}`);
    await show(shots[0]!.page, "/", "Overview");
    // Shot without its turns, Home would show no session at work and no usage: say so instead.
    if (working === undefined) {
      throw new Error(
        "The server did not start with the first page: the project's turns never ran.",
      );
    }
    await working;
    const each = shooter(shots, out, []);
    await each("home", ({ page }) => open(page, "/", "Overview"));
    // Q3, a question in the middle of the round, rather than the round's context at its top.
    await each("questions", async ({ page }) => {
      await open(
        page,
        `/f/${REALISTIC_FOLDERS.asking}/clarifications-01.md`,
        "How much of the proposal should this feature build?",
      );
      await page
        .locator("section", { hasText: "What should Space do when the focus is on a button?" })
        .last()
        .evaluate((element) => element.scrollIntoView({ block: "start" }));
      await settle(page);
    });
    await each("spec", ({ page }) =>
      open(page, `/f/${REALISTIC_FOLDERS.reviewing}/spec.md`, "Open the leader menu with Space"),
    );
  } finally {
    await browser?.close();
    await server?.close();
    for (const path of [folder, data, config]) {
      rmSync(path, { force: true, recursive: true });
    }
  }
}

await main();
