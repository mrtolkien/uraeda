// `vp run dev`'s arguments: none runs `vp dev` as before, and the sandbox gives its own Vite config.
// Importing the script runs nothing: it watches and spawns only when Node runs it.
import { expect, test } from "vite-plus/test";
import { viteArgs } from "../dev.ts";

test("dev.ts passes --config on to vp dev, and runs vp dev alone without it", () => {
  expect(viteArgs([])).toEqual(["dev"]);
  expect(viteArgs(["--config", "/checkout/packages/web/vite.sandbox.config.ts"])).toEqual([
    "dev",
    "--config",
    "/checkout/packages/web/vite.sandbox.config.ts",
  ]);
});

test("dev.ts refuses an argument it does not know, and a --config without its file", () => {
  expect(() => viteArgs(["--reset"])).toThrow("Unknown argument: --reset");
  expect(() => viteArgs(["--config"])).toThrow("--config needs a file");
});
