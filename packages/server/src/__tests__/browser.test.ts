import { expect, test } from "vite-plus/test";
import { browserOpens, openBrowser } from "../browser.ts";

const URL = "http://127.0.0.1:4310/r/todo/";

function fakeChild(error?: Error) {
  return {
    on(_event: "error", listener: (error: Error) => void) {
      if (error) {
        listener(error);
      }
    },
    unref() {},
  };
}

test.each([
  { case: "macOS", env: {}, expected: ["open", URL], platform: "darwin" as const },
  {
    case: "Linux with X11",
    env: { DISPLAY: ":0" },
    expected: ["xdg-open", URL],
    platform: "linux" as const,
  },
  {
    case: "Linux with Wayland",
    env: { WAYLAND_DISPLAY: "wayland-0" },
    expected: ["xdg-open", URL],
    platform: "linux" as const,
  },
  { case: "Linux without a display", env: {}, expected: null, platform: "linux" as const },
  {
    case: "over SSH on macOS",
    env: { SSH_CONNECTION: "1 2 3 4" },
    expected: null,
    platform: "darwin" as const,
  },
  {
    case: "over SSH on Linux",
    env: { DISPLAY: ":0", SSH_TTY: "/dev/pts/1" },
    expected: null,
    platform: "linux" as const,
  },
])("$case", ({ env, expected, platform }) => {
  const calls: Array<Array<string>> = [];
  const spawn = (command: string, args: Array<string>) => {
    calls.push([command, ...args]);
    return fakeChild();
  };

  const result = openBrowser(URL, { env, platform, spawn });

  expect(calls).toEqual(expected ? [expected] : []);
  expect(result).toBe(expected ? "opened" : "skipped");
  // Edge case: a start with no desktop knows it first, and makes no one-time link.
  expect(browserOpens({ env, platform })).toBe(result === "opened");
});

test("a failed launch warns, with the reason", () => {
  const lines: Array<string> = [];
  openBrowser(URL, {
    env: { DISPLAY: ":0" },
    platform: "linux",
    spawn: () => fakeChild(new Error("spawn xdg-open ENOENT")),
    warn: (line) => lines.push(line),
  });

  expect(lines).toEqual(["uraeda: could not open a browser: spawn xdg-open ENOENT\n"]);
});
