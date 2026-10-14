import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { checkBinding, loadBinding } from "../binding.ts";
import { fixtureRepo, temporaryFolder } from "uraeda-binding/test-utils";

const main = fileURLToPath(new URL("../main.ts", import.meta.url));

/** A binding import that fails, as when it is not built. */
const missingBinding = () => Promise.reject(new Error("Cannot find native binding."));

test("refuses to start on a folder that is not a repository", () => {
  const folder = temporaryFolder("uraeda-none");

  const result = spawnSync(process.execPath, [main, "--repo", folder], { encoding: "utf8" });

  expect(result.stderr).toBe(`uraeda-server: ${folder} is not a git repository\n`);
  expect(result.status).toBe(1);
});

test("a busy port exits 1 and names the first server", async () => {
  const repo = fixtureRepo();
  const data = temporaryFolder("uraeda-data");
  const listener = createServer();
  await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", resolve));
  const { port } = listener.address() as { port: number };

  const child = spawn(process.execPath, [main, "--repo", repo, "--port", String(port)], {
    env: { ...process.env, URAEDA_DATA_DIR: data },
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const code = await new Promise((resolve) => child.on("exit", resolve));
  listener.close();

  expect(stderr).toBe(
    `uraeda-server: port ${port} is in use: another Uraeda server may run at http://127.0.0.1:${port}/\n`,
  );
  expect(code).toBe(1);
});

test("explains a binding that is not built", async () => {
  await expect(loadBinding(missingBinding, () => {})).rejects.toThrow(
    "the native binding is not built; run vp run ready",
  );
});

/** A checkout with a binding built at `built` and a core changed at `changed`, in seconds. */
function checkout(built: number, changed: number) {
  const root = temporaryFolder("uraeda-binding");
  mkdirSync(join(root, "packages/binding"), { recursive: true });
  mkdirSync(join(root, "crates/core/src"), { recursive: true });
  const binding = join(root, "packages/binding/uraeda-binding.linux-x64-gnu.node");
  const source = join(root, "crates/core/src/lib.rs");
  writeFileSync(binding, "");
  writeFileSync(source, "");
  utimesSync(join(root, "crates/core/src"), 1, 1);
  utimesSync(join(root, "crates/core"), 1, 1);
  utimesSync(binding, built, built);
  utimesSync(source, changed, changed);
  return root;
}

test("refuses a binding older than the Rust core, as after a pull", () => {
  expect(() => checkBinding(checkout(100, 200))).toThrow(
    "the native binding is older than the Rust core; run vp run --filter uraeda-binding build",
  );
});

test("takes a binding built after the Rust core changed", () => {
  expect(() => checkBinding(checkout(200, 100))).not.toThrow();
});

test("takes any binding outside a checkout of the repository", () => {
  const root = temporaryFolder("uraeda-binding");
  mkdirSync(join(root, "packages/binding"), { recursive: true });
  writeFileSync(join(root, "packages/binding/uraeda-binding.linux-x64-gnu.node"), "");

  expect(() => checkBinding(root)).not.toThrow();
});
