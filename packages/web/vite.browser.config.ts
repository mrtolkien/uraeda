// The layout's checks, in WebKit at an iPhone 17's size and at a desktop's, against the server
// mounted in the test server (see `vite.config.ts`), on the fake agent: the tests `vp run ready`
// runs never start Claude Code. The root's config lists this project next to the others.
// First: a binding older than the Rust core is rebuilt before the imports below load it.
import "uraeda-server/fresh-binding";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Frame, Page } from "playwright";
import { addRepository, removeRepository } from "uraeda-binding";
import { addFeaturePages } from "./samples/index.ts";
import {
  addChange,
  addPlan,
  addSpecFeature,
  addStoryFeature,
  commitOnBranch,
  ELEVEN,
  fixture,
  previewStarts,
  temporaryFolder,
} from "uraeda-binding/test-utils";
import { devFrames, reloadRepositories } from "uraeda-server/dev";
import { freePort } from "uraeda-server/free-port";
import { FakeAdapter } from "uraeda-server/testing";
import { playwright } from "vite-plus/test/browser-playwright";
import { defineConfig, type Plugin, type PluginOption } from "vite-plus";
import { forwardingProxy } from "./src/__browser__/forwarding-proxy.ts";
import base, { uraedaServer } from "./vite.config.ts";
import { setColorScheme, setReducedMotion } from "./vite.browser.color-scheme.ts";

const plugins = (base.plugins ?? []).filter(
  (plugin: PluginOption) => !(plugin && "name" in plugin && plugin.name === "uraeda-server"),
);

/**
 * Each test has a repository of its own, a fresh copy of the fixture listed under its own name: the
 * template the global setup built once with git, copied (see `src/__browser__/setup.ts`), its pages
 * under `/r/<name>/` (see `src/__browser__/helpers.tsx`). The tests still take their turn,
 * both sizes included, for the one fake agent, whose messages each test resets. Each turn has its
 * own token, so a test only ever ends its own turn.
 */
const shared = globalThis as {
  /** The test's repository: its folder, and its name in the test server's list. */
  uraedaRepo?: { name: string; path: string };
  uraedaRepoHolder?: { release: () => void; token: number };
  uraedaRepoTokens?: number;
  uraedaRepoTurn?: Promise<void>;
};

/** The folder of the test's repository. */
function repoFolder(): string {
  return shared.uraedaRepo!.path;
}

type Context = { frame: () => Promise<Frame>; page: Page };
/** The roles `frameClick` clicks in a frame. */
type FrameRole = "button" | "separator";

/** The test server's agent, which the tests that follow a session drive. */
const agent = new FakeAdapter();
type AgentEvent = Parameters<FakeAdapter["emit"]>[0];

/** How long the server waits before it serves a chat image: a slow network, for a test. */
let chatImageDelay = 0;

/** The log of the test feature's fake preview, which records each start, once it is added. */
let previewLog: string | undefined;

/** The host name SC-006's test reaches the test server through, listed as an allowed host. */
const LISTED_HOST = "uraeda.test";
process.env.URAEDA_ALLOWED_HOSTS = LISTED_HOST;

/**
 * The frame of the test's page whose element's `title` is `title`, as Playwright reaches it: a
 * sandboxed frame too, which the page itself cannot read.
 */
async function frameTitled(context: Context, title: string): Promise<Frame> {
  const page = await context.frame();
  const element = await page.locator(`iframe[title="${title}"]`).elementHandle({ timeout: 10_000 });
  const frame = await element?.contentFrame();
  if (!frame) {
    throw new Error(`No frame titled ${title}`);
  }
  return frame;
}

/** Holds the chat images' answers for `chatImageDelay`, before the server answers them. */
const slowChatImages: Plugin = {
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      if (chatImageDelay > 0 && /^\/r\/[^/]+\/chat-images\//.test(request.url ?? "")) {
        setTimeout(next, chatImageDelay);
      } else {
        next();
      }
    });
  },
  name: "slow-chat-images",
};

const commands = {
  /**
   * Waits for the turn, then gives the test a fresh copy of the fixture, added to the test server's
   * list and served, with the turn's token and the repository's name.
   */
  async takeRepo() {
    const previous = shared.uraedaRepoTurn ?? Promise.resolve();
    const { promise: turn, resolve: release } = Promise.withResolvers<void>();
    shared.uraedaRepoTurn = previous.then(() => turn);
    await previous;
    const token = (shared.uraedaRepoTokens = (shared.uraedaRepoTokens ?? 0) + 1);
    shared.uraedaRepoHolder = { release, token };
    const path = temporaryFolder("uraeda-repo");
    cpSync(process.env.URAEDA_TEMPLATE_REPO!, path, { recursive: true });
    const { repository } = await addRepository(process.env.URAEDA_DATA_DIR!, path);
    // Served at once, without waiting for the server's watch of the list.
    await reloadRepositories();
    shared.uraedaRepo = { name: repository.name, path };
    agent.sent = [];
    chatImageDelay = 0;
    previewLog = undefined;
    // A turn whose test gave up waiting for it is never released by that test: it ends once longer
    // than any test and its hooks, so one stuck test does not hold up every one after it.
    setTimeout(() => void commands.releaseRepo(undefined, token), 120_000).unref();
    return { name: repository.name, token };
  },
  /**
   * Ends a test's turn: its repository leaves the list, which closes its watch, and the next
   * test takes its turn. The fixture's exit cleanup removes its files: requests that already
   * started may still be reading them after the page unmounts.
   */
  async releaseRepo(_context: unknown, token: number) {
    const holder = shared.uraedaRepoHolder;
    if (holder?.token !== token) {
      return;
    }
    // The agent's process ends with the test: the next test's session opens one of its own.
    agent.exit(1, "ended by the test");
    const { name } = shared.uraedaRepo!;
    try {
      await removeRepository(process.env.URAEDA_DATA_DIR!, name);
      await reloadRepositories();
    } finally {
      shared.uraedaRepo = undefined;
      shared.uraedaRepoHolder = undefined;
      holder.release();
    }
  },
  /** A file of the repository, `PRIORITIES.md` by default. */
  readRepo(_context: unknown, path = "specs/PRIORITIES.md") {
    return readFileSync(join(repoFolder(), path), "utf8");
  },
  writeRepo(_context: unknown, text: string, path = "specs/PRIORITIES.md") {
    const file = join(repoFolder(), path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  },
  /** The size of a file of the repository in bytes, or -1 when it does not exist. */
  repoFileSize(_context: unknown, path: string) {
    const file = join(repoFolder(), path);
    return existsSync(file) ? statSync(file).size : -1;
  },
  /** The files committed under `path` at the head of the repository's folder `at`, a worktree's. */
  committedFiles(_context: unknown, at: string, path: string) {
    const listed = execFileSync("git", ["ls-tree", "-r", "--name-only", "HEAD", "--", path], {
      cwd: join(repoFolder(), at),
      encoding: "utf8",
    });
    return listed.split("\n").filter(Boolean);
  },
  /** A file of `fixtures/images/`, in base64: the tests drop and paste it as the human would. */
  fixtureImage(_context: unknown, name: string) {
    return readFileSync(join(fixture("images"), name)).toString("base64");
  },
  /** A text file of `fixtures/`, like the inbox's triage, to write in the repository. */
  fixtureText(_context: unknown, name: string) {
    return readFileSync(fixture(name), "utf8");
  },
  /** Serves the chat images `ms` late, until the test ends. */
  slowChatImages(_context: unknown, ms: number) {
    chatImageDelay = ms;
  },
  /** Commits a plan of 11 tasks on a feature's branch, the 7th, "Session column", current. */
  addPlan(_context: unknown, folder: string) {
    addPlan(repoFolder(), folder, ELEVEN);
  },
  /** Commits files, by path, on a branch: a feature's, by its folder. A file given `null` goes. */
  commitOnBranch(_context: unknown, branch: string, files: Record<string, string | null>) {
    commitOnBranch(repoFolder(), branch, files);
  },
  /** Creates a change on its branch `change/<folder>`, with its files, by name in its folder. */
  addChange(_context: unknown, folder: string, files: Record<string, string>) {
    addChange(repoFolder(), folder, files);
  },
  /**
   * Adds the test feature, `2026-10-20-sidebar-resize`, whose spec and proposal link a story, with
   * a preview decision on the fake preview, as `addStoryFeature` does.
   */
  addStoryFeature(_context: unknown, options: Parameters<typeof addStoryFeature>[1] = {}) {
    previewLog = addStoryFeature(repoFolder(), options).log;
  },
  /**
   * Adds the spec page's feature, `2026-10-17-spec-page`, with its decisions changed on its branch,
   * as `addSpecFeature` does.
   */
  addSpecFeature(_context: unknown, options: Parameters<typeof addSpecFeature>[1] = {}) {
    addSpecFeature(repoFolder(), options);
  },
  /** Adds the feature page's features, one per state, as `addFeaturePages` does. */
  addFeaturePages() {
    addFeaturePages(repoFolder());
  },
  /** Each start of the test feature's fake preview: its base path, folder, process, and port. */
  previewStarts() {
    return previewLog === undefined ? [] : previewStarts(previewLog);
  },
  /** The frame secret of the test server's preview paths, which fate gives the page. */
  async frameSecret(context: Context) {
    const frames = await devFrames(Number(new URL(context.page.url()).port));
    return frames!.current();
  },
  /** Kills the test feature's running fake preview, as a crash would: its Storybook fails. */
  stopPreview() {
    const last = previewLog === undefined ? undefined : previewStarts(previewLog).at(-1);
    if (last !== undefined) {
      process.kill(last.pid, "SIGKILL");
    }
  },
  /** The text of a frame of the page, by its `title`, or "" while it has none. */
  async frameText(context: Context, title: string) {
    const frame = await frameTitled(context, title);
    return frame
      .locator("body")
      .innerText({ timeout: 1000 })
      .catch(() => "");
  },
  /**
   * The text of a frame inside a frame of the page, both by their `title`, as Storybook's story
   * inside its own interface, or "" while it has none.
   */
  async innerFrameText(context: Context, title: string, inner: string) {
    const frame = await frameTitled(context, title);
    return frame
      .locator(`iframe[title="${inner}"]`)
      .contentFrame()
      .locator("body")
      .innerText({ timeout: 1000 })
      .catch(() => "");
  },
  /** Clicks the element of a role, and name, in a frame by its `title`; a disabled one, forced. */
  async frameClick(
    context: Context,
    title: string,
    role: FrameRole,
    name?: string,
    force?: boolean,
  ) {
    await (await frameTitled(context, title)).getByRole(role, { name }).click({ force });
  },
  /**
   * Moves the pointer over the element of a role and name in a frame of the page, by its `title`,
   * and says whether the pick script outlines it: a box drawn over the page, at the element's place.
   */
  async frameOutlined(context: Context, title: string, role: FrameRole, name?: string) {
    const target = (await frameTitled(context, title)).getByRole(role, { name });
    await target.hover();
    return target.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return [...document.documentElement.children].some((child) => {
        const drawn = child.getBoundingClientRect();
        return (
          child !== document.body &&
          getComputedStyle(child).position === "fixed" &&
          Math.abs(drawn.left - box.left) < 1 &&
          Math.abs(drawn.top - box.top) < 1 &&
          Math.abs(drawn.width - box.width) < 1 &&
          Math.abs(drawn.height - box.height) < 1
        );
      });
    });
  },
  /** Presses a key in a frame of the page, by its `title`, its body focused, as the human does. */
  async framePress(context: Context, title: string, key: string) {
    await (await frameTitled(context, title)).locator("body").press(key);
  },
  /** An attribute of the element `selector` finds in a frame of the page, by its `title`. */
  async frameAttribute(context: Context, title: string, selector: string, name: string) {
    const frame = await frameTitled(context, title);
    return frame
      .locator(selector)
      .getAttribute(name, { timeout: 1000 })
      .catch(() => null);
  },
  /** Runs a script in a frame of the page, by its `title`, as the story's own code would. */
  async frameRun(context: Context, title: string, script: string) {
    await (await frameTitled(context, title)).evaluate(script);
  },
  /** Reloads a frame of the page, by its `title`, as Storybook does, and waits for its load. */
  async frameReload(context: Context, title: string) {
    const frame = await frameTitled(context, title);
    await Promise.all([
      frame.waitForNavigation({ waitUntil: "load" }),
      frame.evaluate(() => setTimeout(() => window.location.reload())),
    ]);
  },
  /**
   * Opens a page of the test's repository in a new browser whose requests all go through a
   * forwarding proxy, under the listed host name, and gives the text of a frame of it, by its
   * `title`, once it holds `text`.
   */
  async openThroughHost(context: Context, path: string, title: string, text: string) {
    const port = Number(new URL(context.page.url()).port);
    const proxy = await forwardingProxy(port);
    const browser = context.page.context().browser()!;
    // At the desktop project's size: the embed loads once on screen, which it is scrolled to.
    const opened = await browser.newContext({
      proxy: { server: `http://127.0.0.1:${proxy.port}` },
      viewport: { height: 900, width: 1440 },
    });
    try {
      const page = await opened.newPage();
      await page.goto(`http://${LISTED_HOST}:${port}/r/${shared.uraedaRepo!.name}${path}`);
      // Scrolled to, as the reader scrolls to its story: the spec page opens with what you approve.
      await page.locator(`iframe[title="${title}"]`).scrollIntoViewIfNeeded({ timeout: 20_000 });
      const body = page.locator(`iframe[title="${title}"]`).contentFrame().locator("body");
      await body.filter({ hasText: text }).waitFor({ timeout: 20_000 });
      return await body.innerText();
    } finally {
      await opened.close();
      proxy.close();
    }
  },
  /** The messages sent to the agent during the test, in order. */
  agentSent() {
    return agent.sent.map(({ id, images, text, when }) => ({
      id,
      images: images.map(({ path }) => path),
      text,
      when,
    }));
  },
  /** The agent reads the latest message sent to it, or the one at `index`. */
  agentAccept(_context: unknown, index = -1) {
    const message = agent.sent.at(index);
    if (message) {
      agent.emit({ id: message.id, type: "accepted" });
    }
  },
  /** Sends events on the agent's current process, as Claude Code would print them. */
  agentEmit(_context: unknown, events: Array<AgentEvent>) {
    for (const event of events) {
      agent.emit(event);
    }
  },
  /** Ends the agent's current process. */
  agentFinish(_context: unknown, code = 0, stderr = "") {
    agent.exit(code, stderr);
  },
  /**
   * Real mouse moves, presses, and releases, at points of the test's page, which the browser
   * shows in a frame of its own.
   */
  async mouse(
    context: Context,
    steps: Array<{ ms?: number; type: "move" | "down" | "up" | "wait"; x?: number; y?: number }>,
  ) {
    const frame = await context.frame();
    const box = await (await frame.frameElement()).boundingBox();
    const width = await frame.evaluate(() => window.innerWidth);
    const scale = box ? box.width / width : 1;
    for (const step of steps) {
      if (step.type === "move") {
        await context.page.mouse.move(
          (box?.x ?? 0) + step.x! * scale,
          (box?.y ?? 0) + step.y! * scale,
          { steps: 4 },
        );
      } else if (step.type === "down") {
        await context.page.mouse.down();
      } else if (step.type === "up") {
        await context.page.mouse.up();
      } else {
        await new Promise((resolve) => setTimeout(resolve, step.ms));
      }
    }
  },
};

export type RepoCommands = {
  addChange: (folder: string, files: Record<string, string>) => Promise<void>;
  addFeaturePages: () => Promise<void>;
  addPlan: (folder: string) => Promise<void>;
  addSpecFeature: (options?: Parameters<typeof addSpecFeature>[1]) => Promise<void>;
  addStoryFeature: (options?: Parameters<typeof addStoryFeature>[1]) => Promise<void>;
  agentAccept: (index?: number) => Promise<void>;
  agentEmit: (events: Array<AgentEvent>) => Promise<void>;
  agentFinish: (code?: number, stderr?: string) => Promise<void>;
  agentSent: () => Promise<
    Array<{ id: string; images: Array<string>; text: string; when: string }>
  >;
  commitOnBranch: (branch: string, files: Record<string, string | null>) => Promise<void>;
  committedFiles: (at: string, path: string) => Promise<Array<string>>;
  fixtureImage: (name: string) => Promise<string>;
  fixtureText: (name: string) => Promise<string>;
  frameAttribute: (title: string, selector: string, name: string) => Promise<string | null>;
  frameClick: (title: string, role: FrameRole, name?: string, force?: boolean) => Promise<void>;
  frameOutlined: (title: string, role: FrameRole, name?: string) => Promise<boolean>;
  framePress: (title: string, key: string) => Promise<void>;
  frameReload: (title: string) => Promise<void>;
  frameRun: (title: string, script: string) => Promise<void>;
  frameSecret: () => Promise<string>;
  frameText: (title: string) => Promise<string>;
  innerFrameText: (title: string, inner: string) => Promise<string>;
  mouse: (
    steps: Array<{ ms?: number; type: "move" | "down" | "up" | "wait"; x?: number; y?: number }>,
  ) => Promise<void>;
  openThroughHost: (path: string, title: string, text: string) => Promise<string>;
  previewStarts: () => Promise<Array<{ base: string; cwd: string; pid: number; port: number }>>;
  readRepo: (path?: string) => Promise<string>;
  releaseRepo: (token: number) => Promise<void>;
  repoFileSize: (path: string) => Promise<number>;
  slowChatImages: (ms: number) => Promise<void>;
  stopPreview: () => Promise<void>;
  takeRepo: () => Promise<{ name: string; token: number }>;
  writeRepo: (text: string, path?: string) => Promise<void>;
};

export default defineConfig({
  ...base,
  plugins: [
    ...plugins,
    slowChatImages,
    // SC-006's page, under the listed host name, is its own origin, which the guard allows.
    uraedaServer({
      adapter: agent,
      allowOrigins: (port) => [`http://${LISTED_HOST}:${port}`],
      signIn: false,
    }),
  ],
  // Vite answers the listed host name too (R12).
  server: { ...base.server, allowedHosts: [LISTED_HOST], strictPort: false },
  // StyleX's runtime injection is imported by the compiled styles, which Vite finds only once the
  // tests run: bundled late, on a cold cache, it reloads the browser and fails the test files.
  // `pele` too, which a diagram imports on demand only.
  optimizeDeps: { include: ["@stylexjs/stylex/lib/stylex-inject", "pele/lazy"] },
  test: {
    // The tests' server, on a free port: Vitest's default, 63315, is every checkout's, and so are
    // the ports after it, which Vite tries in turn.
    api: { host: "127.0.0.1", port: await freePort() },
    globalSetup: ["src/__browser__/setup.ts"],
    include: ["src/__browser__/**/*.test.tsx"],
    name: "uraeda-web-browser",
    testTimeout: 30_000,
    // A test's turn waits for the other size's test, up to its own timeout.
    hookTimeout: 60_000,
    // Test files run in frames of one page, whose history they share: one file's Back would move
    // another's. One file at a time, in each browser.
    fileParallelism: false,
    // WebKit, at a phone's size and a desktop's.
    browser: {
      commands: { ...commands, setColorScheme, setReducedMotion },
      enabled: true,
      headless: true,
      // Times read in UTC, as the UI tests' (see `vite.config.ts`): a feature's stages cross midnight
      // where its commits say, whatever the machine's time zone.
      instances: [
        // A touch screen, as a phone has.
        {
          browser: "webkit",
          name: "phone",
          provider: playwright({ contextOptions: { hasTouch: true, timezoneId: "UTC" } }),
          viewport: { height: 874, width: 402 },
        },
        { browser: "webkit", name: "desktop", viewport: { height: 900, width: 1440 } },
      ],
      provider: playwright({ contextOptions: { timezoneId: "UTC" } }),
      // Failure screenshots are automatic. Full DOM/network tracing is opt-in: recording every
      // passing test made CI much slower. Use URAEDA_TEST_TRACE=1 with an uncached browser task.
      screenshotDirectory: ".vitest/screenshots",
      trace:
        process.env.URAEDA_TEST_TRACE === "1"
          ? { mode: "retain-on-failure", tracesDir: ".vitest/traces" }
          : "off",
    },
    // CI's WebKit draws without a GPU, and its scrolling and animations take longer than a desktop's.
    expect: { poll: { timeout: 5000 } },
  },
});
