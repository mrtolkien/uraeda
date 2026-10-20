// The binding's transport contracts, on the real native output: the shapes and errors the server
// relies on. The core's own tests own the detailed rules, like comments kept in arrays, BOMs, and
// Windows line ends (`crates/core/tests/settings_writes.rs`).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { checkedPort, readSettings, setPort, settingsFile } from "./index.js";
import { temporaryFolder } from "./test-utils.ts";

const PORT_PROBLEM = "The port is a number from 1 to 65535.";

/** A config folder of the test's own, holding `text` as its settings file. */
function configWith(text: string) {
  const dir = temporaryFolder("uraeda-config");
  writeFileSync(join(dir, "config.toml"), text);
  return dir;
}

/** The message a call rejects with, or undefined when it resolves. */
const rejection = (call: Promise<unknown>) =>
  call.then(
    () => undefined,
    (error: Error) => error.message,
  );

const read = (dir: string) => readFileSync(join(dir, "config.toml"), "utf8");

test("settings cross the binding in camelCase, an absent key left out", async () => {
  const dir = configWith(
    [
      "[server]",
      'allowed_hosts = ["Box.TS.net"]',
      "open_browser = false",
      "",
      "[runs]",
      "build_in_fresh_session = true",
      "",
    ].join("\n"),
  );

  expect(await readSettings(dir)).toEqual({
    runs: { buildInFreshSession: true },
    server: { allowedHosts: ["box.ts.net"], openBrowser: false },
  });
});

test("a write is read back by a new read, keeping the human's comment and order", async () => {
  const dir = configWith("# mine\n[server]\nopen_browser = true # keep\n");

  const written = await setPort(dir, " 4400 ");

  expect(written).toEqual({ runs: {}, server: { openBrowser: true, port: 4400 } });
  expect(read(dir)).toBe("# mine\n[server]\nopen_browser = true # keep\nport = 4400\n");
  expect(await readSettings(dir)).toEqual(written);
});

test("a synchronous check throws its problem at the call, not as a rejection", () => {
  expect(checkedPort(" 8080 ")).toBe(8080);
  let thrown: unknown;
  try {
    checkedPort("70000");
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(Error);
  expect((thrown as Error).message).toBe(PORT_PROBLEM);
});

test("an asynchronous refusal rejects with the core's code and message, writing nothing", async () => {
  const before = "[server]\nport = 4310\n";
  const dir = configWith(before);

  expect(await rejection(setPort(dir, "0"))).toBe(`refused: ${PORT_PROBLEM}`);
  expect(read(dir)).toBe(before);
});

test("an unreadable file rejects reads and writes with its own code, and is kept", async () => {
  const before = "[server\nport = 4310\n";
  const dir = configWith(before);

  const reading = await rejection(readSettings(dir));
  const writing = await rejection(setPort(dir, "4400"));

  expect(reading).toMatch(new RegExp(`^unreadable: Cannot read ${escape(settingsFile(dir))}: `));
  expect(writing).toMatch(new RegExp(`^unreadable: Cannot read ${escape(settingsFile(dir))}: `));
  expect(read(dir)).toBe(before);
});

function escape(text: string) {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
