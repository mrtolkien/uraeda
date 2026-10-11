import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { loadBinding } from "../binding.ts";

const main = fileURLToPath(new URL("../main.ts", import.meta.url));

test("refuses to start on a folder that is not a repository", () => {
  const folder = realpathSync(mkdtempSync(join(tmpdir(), "uraeda-none-")));

  const result = spawnSync(process.execPath, [main, "--repo", folder], { encoding: "utf8" });

  expect(result.stderr).toBe(`uraeda-server: ${folder} is not a git repository\n`);
  expect(result.status).toBe(1);
});

test("explains a binding that is not built", async () => {
  const load = () => Promise.reject(new Error("Cannot find native binding."));

  await expect(loadBinding(load)).rejects.toThrow(
    "the native binding is not built; run vp run ready",
  );
});
