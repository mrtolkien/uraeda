// @vitest-environment node
// The builders' version covers every module the sample projects and sessions are built with: a
// change to one the stamp missed would leave a sandbox built by older code without its warning.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { expect, test } from "vite-plus/test";
import { SOURCES } from "../seed.ts";

const checkout = join(import.meta.dirname, "../../../..");

/** The workspace's packages the builders import, by name, and their folders. */
const PACKAGES: Record<string, string> = {
  "uraeda-binding": "packages/binding",
  "uraeda-server": "packages/server",
};

/** Each module's static and dynamic imports, but those of types alone. */
const IMPORTS =
  /(?:^|\n)\s*(?:import|export)(?!\s+type\s)[^;]*?\sfrom\s+"([^"]+)"|import\(\s*"([^"]+)"\s*\)/g;

/** The file an import names, or null for a module outside the workspace. */
function resolveImport(specifier: string, from: string): string | null {
  if (specifier.startsWith(".")) {
    return resolve(dirname(from), specifier);
  }
  const [name, ...path] = specifier.split("/");
  const folder = PACKAGES[name];
  if (folder === undefined) {
    return null;
  }
  const { exports } = JSON.parse(readFileSync(join(checkout, folder, "package.json"), "utf8"));
  const target = exports[path.length > 0 ? `./${path.join("/")}` : "."];
  return join(checkout, folder, typeof target === "string" ? target : target.default);
}

/** Every module of the workspace `roots` import, themselves included, from the checkout's root. */
function reached(roots: Array<string>): Set<string> {
  const seen = new Set<string>();
  const queue = roots.map((root) => join(checkout, root));
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    if (seen.has(file) || !existsSync(file)) {
      continue;
    }
    seen.add(file);
    if (!file.endsWith(".ts")) {
      continue;
    }
    for (const [, from, imported] of readFileSync(file, "utf8").matchAll(IMPORTS)) {
      const target = resolveImport(from ?? imported, file);
      if (target !== null) {
        queue.push(target);
      }
    }
  }
  return new Set([...seen].map((file) => relative(checkout, file)));
}

test("the builders' version covers every module they import that the sandbox's server does not", () => {
  // The server's own modules are the app the sandbox serves, reloaded as they change: a change to
  // them rebuilds no sample project.
  const server = reached(["packages/server/src/dev.ts"]);
  const builders = [
    ...reached([
      "packages/web/samples/index.ts",
      "packages/web/sandbox/seed.ts",
      "packages/web/sandbox/sessions.ts",
      "packages/web/sandbox/agent.ts",
    ]),
  ].filter((file) => !server.has(file));

  expect(builders).toContain("packages/server/src/testing.ts");
  const missed = builders.filter(
    (file) => !SOURCES.some((source) => file === source || file.startsWith(`${source}/`)),
  );
  expect(missed).toEqual([]);
});
