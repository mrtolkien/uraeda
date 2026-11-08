// The documentation's example, `examples/extensions/wiki/`, as a server loads it: its server code
// and its page compile and run with no problem, and its record lists the Markdown files of a
// repository's `docs/` folder, through the `folder` setting's default.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "vite-plus/test";
import { records, serve, stateOf } from "./serve.ts";

/** The example's folder, in the checkout. */
const EXAMPLE = resolve(import.meta.dirname, "../../../../../examples/extensions/wiki");

/** The example's files, by name. */
function exampleFiles(): Record<string, string> {
  return Object.fromEntries(
    readdirSync(EXAMPLE).map((file) => [file, readFileSync(join(EXAMPLE, file), "utf8")]),
  );
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
    },
  });

  const state = stateOf(opened.server, "wiki");
  expect(state?.problems).toEqual([]);
  expect(state?.state).toBe("on");
  expect(opened.server.extensions.pageBundle("wiki")?.css).toContain("var(--spacing-4)");
  const [record] = await records(opened.server, "uraeda", ["wiki/pages"]);
  expect(record.error).toBeNull();
  expect(JSON.parse(record.value)).toEqual({
    folder: "docs",
    isMissing: false,
    pages: [
      { path: "guides/setup.md", text: "Set it up.\n", title: "guides/setup" },
      { path: "index.md", text: "# Welcome\n\nThe wiki's first page.\n", title: "Welcome" },
    ],
  });
});
