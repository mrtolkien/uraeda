// The layout's checks, in WebKit at an iPhone 17's size and at a desktop's, against the server
// mounted in the test server (see `vite.config.ts`), on the fake agent: the tests `vp run ready`
// runs never start Claude Code. The root's config lists this project next to the others.
import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Frame, Page } from "playwright";
import { addRepository, removeRepository } from "uraeda-binding";
import {
  addPlan,
  commitOnBranch,
  ELEVEN,
  fixture,
  temporaryFolder,
} from "uraeda-binding/test-utils";
import { reloadRepositories } from "uraeda-server/dev";
import { FakeAdapter } from "uraeda-server/testing";
import { playwright } from "vite-plus/test/browser-playwright";
import { defineConfig, type Plugin, type PluginOption } from "vite-plus";
import base, { uraedaServer } from "./vite.config.ts";

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

/** The test server's agent, which the tests that follow a session drive. */
const agent = new FakeAdapter();
type AgentEvent = Parameters<FakeAdapter["emit"]>[0];

/** How long the server waits before it serves a chat image: a slow network, for a test. */
let chatImageDelay = 0;

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
  /** A file of `fixtures/images/`, in base64: the tests drop and paste it as the human would. */
  fixtureImage(_context: unknown, name: string) {
    return readFileSync(join(fixture("images"), name)).toString("base64");
  },
  /** Serves the chat images `ms` late, until the test ends. */
  slowChatImages(_context: unknown, ms: number) {
    chatImageDelay = ms;
  },
  /** Commits a plan of 11 tasks on a feature's branch, the 7th, "Session column", current. */
  addPlan(_context: unknown, folder: string) {
    addPlan(repoFolder(), folder, ELEVEN);
  },
  /** Commits files, by path, on a feature's branch. */
  commitOnBranch(_context: unknown, folder: string, files: Record<string, string>) {
    commitOnBranch(repoFolder(), folder, files);
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
  addPlan: (folder: string) => Promise<void>;
  agentAccept: (index?: number) => Promise<void>;
  agentEmit: (events: Array<AgentEvent>) => Promise<void>;
  agentFinish: (code?: number, stderr?: string) => Promise<void>;
  agentSent: () => Promise<
    Array<{ id: string; images: Array<string>; text: string; when: string }>
  >;
  commitOnBranch: (folder: string, files: Record<string, string>) => Promise<void>;
  fixtureImage: (name: string) => Promise<string>;
  mouse: (
    steps: Array<{ ms?: number; type: "move" | "down" | "up" | "wait"; x?: number; y?: number }>,
  ) => Promise<void>;
  readRepo: (path?: string) => Promise<string>;
  releaseRepo: (token: number) => Promise<void>;
  repoFileSize: (path: string) => Promise<number>;
  slowChatImages: (ms: number) => Promise<void>;
  takeRepo: () => Promise<{ name: string; token: number }>;
  writeRepo: (text: string, path?: string) => Promise<void>;
};

export default defineConfig({
  ...base,
  plugins: [...plugins, slowChatImages, uraedaServer({ adapter: agent })],
  // The dev server's fixed port is for `vp dev`: the tests take the next free port when another
  // checkout's tests hold theirs.
  server: { ...base.server, strictPort: false },
  // StyleX's runtime injection is imported by the compiled styles, which Vite finds only once the
  // tests run: bundled late, on a cold cache, it reloads the browser and fails the test files.
  optimizeDeps: { include: ["@stylexjs/stylex/lib/stylex-inject"] },
  test: {
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
      commands,
      enabled: true,
      headless: true,
      instances: [
        // A touch screen, as a phone has.
        {
          browser: "webkit",
          name: "phone",
          provider: playwright({ contextOptions: { hasTouch: true } }),
          viewport: { height: 874, width: 402 },
        },
        { browser: "webkit", name: "desktop", viewport: { height: 900, width: 1440 } },
      ],
      provider: playwright(),
    },
    // CI's WebKit draws without a GPU, and its scrolling and animations take longer than a desktop's.
    expect: { poll: { timeout: 5000 } },
  },
});
