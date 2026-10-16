import { existsSync, mkdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, onTestFinished, test, vi } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { LIST_QUIET_MS } from "../repositories.ts";
import { FileWatch } from "../settings-watch.ts";
import { ServerSettings } from "../settings.ts";

/** The core's binding, as one object: the settings take it whole. */
const binding = await import("uraeda-binding");

const MAC = "mac.tail1234.ts.net";
const LAPTOP = "laptop.tail1234.ts.net";

/** How long a change may take to reach the view. */
const POLL = { timeout: 5000 };

/** The settings file's text holding the host name `name`. */
const hosts = (name: string) => `[server]\nallowed_hosts = ["${name}"]\n`;

/**
 * Opens the settings of `dir` with a binding counting its reads of the file, closed after the
 * test.
 */
async function watched(dir: string) {
  const counted = {
    checkedPort: binding.checkedPort,
    reads: 0,
    readSettings(folder: string) {
      counted.reads += 1;
      return binding.readSettings(folder);
    },
    settingsFile: binding.settingsFile,
  };
  const settings = await ServerSettings.open({ binding: counted, dir, options: { noOpen: false } });
  onTestFinished(() => settings.close());
  return { counted, settings };
}

/** Edge case: no config folder. */
test("a start without the config folder leaves it absent, and sees it made later", async () => {
  const parent = join(temporaryFolder("uraeda-config"), "home", ".config");
  const dir = join(parent, "uraeda");
  const { settings } = await watched(dir);
  expect(existsSync(parent)).toBe(false);

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "config.toml"), hosts(MAC));

  await expect.poll(() => settings.allowedHosts(), POLL).toEqual([MAC]);
});

test("a config folder deleted and made again is seen again", async () => {
  const dir = join(temporaryFolder("uraeda-config"), "uraeda");
  mkdirSync(dir);
  writeFileSync(join(dir, "config.toml"), hosts(MAC));
  const { settings } = await watched(dir);
  expect(settings.allowedHosts()).toEqual([MAC]);

  rmSync(dir, { recursive: true });
  await expect.poll(() => settings.allowedHosts(), POLL).toEqual([]);
  mkdirSync(dir);
  writeFileSync(join(dir, "config.toml"), hosts(LAPTOP));

  await expect.poll(() => settings.allowedHosts(), POLL).toEqual([LAPTOP]);
});

test("a write by the core, renamed over the file, reaches the view", async () => {
  const dir = temporaryFolder("uraeda-config");
  const { settings } = await watched(dir);

  await binding.setPort(dir, "4400");

  await expect.poll(() => settings.view().port.inForce, POLL).toBe(4400);
});

/** Edge case: a `config.toml` symlinked elsewhere, as by GNU Stow. */
test("a symlinked file is seen changing, by hand, by the core, and pointed elsewhere", async () => {
  const dir = temporaryFolder("uraeda-config");
  const dotfiles = temporaryFolder("uraeda-dotfiles");
  writeFileSync(join(dotfiles, "uraeda.toml"), hosts(MAC));
  symlinkSync(join(dotfiles, "uraeda.toml"), join(dir, "config.toml"));
  const { settings } = await watched(dir);
  expect(settings.allowedHosts()).toEqual([MAC]);

  writeFileSync(join(dotfiles, "uraeda.toml"), hosts(LAPTOP));
  await expect.poll(() => settings.allowedHosts(), POLL).toEqual([LAPTOP]);

  await binding.setPort(dir, "4400");
  await expect.poll(() => settings.view().port.inForce, POLL).toBe(4400);

  const other = temporaryFolder("uraeda-dotfiles");
  writeFileSync(join(other, "config.toml"), hosts(MAC));
  unlinkSync(join(dir, "config.toml"));
  symlinkSync(join(other, "config.toml"), join(dir, "config.toml"));
  await expect.poll(() => settings.allowedHosts(), POLL).toEqual([MAC]);
  writeFileSync(join(other, "config.toml"), hosts(LAPTOP));
  await expect.poll(() => settings.allowedHosts(), POLL).toEqual([LAPTOP]);
});

test("a burst of writes is read once", async () => {
  const dir = temporaryFolder("uraeda-config");
  const { counted, settings } = await watched(dir);
  const reads = counted.reads;
  // A second watch of the file: once it sees a write, the settings' watch has had it too.
  let seen = 0;
  const probe = new FileWatch(dir, "config.toml", () => {
    seen += 1;
  });
  onTestFinished(() => probe.close());
  // The settings' quiet moment passes only when the test says so.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  onTestFinished(() => {
    vi.useRealTimers();
  });

  for (const name of [MAC, LAPTOP, MAC, LAPTOP]) {
    const before = seen;
    writeFileSync(join(dir, "config.toml"), hosts(name));
    await expect.poll(() => seen, POLL).toBeGreaterThan(before);
  }
  vi.advanceTimersByTime(LIST_QUIET_MS);
  // Waits for the read the quiet moment started, then reads once more.
  await settings.reload();

  expect(settings.allowedHosts()).toEqual([LAPTOP]);
  expect(counted.reads).toBe(reads + 2);
});

test("another file of the folder is not reported", async () => {
  const dir = temporaryFolder("uraeda-config");
  let changes = 0;
  const watch = new FileWatch(dir, "config.toml", () => {
    changes += 1;
  });
  onTestFinished(() => watch.close());
  // A second watch of the folder, for another name: its event comes after the first file's.
  let probed = false;
  const probe = new FileWatch(dir, "probe.txt", () => {
    probed = true;
  });
  onTestFinished(() => probe.close());

  writeFileSync(join(dir, "notes.txt"), "mine\n");
  writeFileSync(join(dir, "probe.txt"), "seen\n");
  await expect.poll(() => probed, POLL).toBe(true);

  expect(changes).toBe(0);
});

test("close stops the reads and the listeners' calls", async () => {
  const dir = temporaryFolder("uraeda-config");
  const { counted, settings } = await watched(dir);
  const changed = vi.fn();
  settings.onChange(changed);
  const reads = counted.reads;
  // Settings still open on the folder: once they read the write, the closed ones had its events.
  const open = await watched(dir);

  settings.close();
  writeFileSync(join(dir, "config.toml"), hosts(MAC));
  await expect.poll(() => open.settings.allowedHosts(), POLL).toEqual([MAC]);

  expect(counted.reads).toBe(reads);
  expect(changed).not.toHaveBeenCalled();
  expect(settings.allowedHosts()).toEqual([]);
});

test("a listener that throws is printed, and the others are still called", async () => {
  const dir = temporaryFolder("uraeda-config");
  const { settings } = await watched(dir);
  const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  onTestFinished(() => write.mockRestore());
  settings.onChange(() => {
    throw new Error("the guard broke");
  });
  const after = vi.fn();
  settings.onChange(after);

  writeFileSync(join(dir, "config.toml"), hosts(MAC));

  await expect.poll(() => after.mock.calls.length, POLL).toBe(1);
  expect(write.mock.calls).toEqual([["uraeda: the guard broke\n"]]);
});
