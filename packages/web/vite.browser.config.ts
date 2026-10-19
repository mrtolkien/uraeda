// The browser checks, in WebKit at an iPhone 17's size and at a desktop's, against the server
// mounted in the test server (see `vite.config.ts`), on the fake agent: the tests `vp run ready`
// runs never start Claude Code. Only what needs a real layout runs here (the page checks of every
// page, the lists' keys, the reading place, the sheets, the columns): the rest is in happy-dom,
// under `src/__flows__/`. The root's config lists this project next to the others.
// First: a binding older than the Rust core is rebuilt before the imports below load it.
import "uraeda-server/fresh-binding";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { addRepository, removeRepository } from "uraeda-binding";
import { addFeaturePages } from "./.storybook/featurePages.ts";
import {
  addChange,
  addPlan,
  commitOnBranch,
  ELEVEN,
  fixture,
  temporaryFolder,
} from "uraeda-binding/test-utils";
import { reloadRepositories } from "uraeda-server/dev";
import { freePort } from "uraeda-server/free-port";
import { FakeAdapter } from "uraeda-server/testing";
import { playwright } from "vite-plus/test/browser-playwright";
import { defineConfig, type PluginOption } from "vite-plus";
import base, { uraedaServer } from "./vite.config.ts";
import { setColorScheme } from "./vite.browser.color-scheme.ts";

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

/** The test server's agent, which the tests that follow a session drive. */
const agent = new FakeAdapter();
type AgentEvent = Parameters<FakeAdapter["emit"]>[0];

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
  /** A text file of `fixtures/`, like the inbox's triage, to write in the repository. */
  fixtureText(_context: unknown, name: string) {
    return readFileSync(fixture(name), "utf8");
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
  /** Adds the feature page's features, one per state, as `addFeaturePages` does. */
  addFeaturePages() {
    addFeaturePages(repoFolder());
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
};

export type RepoCommands = {
  addChange: (folder: string, files: Record<string, string>) => Promise<void>;
  addFeaturePages: () => Promise<void>;
  addPlan: (folder: string) => Promise<void>;
  agentAccept: (index?: number) => Promise<void>;
  agentEmit: (events: Array<AgentEvent>) => Promise<void>;
  agentSent: () => Promise<
    Array<{ id: string; images: Array<string>; text: string; when: string }>
  >;
  commitOnBranch: (branch: string, files: Record<string, string | null>) => Promise<void>;
  fixtureText: (name: string) => Promise<string>;
  readRepo: (path?: string) => Promise<string>;
  releaseRepo: (token: number) => Promise<void>;
  takeRepo: () => Promise<{ name: string; token: number }>;
  writeRepo: (text: string, path?: string) => Promise<void>;
};

export default defineConfig({
  ...base,
  plugins: [...plugins, uraedaServer({ adapter: agent, signIn: false })],
  server: { ...base.server, strictPort: false },
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
      commands: { ...commands, setColorScheme },
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
