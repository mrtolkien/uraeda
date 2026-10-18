/**
 * Checks Uraeda's own Storybook as Uraeda serves it (US7.1, review focus 1): Uraeda's server, on the
 * fake agent, lists this checkout's repository and starts its preview decision's command, the real
 * Storybook of `packages/web`; WebKit opens the `Ready` story of `StoryEmbed.stories.tsx` through
 * Uraeda's address, `/r/<name>/preview/<secret>/<folder>/iframe.html?id=storyembed--ready&viewMode=story`,
 * its base from the checkout's `Preview` record;
 * the story shows the fixture's data, which its fate client reads through GETs (R4), and its frame the
 * fixture's story, through Uraeda (R43); then an edit of
 * the stories file shows in the frame without a reload, and the file is restored. Then it opens
 * Uraeda's own Storybook page, `/f/<folder>/storybook?path=/story/storyembed--ready`, served by
 * Vite as `vp dev` serves it, so Storybook's interface shows in the page's own sandboxed frame:
 * its canvas shows the `Ready` story, picking
 * `Removed` and turning its `removed` control off update the canvas, an export added to the stories
 * file shows in the sidebar and renders, and the canvas renders at a phone's width, whose screenshot
 * it writes to the system's temporary folder for a look.
 *
 * Run it by hand, inside `nix develop` for WebKit, after `vp install`:
 * `node packages/web/scripts/validate-storybook.ts`. It is not part of `vp test` or `vp run ready`:
 * it starts the real Storybook, which takes a few seconds and a free port. In a feature's worktree,
 * it opens that feature's Storybook, else the main checkout's. It reads the repository only: its
 * data folder is a temporary one.
 *
 * It prints one line per check, `PASS` or `FAIL` with what it got, and exits 1 on the first failure.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, type Frame, type FrameLocator, type Page, webkit } from "playwright";
import { addRepository } from "uraeda-binding";
import { FakeAdapter } from "uraeda-server/testing";
import { createServer } from "vite-plus";
import base, { uraedaServer } from "../vite.config.ts";
import { whileEdited } from "./edited.ts";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const STORIES = join(root, "packages/web/src/StoryEmbed.stories.tsx");
/** The `Ready` story's label, and the edit the check makes to it. */
const LABEL = "Dragging the handle";
const EDITED = `${LABEL}, edited`;
/** How long Storybook may take to start, and a story or an edit to show. */
const START_MS = 120_000;
const SHOW_MS = 30_000;
/** The export the interface's check adds to the stories file, and its story's id. */
const ADDED = `\nexport const Added: Story = { args: { folder: CHECKOUTS.ready, story: dragging } };\n`;
const ADDED_ID = "storyembed--added";
/** The text of the `Removed` story, and of the `Missing` one it shows with `removed` off. */
const REMOVED = "This variant was removed after your answer.";
const MISSING = "No story “Resizing” in packages/web/src/SidebarHandle.stories.tsx on this branch.";

/**
 * The checkout's folder: its feature's or change's in a worktree, the branch's name without the
 * `change/` of a change's, else `main`.
 */
function checkoutFolder(): string {
  const git = (...args: Array<string>) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const worktree = git("rev-parse", "--absolute-git-dir") !== join(root, ".git");
  return worktree ? git("branch", "--show-current").replace(/^change\//, "") : "main";
}

function pass(name: string) {
  process.stdout.write(`PASS ${name}\n`);
}

function fail(name: string, got: unknown): never {
  throw new Error(`FAIL ${name}: got ${typeof got === "string" ? got : JSON.stringify(got)}`);
}

/**
 * The UI served by Vite with the server's routes in process, on the fake agent, without sign-in, on
 * a free port, as `vp dev` serves it.
 */
async function serve() {
  const plugins = (base.plugins ?? []).filter(
    (plugin) => !(plugin && "name" in plugin && plugin.name === "uraeda-server"),
  );
  const server = await createServer({
    ...base,
    configFile: false,
    logLevel: "warn",
    plugins: [...plugins, uraedaServer({ adapter: new FakeAdapter(), file: false, signIn: false })],
    root: join(root, "packages/web"),
    server: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  await server.listen();
  return server;
}

/**
 * Reads the checkout's `Preview` record through fate, as the Storybook page does, until it is ready:
 * each read is a view, and the first starts Storybook. Returns its last state, error, and base.
 */
async function waitForStorybook(address: string, name: string, folder: string) {
  const deadline = Date.now() + START_MS;
  let last: { base?: string | null; error?: string | null; state?: string } = {};
  while (Date.now() < deadline) {
    const response = await fetch(`${address}/r/${encodeURIComponent(name)}/fate`, {
      body: JSON.stringify({
        operations: [
          {
            id: "1",
            ids: [folder],
            kind: "byId",
            select: ["state", "error", "base"],
            type: "Preview",
          },
        ],
        version: 1,
      }),
      headers: { "content-type": "application/json", origin: address },
      method: "POST",
    });
    const payload = (await response.json()) as {
      results: Array<{
        data?: Array<{ base: string | null; error: string | null; state: string }>;
      }>;
    };
    last = payload.results[0]?.data?.[0] ?? {};
    if (last.state === "ready" || last.state === "failed") {
      return last;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return last;
}

/** The text of the story's page, once `text` shows in it, or what it shows after `SHOW_MS`. */
async function shown(page: Page | Frame, text: string): Promise<string> {
  await page
    .getByText(text, { exact: true })
    .first()
    .waitFor({ timeout: SHOW_MS })
    .catch(() => {});
  return page.locator("body").innerText();
}

async function check(address: string, name: string, folder: string) {
  const state = await waitForStorybook(address, name, folder);
  if (state.state !== "ready") {
    fail("Uraeda starts the checkout's Storybook", state);
  }
  pass(`Uraeda starts the Storybook of ${folder}`);

  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ viewport: { height: 900, width: 1440 } });
    const url = `${address}${state.base}iframe.html?id=storyembed--ready&viewMode=story`;
    await page.goto(url);
    // The embed draws its frames only once its story is ready, which it reads through fate's GETs
    // and live stream, from the server in Storybook.
    const ready = await page
      .getByTitle(`${LABEL}, desktop`)
      .waitFor({ state: "attached", timeout: START_MS })
      .then(
        () => true,
        () => false,
      );
    const text = await page.locator("body").innerText();
    if (!ready || !text.includes(LABEL)) {
      fail("the Ready story shows the fixture's data", text);
    }
    pass("the Ready story shows the fixture's data, read through fate's GETs");

    // The story's own frame, the fixture's fake Storybook, loads through Uraeda: its address is
    // under this Storybook's base (R43).
    const inner = page.frameLocator(`iframe[title="${LABEL}, desktop"]`);
    const story = await inner
      .getByRole("heading", { name: "Dragging" })
      .waitFor({ timeout: SHOW_MS })
      .then(
        () => true,
        () => false,
      );
    if (!story) {
      const src = await page.getByTitle(`${LABEL}, desktop`).getAttribute("src");
      const body = await inner
        .locator("body")
        .innerText({ timeout: 1000 })
        .catch(() => "");
      fail("the Ready story's frame shows its story", { body, src });
    }
    pass("the Ready story's frame shows its story, through Uraeda");

    await page.evaluate(() => {
      (window as { uraedaLoaded?: boolean }).uraedaLoaded = true;
    });
    await whileEdited(
      STORIES,
      (original) => original.replace(`label: "${LABEL}"`, `label: "${EDITED}"`),
      async () => {
        const edited = await shown(page, EDITED);
        if (!edited.includes(EDITED)) {
          fail("an edit of the stories file shows", edited);
        }
        const kept = await page.evaluate(() => (window as { uraedaLoaded?: boolean }).uraedaLoaded);
        if (kept !== true) {
          fail("the edit shows without a reload", "the page was reloaded");
        }
        pass("an edit of the stories file shows in the frame, without a reload");
      },
    );
    await checkInterface(browser, storybookPage(address, name, folder));
  } finally {
    await browser.close();
  }
}

/** Whether `text` shows in Storybook's canvas, the story frame of its interface, within `SHOW_MS`. */
function inCanvas(canvas: FrameLocator, text: string): Promise<boolean> {
  return canvas
    .getByText(text)
    .first()
    .waitFor({ timeout: SHOW_MS })
    .then(
      () => true,
      () => false,
    );
}

/** The text of Storybook's canvas, for a failure. */
function canvasText(canvas: FrameLocator): Promise<string> {
  return canvas
    .locator("body")
    .innerText({ timeout: 1000 })
    .catch(() => "");
}

/**
 * Whether Storybook's controls panel lists each of `args` within `SHOW_MS`: it learns them only from
 * the story frame's messages, which the frame renders without, from its own address.
 */
async function listsControls(storybook: FrameLocator, args: Array<string>): Promise<boolean> {
  const panel = storybook.locator("#storybook-panel-root");
  const listed = await Promise.all(
    args.map((arg) =>
      panel
        .getByText(arg, { exact: true })
        .first()
        .waitFor({ timeout: SHOW_MS })
        .then(
          () => true,
          () => false,
        ),
    ),
  );
  return !listed.includes(false);
}

/** Uraeda's Storybook page of the checkout, at the story `?path=` names. */
function storybookPage(address: string, name: string, folder: string): string {
  const page = folder === "main" ? "/storybook" : `/f/${encodeURIComponent(folder)}/storybook`;
  return `${address}/r/${encodeURIComponent(name)}${page}?path=/story/storyembed--ready`;
}

/** The frame of Storybook's interface inside Uraeda's page, whose window a reload would replace. */
async function interfaceFrame(page: Page): Promise<Frame> {
  const handle = await page.locator('iframe[title="Storybook"]').elementHandle();
  return (await handle!.contentFrame())!;
}

/**
 * Checks Storybook's own interface, as Uraeda's Storybook page frames it (US1.1 to US1.4), the page
 * served as `vp dev` serves it: its frame is sandboxed without an origin of its own, and a
 * regression in what the page forwards to it, like the `?path=`, shows only here.
 */
async function checkInterface(browser: Browser, url: string) {
  const page = await browser.newPage({ viewport: { height: 900, width: 1440 } });
  const storybook = page.frameLocator('iframe[title="Storybook"]');
  const canvas = storybook.frameLocator("#storybook-preview-iframe");
  await page.goto(url);
  if (!(await inCanvas(canvas, LABEL)) || !(await listsControls(storybook, ["folder", "story"]))) {
    fail("the Storybook page's canvas shows the Ready story", await canvasText(canvas));
  }
  pass("the Storybook page's canvas shows the Ready story");
  // The marker lives in the interface's window, the one a reload of Storybook would replace.
  const inner = await interfaceFrame(page);
  await inner.evaluate(() => {
    (window as { uraedaLoaded?: boolean }).uraedaLoaded = true;
  });

  await storybook.locator("#storyembed--removed").click();
  if (
    !(await inCanvas(canvas, REMOVED)) ||
    !(await listsControls(storybook, ["folder", "removed", "story"]))
  ) {
    fail("picking Removed shows it, with its controls", await canvasText(canvas));
  }
  pass("picking Removed in the sidebar shows it, with its folder, removed, and story controls");

  // Storybook's switch draws over its input, which takes the click itself.
  await storybook.locator("#control-removed").dispatchEvent("click");
  const reloaded = async () =>
    (await inner.evaluate(() => (window as { uraedaLoaded?: boolean }).uraedaLoaded)) !== true;
  if (!(await inCanvas(canvas, MISSING)) || (await reloaded())) {
    fail("turning removed off shows the missing story", await canvasText(canvas));
  }
  pass("turning the removed control off shows the missing story, without a reload");

  await whileEdited(
    STORIES,
    (original) => original + ADDED,
    async () => {
      const listed = await storybook
        .locator(`#${ADDED_ID}`)
        .waitFor({ timeout: SHOW_MS })
        .then(
          () => true,
          () => false,
        );
      if (!listed) {
        fail("an added export shows in the sidebar", "it was never listed");
      }
      if (await reloaded()) {
        fail("an added export shows in the sidebar without a reload", "the page was reloaded");
      }
      await storybook.locator(`#${ADDED_ID}`).click();
      if (!(await inCanvas(canvas, LABEL))) {
        fail("the added export renders", await canvasText(canvas));
      }
      pass("an export added to the stories file shows in the sidebar, and renders");
    },
  );
  await page.close();
  await checkPhone(browser, url);
}

/** Checks Storybook's interface at a phone's width, and writes its screenshot for a look. */
async function checkPhone(browser: Browser, url: string) {
  const page = await browser.newPage({ viewport: { height: 874, width: 402 } });
  const canvas = page
    .frameLocator('iframe[title="Storybook"]')
    .frameLocator("#storybook-preview-iframe");
  await page.goto(url);
  if (!(await inCanvas(canvas, LABEL))) {
    fail("the canvas shows the Ready story at 402 px", await canvasText(canvas));
  }
  const screenshot = join(tmpdir(), "uraeda-validate-storybook-402.png");
  await page.screenshot({ path: screenshot });
  await page.close();
  pass(`the canvas shows the Ready story at 402 px, screenshot in ${screenshot}`);
}

async function main(): Promise<number> {
  const dataDir = mkdtempSync(join(tmpdir(), "uraeda-validate-storybook-"));
  process.env.URAEDA_DATA_DIR = dataDir;
  // Settings of its own, none: the developer's host names never reach the check.
  const configDir = mkdtempSync(join(tmpdir(), "uraeda-validate-storybook-config-"));
  process.env.URAEDA_CONFIG_DIR = configDir;
  process.env.URAEDA_REPO = root;
  const folder = checkoutFolder();
  const { repository } = await addRepository(dataDir, root);
  // The UI and the server as `vp dev` serves them, on the fake agent, the server started by its
  // first request.
  const vite = await serve();
  const address = vite.resolvedUrls?.local[0]?.replace(/\/$/, "") ?? "";
  try {
    await check(address, repository.name, folder);
    return 0;
  } catch (error) {
    process.stdout.write(`${(error as Error).message}\n`);
    return 1;
  } finally {
    await vite.close();
    for (const folder of [dataDir, configDir]) {
      rmSync(folder, { force: true, recursive: true });
    }
  }
}

process.exitCode = await main();
