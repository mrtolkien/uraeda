// The sandbox's source locations: code-inspector's transform marks each element with the file, line,
// and column it is written at, on top of the UI's own transforms, which keep their output.
import { join } from "node:path";
import { createServer, type PluginOption, type ViteDevServer } from "vite-plus";
import { afterEach, expect, test } from "vite-plus/test";
import { uiTransforms } from "../../vite.transforms.ts";
import { sourceLocations } from "../sourceLocations.ts";

const web = join(import.meta.dirname, "../..");

let server: ViteDevServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

/** A Vite server over the web UI, in middleware mode, with only `plugins`. */
async function transformServer(plugins: Array<PluginOption>) {
  server = await createServer({
    configFile: false,
    logLevel: "silent",
    plugins,
    root: web,
    server: { hmr: false, middlewareMode: true, watch: null },
  });
  return server;
}

/** The code the server serves for a module of the web UI, by its path from the UI's root. */
async function transformed(served: ViteDevServer, path: string) {
  return (await served.transformRequest(path))?.code ?? "";
}

test("a component keeps the compiler's and StyleX's output, and gains its source", async () => {
  const served = await transformServer([sourceLocations(), ...uiTransforms()]);

  const code = await transformed(served, "/src/sandbox/SandboxBar.tsx");

  // The bar's badge, at its line and column in the file as written.
  expect(code).toContain('"data-insp-path": "packages/web/src/sandbox/SandboxBar.tsx:74:7:Badge"');
  expect(code).toMatch(/react[/_]compiler-runtime/);
  expect(code).not.toContain("stylex.create(");
});

test("no code-inspector client reaches the page", async () => {
  const served = await transformServer([sourceLocations(), ...uiTransforms()]);

  expect(await transformed(served, "/src/sandbox/SandboxBar.tsx")).not.toContain(
    "code-inspector-component",
  );
});

test("without the plugin, no source attribute is added", async () => {
  const served = await transformServer(uiTransforms());

  expect(await transformed(served, "/src/sandbox/SandboxBar.tsx")).not.toContain("data-insp-path");
});
