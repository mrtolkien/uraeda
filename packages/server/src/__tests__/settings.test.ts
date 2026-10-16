import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, onTestFinished, test, vi } from "vite-plus/test";
import type { Settings } from "uraeda-binding";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { inForce, ServerSettings, type ServerSettingsView } from "../settings.ts";

/** The core's binding, as one object: the settings take it whole. */
const binding = await import("uraeda-binding");

const MAC = "mac.tail1234.ts.net";
const BUILD = "build.tail1234.ts.net";
const LAPTOP = "laptop.tail1234.ts.net";

/** A file holding every server setting. */
const file: Settings = { server: { allowedHosts: [MAC], openBrowser: true, port: 4310 } };

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
    file: { server: {} },
    name: "the defaults, for keys the file does not hold",
    options: none,
    view: {
      allowedHosts: { inForce: [], saved: null, source: { kind: "default" } },
      openBrowser: { inForce: true, saved: null, source: { kind: "default" } },
      port: { inForce: 4310, saved: null, source: { kind: "default" } },
    },
  },
  {
    file: { server: { allowedHosts: [MAC], openBrowser: false, port: 4400 } },
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
  expect(inForce(options, file)).toEqual(view);
});

/** Opens the settings of `dir`, closed after the test. */
async function opened(dir: string, options: Parameters<typeof inForce>[0] = none) {
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

  const settings = await opened(dir, { noOpen: false, port: { name: "URAEDA_PORT", value: 4400 } });
  await settings.reload();

  const problem = `Cannot read ${dir}/config.toml: line 2, port: The port is a number from 1 to 65535.`;
  expect(settings.problem).toBe(problem);
  expect(settings.view()).toEqual(
    inForce({ noOpen: false, port: { name: "URAEDA_PORT", value: 4400 } }, null),
  );
  expect(write.mock.calls).toEqual([
    [`uraeda: ${problem} The server uses its defaults until the file is fixed.\n`],
  ]);
  expect(readFileSync(join(dir, "config.toml"), "utf8")).toBe("[server]\nport = 0\n");
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
  expect(settings.view()).toEqual(inForce(none, null));
});

test("the watch of the config folder reads a change made by hand", async () => {
  const dir = join(temporaryFolder("uraeda-config"), "uraeda");
  const settings = await opened(dir);
  const changed = vi.fn();
  settings.onChange(changed);

  writeFileSync(join(dir, "config.toml"), `[server]\nallowed_hosts = ["${LAPTOP}"]\n`);

  await expect.poll(() => settings.allowedHosts(), { timeout: 5000 }).toEqual([LAPTOP]);
  expect(changed).toHaveBeenCalledTimes(1);
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
