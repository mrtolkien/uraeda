/**
 * Screenshots of the UI's views for review, as the UI checks decision asks before handing a UI
 * change over: each view at a phone's size (402 × 874, with a touch screen) and a desktop's
 * (1440 × 900), in light and dark, saved as `<view>-<phone|desktop>-<light|dark>.webp` in the
 * feature's `screenshots/` folder, re-encoded by the core as an attached image is.
 *
 * Run it with `vp run --filter uraeda-web screenshots <folder>`, inside `nix develop` for WebKit. It serves
 * the UI with Vite over a fresh copy of `fixtures/repo`, the repository it opens first, listed in a
 * fresh data folder, its server in process on the fake agent, as the browser tests do, and drives
 * WebKit with Playwright. Its output is for people to look
 * at: no test compares it.
 *
 * It saves into the feature's folder it is given: `vp run --filter uraeda-web screenshots <folder>`;
 * the views named after it, like `session-working sidebar`, are the only ones taken.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, type Page, webkit } from "playwright";
import { addRepository } from "uraeda-binding";
import { addStoryFeature, fixtureRepo, git, STORY_FEATURE } from "uraeda-binding/test-utils";
import { FakeAdapter } from "uraeda-server/testing";
import { createServer, type PluginOption } from "vite-plus";
import base, { uraedaServer } from "../vite.config.ts";
import { takeChanges } from "./change-shots.ts";
import { takeImages } from "./image-shots.ts";
import { takeInbox } from "./inbox-shots.ts";
import { addRoundMockup, takeRound } from "./round-shots.ts";
import { type Serve, takeSettings } from "./settings-shots.ts";
import { takeShell } from "./shell-shots.ts";
import { takeSignIn } from "./sign-in-shots.ts";
import { takeTextInputs } from "./text-input-shots.ts";
import {
  forget,
  here,
  setPrefix,
  settle,
  shooter,
  show,
  type Each,
  type Shot,
  type Size,
  SPEC,
  takeFolds,
  wait,
} from "./shots.ts";
import { AGENT, takeImplementation, takeSessions } from "./sessionShots.ts";

const web = fileURLToPath(new URL("..", import.meta.url));
const root = fileURLToPath(new URL("../../..", import.meta.url));
const folder = process.argv[2];
if (!folder) {
  throw new Error("Name the feature's folder: vp run --filter uraeda-web screenshots <folder>");
}
const out = join(root, "specs", folder, "screenshots");
/** The views to take, by name, after the folder: every view when none is named. */
const views = process.argv.slice(3);

const MOCKUP = "/f/2026-10-06-recurring-tasks/mockups/repeat.html";

/** The fixture, with the fixture HTML mockup committed on the recurring tasks' branch. */
function repository() {
  const repo = fixtureRepo();
  const branch = "2026-10-06-recurring-tasks";
  git(repo, "switch", "--quiet", branch);
  mkdirSync(join(repo, "specs", branch, "mockups"), { recursive: true });
  copyFileSync(
    join(root, "fixtures/mockups/repeat.html"),
    join(repo, "specs", branch, "mockups/repeat.html"),
  );
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "docs: mockup repeat.html");
  git(repo, "switch", "--quiet", "main");
  // The round page's mockup feature, whose round holds a diagram, a follow-up, and every group.
  addRoundMockup(repo);
  return repo;
}

async function main() {
  const repo = repository();
  // The test feature, whose spec embeds a story, before any worktree is made: its preview decision
  // goes on every branch, so the features' pages and sessions list their Storybook.
  addStoryFeature(repo);
  const data = mkdtempSync(join(tmpdir(), "uraeda-data-"));
  process.env.URAEDA_REPO = repo;
  process.env.URAEDA_DATA_DIR = data;
  // Settings of its own, none: the developer's never show in the screenshots.
  const config = mkdtempSync(join(tmpdir(), "uraeda-config-"));
  process.env.URAEDA_CONFIG_DIR = config;
  // Listed now, as the server lists it when it starts: its pages are under `/r/<name>/`.
  const { repository: listed } = await addRepository(data, repo);
  const adapter = new FakeAdapter();
  const server = await serve(adapter, 4390);
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
          colorScheme: mode,
          viewport: size === "phone" ? { height: 874, width: 402 } : { height: 900, width: 1440 },
          // A touch screen, as the browser tests' phone has.
          hasTouch: size === "phone",
          reducedMotion: "reduce",
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
    const at = `/r/${encodeURIComponent(listed.name)}`;
    await take(shots, adapter, repo, at);
    await takeImages(shooter(shots, out, views), shots[0]!.page, adapter, repo, `${url}${at}`);
    await takeTextInputs(shooter(shots, out, views));
    await takeChanges(shooter(shots, out, views), shots[0]!.page, adapter, repo);
    await takeStories(shooter(shots, out, views));
    // `settings` names every view of the settings page. Its second server reads `env` with its
    // first request, so `env` stays in the environment until it is closed.
    const second: Serve = async (env) => {
      const before = Object.fromEntries(Object.keys(env).map((name) => [name, process.env[name]]));
      const restore = () => {
        for (const [name, value] of Object.entries(before)) {
          if (value === undefined) {
            delete process.env[name];
          } else {
            process.env[name] = value;
          }
        }
      };
      Object.assign(process.env, env);
      const started = await serve(new FakeAdapter(), 4395).catch((error: unknown) => {
        restore();
        throw error;
      });
      return {
        close: async () => {
          await started.close();
          restore();
        },
        url: started.resolvedUrls?.local[0]?.replace(/\/$/, "") ?? "",
      };
    };
    await takeSettings(
      shooter(shots, out, views.includes("settings") ? [] : views),
      config,
      second,
      at,
    );
    // `sign-in` names every view of signing in and out.
    await takeSignIn(shooter(shots, out, views.includes("sign-in") ? [] : views));
  } finally {
    await browser?.close();
    await server.close();
    for (const folder of [data, config, repo]) {
      rmSync(folder, { force: true, recursive: true });
    }
  }
}

/**
 * The UI served by Vite with the server's routes in process, on `adapter`, without sign-in, on
 * `port` or the next one free, with the settings of the environment as it is now.
 */
async function serve(adapter: FakeAdapter, port: number) {
  const plugins = (base.plugins ?? []).filter(
    (plugin: PluginOption) => !(plugin && "name" in plugin && plugin.name === "uraeda-server"),
  );
  const server = await createServer({
    ...base,
    configFile: false,
    logLevel: "warn",
    plugins: [...plugins, uraedaServer({ adapter, signIn: false })],
    root: web,
    server: { host: "127.0.0.1", port, strictPort: false },
  });
  await server.listen();
  return server;
}

/** Home, with the navigation open on the phone. */
async function sidebar(page: Page, size: Size) {
  await show(page, "/", HOME);
  if (size === "phone") {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await page.getByText("Map the runner code").first().waitFor();
  await settle(page);
}

/** The repository menu, from its trigger in the navigation's heading or the phone's top bar. */
async function repositories(page: Page) {
  await show(page, "/", HOME);
  await page
    .getByRole("button", { name: /^Uraeda / })
    .first()
    .click();
  await page.getByRole("dialog", { name: "Repositories" }).waitFor();
  await settle(page);
}

/** What home shows once its data is drawn: its last card. */
const HOME = "Constitution and decisions";

/** Forgets, in every shot's page. */
async function forgetAll(shots: Array<Shot>) {
  for (const { page } of shots) {
    await forget(page);
  }
}

/** The constitution and decisions, the list, then a decision open. */
async function takeDecisions(each: Each) {
  await each("decisions", ({ page }) => show(page, "/decisions", "Version"));
  await each("decision", ({ page }) => show(page, "/decisions/ui-behaviour", "Approved by"));
}

/** The PRIORITIES.md of the screenshots' repository. */
const priorities = (repo: string) => readFileSync(join(repo, "specs/PRIORITIES.md"), "utf8");

/** Every view, each at both sizes and in both themes, or on one size when only it shows it. */
async function take(shots: Array<Shot>, adapter: FakeAdapter, repo: string, at: string) {
  setPrefix(at);
  const each = shooter(shots, out, views);
  // First, while nothing waits for a commit.
  await takeInbox(each, repo);
  await takeFolds(each);
  const original = priorities(repo);
  await takePriorities(each, shots, repo);
  await takeDecisions(each);
  // A refused Undo: the file changes before the Undo's insert reaches the server. Taken before
  // the reviews' views, which make a draft of a priority that would show here.
  await each("undo-refused", async ({ page }) => {
    await page.route("**/fate**", async (route) => {
      if (route.request().postData()?.includes("priorities.insert")) {
        writeFileSync(
          join(repo, "specs/PRIORITIES.md"),
          `${priorities(repo)}\n- Added elsewhere\n`,
        );
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

  const first = shots[0]!.page;
  await takeReviews(each, first);
  await takeSessions(each, first, adapter);

  await each("sidebar", ({ page, size }) => sidebar(page, size));
  await takeShell(each, sidebar);

  await each("repositories", ({ page }) => repositories(page));
  await each("repositories-add", async ({ page }) => {
    await repositories(page);
    await page.getByText("Add a repository…").click();
    await page.getByRole("textbox", { name: "Folder" }).fill("/");
    await page.getByRole("list", { name: "Folders" }).waitFor();
    await settle(page);
  });
  await each("sidebar-no-match", async ({ page, size }) => {
    await sidebar(page, size);
    await page.getByRole("searchbox", { name: "Search sessions" }).fill("zzz");
    await page.getByText("No session matches “zzz”.").waitFor();
    await settle(page);
  });

  await takeImplementation(each, adapter, repo);
}

/** Home, the priorities, dragged, an entry's pane, reading and editing, and the ＋ form. */
async function takePriorities(each: Each, shots: Array<Shot>, repo: string) {
  const original = priorities(repo);

  await each("home", ({ page }) => show(page, "/", HOME));

  await each("pane-reading", ({ page }) => show(page, "/priorities/git-listener", "Open draft"));

  // The line in place, its text changed, unsaved, and the draft's text editable under it (C2).
  await each("pane-editing", async ({ page }) => {
    await show(page, "/priorities/git-listener", "Open draft");
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("textbox", { name: "Line" }).fill("Git listener");
    await settle(page);
  });
  // The pane's unsaved text is kept in the browser: forgotten, so the next view opens as new.
  await forgetAll(shots);

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
        async ({ to, x, y }) => {
          const touch = (type: string, target: EventTarget, at: number) =>
            target.dispatchEvent(
              new PointerEvent(type, {
                bubbles: true,
                button: type === "pointermove" ? -1 : 0,
                buttons: 1,
                cancelable: true,
                clientX: x,
                clientY: at,
                composed: true,
                isPrimary: true,
                pointerId: 1,
                pointerType: "touch",
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
        { to: above.y + 2, x: box.x + box.width / 2, y: box.y + box.height / 2 },
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
  if (priorities(repo) !== original) {
    throw new Error("a drag was dropped: PRIORITIES.md changed");
  }

  await each("quick-add", async ({ page, size }) => {
    await forget(page);
    await show(page, "/", HOME);
    // The sidebar's ＋, in the phone's drawer.
    if (size === "phone") {
      await page.getByRole("button", { name: "Open navigation" }).click();
    }
    await page.getByRole("button", { name: "Add to the priorities" }).click();
    await page
      .getByRole("dialog", { name: "New priority" })
      .getByRole("textbox", { name: "Priority" })
      .fill("Show the agent's last commit");
    await settle(page);
  });
  await forgetAll(shots);
}

/** A round, reviews, a mockup, a missing file, the editor, and the hand-over to the agent. */
async function takeReviews(each: Each, first: Page) {
  await takeRound(each);

  await each("review-comment", async ({ page, size }) => {
    await show(page, SPEC, "Complete a repeating task");
    await page.getByRole("button", { exact: true, name: "2 more scenarios" }).first().click();
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
  await show(first, "/priorities/claude-code-runner-triggered-manually", "Claude Code runner");
  await first.getByRole("button", { name: "Draft" }).click();
  await first.waitForURL(/\/edit\//);
  const editor = here(first);
  await each("editor-hints", ({ page }) => show(page, editor, "To write in the empty sections:"));

  // The workflow's message in the composer of a feature waiting on the agent, unsent.
  await each("session-handover", async ({ page }) => {
    await show(page, AGENT, "Start the agent");
    await page.getByRole("button", { name: "Start the agent" }).first().click();
    await page.waitForURL(/\/session\?continue=/);
    await page
      .getByText(/Continue the feature/)
      .first()
      .waitFor();
    await settle(page);
  });

  // The commit buttons of a review, which start the agent.
  await each("review-commit", async ({ page }) => {
    await show(page, SPEC, "Complete a repeating task");
    await page
      .getByRole("button", { name: "Approve and start the agent" })
      .evaluate((element) => element.scrollIntoView({ block: "center" }));
    await settle(page);
  });
}

/** A spec embedding a story, in pick mode too, and the Storybook page, on the fake preview. */
async function takeStories(each: Each) {
  await each("story-embed", async ({ page }) => {
    await show(page, `/f/${STORY_FEATURE}/spec.md`, "Resize the sidebar");
    await page
      .frameLocator('iframe[title^="Dragging the handle, "]')
      .getByText("Clicked 0 times")
      .waitFor({ timeout: 20_000 });
    await settle(page);
  });
  await each("story-pick", async ({ page }) => {
    await show(page, `/f/${STORY_FEATURE}/spec.md`, "Resize the sidebar");
    const frame = page.frameLocator('iframe[title^="Dragging the handle, "]');
    await frame.getByText("Clicked 0 times").waitFor({ timeout: 20_000 });
    await page.getByRole("button", { name: "Pick an element" }).click();
    await frame.getByRole("button", { name: "Hide the sidebar" }).hover();
    await settle(page);
  });
  await each("storybook-page", async ({ page }) => {
    await show(page, `/f/${STORY_FEATURE}/storybook`, "Storybook");
    await page
      .frameLocator('iframe[title="Storybook"]')
      .frameLocator('iframe[title="storybook-preview-iframe"]')
      .getByText("Clicked 0 times")
      .waitFor({ timeout: 20_000 });
    await settle(page);
  });
}

await main();
