import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, onTestFinished, test, vi } from "vite-plus/test";
import type { Settings } from "uraeda-binding";
import { temporaryFolder } from "uraeda-binding/test-utils";
import {
  type GivenValues,
  inForce,
  type RunSettingsView,
  ServerSettings,
  type ServerSettingsView,
} from "../settings.ts";

/** The core's binding, as one object: the settings take it whole. */
const binding = await import("uraeda-binding");

const MAC = "mac.tail1234.ts.net";
const BUILD = "build.tail1234.ts.net";
const LAPTOP = "laptop.tail1234.ts.net";

/** A file holding every server setting. */
const file: Settings = {
  keyboard: {},
  runs: {},
  server: { allowedHosts: [MAC], openBrowser: true, port: 4310 },
};

/** No flag and no variable. */
const none = { noOpen: false };

/** US2.1 to US2.5: each source alone and over the ones after it. */
test.each<{
  file: Settings | null;
  name: string;
  options: Parameters<typeof inForce>[0];
  view: ServerSettingsView;
}>([
  {
    file: null,
    name: "the defaults, without a file",
    options: none,
    view: {
      allowedHosts: { inForce: [], saved: null, source: { kind: "default" } },
      openBrowser: { inForce: true, saved: null, source: { kind: "default" } },
      port: { inForce: 4310, saved: null, source: { kind: "default" } },
    },
  },
  {
    file: { keyboard: {}, runs: {}, server: {} },
    name: "the defaults, for keys the file does not hold",
    options: none,
    view: {
      allowedHosts: { inForce: [], saved: null, source: { kind: "default" } },
      openBrowser: { inForce: true, saved: null, source: { kind: "default" } },
      port: { inForce: 4310, saved: null, source: { kind: "default" } },
    },
  },
  {
    file: {
      keyboard: {},
      runs: {},
      server: { allowedHosts: [MAC], openBrowser: false, port: 4400 },
    },
    name: "the file over the defaults",
    options: none,
    view: {
      allowedHosts: { inForce: [MAC], saved: [MAC], source: { kind: "file" } },
      openBrowser: { inForce: false, saved: false, source: { kind: "file" } },
      port: { inForce: 4400, saved: 4400, source: { kind: "file" } },
    },
  },
  {
    file,
    name: "the variables over the file",
    options: {
      allowedHosts: { name: "URAEDA_ALLOWED_HOSTS", value: [BUILD] },
      noOpen: false,
      port: { name: "URAEDA_PORT", value: 4400 },
    },
    view: {
      allowedHosts: {
        inForce: [BUILD],
        saved: [MAC],
        source: { kind: "environment", name: "URAEDA_ALLOWED_HOSTS" },
      },
      openBrowser: { inForce: true, saved: true, source: { kind: "file" } },
      port: { inForce: 4400, saved: 4310, source: { kind: "environment", name: "URAEDA_PORT" } },
    },
  },
  {
    file: null,
    name: "the variables over the defaults",
    options: { noOpen: false, port: { name: "URAEDA_PORT", value: 4400 } },
    view: {
      allowedHosts: { inForce: [], saved: null, source: { kind: "default" } },
      openBrowser: { inForce: true, saved: null, source: { kind: "default" } },
      port: { inForce: 4400, saved: null, source: { kind: "environment", name: "URAEDA_PORT" } },
    },
  },
  {
    file,
    name: "the flags over the file",
    options: {
      allowedHosts: { name: "--allowed-hosts", value: [BUILD] },
      noOpen: true,
      port: { name: "--port", value: 4500 },
    },
    view: {
      allowedHosts: {
        inForce: [BUILD],
        saved: [MAC],
        source: { kind: "flag", name: "--allowed-hosts" },
      },
      openBrowser: { inForce: false, saved: true, source: { kind: "flag", name: "--no-open" } },
      port: { inForce: 4500, saved: 4310, source: { kind: "flag", name: "--port" } },
    },
  },
  {
    file,
    name: "an empty flag over the file's host names",
    options: { allowedHosts: { name: "--allowed-hosts", value: [] }, noOpen: false },
    view: {
      allowedHosts: {
        inForce: [],
        saved: [MAC],
        source: { kind: "flag", name: "--allowed-hosts" },
      },
      openBrowser: { inForce: true, saved: true, source: { kind: "file" } },
      port: { inForce: 4310, saved: 4310, source: { kind: "file" } },
    },
  },
])("$name", ({ file, options, view }) => {
  expect(inForce(options, file).server).toEqual(view);
});

/** US2.1 to US2.5 for the continues' settings: each source over the ones after it. */
test.each<{
  file: Settings["runs"] | null;
  name: string;
  options: Parameters<typeof inForce>[0];
  runs: Partial<RunSettingsView>;
}>([
  {
    file: null,
    name: "the continues on and 3 in a row, without a value",
    options: none,
    runs: {
      automaticContinues: { inForce: 3, saved: null, source: { kind: "default" } },
      continueAfterLimit: { inForce: true, saved: null, source: { kind: "default" } },
      continueAfterRestart: { inForce: true, saved: null, source: { kind: "default" } },
      continueBeforeGate: { inForce: true, saved: null, source: { kind: "default" } },
    },
  },
  {
    file: { automaticContinues: 4, continueBeforeGate: false },
    name: "the file's continues over the defaults",
    options: none,
    runs: {
      automaticContinues: { inForce: 4, saved: 4, source: { kind: "file" } },
      continueBeforeGate: { inForce: false, saved: false, source: { kind: "file" } },
    },
  },
  {
    file: { automaticContinues: 4, continueAfterRestart: true },
    name: "the continues' variables over the file",
    options: {
      automaticContinues: { name: "URAEDA_AUTOMATIC_CONTINUES", value: 5 },
      continueAfterRestart: { name: "URAEDA_CONTINUE_AFTER_RESTART", value: false },
      noOpen: false,
    },
    runs: {
      automaticContinues: {
        inForce: 5,
        saved: 4,
        source: { kind: "environment", name: "URAEDA_AUTOMATIC_CONTINUES" },
      },
      continueAfterRestart: {
        inForce: false,
        saved: true,
        source: { kind: "environment", name: "URAEDA_CONTINUE_AFTER_RESTART" },
      },
    },
  },
  {
    file: { automaticContinues: 4, continueAfterLimit: true },
    name: "the continues' flags over the file",
    options: {
      automaticContinues: { name: "--automatic-continues", value: 6 },
      continueAfterLimit: { name: "--no-continue-after-limit", value: false },
      noOpen: false,
    },
    runs: {
      automaticContinues: {
        inForce: 6,
        saved: 4,
        source: { kind: "flag", name: "--automatic-continues" },
      },
      continueAfterLimit: {
        inForce: false,
        saved: true,
        source: { kind: "flag", name: "--no-continue-after-limit" },
      },
    },
  },
])("$name", ({ file: runs, options, runs: view }) => {
  expect(inForce(options, runs && { ...file, runs }).runs).toMatchObject(view);
});

test("the build starts in a fresh session by default, and the file's value turns it off", () => {
  expect(inForce(none, null).runs.buildInFreshSession).toEqual({
    inForce: true,
    saved: null,
    source: { kind: "default" },
  });
  expect(inForce(none, file).runs.buildInFreshSession.inForce).toBe(true);
  expect(
    inForce(none, { ...file, runs: { buildInFreshSession: false } }).runs.buildInFreshSession,
  ).toEqual({ inForce: false, saved: false, source: { kind: "file" } });
});

test("single-key shortcuts are on by default, and the file's value turns them off", () => {
  expect(inForce(none, null).keyboard.singleKeyShortcuts).toEqual({
    inForce: true,
    saved: null,
    source: { kind: "default" },
  });
  expect(inForce(none, file).keyboard.singleKeyShortcuts.inForce).toBe(true);
  expect(
    inForce(none, { ...file, keyboard: { singleKeyShortcuts: false } }).keyboard.singleKeyShortcuts,
  ).toEqual({ inForce: false, saved: false, source: { kind: "file" } });
});

/** Vim's settings in force over `file`, without the run's values. */
function vim(file: Settings | null) {
  const { vimCommands, vimMode } = inForce(none, file).keyboard;
  return { vimCommands, vimMode };
}

test("Vim is off and without commands by default, and the file's values turn it on", () => {
  expect(vim(null)).toEqual({
    vimCommands: { inForce: [], saved: null, source: { kind: "default" } },
    vimMode: { inForce: false, saved: null, source: { kind: "default" } },
  });
  expect(vim(file)).toEqual(vim(null));
  expect(vim({ ...file, keyboard: { vimCommands: ["imap jj <Esc>"], vimMode: true } })).toEqual({
    vimCommands: { inForce: ["imap jj <Esc>"], saved: ["imap jj <Esc>"], source: { kind: "file" } },
    vimMode: { inForce: true, saved: true, source: { kind: "file" } },
  });
});

/** Opens the settings of `dir`, closed after the test. */
async function opened(dir: string, options: GivenValues = none) {
  const settings = await ServerSettings.open({ binding, dir, options });
  onTestFinished(() => settings.close());
  return settings;
}

/** Captures what the server prints, restored after the test. */
function stderr() {
  const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  onTestFinished(() => write.mockRestore());
  return write;
}

/** Edge case: a file that cannot be read. */
test("a broken file gives the defaults and its problem, printed once", async () => {
  const dir = temporaryFolder("uraeda-config");
  writeFileSync(join(dir, "config.toml"), "[server]\nport = 0\n");
  const write = stderr();

  const settings = await opened(dir, {
    noOpen: false,
    port: { name: "URAEDA_PORT", value: "4400" },
  });
  await settings.reload();

  const problem = `Cannot read ${binding.settingsFile(dir)}: line 2, port: The port is a number from 1 to 65535.`;
  expect(settings.problem).toBe(problem);
  expect(settings.view()).toEqual(
    inForce({ noOpen: false, port: { name: "URAEDA_PORT", value: 4400 } }, null).server,
  );
  expect(write.mock.calls).toEqual([
    [`uraeda: ${problem} The server uses its defaults until the file is fixed.\n`],
  ]);
  expect(readFileSync(join(dir, "config.toml"), "utf8")).toBe("[server]\nport = 0\n");
});

/** US5, edge case: a file the core cannot read leaves the shortcuts on. */
test("a file that cannot be read leaves single-key shortcuts on", async () => {
  const dir = temporaryFolder("uraeda-config");
  writeFileSync(join(dir, "config.toml"), "[keyboard]\nsingle_key_shortcuts = 1\n");
  stderr();

  const settings = await opened(dir);

  expect(settings.problem).toMatch(
    /line 2, single_key_shortcuts: Single-key shortcuts is true or false\./,
  );
  expect(settings.keyboard().singleKeyShortcuts).toEqual({
    inForce: true,
    saved: null,
    source: { kind: "default" },
  });

  writeFileSync(join(dir, "config.toml"), "[keyboard]\nsingle_key_shortcuts = false\n");
  await settings.reload();
  expect(settings.problem).toBeNull();
  expect(settings.keyboard().singleKeyShortcuts).toEqual({
    inForce: false,
    saved: false,
    source: { kind: "file" },
  });
});

test("a hand edit reaches the view once read again, and each listener once", async () => {
  const dir = temporaryFolder("uraeda-config");
  writeFileSync(join(dir, "config.toml"), `[server]\nallowed_hosts = ["${MAC}"]\n`);
  const settings = await opened(dir);
  const first = vi.fn();
  const second = vi.fn();
  settings.onChange(first);
  const off = settings.onChange(second);
  off();

  writeFileSync(join(dir, "config.toml"), `[server]\nallowed_hosts = ["${MAC}", "${LAPTOP}"]\n`);
  await settings.reload();
  await settings.reload();

  expect(settings.view().allowedHosts.saved).toEqual([MAC, LAPTOP]);
  expect(settings.allowedHosts()).toEqual([MAC, LAPTOP]);
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).not.toHaveBeenCalled();
});

test("a fixed file clears its problem, and a deleted one gives the defaults", async () => {
  const dir = temporaryFolder("uraeda-config");
  writeFileSync(join(dir, "config.toml"), "[server\n");
  stderr();
  const settings = await opened(dir);
  expect(settings.problem).toMatch(/^Cannot read .*config\.toml: line 1/);

  writeFileSync(join(dir, "config.toml"), "[server]\nport = 4400\n");
  await settings.reload();
  expect(settings.problem).toBeNull();
  expect(settings.view().port.inForce).toBe(4400);

  rmSync(join(dir, "config.toml"));
  await settings.reload();
  expect(settings.problem).toBeNull();
  expect(settings.view()).toEqual(inForce(none, null).server);
});

test("the file's path is written with ~ for the home folder", async () => {
  const home = temporaryFolder("uraeda-home");
  vi.stubEnv("HOME", home);
  onTestFinished(() => {
    vi.unstubAllEnvs();
  });

  const settings = await opened(join(home, ".config", "uraeda"));

  expect(settings.file).toBe("~/.config/uraeda/config.toml");
});

/** A port given by a flag or a variable follows the core's rule, as the file's does. */
test.each(["0", "abc", "70000", "4400.5", ""])("the given port %j is refused", async (typed) => {
  const options = { noOpen: false, port: { name: "URAEDA_PORT" as const, value: typed } };

  await expect(opened(temporaryFolder("uraeda-config"), options)).rejects.toThrow(
    /^The port is a number from 1 to 65535\.$/,
  );
});

/** The cap typed in `URAEDA_AUTOMATIC_CONTINUES`. */
const typed = (value: string) => ({
  automaticContinues: { name: "URAEDA_AUTOMATIC_CONTINUES" as const, value },
  noOpen: false,
});

/** The variable's cap follows the core's rule, as the file's does. */
test("a given cap on automatic continues is the core's number, from 1 to 10", async () => {
  await expect(opened(temporaryFolder("uraeda-config"), typed("11"))).rejects.toThrow(
    /^Automatic continues in a row is a whole number from 1 to 10\.$/,
  );
  const settings = await opened(temporaryFolder("uraeda-config"), typed(" 7 "));
  expect(settings.runs().automaticContinues.inForce).toBe(7);
});

/** The switch typed in `URAEDA_CONTINUE_BEFORE_GATE`. */
const gate = (value: string) => ({
  continueBeforeGate: { name: "URAEDA_CONTINUE_BEFORE_GATE" as const, value },
  noOpen: false,
});

/** R13 */
test("a given switch's variable reads true or false, and stops the start otherwise", async () => {
  await expect(opened(temporaryFolder("uraeda-config"), gate("yes"))).rejects.toThrow(
    /^URAEDA_CONTINUE_BEFORE_GATE is true or false\.$/,
  );
  const settings = await opened(temporaryFolder("uraeda-config"), gate(" false "));
  expect(settings.runs().continueBeforeGate).toEqual({
    inForce: false,
    saved: null,
    source: { kind: "environment", name: "URAEDA_CONTINUE_BEFORE_GATE" },
  });
});

test("a given port is the core's number", async () => {
  const options = { noOpen: false, port: { name: "--port" as const, value: " 4400 " } };

  const settings = await opened(temporaryFolder("uraeda-config"), options);

  expect(settings.view().port).toEqual({
    inForce: 4400,
    saved: null,
    source: { kind: "flag", name: "--port" },
  });
});
