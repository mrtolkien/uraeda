// The sandbox's source locations: code-inspector's transform marks each element with the file, line,
// and column it is written at, on top of the UI's own transforms, which keep their output.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type PluginOption, type ViteDevServer } from "vite-plus";
import { afterEach, expect, test } from "vite-plus/test";
import { uiTransforms } from "../../vite.transforms.ts";
import { sourceLocations } from "../sourceLocations.ts";

const web = join(import.meta.dirname, "../..");

let server: ViteDevServer | undefined;

let checkout: string | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
  if (checkout !== undefined) {
    await rm(checkout, { force: true, recursive: true });
    checkout = undefined;
  }
});

/** A Vite server over the web UI, or `root`, in middleware mode, with only `plugins`. */
async function transformServer(plugins: Array<PluginOption>, root = web) {
  server = await createServer({
    configFile: false,
    logLevel: "silent",
    plugins,
    root,
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

  // The bar's badge, at its line and column in the file as written, both counted from 1.
  const lines = (await readFile(join(web, "src/sandbox/SandboxBar.tsx"), "utf8")).split("\n");
  const line = lines.findIndex((text) => text.includes("<Badge"));
  const column = lines[line].indexOf("<Badge") + 1;
  expect(code).toContain(
    `"data-insp-path": "packages/web/src/sandbox/SandboxBar.tsx:${line + 1}:${column}:Badge"`,
  );
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

test("paths are from the root of the checkout Vite serves, wherever the server runs", async () => {
  checkout = await mkdtemp(join(tmpdir(), "uraeda-source-locations-"));
  execFileSync("git", ["init", "--quiet"], { cwd: checkout });
  await mkdir(join(checkout, "app/src"), { recursive: true });
  const file = join(checkout, "app/src/Hello.tsx");
  const source = "export const Hello = () => <p>Hi</p>;\n";
  await writeFile(file, source);
  // The plugin's own hooks, as Vite calls them: a server over this checkout would need React.
  const plugin = sourceLocations();
  await callHook(plugin.configResolved, { root: join(checkout, "app") });
  const result = (await callHook(plugin.transform, source, file)) as { code: string };

  expect(result.code).toContain('"app/src/Hello.tsx:1:28:p"');
  expect(result.code).not.toContain(checkout);
});

/** Calls a plugin's hook, a function or an object holding its `handler`, as Vite does. */
async function callHook(hook: unknown, ...args: Array<unknown>): Promise<unknown> {
  const handler = typeof hook === "function" ? hook : (hook as { handler?: unknown })?.handler;
  return typeof handler === "function" ? handler.call({}, ...args) : undefined;
}
