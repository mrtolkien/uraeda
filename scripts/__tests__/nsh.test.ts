import { mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { seedLock, withFreePort } from "../nsh.ts";

test("the runners' lockfile starts as the repository's, and follows it when it changes", () => {
  const folder = mkdtempSync(join(tmpdir(), "nsh-lock-"));
  try {
    const pinned = join(folder, "Cargo.lock");
    const generated = join(folder, "app/.nsh/rust/Cargo.lock");
    writeFileSync(pinned, "pinned");
    utimesSync(pinned, 100, 100);

    // A new checkout has no generated workspace yet.
    expect(seedLock(pinned, generated)).toBe(true);
    expect(readFileSync(generated, "utf8")).toBe("pinned");

    // Cargo then rewrites it for the runners: that stays until the repository pins anew.
    writeFileSync(generated, "the runners' own");
    utimesSync(generated, 200, 200);
    expect(seedLock(pinned, generated)).toBe(false);
    expect(readFileSync(generated, "utf8")).toBe("the runners' own");

    writeFileSync(pinned, "pinned anew");
    utimesSync(pinned, 300, 300);
    expect(seedLock(pinned, generated)).toBe(true);
    expect(readFileSync(generated, "utf8")).toBe("pinned anew");
  } finally {
    rmSync(folder, { force: true, recursive: true });
  }
});

test("a development session takes a free port, unless one is asked for", () => {
  expect(withFreePort(["run"])).toEqual(["run", "--port", "0"]);
  expect(withFreePort(["dev", "--port", "8790"])).toEqual(["dev", "--port", "8790"]);
  expect(withFreePort(["run", "--port=8790"])).toEqual(["run", "--port=8790"]);
  expect(withFreePort(["test", "--target", "linux"])).toEqual(["test", "--target", "linux"]);
});
