// The layout's checks, in WebKit at an iPhone 17's size and at a desktop's, against the server
// mounted in the test server (see `vite.config.ts`), on the fake agent: the tests `vp run ready`
// runs never start Claude Code. The root's config lists this project next to the others.
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Frame, Page } from "playwright";
import { fixtureRepo } from "uraeda-binding/test-utils";
import { forgetRepo } from "uraeda-server/dev";
import { FakeAdapter } from "uraeda-server/testing";
import { playwright } from "vite-plus/test/browser-playwright";
import { defineConfig, type PluginOption } from "vite-plus";
import base, { uraedaServer } from "./vite.config.ts";

const plugins = (base.plugins ?? []).filter(
  (plugin: PluginOption) => !(plugin && "name" in plugin && plugin.name === "uraeda-server"),
);

/**
 * The tests take the repository in turn, both sizes included, each on a fresh copy of the fixture
 * (see `src/__browser__/helpers.tsx`): the server reads `URAEDA_REPO` at each request. Each turn
 * has its own token, so a test only ever ends its own turn.
 */
const shared = globalThis as {
  uraedaRepoTurn?: Promise<void>;
  uraedaRepoHolder?: { token: number; release: () => void };
  uraedaRepoTokens?: number;
};

type Context = { page: Page; frame: () => Promise<Frame> };

/** The test server's agent, which the tests that follow a session drive. */
const agent = new FakeAdapter();
type AgentEvent = Parameters<FakeAdapter["emit"]>[0];

const commands = {
  /** Waits for the repository, then gives the test a fresh copy of the fixture, and its token. */
  async takeRepo() {
    const previous = shared.uraedaRepoTurn ?? Promise.resolve();
    let release = () => {};
    shared.uraedaRepoTurn = previous.then(() => new Promise<void>((done) => (release = done)));
    await previous;
    const token = (shared.uraedaRepoTokens = (shared.uraedaRepoTokens ?? 0) + 1);
    shared.uraedaRepoHolder = { token, release };
    process.env.URAEDA_REPO = fixtureRepo();
    agent.sent = [];
    // A turn whose test gave up waiting for it is never released by that test: it ends once longer
    // than any test and its hooks, so one stuck test does not hold up every one after it.
    setTimeout(() => void commands.releaseRepo(undefined, token), 120_000).unref();
    return token;
  },
  /** Ends a test's turn: its copy is forgotten, and the next test takes the repository. */
  async releaseRepo(_context: unknown, token: number) {
    const holder = shared.uraedaRepoHolder;
    if (holder?.token !== token) {
      return;
    }
    // The agent's process ends with the test: the next test's session opens one of its own.
    agent.exit(1, "ended by the test");
    const repo = process.env.URAEDA_REPO!;
    await forgetRepo(repo);
    rmSync(repo, { recursive: true, force: true });
    shared.uraedaRepoHolder = undefined;
    holder.release();
  },
  /** A file of the repository, `PRIORITIES.md` by default. */
  readRepo(_context: unknown, path = "specs/PRIORITIES.md") {
    return readFileSync(join(process.env.URAEDA_REPO!, path), "utf8");
  },
  writeRepo(_context: unknown, text: string, path = "specs/PRIORITIES.md") {
    writeFileSync(join(process.env.URAEDA_REPO!, path), text);
  },
  /** The messages sent to the agent during the test, in order. */
  agentSent() {
    return agent.sent.map(({ id, text, when }) => ({ id, text, when }));
  },
  /** The agent reads the latest message sent to it, or the one at `index`. */
  agentAccept(_context: unknown, index = -1) {
    const message = agent.sent.at(index);
    if (message) {
      agent.emit({ type: "accepted", id: message.id });
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
    steps: Array<{ type: "move" | "down" | "up" | "wait"; x?: number; y?: number; ms?: number }>,
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
  takeRepo: () => Promise<number>;
  releaseRepo: (token: number) => Promise<void>;
  readRepo: (path?: string) => Promise<string>;
  writeRepo: (text: string, path?: string) => Promise<void>;
  agentSent: () => Promise<Array<{ id: string; text: string; when: string }>>;
  agentAccept: (index?: number) => Promise<void>;
  agentEmit: (events: Array<AgentEvent>) => Promise<void>;
  agentFinish: (code?: number, stderr?: string) => Promise<void>;
  mouse: (
    steps: Array<{ type: "move" | "down" | "up" | "wait"; x?: number; y?: number; ms?: number }>,
  ) => Promise<void>;
};

export default defineConfig({
  ...base,
  plugins: [...plugins, uraedaServer({ adapter: agent })],
  // The dev server's fixed port is for `vp dev`: the tests take the next free port when another
  // checkout's tests hold theirs.
  server: { ...base.server, strictPort: false },
  // StyleX's runtime injection is imported by the compiled styles, which Vite finds only once the
  // tests run: bundled late, on a cold cache, it reloads the browser and fails the test files.
  optimizeDeps: { include: ["@stylexjs/stylex/lib/stylex-inject"] },
  test: {
    name: "uraeda-web-browser",
    include: ["src/__browser__/**/*.test.tsx"],
    globalSetup: ["src/__browser__/setup.ts"],
    testTimeout: 30_000,
    // A test's turn at the repository waits for the other size's test, up to its own timeout.
    hookTimeout: 60_000,
    // Test files run in frames of one page, whose history they share: one file's Back would move
    // another's. One file at a time, in each browser.
    fileParallelism: false,
    // CI's WebKit draws without a GPU, and its scrolling and animations take longer than a desktop's.
    expect: { poll: { timeout: 5_000 } },
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      commands,
      instances: [
        // A touch screen, as a phone has.
        {
          browser: "webkit",
          name: "phone",
          viewport: { width: 402, height: 874 },
          provider: playwright({ contextOptions: { hasTouch: true } }),
        },
        { browser: "webkit", name: "desktop", viewport: { width: 1440, height: 900 } },
      ],
    },
  },
});
