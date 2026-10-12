// The layout's checks, in WebKit at an iPhone 17's size and at a desktop's, against the server
// mounted in the test server (see `vite.config.ts`), on the fake agent: the tests `vp run ready`
// runs never start Claude Code. The root's config lists this project next to the others.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Frame, Page } from "playwright";
import { fixtureRepo } from "uraeda-binding/test-utils";
import { FakeAdapter } from "uraeda-server/testing";
import { playwright } from "vite-plus/test/browser-playwright";
import { defineConfig, type PluginOption } from "vite-plus";
import base, { uraedaServer } from "./vite.config.ts";

const plugins = (base.plugins ?? []).filter(
  (plugin: PluginOption) => !(plugin && "name" in plugin && plugin.name === "uraeda-server"),
);

/**
 * The tests that change the repository take it in turn, both sizes included, each on a fresh copy
 * of the fixture: the server reads `URAEDA_REPO` at each request. The others read whichever copy is
 * current, which holds the same lines once the change is over.
 */
const shared = globalThis as { uraedaRepoTurn?: Promise<void>; uraedaRepoRelease?: () => void };

type Context = { page: Page; frame: () => Promise<Frame> };

const commands = {
  /** Waits for the repository, then gives the test a fresh copy of the fixture. */
  async takeRepo() {
    const previous = shared.uraedaRepoTurn ?? Promise.resolve();
    let release = () => {};
    shared.uraedaRepoTurn = previous.then(() => new Promise<void>((done) => (release = done)));
    await previous;
    shared.uraedaRepoRelease = release;
    process.env.URAEDA_REPO = fixtureRepo();
  },
  /** Puts a fresh copy of the fixture back, and lets the next test take the repository. */
  async releaseRepo() {
    process.env.URAEDA_REPO = fixtureRepo();
    shared.uraedaRepoRelease?.();
    shared.uraedaRepoRelease = undefined;
  },
  /** A file of the repository, `PRIORITIES.md` by default. */
  readRepo(_context: unknown, path = "specs/PRIORITIES.md") {
    return readFileSync(join(process.env.URAEDA_REPO!, path), "utf8");
  },
  writeRepo(_context: unknown, text: string, path = "specs/PRIORITIES.md") {
    writeFileSync(join(process.env.URAEDA_REPO!, path), text);
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
  takeRepo: () => Promise<void>;
  releaseRepo: () => Promise<void>;
  readRepo: (path?: string) => Promise<string>;
  writeRepo: (text: string, path?: string) => Promise<void>;
  mouse: (
    steps: Array<{ type: "move" | "down" | "up" | "wait"; x?: number; y?: number; ms?: number }>,
  ) => Promise<void>;
};

export default defineConfig({
  ...base,
  plugins: [...plugins, uraedaServer({ adapter: new FakeAdapter() })],
  test: {
    name: "uraeda-web-browser",
    include: ["src/__browser__/**/*.test.tsx"],
    globalSetup: ["src/__browser__/setup.ts"],
    testTimeout: 30_000,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      commands,
      instances: [
        { browser: "webkit", name: "phone", viewport: { width: 402, height: 874 } },
        { browser: "webkit", name: "desktop", viewport: { width: 1440, height: 900 } },
      ],
    },
  },
});
