/**
 * Checks Uraeda's own Storybook as Uraeda serves it (US7.1, review focus 1): Uraeda's server, on the
 * fake agent, lists this checkout's repository and starts its preview decision's command, the real
 * Storybook of `packages/web`; WebKit opens the `Ready` story of `StoryEmbed.stories.tsx` through
 * Uraeda's address, `/r/<name>/preview/<folder>/iframe.html?id=storyembed--ready&viewMode=story`;
 * the story shows the fixture's data, which its fate client reads through GETs (R4); then an edit of
 * the stories file shows in the frame without a reload, and the file is restored.
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
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Frame, type Page, webkit } from "playwright";
import { addRepository } from "uraeda-binding";
import { devHandler, devUpgrade, stopDevRuns } from "uraeda-server/dev";
import { FakeAdapter } from "uraeda-server/testing";
import { whileEdited } from "./edited.ts";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const STORIES = join(root, "packages/web/src/StoryEmbed.stories.tsx");
/** The `Ready` story's label, and the edit the check makes to it. */
const LABEL = "Dragging the handle";
const EDITED = `${LABEL}, edited`;
/** How long Storybook may take to start, and a story or an edit to show. */
const START_MS = 120_000;
const SHOW_MS = 30_000;

/** The checkout's folder: its feature's in a worktree, else `main`. */
function checkoutFolder(): string {
  const git = (...args: Array<string>) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const worktree = git("rev-parse", "--absolute-git-dir") !== join(root, ".git");
  return worktree ? git("branch", "--show-current") : "main";
}

function pass(name: string) {
  process.stdout.write(`PASS ${name}\n`);
}

function fail(name: string, got: unknown): never {
  throw new Error(`FAIL ${name}: got ${typeof got === "string" ? got : JSON.stringify(got)}`);
}

/** Listens on a free port of 127.0.0.1. */
function listen(http: HttpServer): Promise<number> {
  return new Promise((resolve) =>
    http.listen(0, "127.0.0.1", () => resolve((http.address() as AddressInfo).port)),
  );
}

/**
 * Reads the checkout's `Preview` record through fate, as the Storybook page does, until it is ready:
 * each read is a view, and the first starts Storybook. Returns its last state and error.
 */
async function waitForStorybook(address: string, name: string, folder: string) {
  const deadline = Date.now() + START_MS;
  let last: { error?: string | null; state?: string } = {};
  while (Date.now() < deadline) {
    const response = await fetch(`${address}/r/${encodeURIComponent(name)}/fate`, {
      body: JSON.stringify({
        operations: [
          { id: "1", ids: [folder], kind: "byId", select: ["state", "error"], type: "Preview" },
        ],
        version: 1,
      }),
      headers: { "content-type": "application/json", origin: address },
      method: "POST",
    });
    const payload = (await response.json()) as {
      results: Array<{ data?: Array<{ error: string | null; state: string }> }>;
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
    const url = `${address}/r/${encodeURIComponent(name)}/preview/${encodeURIComponent(folder)}/iframe.html?id=storyembed--ready&viewMode=story`;
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
  } finally {
    await browser.close();
  }
}

async function main(): Promise<number> {
  const dataDir = mkdtempSync(join(tmpdir(), "uraeda-validate-storybook-"));
  process.env.URAEDA_DATA_DIR = dataDir;
  process.env.URAEDA_REPO = root;
  const folder = checkoutFolder();
  const { repository } = await addRepository(dataDir, root);
  // The server as `vp dev` mounts it, on the fake agent, started by its first request.
  const handler = devHandler(root, { adapter: new FakeAdapter(), file: false });
  const http = createServer((request, response) =>
    handler(request, response, () => {
      response.statusCode = 404;
      response.end();
    }),
  );
  http.on("upgrade", devUpgrade());
  const port = await listen(http);
  try {
    await check(`http://127.0.0.1:${port}`, repository.name, folder);
    return 0;
  } catch (error) {
    process.stdout.write(`${(error as Error).message}\n`);
    return 1;
  } finally {
    await stopDevRuns();
    http.close();
    rmSync(dataDir, { force: true, recursive: true });
  }
}

process.exitCode = await main();
