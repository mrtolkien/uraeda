// @vitest-environment node
// The allowed host names: removing one cuts this browser off only when the browser reached the
// server through it, it is not 127.0.0.1 or localhost, and the file's names are in force.
import { expect, test } from "vite-plus/test";
import { cutsOff } from "../settings/hosts.ts";

const MAC = "mac.tail1234.ts.net";
const PHONE = "phone.tail1234.ts.net";

const FILE = { kind: "file" };
const FLAG = { kind: "flag", name: "--allowed-hosts" };

test.each([
  [
    "a name asked before removal: the one this browser reached the server through",
    MAC,
    MAC,
    FILE,
    true,
  ],
  ["another device's name, removed without asking", PHONE, MAC, FILE, false],
  ["this browser at 127.0.0.1, which always passes", "127.0.0.1", "127.0.0.1", FILE, false],
  ["this browser at localhost, which always passes", "localhost", "localhost", FILE, false],
  [
    "--allowed-hosts given: the file's names are not in force, nothing is cut off",
    MAC,
    MAC,
    FLAG,
    false,
  ],
  ["no names in the file, the default in force", MAC, MAC, { kind: "default" }, false],
  [
    "the browser's host name in capitals is compared lowercased",
    MAC,
    MAC.toUpperCase(),
    FILE,
    true,
  ],
])("%s", (_case, name, browser, source, cuts) => {
  expect(cutsOff(name, browser, source)).toBe(cuts);
});
