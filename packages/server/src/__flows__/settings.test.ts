// The settings: the settings decision's rule that a value resolves from its flag, then its
// variable, the file, and its default, that a flag or variable is never written into the file, and
// that a file the human broke is never overwritten.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { loadConfigDir, loadDataDir, loadEnv } from "../env.ts";
import { parseOptions } from "../options.ts";
import { ServerSettings } from "../settings.ts";

const binding = await import("uraeda-binding");

type Setting = { inForce: unknown; saved: unknown; source: { kind: string } };

/** The settings the server would run with: `argv` over `environment`, over `file`'s text. */
async function settingsOf(argv: Array<string>, environment: Record<string, string>, file?: string) {
  const dir = temporaryFolder("uraeda-config");
  if (file !== undefined) {
    writeFileSync(join(dir, "config.toml"), file);
  }
  const options = parseOptions(argv, loadEnv(null, environment));
  const settings = await ServerSettings.open({ binding, dir, options });
  return { dir, settings };
}

test.each<[string, Array<string>, Record<string, string>, string | undefined, number, string]>([
  ["nothing given", [], {}, undefined, 4310, "default"],
  ["the file", [], {}, "[server]\nport = 5000\n", 5000, "file"],
  [
    "the variable over the file",
    [],
    { URAEDA_PORT: "6000" },
    "[server]\nport = 5000\n",
    6000,
    "environment",
  ],
  [
    "the flag over the variable and the file",
    ["--port", "7000"],
    { URAEDA_PORT: "6000" },
    "[server]\nport = 5000\n",
    7000,
    "flag",
  ],
  ["an empty variable, as unset", [], { URAEDA_PORT: "" }, "[server]\nport = 5000\n", 5000, "file"],
])("the port from %s", async (_, argv, environment, file, port, source) => {
  const { settings } = await settingsOf(argv, environment, file);

  const view = settings.view().port as Setting;

  expect([view.inForce, view.source.kind]).toEqual([port, source]);
  settings.close();
});

test("a port that is not one stops the start, from the flag or the variable", async () => {
  for (const [argv, environment] of [
    [["--port", "0"], {}],
    [["--port", "70000"], {}],
    [[], { URAEDA_PORT: "abc" }],
  ] as const) {
    await expect(settingsOf([...argv], { ...environment })).rejects.toThrow();
  }
});

test("the host names resolve the same way, and a flag given empty still wins", async () => {
  const file = '[server]\nallowed_hosts = ["file.example"]\n';

  const fromFile = await settingsOf([], {}, file);
  const fromVariable = await settingsOf(
    [],
    { URAEDA_ALLOWED_HOSTS: "env.example, other.example" },
    file,
  );
  const fromFlag = await settingsOf(
    ["--allowed-hosts", "flag.example"],
    { URAEDA_ALLOWED_HOSTS: "env.example" },
    file,
  );
  const none = await settingsOf(["--allowed-hosts", ""], {}, file);

  expect(fromFile.settings.allowedHosts()).toEqual(["file.example"]);
  expect(fromVariable.settings.allowedHosts()).toEqual(["env.example", "other.example"]);
  expect(fromFlag.settings.allowedHosts()).toEqual(["flag.example"]);
  expect(none.settings.allowedHosts()).toEqual([]);
  for (const { settings } of [fromFile, fromVariable, fromFlag, none]) {
    settings.close();
  }
});

test("a flag or a variable is never written into the file, by the server or by a change", async () => {
  const { dir, settings } = await settingsOf(
    ["--port", "7000", "--allowed-hosts", "flag.example", "--no-open"],
    {},
  );
  const file = join(dir, "config.toml");

  // Starting wrote nothing: the folder is as it was.
  expect(existsSync(file)).toBe(false);

  // A change of another setting writes that setting only.
  await binding.setBuildInFreshSession(dir, false);
  await settings.reload();
  const written = readFileSync(file, "utf8");
  expect(written).not.toContain("7000");
  expect(written).not.toContain("flag.example");
  expect(written).not.toMatch(/open_browser\s*=\s*false/);
  // The flags still win for this run.
  expect((settings.view().port as Setting).inForce).toBe(7000);
  expect(settings.allowedHosts()).toEqual(["flag.example"]);
  settings.close();
});

test("a file the human broke gives the defaults, and no change overwrites it", async () => {
  const broken = "[server\nport = ";
  const { dir, settings } = await settingsOf([], {}, broken);

  expect(settings.problem).not.toBeNull();
  expect((settings.view().port as Setting).inForce).toBe(4310);
  await expect(binding.addAllowedHost(dir, "mac.example")).rejects.toThrow();
  await expect(binding.setPort(dir, "5000")).rejects.toThrow();

  expect(readFileSync(join(dir, "config.toml"), "utf8")).toBe(broken);
  settings.close();
});

test("a change keeps the human's comments, unknown keys, and order", async () => {
  const text = "# my own notes\n[server]\nport = 5000\nmine = 1\n\n[elsewhere]\nkept = true\n";
  const { dir, settings } = await settingsOf([], {}, text);

  await binding.addAllowedHost(dir, "mac.example");

  const written = readFileSync(join(dir, "config.toml"), "utf8");
  expect(written).toContain("# my own notes");
  expect(written).toContain("mine = 1");
  expect(written).toContain("[elsewhere]\nkept = true");
  expect(written.indexOf("port = 5000")).toBeLessThan(written.indexOf("mac.example"));
  settings.close();
});

test("a hand edit of the file is in force after the server reads it again", async () => {
  const { dir, settings } = await settingsOf([], {}, "[server]\nport = 5000\n");
  let told = 0;
  settings.onChange(() => told++);

  writeFileSync(join(dir, "config.toml"), "[server]\nport = 5001\n");
  await settings.reload();

  expect((settings.view().port as Setting).inForce).toBe(5001);
  expect(told).toBe(1);
  // Read again with no change, nothing is told.
  await settings.reload();
  expect(told).toBe(1);
  settings.close();
});

test("the data and config folders come from the variable, then .env, then the system's default", () => {
  const root = temporaryFolder("uraeda-checkout");
  writeFileSync(
    join(root, ".env"),
    "URAEDA_DATA_DIR=from-env-file\nURAEDA_CONFIG_DIR=config-from-env-file\n",
  );

  expect(loadDataDir(root, binding, { URAEDA_DATA_DIR: "/from/environment" })).toBe(
    "/from/environment",
  );
  expect(loadDataDir(root, binding, {})).toBe(join(root, "from-env-file"));
  expect(loadConfigDir(root, binding, {})).toBe(join(root, "config-from-env-file"));
  // Without a checkout, only the environment, then the system's own folders.
  expect(loadDataDir(null, binding, {})).toBe(binding.dataDir(null));
  expect(loadConfigDir(null, binding, {})).toBe(binding.configDir(null));
});
