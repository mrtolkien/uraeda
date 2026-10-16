// The host names in force while the server runs: the settings file's, read again on each change,
// unless a flag gives them for the run (US1.1, US1.3, SC-001, review focus 1).
import type { IncomingMessage } from "node:http";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, expect, test } from "vite-plus/test";
import { fixtureRepo, temporaryFolder } from "uraeda-binding/test-utils";
import { FakeAdapter } from "../runner/fake.ts";
import { type Server, startServer } from "../server.ts";
import { testSettings } from "../testing.ts";

/** The core's binding, as one object: the server takes it whole. */
const binding = await import("uraeda-binding");

const MAC = "mac.tail1234.ts.net";
const LAPTOP = "laptop.tail1234.ts.net";
const BUILD = "build.tail1234.ts.net";
const port = 4310;

/** The servers of a test, stopped after it, their settings closed with them. */
const started: Array<Server> = [];

afterEach(async () => {
  for (const server of started.splice(0)) {
    await server.stop();
  }
});

/**
 * A server without sign-in over a new config folder, the host names of `--allowed-hosts` given
 * when `flag` is: its config folder, its settings, and the status of a read on a host name.
 */
async function hostServer(flag?: Array<string>) {
  const dir = temporaryFolder("uraeda-config");
  const settings = await testSettings({ allowedHosts: flag, dir });
  const server = await startServer({
    adapter: new FakeAdapter(),
    allowOrigins: [],
    binding,
    dataDir: temporaryFolder("uraeda-data"),
    given: false,
    port,
    repo: fixtureRepo(),
    settings,
    signIn: false,
  });
  started.push(server);
  const status = async (host: string) =>
    (
      await server.app.request(`http://${host}/fate`, {
        body: JSON.stringify({ operations: [], version: 1 }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    ).status;
  return { dir, server, settings, status };
}

/** The first line of the server's answer to an upgrade on `host`, to a preview path. */
function upgradeAnswer(server: Server, host: string): Promise<string> {
  const socket = new PassThrough();
  let answer = "";
  socket.on("data", (chunk: Buffer) => (answer += chunk.toString()));
  const request = {
    headers: { connection: "Upgrade", host, upgrade: "websocket" },
    method: "GET",
    url: "/r/repo/preview/another-secret/folder/socket",
  } as unknown as IncomingMessage;
  return new Promise((resolve) => {
    socket.on("finish", () => resolve(answer.split("\r\n")[0]));
    server.upgrade(request, socket, Buffer.alloc(0));
  });
}

/** US1.1, US1.3, SC-001 */
test("a host name in the file passes from the next request, until it changes", async () => {
  const { dir, server, settings, status } = await hostServer();
  expect(await status(MAC)).toBe(403);
  expect(await upgradeAnswer(server, MAC)).toBe("HTTP/1.1 403 Forbidden");

  await binding.addAllowedHost(dir, MAC);
  await settings.reload();
  expect(await status(MAC)).toBe(200);
  // Past the guard, the upgrade is refused for its secret only.
  expect(await upgradeAnswer(server, MAC)).toBe("HTTP/1.1 404 Not Found");

  await binding.editAllowedHost(dir, MAC, LAPTOP);
  await settings.reload();
  expect(await status(MAC)).toBe(403);
  expect(await status(LAPTOP)).toBe(200);

  rmSync(join(dir, "config.toml"));
  await settings.reload();
  expect(await status(LAPTOP)).toBe(403);
});

/** Review focus 1 */
test("host names given by --allowed-hosts stay, whatever the file lists", async () => {
  const { dir, settings, status } = await hostServer([BUILD]);

  await binding.addAllowedHost(dir, MAC);
  await settings.reload();

  expect(settings.view().allowedHosts.saved).toEqual([MAC]);
  expect(await status(MAC)).toBe(403);
  expect(await status(BUILD)).toBe(200);
  expect(await status(`${BUILD}:${port}`)).toBe(200);
});
