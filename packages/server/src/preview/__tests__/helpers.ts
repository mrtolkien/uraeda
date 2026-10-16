// The preview runner's test helpers: runners stopped after each test, a clock the test moves, and
// the test feature's checkout on the fake preview.
import { randomBytes } from "node:crypto";
import { createServer, request as httpRequest } from "node:http";
import { connect } from "node:net";
import { basename, join } from "node:path";
import { getRequestListener } from "@hono/node-server";
import { afterEach, expect, onTestFinished } from "vite-plus/test";
import {
  addStoryFeature,
  type FakeMode,
  fixtureRepo,
  STORY_FEATURE,
  temporaryFolder,
} from "uraeda-binding/test-utils";
import { FakeAdapter } from "../../runner/fake.ts";
import { startServer } from "../../server.ts";
import { testSettings } from "../../testing.ts";
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

/**
 * The server on a free port, its requests and upgrades, in a repository with the test feature,
 * whose Storybook, the fake preview in `mode`, is viewed and ready under the frame secret: its base
 * path, its origin, the fake's log of starts, the server, and its runner. Everything is closed
 * after the test.
 */
export async function runningPreview(mode: FakeMode = "ok", repo = fixtureRepo()) {
  const { log } = addStoryFeature(repo, { preview: { mode } });
  const http = createServer();
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  const { port } = http.address() as { port: number };
  const server = await startServer({
    adapter: new FakeAdapter(),
    allowOrigins: [],
    binding,
    dataDir: temporaryFolder("uraeda-data"),
    given: false,
    port,
    repo,
    settings: await testSettings(),
    signIn: false,
  });
  http.on("request", getRequestListener(server.app.fetch));
  http.on("upgrade", server.upgrade);
  onTestFinished(async () => {
    http.closeAllConnections();
    await new Promise<void>((resolve) => http.close(() => resolve()));
    await server.stop();
  });
  const name = basename(repo);
  const base = `/r/${name}/preview/${server.frames.current()}/${STORY_FEATURE}/`;
  const checkout = await checkoutOf(join(repo, ".worktrees", STORY_FEATURE), base);
  server.previews.view(checkout);
  await ready(server.previews, checkout);
  return {
    base,
    log: log!,
    name,
    origin: `http://127.0.0.1:${port}`,
    port,
    previews: server.previews,
    repo,
    server,
  };
}

/** What the fake preview echoes of a request or an upgrade it got. */
export type Echo = {
  headers: Record<string, string>;
  path: string;
  query: Record<string, Array<string>>;
};

/**
 * The fake preview's echo of a WebSocket upgrade to `url`, sent with `headers`: its first message,
 * one text frame under 64 KB, parsed. The socket is destroyed once it is read.
 */
export function upgradeEcho(url: string, headers: Record<string, string> = {}): Promise<Echo> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, {
      headers: {
        connection: "Upgrade",
        "sec-websocket-key": randomBytes(16).toString("base64"),
        "sec-websocket-version": "13",
        upgrade: "websocket",
        ...headers,
      },
    });
    request.on("upgrade", (_response, socket, head) => {
      let received = head;
      const read = (chunk: Buffer) => {
        received = Buffer.concat([received, chunk]);
        const short = received.length >= 2 && received[1]! < 126;
        const start = short ? 2 : 4;
        const length = short ? received[1]! : received.length >= 4 ? received.readUInt16BE(2) : 0;
        if (received.length >= 2 && received.length >= start + length && length > 0) {
          socket.destroy();
          resolve(JSON.parse(received.subarray(start, start + length).toString("utf8")));
        }
      };
      socket.on("data", read);
      read(Buffer.alloc(0));
    });
    request.on("response", (response) => reject(new Error(`${url}: ${response.statusCode}`)));
    request.on("error", reject);
    request.end();
  });
}
