// The preview runner's test helpers: runners stopped after each test, a clock the test moves, and
// the test feature's checkout on the fake preview.
import { randomBytes } from "node:crypto";
import { request as httpRequest } from "node:http";
import { connect } from "node:net";
import { join } from "node:path";
import { afterEach, expect } from "vite-plus/test";
import {
  addStoryFeature,
  type FakeMode,
  fixtureRepo,
  STORY_FEATURE,
} from "uraeda-binding/test-utils";
import { type Checkout, Previews } from "../runner.ts";

const binding = await import("uraeda-binding");

/** How long a test waits for a Storybook: a fake preview starts in well under a second. */
export const WAIT = { interval: 50, timeout: 10_000 };

/** The runners of a test, whose Storybooks are stopped after it. */
const runners: Array<Previews> = [];

afterEach(async () => {
  await Promise.all(runners.splice(0).map((runner) => runner.stopAll()));
});

/** A runner, stopped after the test. */
export function previews(options: ConstructorParameters<typeof Previews>[0] = {}): Previews {
  const runner = new Previews(options);
  runners.push(runner);
  return runner;
}

/** A clock the test moves by hand, for the runner's `now`. */
export function fakeClock(): { advance: (ms: number) => void; now: () => number } {
  let time = 1_000_000;
  return {
    advance: (ms) => {
      time += ms;
    },
    now: () => time,
  };
}

/** The checkout at `dir`, under `base`, from its own preview decision, read by the binding. */
export async function checkoutOf(dir: string, base: string): Promise<Checkout> {
  const found = await binding.preview(dir);
  if (found === null) {
    throw new Error(`${dir} has no active preview decision`);
  }
  return { base, command: found.command, dir, folder: found.folder };
}

/**
 * A fixture repository with the test feature, its worktree's preview running the fake preview in
 * `mode`: the worktree's checkout, under `/r/repo/preview/2026-10-20-sidebar-resize/`, and the
 * fake's log of starts.
 */
export async function storyCheckout(
  options: { delay?: number; mode?: FakeMode } = {},
): Promise<{ checkout: Checkout; log: string; repo: string }> {
  const repo = fixtureRepo();
  const { log } = addStoryFeature(repo, { preview: options });
  const dir = join(repo, ".worktrees", STORY_FEATURE);
  const checkout = await checkoutOf(dir, `/r/repo/preview/${STORY_FEATURE}/`);
  return { checkout, log: log!, repo };
}

/** Waits for the checkout's Storybook to be ready. */
export async function ready(runner: Previews, checkout: Checkout): Promise<void> {
  await expect.poll(() => runner.state(checkout.base)?.state, WAIT).toBe("ready");
}

/** Whether the process is running. */
export function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * The status an upgrade to `url` is answered with, 101 when it is switched, undefined when it is
 * closed without an answer: a WebSocket GET, or another `method` and `upgrade`.
 */
export function upgradeStatus(
  url: string,
  {
    method = "GET",
    origin,
    protocol,
    upgrade = "websocket",
  }: { method?: string; origin?: string; protocol?: string; upgrade?: string },
): Promise<number | undefined> {
  return new Promise((resolve) => {
    const request = httpRequest(url, {
      headers: {
        connection: "Upgrade",
        "sec-websocket-key": randomBytes(16).toString("base64"),
        "sec-websocket-version": "13",
        upgrade,
        ...(origin === undefined ? {} : { origin }),
        ...(protocol === undefined ? {} : { "sec-websocket-protocol": protocol }),
      },
      method,
    });
    request.on("upgrade", (response, socket) => {
      socket.destroy();
      resolve(response.statusCode);
    });
    request.on("response", (response) => {
      response.resume();
      resolve(response.statusCode);
    });
    request.on("error", () => resolve(undefined));
    request.end();
  });
}

/**
 * Whether a WebSocket upgrade to `url` is switched, with the given `Origin` and protocol: false
 * when it is answered otherwise, or closed.
 */
export async function socketOpens(
  url: string,
  options: { origin?: string; protocol?: string },
): Promise<boolean> {
  return (await upgradeStatus(url, options)) === 101;
}

/**
 * The first answer to a WebSocket upgrade sent raw to the server on `port`, with `target` as it is,
 * which a URL may not parse: empty when the socket closes without one.
 */
export function rawUpgrade(port: number, target: string): Promise<string> {
  return new Promise((resolve) => {
    const socket = connect(port, "127.0.0.1", () => {
      socket.write(
        [
          `GET ${target} HTTP/1.1`,
          `Host: 127.0.0.1:${port}`,
          "Connection: Upgrade",
          "Upgrade: websocket",
          `Sec-WebSocket-Key: ${randomBytes(16).toString("base64")}`,
          "Sec-WebSocket-Version: 13",
          "",
          "",
        ].join("\r\n"),
      );
    });
    let answer = "";
    socket.on("data", (chunk) => {
      answer += chunk.toString();
    });
    socket.on("error", () => undefined);
    socket.on("close", () => resolve(answer));
  });
}
