// The `Settings` record and its five changes, on every endpoint: the values in force, the file's,
// and their sources; the core's refusals; and the live update each change sends (review focus 2).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import { live } from "../fate.ts";
import { binding, byIdAt, fateAt, testApp } from "./helpers.ts";

const MAC = "mac.tail1234.ts.net";
const SELECT = ["id", "file", "problem", "server"];

type Opened = Awaited<ReturnType<typeof testApp>>;

/** The `Settings` record, as the endpoint of `name` gives it: the global one for null. */
async function record(opened: Opened, name: string | null = null) {
  const [read] = await byIdAt(opened.app, name, "Settings", ["settings"], SELECT);
  return read;
}

/** A settings mutation on the global endpoint: its result. */
async function change(opened: Opened, mutation: string, input: unknown) {
  const [result] = await fateAt(opened.app, null, [
    { input, kind: "mutation", name: `settings.${mutation}`, select: SELECT },
  ]);
  return result;
}

/** The `Settings` updates a bus's `update` gets from now on. */
function heard(bus: { update: (...args: Array<never>) => void }) {
  const update = vi.spyOn(bus, "update");
  // The global bus's spy is shared by the tests of this file: its earlier calls are not heard.
  const from = update.mock.calls.length;
  return () =>
    update.mock.calls
      .slice(from)
      .map(([type, id]) => `${String(type)} ${String(id)}`)
      .filter((call) => call.startsWith("Settings "));
}

const defaults = {
  allowedHosts: { inForce: [], saved: null, source: { kind: "default" } },
  openBrowser: { inForce: true, saved: null, source: { kind: "default" } },
  port: { inForce: 4310, saved: null, source: { kind: "default" } },
};

test("the record of an empty config folder is read on the global endpoint and a repository's", async () => {
  const opened = await testApp();

  const global = await record(opened);
  const hosted = await record(opened, opened.name);

  expect(global).toEqual({
    file: opened.settings.file,
    id: "settings",
    problem: null,
    server: defaults,
  });
  expect(hosted).toEqual(global);
});

/** US1.1 */
test("adding a host name answers it saved and in force, and writes the file", async () => {
  const opened = await testApp();

  const result = await change(opened, "addHost", { name: MAC });

  expect(result.error).toBeUndefined();
  expect(result.data.server.allowedHosts).toEqual({
    inForce: [MAC],
    saved: [MAC],
    source: { kind: "file" },
  });
  expect((await binding.readSettings(opened.configDir)).server.allowedHosts).toEqual([MAC]);
});

test("each change answers the record with its value", async () => {
  const opened = await testApp();
  await change(opened, "addHost", { name: MAC });

  const edited = await change(opened, "editHost", { from: MAC, to: "laptop.tail1234.ts.net" });
  const removed = await change(opened, "removeHost", { name: "laptop.tail1234.ts.net" });
  const port = await change(opened, "setPort", { port: " 4400 " });
  const open = await change(opened, "setOpenBrowser", { open: false });

  expect(edited.data.server.allowedHosts.saved).toEqual(["laptop.tail1234.ts.net"]);
  expect(removed.data.server.allowedHosts.saved).toEqual([]);
  expect(port.data.server.port).toEqual({ inForce: 4400, saved: 4400, source: { kind: "file" } });
  expect(open.data.server.openBrowser).toEqual({
    inForce: false,
    saved: false,
    source: { kind: "file" },
  });
});

/** US3 */
test("a port that is not one is refused with the core's message", async () => {
  const opened = await testApp();

  const result = await change(opened, "setPort", { port: "70000" });

  expect(result.error).toEqual({
    code: "BAD_REQUEST",
    message: "refused: The port is a number from 1 to 65535.",
  });
  expect((await record(opened)).server.port).toEqual(defaults.port);
});

test("a broken file is the record's problem, and refuses every change with it", async () => {
  const opened = await testApp();
  const file = join(opened.configDir, "config.toml");
  const broken = "[server]\nport = 70000\n";
  writeFileSync(file, broken);
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  await opened.settings.reload();
  const problem = `Cannot read ${opened.settings.file}: line 2, port: The port is a number from 1 to 65535.`;

  const read = await record(opened);
  const results = await Promise.all([
    change(opened, "addHost", { name: MAC }),
    change(opened, "editHost", { from: MAC, to: "laptop.tail1234.ts.net" }),
    change(opened, "removeHost", { name: MAC }),
    change(opened, "setPort", { port: "4400" }),
    change(opened, "setOpenBrowser", { open: false }),
  ]);

  expect(read).toEqual({ file: opened.settings.file, id: "settings", problem, server: defaults });
  expect(results.map((result) => result.error)).toEqual(
    Array(5).fill({ code: "BAD_REQUEST", message: `refused: ${problem}` }),
  );
  expect(readFileSync(file, "utf8")).toBe(broken);
});

/**
 * Review focus 2: the page's write is heard by the settings' watch too. The test waits for the
 * watch's own read, not a duration, then counts the updates sent.
 */
test("a change sends one update on the global bus and the repository's", async () => {
  const opened = await testApp();
  const buses = [live, opened.hosts.get(opened.name)!.live].map(heard);
  const reload = vi.spyOn(opened.settings, "reload");

  await change(opened, "addHost", { name: MAC });
  const read = await record(opened);
  // The change's own read, then the watch's, once the file's write is heard.
  await vi.waitFor(() => expect(reload.mock.calls.length).toBeGreaterThanOrEqual(2), {
    interval: 10,
    timeout: 10_000,
  });
  await Promise.all(reload.mock.results.map((result) => result.value));

  expect(read.server.allowedHosts.inForce).toEqual([MAC]);
  for (const calls of buses) {
    expect(calls()).toEqual(["Settings settings"]);
  }
});

test("a hand edit of the file sends the update, and the record reads it", async () => {
  const opened = await testApp();
  const global = heard(live);

  writeFileSync(join(opened.configDir, "config.toml"), "[server]\nport = 4500\n");
  await vi.waitFor(() => expect(global()).toEqual(["Settings settings"]), {
    interval: 10,
    timeout: 10_000,
  });

  expect((await record(opened)).server.port).toEqual({
    inForce: 4500,
    saved: 4500,
    source: { kind: "file" },
  });
});
