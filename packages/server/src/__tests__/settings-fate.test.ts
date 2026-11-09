// The `Settings` record and its changes, on every endpoint: the values in force, the file's, and
// their sources; the core's refusals; and the live update each change sends (review focus 2). And a
// feature's own run options, which its record shows over the settings'.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import { live } from "../fate.ts";
import { binding, byIdAt, fateAt, testApp } from "./helpers.ts";

const MAC = "mac.tail1234.ts.net";
const FEATURE = "2026-10-12-cli-tuis";
const SELECT = ["id", "file", "problem", "keyboard", "runs", "server"];

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

/** The keyboard's defaults: single-key shortcuts are on, Vim is off and without commands. */
const keyboardDefaults = {
  singleKeyShortcuts: { inForce: true, saved: null, source: { kind: "default" } },
  vimCommands: { inForce: [], saved: null, source: { kind: "default" } },
  vimMode: { inForce: false, saved: null, source: { kind: "default" } },
};

/**
 * The runs' defaults: the build after a spec's approval starts in a fresh session, every automatic
 * continue is on, 3 in a row, open pull requests are not caught up by themselves, and no run option
 * is set.
 */
const runDefaults = {
  automaticContinues: { inForce: 3, saved: null, source: { kind: "default" } },
  buildInFreshSession: { inForce: true, saved: null, source: { kind: "default" } },
  catchUpPullRequests: { inForce: false, saved: null, source: { kind: "default" } },
  continueAfterLimit: { inForce: true, saved: null, source: { kind: "default" } },
  continueAfterRestart: { inForce: true, saved: null, source: { kind: "default" } },
  options: { steps: [] },
};

test("the record of an empty config folder is read on the global endpoint and a repository's", async () => {
  const opened = await testApp();

  const global = await record(opened);
  const hosted = await record(opened, opened.name);

  expect(global).toEqual({
    file: opened.settings.file,
    id: "settings",
    keyboard: keyboardDefaults,
    problem: null,
    runs: runDefaults,
    server: defaults,
  });
  expect(hosted).toEqual(global);

  const effort = await testApp(undefined, { environment: { CLAUDE_CODE_EFFORT_LEVEL: "high" } });
  expect((await record(effort)).runs).toEqual({ ...runDefaults, claudeEffortFromEnv: "high" });
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
  const fresh = await change(opened, "setBuildInFreshSession", { fresh: false });
  const limit = await change(opened, "setContinue", { key: "limit", on: false });
  const continues = await change(opened, "setAutomaticContinues", { continues: "4" });
  const tooMany = await change(opened, "setAutomaticContinues", { continues: "11" });

  expect(edited.data.server.allowedHosts.saved).toEqual(["laptop.tail1234.ts.net"]);
  expect(removed.data.server.allowedHosts.saved).toEqual([]);
  expect(port.data.server.port).toEqual({ inForce: 4400, saved: 4400, source: { kind: "file" } });
  expect(open.data.server.openBrowser).toEqual({
    inForce: false,
    saved: false,
    source: { kind: "file" },
  });
  expect(fresh.data.runs.buildInFreshSession).toEqual({
    inForce: false,
    saved: false,
    source: { kind: "file" },
  });
  expect(limit.data.runs.continueAfterLimit).toEqual({
    inForce: false,
    saved: false,
    source: { kind: "file" },
  });
  expect(continues.data.runs.automaticContinues).toEqual({
    inForce: 4,
    saved: 4,
    source: { kind: "file" },
  });
  expect(tooMany.error).toEqual({
    code: "BAD_REQUEST",
    message: "refused: Automatic continues in a row is a whole number from 1 to 10.",
  });
  expect((await binding.readSettings(opened.configDir)).runs).toEqual({
    automaticContinues: 4,
    buildInFreshSession: false,
    continueAfterLimit: false,
    // The old switch reads as the plan's table until the settings' Runs section writes it away.
    options: { steps: [{ newSession: false, step: "plan" }] },
  });
});

test("the run options are written whole, and refused with the core's message", async () => {
  const opened = await testApp();
  const options = {
    reviewDepth: "branch",
    steps: [{ agent: "claude", effort: "high", model: "opus", step: "spec" }],
  };

  const result = await change(opened, "setRunOptions", { options });
  const refused = await change(opened, "setRunOptions", {
    options: { steps: [{ step: "deploy" }] },
  });

  expect(result.data.runs.options).toEqual(options);
  expect((await binding.readSettings(opened.configDir)).runs.options).toEqual(options);
  expect(refused.error).toMatchObject({ code: "BAD_REQUEST", message: /^refused: / });
  expect((await record(opened)).runs.options).toEqual(options);
});

test("a feature's record holds its own run options, the settings' left to their record", async () => {
  const opened = await testApp();
  const defaults = { steps: [{ model: "opus", step: "review" }] };
  await change(opened, "setRunOptions", { options: defaults });
  const set = (folder: string, options: unknown) =>
    fateAt(opened.app, opened.name, [
      {
        input: { folder, options },
        kind: "mutation",
        name: "feature.setRunOptions",
        select: ["id", "runOptions"],
      },
    ]);

  const [result] = await set(FEATURE, { steps: [{ effort: "high", step: "spec" }] });
  const [refused] = await set(FEATURE, { steps: [{ step: "deploy" }] });
  const [unknown] = await set("2026-01-01-nothing", { steps: [] });
  const [read] = await byIdAt(opened.app, opened.name, "Feature", [FEATURE], ["id", "runOptions"]);

  const own = { steps: [{ effort: "high", step: "spec" }] };
  expect(result.data.runOptions).toEqual(own);
  expect(refused.error).toMatchObject({ code: "BAD_REQUEST", message: /^refused: / });
  expect(unknown.error).toMatchObject({ code: "BAD_REQUEST", message: /^refused: / });
  expect(read.runOptions).toEqual(own);
});

/** US5 1 */
test("turning single-key shortcuts off answers the record and writes the file", async () => {
  const opened = await testApp();

  const result = await change(opened, "setSingleKeyShortcuts", { on: false });

  expect(result.error).toBeUndefined();
  expect(result.data.keyboard.singleKeyShortcuts).toEqual({
    inForce: false,
    saved: false,
    source: { kind: "file" },
  });
  expect((await binding.readSettings(opened.configDir)).keyboard.singleKeyShortcuts).toBe(false);
  expect((await record(opened)).keyboard.singleKeyShortcuts.inForce).toBe(false);
});

test("turning Vim on and setting its commands answer the record and write the file", async () => {
  const opened = await testApp();

  const mode = await change(opened, "setVimMode", { on: true });
  const commands = await change(opened, "setVimCommands", { lines: ["imap jj <Esc>"] });

  expect([mode.error, commands.error]).toEqual([undefined, undefined]);
  expect(mode.data.keyboard.vimMode).toEqual({
    inForce: true,
    saved: true,
    source: { kind: "file" },
  });
  expect(commands.data.keyboard.vimCommands).toEqual({
    inForce: ["imap jj <Esc>"],
    saved: ["imap jj <Esc>"],
    source: { kind: "file" },
  });
  const { keyboard } = await binding.readSettings(opened.configDir);
  expect([keyboard.vimMode, keyboard.vimCommands]).toEqual([true, ["imap jj <Esc>"]]);
  const read = await record(opened);
  expect([read.keyboard.vimMode.inForce, read.keyboard.vimCommands.inForce]).toEqual([
    true,
    ["imap jj <Esc>"],
  ]);
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

test("an unknown kind of automatic run is refused as a bad request", async () => {
  const opened = await testApp();

  const result = await change(opened, "setContinue", { key: "sleep", on: false });

  expect(result.error).toEqual({
    code: "BAD_REQUEST",
    message: "refused: sleep is not a kind of automatic run: restart, limit, or catch-up.",
  });
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
    change(opened, "setBuildInFreshSession", { fresh: false }),
    change(opened, "setSingleKeyShortcuts", { on: false }),
    change(opened, "setContinue", { key: "restart", on: false }),
    change(opened, "setAutomaticContinues", { continues: "4" }),
    change(opened, "setVimMode", { on: true }),
    change(opened, "setVimCommands", { lines: ["imap jj <Esc>"] }),
  ]);

  expect(read).toEqual({
    file: opened.settings.file,
    id: "settings",
    keyboard: keyboardDefaults,
    problem,
    runs: runDefaults,
    server: defaults,
  });
  expect(results.map((result) => result.error)).toEqual(
    Array(11).fill({ code: "BAD_REQUEST", message: `refused: ${problem}` }),
  );
  expect(readFileSync(file, "utf8")).toBe(broken);
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
