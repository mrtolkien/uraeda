// The extensions as the running server sees them, written to the data folder for `ura extension
// list`: each one's state and problems, its code's included, rewritten as they change.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { serve } from "./serve.ts";

type Written = {
  at: string;
  extensions: Array<{
    name: string;
    problems: Array<{ file: string; line?: number; message: string }>;
    state: string;
    waitingFor: string | null;
  }>;
  version: number;
};

const read = (dataDir: string): Written | undefined => {
  try {
    return JSON.parse(
      readFileSync(join(dataDir, "run", "extensions-status.json"), "utf8"),
    ) as Written;
  } catch {
    return undefined;
  }
};

const of = (dataDir: string, name: string) =>
  read(dataDir)?.extensions.find((one) => one.name === name);

test("the server writes each extension's state and problems, and rewrites them as they change", async () => {
  const broken = `export default function activate() { throw new Error("boom at activation"); }\n`;
  const opened = await serve({ bad: { "server.ts": broken } }, '[extensions.bad]\non = "all"\n');

  await expect.poll(() => of(opened.dataDir, "bad")?.state).toBe("broken");
  const written = read(opened.dataDir)!;
  expect(written.version).toBe(1);
  expect(Number.isNaN(Date.parse(written.at))).toBe(false);
  expect(
    of(opened.dataDir, "bad")
      ?.problems.map(({ message }) => message)
      .join("\n"),
  ).toContain("boom at activation");
  expect(of(opened.dataDir, "inbox")).toMatchObject({ problems: [], state: "on" });

  // Fixed on disk: the server reloads it, and the file says so.
  const fixed = `export default function activate() {}\n`;
  writeFileSync(join(opened.configDir, "extensions", "bad", "server.ts"), fixed);
  await expect.poll(() => of(opened.dataDir, "bad")?.state, { timeout: 5000 }).toBe("on");
  expect(of(opened.dataDir, "bad")?.problems).toEqual([]);
});
