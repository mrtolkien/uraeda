// oxlint-disable max-lines -- over the limit before the code quality decision: each group of views' shots in a module of its own
/**
 * Screenshots of the UI's views for review, as the UI checks decision asks before handing a UI
 * change over: each view at a phone's size (402 × 874, with a touch screen) and a desktop's
 * (1440 × 900), in light and dark, saved as `<view>-<phone|desktop>-<light|dark>.png` in the
 * feature's `screenshots/` folder.
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
import { type Browser, type BrowserContext, type Page, webkit } from "playwright";
import { addRepository } from "uraeda-binding";
import { fixtureRepo, git } from "uraeda-binding/test-utils";
import { FakeAdapter } from "uraeda-server/testing";
import { createServer, type PluginOption } from "vite-plus";
import base, { uraedaServer } from "../vite.config.ts";

const web = fileURLToPath(new URL("..", import.meta.url));
const root = fileURLToPath(new URL("../../..", import.meta.url));
const folder = process.argv[2];
if (!folder) {
  throw new Error("Name the feature's folder: vp run --filter uraeda-web screenshots <folder>");
}
const out = join(root, "specs", folder, "screenshots");
/** The views to take, by name, after the folder: every view when none is named. */
const views = process.argv.slice(3);

const ROUND = "/f/2026-10-11-web-ui/clarifications-01.md";
const SPEC = "/f/2026-10-06-recurring-tasks/spec.md";
const AGENT = "/f/2026-10-12-cli-tuis";
const MOCKUP = "/f/2026-10-06-recurring-tasks/mockups/repeat.html";
const LONG = "specs/2026-10-12-cli-tuis/clarifications-01.md";

type Size = "phone" | "desktop";
type Mode = "light" | "dark";
type Shot = { context: BrowserContext; mode: Mode; page: Page; size: Size };

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
  // Listed now, as the server lists it when it starts: its pages are under `/r/<name>/`.
  const { repository: listed } = await addRepository(data, repo);
  const adapter = new FakeAdapter();
  const plugins = (base.plugins ?? []).filter(
    (plugin: PluginOption) => !(plugin && "name" in plugin && plugin.name === "uraeda-server"),
  );
  const server = await createServer({
    ...base,
    configFile: false,
    logLevel: "warn",
    plugins: [...plugins, uraedaServer({ adapter })],
    root: web,
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
          colorScheme: mode,
          viewport: size === "phone" ? { height: 874, width: 402 } : { height: 900, width: 1440 },
          // A touch screen, as the browser tests' phone has.
          hasTouch: size === "phone",
          reducedMotion: "reduce",
        });
        await context.addInitScript((value) => {
          window.localStorage.setItem("uraeda.theme", value);
        }, mode);
        shots.push({ context, mode, page: await context.newPage(), size });
      }
    }
    await take(shots, adapter, repo, `/r/${encodeURIComponent(listed.name)}`);
  } finally {
    await browser?.close();
    await server.close();
    rmSync(data, { force: true, recursive: true });
    rmSync(repo, { force: true, recursive: true });
  }
}

/** The repository's prefix, `/r/<name>`, which every page's path starts with. */
let prefix = "";

/** Opens a page of the repository, and waits for a text and for the page to settle. */
async function show(page: Page, path: string, text: string | RegExp) {
  await page.goto(`${prefix}${path}`);
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
  process.stdout.write(`  ${view}-${shot.size}-${shot.mode}.png\n`);
}

/** Takes a view, at both sizes and in both themes, or on one size when only it shows it. */
type Each = (view: string, act: (shot: Shot) => Promise<void>, only?: Size) => Promise<void>;

/** What takes each view of the shots, unless the views named after the folder leave it out. */
function shooter(shots: Array<Shot>): Each {
  return async (view, act, only) => {
    if (views.length > 0 && !views.includes(view)) {
      return;
    }
    for (const shot of shots) {
      if (only && shot.size !== only) {
        continue;
      }
      await act(shot);
      await save(shot, view);
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

const APPROVED = "/f/2026-10-13-plan-review/spec.md";

/** A spec's first story: its band's text under review, its heading once approved. */
const story = (page: Page) => page.getByText(/^US1( ·|:)/).first();

/**
 * A spec under review at its top, its mockups first. A spec's folds: under review, closed, with US2's scenarios open, and with Details opened from a
 * link to its Data; an approved spec's, closed, then with Details open.
 */
async function takeFolds(each: Each) {
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

/** Every view, each at both sizes and in both themes, or on one size when only it shows it. */
// oxlint-disable-next-line max-lines-per-function -- over the limit before the code quality decision: each view's shots in a function of their own
async function take(shots: Array<Shot>, adapter: FakeAdapter, repo: string, at: string) {
  prefix = at;
  /** A page's path within the repository, from the page's URL. */
  const here = (page: Page) => new URL(page.url()).pathname.slice(prefix.length);
  const each = shooter(shots);
  await takeFolds(each);
  const priorities = () => readFileSync(join(repo, "specs/PRIORITIES.md"), "utf8");
  const original = priorities();

  await each("home", ({ page }) => show(page, "/", "Waiting on you"));

  await each(
    "home-task",
    async ({ page }) => {
      await show(page, "/", "Waiting on you");
      await page.getByRole("link", { name: /Claude Code runner/ }).click();
      await page.getByRole("radio", { checked: true, name: "Next" }).waitFor();
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
    await page.getByRole("button", { exact: true, name: "Scenarios (4)" }).first().click();
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

  /** Sends a message from the composer, as the human does, and gives the message's ID. */
  const send = async (page: Page, text: string) => {
    const sent = adapter.sent.length;
    await page.getByRole("textbox", { name: "Message Claude Code" }).fill(text);
    await page.getByRole("button", { name: "Send" }).first().click();
    while (adapter.sent.length === sent) {
      await wait(50);
    }
    return adapter.sent.at(-1)!.id;
  };
  const result = { denials: [], errors: [], interrupted: false, ok: true, type: "result" as const };

  // Two chats: one replied to, one whose action auto mode blocked.
  await show(first, "/chats/new", "New chat");
  let id = await send(first, "Why is CI slow on WebKit?");
  adapter.emit({ id, type: "accepted" });
  adapter.emit({
    text: "WebKit draws without a GPU on CI: its animations take longer.",
    type: "text",
  });
  adapter.emit(result);
  await first.waitForURL(/\/chats\/(?!new)/);
  await show(first, "/chats/new", "New chat");
  id = await send(first, "Tag v0.3.0 and push the tag.");
  adapter.emit({ id, type: "accepted" });
  adapter.emit({
    id: "tag",
    input: { command: "git tag v0.3.0" },
    kind: "execute",
    name: "Bash",
    target: "git tag v0.3.0",
    type: "toolStart",
  });
  adapter.emit({ id: "tag", isError: false, output: "", type: "toolEnd" });
  adapter.emit({
    text: "I created the tag `v0.3.0`, but pushing it was blocked. Allow the push and I'll retry.",
    type: "text",
  });
  adapter.emit({
    ...result,
    denials: [{ input: { command: "git push origin v0.3.0" }, tool: "Bash" }],
  });
  await first.waitForURL(/\/chats\/(?!new)/);
  const chat = here(first);
  await each("chat-blocked", ({ page }) => show(page, chat, "Allow and retry"));
  await each("chat-new", ({ page }) => show(page, "/chats/new", "New chat"));

  // A feature's session at work: a sub-agent's tools, a reply streaming, and a steered message.
  await show(first, `${AGENT}/session`, "CLI TUIs");
  id = await send(first, "Plan the CLI.");
  adapter.emit({ id, type: "accepted" });
  adapter.emit({ text: `Reading **the answers** of round 01 in \`${LONG}\`.`, type: "text" });
  adapter.emit({
    id: "a",
    input: { file_path: LONG },
    kind: "read",
    name: "Read",
    target: LONG,
    type: "toolStart",
  });
  adapter.emit({ id: "a", isError: false, output: "…", type: "toolEnd" });
  adapter.emit({
    id: "task",
    input: {},
    kind: "other",
    name: "Task",
    subagent: { description: "Map the runner code" },
    type: "toolStart",
  });
  adapter.emit({
    id: "b",
    input: {},
    kind: "search",
    name: "Grep",
    parent: "task",
    target: '"sessions" packages/server/src/runner/',
    type: "toolStart",
  });
  adapter.emit({
    text: "The runner already keeps one cache per repository. I'll key sessions by their own ID",
    type: "textDelta",
  });
  await first.getByRole("button", { name: "Stop" }).first().waitFor();
  await send(first, "Use the existing helper for the cache's paths.");
  await wait(500);
  await each("session-working", async ({ page }) => {
    await show(page, `${AGENT}/session`, "Not read yet");
  });
  await each("agent-section", async ({ page }) => {
    await show(page, AGENT, "Open the session");
    // The section at the top, below the phone's top bar.
    await page
      .getByRole("region", { name: "Agent" })
      .evaluate((element) =>
        window.scrollBy(
          0,
          element.getBoundingClientRect().top - (window.innerWidth < 768 ? 64 : 16),
        ),
      );
    await wait(300);
  });

  /** Home, with the navigation open on the phone. */
  const sidebar = async (page: Page, size: Size) => {
    await show(page, "/", "Waiting on you");
    if (size === "phone") {
      await page.getByRole("button", { name: "Open navigation" }).click();
    }
    await page.getByText("Map the runner code").first().waitFor();
    await settle(page);
  };
  await each("sidebar", ({ page, size }) => sidebar(page, size));

  /** The repository menu, from its trigger in the navigation's heading or the phone's top bar. */
  const repositories = async (page: Page) => {
    await show(page, "/", "Waiting on you");
    await page
      .getByRole("button", { name: /^Uraeda / })
      .first()
      .click();
    await page.getByRole("dialog", { name: "Repositories" }).waitFor();
    await settle(page);
  };
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
