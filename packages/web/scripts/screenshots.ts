/**
 * Screenshots of the UI's views for review, as the UI checks decision asks before handing a UI
 * change over: each view at a phone's size (402 × 874, with a touch screen) and a desktop's
 * (1440 × 900), in light and dark, saved as `<view>-<phone|desktop>-<light|dark>.png` in the
 * feature's `screenshots/` folder.
 *
 * Run it with `vp run --filter uraeda-web screenshots`, inside `nix develop` for WebKit. It serves
 * the UI with Vite over a fresh copy of `fixtures/repo`, its server in process on the fake agent,
 * as the browser tests do, and drives WebKit with Playwright. Its output is for people to look
 * at: no test compares it.
 *
 * Pass a feature's folder to save elsewhere: `vp run --filter uraeda-web screenshots <folder>`.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, type BrowserContext, type Page, webkit } from "playwright";
import { fixtureRepo, git } from "uraeda-binding/test-utils";
import { FakeAdapter } from "uraeda-server/testing";
import { createServer, type PluginOption } from "vite-plus";
import base, { uraedaServer } from "../vite.config.ts";

const web = fileURLToPath(new URL("..", import.meta.url));
const root = fileURLToPath(new URL("../../..", import.meta.url));
const folder = process.argv[2] ?? "2026-10-12-ui-improvements";
const out = join(root, "specs", folder, "screenshots");

const ROUND = "/f/2026-10-11-web-ui/clarifications-01.md";
const SPEC = "/f/2026-10-06-recurring-tasks/spec.md";
const AGENT = "/f/2026-10-12-cli-tuis";
const MOCKUP = "/f/2026-10-06-recurring-tasks/mockups/repeat.html";
const LONG = "specs/2026-10-12-cli-tuis/clarifications-01.md";

type Size = "phone" | "desktop";
type Mode = "light" | "dark";
type Shot = { size: Size; mode: Mode; context: BrowserContext; page: Page };

/** The fixture, with the example's mockup committed on the recurring tasks' branch. */
function repository() {
  const repo = fixtureRepo();
  const branch = "2026-10-06-recurring-tasks";
  git(repo, "switch", "--quiet", branch);
  mkdirSync(join(repo, "specs", branch, "mockups"), { recursive: true });
  copyFileSync(
    join(root, "skills/uraeda/assets/example/specs", branch, "mockups/repeat.html"),
    join(repo, "specs", branch, "mockups/repeat.html"),
  );
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "docs: mockup repeat.html");
  git(repo, "switch", "--quiet", "main");
  return repo;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const repo = repository();
  const data = mkdtempSync(join(tmpdir(), "uraeda-data-"));
  process.env.URAEDA_REPO = repo;
  process.env.URAEDA_DATA_DIR = data;
  const adapter = new FakeAdapter();
  const plugins = (base.plugins ?? []).filter(
    (plugin: PluginOption) => !(plugin && "name" in plugin && plugin.name === "uraeda-server"),
  );
  const server = await createServer({
    ...base,
    configFile: false,
    root: web,
    logLevel: "warn",
    plugins: [...plugins, uraedaServer({ adapter })],
    server: { host: "127.0.0.1", port: 4390, strictPort: false },
  });
  await server.listen();
  const url = server.resolvedUrls?.local[0]?.replace(/\/$/, "") ?? "";
  let browser: Browser | undefined;
  try {
    mkdirSync(out, { recursive: true });
    browser = await webkit.launch();
    const shots: Array<Shot> = [];
    for (const size of ["phone", "desktop"] as const) {
      for (const mode of ["light", "dark"] as const) {
        const context = await browser.newContext({
          baseURL: url,
          viewport: size === "phone" ? { width: 402, height: 874 } : { width: 1440, height: 900 },
          // A touch screen, as the browser tests' phone has.
          hasTouch: size === "phone",
          colorScheme: mode,
          reducedMotion: "reduce",
        });
        await context.addInitScript((value) => {
          window.localStorage.setItem("uraeda.theme", value);
        }, mode);
        shots.push({ size, mode, context, page: await context.newPage() });
      }
    }
    await take(shots, adapter, repo);
  } finally {
    await browser?.close();
    await server.close();
    rmSync(data, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
  }
}

/** Opens a page of the UI, and waits for a text and for the page to settle. */
async function show(page: Page, path: string, text: string | RegExp) {
  await page.goto(path);
  await page.getByText(text).first().waitFor({ timeout: 20_000 });
  await settle(page);
}

/** Waits for fonts, then for transitions to end. */
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await wait(500);
}

async function save(shot: Shot, view: string) {
  const path = join(out, `${view}-${shot.size}-${shot.mode}.png`);
  await shot.page.screenshot({ path });
  console.log(`  ${view}-${shot.size}-${shot.mode}.png`);
}

/** Every view, each at both sizes and in both themes, or on one size when only it shows it. */
async function take(shots: Array<Shot>, adapter: FakeAdapter, repo: string) {
  const each = async (
    view: string,
    act: (shot: Shot) => Promise<void>,
    only?: Size,
  ): Promise<void> => {
    for (const shot of shots) {
      if (only && shot.size !== only) {
        continue;
      }
      await act(shot);
      await save(shot, view);
    }
  };
  const priorities = () => readFileSync(join(repo, "specs/PRIORITIES.md"), "utf8");
  const original = priorities();

  await each("home", ({ page }) => show(page, "/", "Waiting on you"));

  await each(
    "home-task",
    async ({ page }) => {
      await show(page, "/", "Waiting on you");
      await page.getByRole("link", { name: /Claude Code runner/ }).click();
      await page.getByRole("radio", { name: "Next", checked: true }).waitFor();
      await settle(page);
    },
    "desktop",
  );

  await each("task-draft", ({ page }) =>
    show(page, "/priorities/git-listener", "Run the next step when a branch changes."),
  );

  await each("priorities", ({ page }) => show(page, "/priorities", "Git listener process"));

  await each("priorities-drag", async ({ page, size }) => {
    await show(page, "/priorities", "Git listener process");
    const line = page.getByRole("link", { name: /Git listener process/ });
    const above = (await page.getByRole("link", { name: /Claude Code runner/ }).boundingBox())!;
    if (size === "desktop") {
      const handle = (await page
        .getByRole("button", { name: "Move Git listener process" })
        .boundingBox())!;
      const x = handle.x + handle.width / 2;
      const y = handle.y + handle.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y - 10, { steps: 4 });
      await page.mouse.move(x, above.y + 2, { steps: 8 });
    } else {
      // A press held for half a second, then the finger moving: dnd-kit's touch drag.
      const box = (await line.boundingBox())!;
      await page.evaluate(
        async ({ x, y, to }) => {
          const touch = (type: string, target: EventTarget, at: number) =>
            target.dispatchEvent(
              new PointerEvent(type, {
                bubbles: true,
                cancelable: true,
                composed: true,
                pointerId: 1,
                pointerType: "touch",
                isPrimary: true,
                button: type === "pointermove" ? -1 : 0,
                buttons: 1,
                clientX: x,
                clientY: at,
              }),
            );
          const element = document.elementFromPoint(x, y)!;
          touch("pointerdown", element, y);
          await new Promise((resolve) => setTimeout(resolve, 650));
          for (const at of [y - 10, y - 30, to]) {
            touch("pointermove", document, at);
            await new Promise((resolve) => setTimeout(resolve, 60));
          }
        },
        { x: box.x + box.width / 2, y: box.y + box.height / 2, to: above.y + 2 },
      );
    }
    await wait(600);
  });
  // Each drag is cancelled once its screenshot is taken: nothing is written.
  for (const { page } of shots) {
    await page.keyboard.press("Escape");
    await page.mouse.up();
  }
  await wait(300);
  if (priorities() !== original) {
    throw new Error("a drag was dropped: PRIORITIES.md changed");
  }

  await each("quick-add", async ({ page }) => {
    await show(page, "/", "Waiting on you");
    await page.getByRole("button", { name: "Add a priority" }).click();
    await page.getByRole("textbox", { name: "Priority" }).fill("Show the agent's last commit");
    await settle(page);
  });

  await each(
    "round-index",
    async ({ page }) => {
      await show(page, ROUND, "How does your iPhone reach the server?");
      await page.getByRole("button", { name: /^\d+\/\d+$/ }).click();
      await page.getByRole("dialog", { name: "Questions" }).waitFor();
      await settle(page);
    },
    "phone",
  );
  await each(
    "round",
    async ({ page }) => {
      await show(page, ROUND, "How does your iPhone reach the server?");
      // The next unanswered question, at the top.
      await page.keyboard.press("n");
      await settle(page);
    },
    "desktop",
  );

  await each("review-comment", async ({ page, size }) => {
    await show(page, SPEC, "Complete a repeating task");
    // The element itself: once pressed, the locator would find the next block.
    const block = (await page
      .getByRole("button", { name: /Given a weekly task/, pressed: false })
      .first()
      .elementHandle())!;
    await block.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await block.click({ force: true });
    const field = page.getByRole("textbox", { name: "Comment text" });
    await field.waitFor();
    await field.fill("Say what happens when the week has no Monday.");
    await wait(1000);
    if (size === "desktop") {
      // The block near the top of the screen, its comment field and buttons under it.
      await block.evaluate((element) =>
        window.scrollBy(0, element.getBoundingClientRect().top - window.innerHeight / 6),
      );
      await wait(300);
    }
  });

  await each("mockup", ({ page }) => show(page, MOCKUP, "repeat.html"));

  await each("missing", ({ page }) =>
    show(page, "/f/2026-10-11-web-ui/spec.md", "No file spec.md in 2026-10-11-web-ui."),
  );

  // A new draft, made once from its task view, then opened in the editor at every size.
  const first = shots[0]!.page;
  await show(first, "/priorities/claude-code-runner-triggered-manually", "Claude Code runner");
  await first.getByRole("button", { name: "Draft" }).click();
  await first.waitForURL(/\/edit\//);
  const editor = new URL(first.url()).pathname;
  await each("editor-hints", ({ page }) => show(page, editor, "To write in the empty sections:"));

  // The agent panel, a run going on, then failed, on the fake agent.
  await show(first, AGENT, "Start the agent");
  await first.getByRole("button", { name: "Start the agent" }).click();
  await first.getByRole("button", { name: "Stop" }).waitFor();
  adapter.emit({ type: "init", sessionId: "fake", plugins: ["uraeda"], pluginErrors: [] });
  adapter.emit({ type: "text", text: `Reading **the answers** of round 01 in \`${LONG}\`.` });
  adapter.emit({ type: "toolStart", id: "a", name: "Read", input: { file_path: LONG } });
  adapter.emit({ type: "toolEnd", id: "a", isError: false, output: "…" });
  adapter.emit({
    type: "toolStart",
    id: "b",
    name: "Bash",
    input: { command: `ura check ${LONG} && vp run ready` },
  });
  await wait(500);
  const agent = async (page: Page, text: string) => {
    await show(page, AGENT, text);
    // The panel at the top, below the phone's top bar.
    await page
      .getByRole("region", { name: "Agent" })
      .evaluate((element) =>
        window.scrollBy(
          0,
          element.getBoundingClientRect().top - (window.innerWidth < 768 ? 64 : 16),
        ),
      );
    await wait(300);
  };
  await each("agent-running", ({ page }) => agent(page, "Stop"));
  // The run's view: a page on the phone, a pane beside the feature page on desktop.
  const run = await first
    .getByRole("list", { name: "Runs" })
    .getByRole("link")
    .first()
    .getAttribute("href");
  const view = async (page: Page, text: string) => {
    await show(page, AGENT, text);
    await page
      .getByRole("link", { name: /^Plan · / })
      .first()
      .click();
    await page.waitForURL(`**${run}`);
    await page.getByRole("log", { name: "Run log" }).waitFor();
    await settle(page);
  };
  await each("run-running", ({ page }) => view(page, "Stop"));
  adapter.emit({
    type: "result",
    ok: false,
    costUsd: 0.42,
    errors: ["The tests failed."],
    denials: [{ tool: "Bash", input: { command: "gh pr create --draft" } }],
  });
  adapter.finish(1, `could not read ${LONG}`);
  await wait(500);
  await each("agent-failed", ({ page }) => agent(page, "Try again"));
  await each("run-failed", ({ page }) => view(page, "Try again"));

  // A refused Undo: the file changes before the Undo's insert reaches the server.
  await each("undo-refused", async ({ page }) => {
    await page.route("**/fate**", async (route) => {
      if (route.request().postData()?.includes("priorities.insert")) {
        writeFileSync(join(repo, "specs/PRIORITIES.md"), `${priorities()}\n- Added elsewhere\n`);
      }
      await route.continue();
    });
    await show(page, "/priorities/nix-docker-based-execution-environments", "Nix + Docker");
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Undo" }).click();
    await page.getByText(/Could not restore/).waitFor();
    await settle(page);
    await page.unroute("**/fate**");
    writeFileSync(join(repo, "specs/PRIORITIES.md"), original);
  });
}

await main();
