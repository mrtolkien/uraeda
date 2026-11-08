// The documentation's example, `examples/extensions/wiki/`, as a server loads it: its server code
// and its page compile and run with no problem, its page registers its place, and its record lists
// the Markdown files of a repository's `docs/` folder, through the `folder` setting's default,
// each cut at 256 KB.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "vite-plus/test";
import type { PageBundle } from "../loader.ts";
import { records, serve, stateOf } from "./serve.ts";

/** The example's folder, in the checkout. */
const EXAMPLE = resolve(import.meta.dirname, "../../../../../examples/extensions/wiki");

/** The example's files, by name. */
function exampleFiles(): Record<string, string> {
  return Object.fromEntries(
    readdirSync(EXAMPLE).map((file) => [file, readFileSync(join(EXAMPLE, file), "utf8")]),
  );
}

/** Anything a page's module reads of a shared module at registration: callable, every key too. */
const anything: object = new Proxy(() => anything, {
  get: (_, key) => (typeof key === "symbol" ? undefined : key === "then" ? undefined : anything),
});

/**
 * Runs the page bundle's entry as the web's page runtime does, its shared modules stand-ins, and
 * calls its default export with a page API that records each call: what it registered.
 */
function register(bundle: PageBundle): Array<[string, unknown]> {
  const load = (file: string): Record<string, unknown> => {
    const exports: Record<string, unknown> = {};
    const run = new Function("__import", "__exports", bundle.modules[file]);
    run((specifier: string) => {
      if (specifier.startsWith(".")) {
        const name = specifier.replace(/^\.\//, "");
        return load([name, `${name}.ts`, `${name}.tsx`].find((one) => one in bundle.modules)!);
      }
      return anything;
    }, exports);
    return exports;
  };
  const calls: Array<[string, unknown]> = [];
  const api = new Proxy(
    {},
    { get: (_, key) => (input: unknown) => calls.push([String(key), input]) },
  );
  (load(bundle.entry).default as (api: object) => void)(api);
  return calls;
}

// Break: the example's server code reading another folder than its setting's, or its page
// refused by the compiler, fails here before the documentation shows it.
test("the wiki example loads and lists a repository's docs", async () => {
  const opened = await serve({ wiki: exampleFiles() }, `[extensions.wiki]\non = ["uraeda"]\n`, {
    prepare: (repo) => {
      mkdirSync(join(repo, "docs", "guides"), { recursive: true });
      writeFileSync(join(repo, "docs", "index.md"), "# Welcome\n\nThe wiki's first page.\n");
      writeFileSync(join(repo, "docs", "guides", "setup.md"), "Set it up.\n");
      writeFileSync(join(repo, "docs", "notes.txt"), "Not a page.\n");
      writeFileSync(join(repo, "docs", "long.md"), "# Long\n" + "x".repeat(300 * 1024));
    },
  });

  const state = stateOf(opened.server, "wiki");
  expect(state?.problems).toEqual([]);
  expect(state?.state).toBe("on");
  const bundle = opened.server.extensions.pageBundle("wiki")!;
  expect(bundle.css).toContain("var(--spacing-4)");
  // Break: a page that throws as it registers, or registers no place, fails here.
  expect(register(bundle)).toEqual([
    [
      "place",
      expect.objectContaining({ icon: "uraeda:book-open", id: "wiki", key: "w", title: "Wiki" }),
    ],
  ]);
  const [record] = await records(opened.server, "uraeda", ["wiki/pages"]);
  expect(record.error).toBeNull();
  const wiki = JSON.parse(record.value) as { pages: Array<{ path: string; text: string }> };
  const long = wiki.pages.at(-1)!;
  expect({ ...wiki, pages: wiki.pages.slice(0, -1) }).toEqual({
    folder: "docs",
    isMissing: false,
    pages: [
      { path: "guides/setup.md", text: "Set it up.\n", title: "guides/setup" },
      { path: "index.md", text: "# Welcome\n\nThe wiki's first page.\n", title: "Welcome" },
    ],
  });
  expect(long.path).toBe("long.md");
  expect(long.text.length).toBeLessThan(257 * 1024);
  expect(long.text).toMatch(/\*This page is cut at 256 KB: open its file for the rest\.\*\n$/);
});
