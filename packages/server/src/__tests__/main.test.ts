import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { loadBinding } from "../binding.ts";

const main = fileURLToPath(new URL("../main.ts", import.meta.url));

test("refuses to start on a missing specs folder", () => {
  const result = spawnSync(process.execPath, [main, "--specs", "missing"], { encoding: "utf8" });

  expect(result.stderr).toBe("uraeda-server: missing: no such folder\n");
  expect(result.status).toBe(1);
});

test("explains a binding that is not built", async () => {
  const load = () => Promise.reject(new Error("Cannot find native binding."));

  await expect(loadBinding(load)).rejects.toThrow(
    "the native binding is not built; run vp run ready",
  );
});
