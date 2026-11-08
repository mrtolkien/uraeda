// What one version's files may import, and which files it may read: compiled straight through
// `compileVersion`, with the real compiler, no loader around it.
import { symlinkSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { compileModule } from "uraeda-binding";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { compileVersion, type Problem } from "../graph.ts";
import { identityPage, writeFiles } from "./helpers.ts";

/** The problems of a version whose files are `files`, its entries `server.ts` and `page.tsx`. */
function problemsOf(
  files: Record<string, string>,
  folder = temporaryFolder("wiki"),
): Array<Problem> {
  writeFiles(folder, files);
  const entries = {
    ...("server.ts" in files ? { server: join(folder, "server.ts") } : {}),
    ...("page.tsx" in files ? { page: join(folder, "page.tsx") } : {}),
  };
  const compiled = compileVersion(
    { folder, ...entries },
    { compileModule, compilePage: identityPage, shared: { react: {} } },
  );
  return "problems" in compiled ? compiled.problems : [];
}

const importing = (specifier: string) =>
  `import x from "${specifier}";\nexport default function activate() {\n  return x;\n}\n`;

test.each([
  ["server", "a shared module", "server.ts", "react", null],
  ["server", "a node: module", "server.ts", "node:path", null],
  [
    "server",
    "a bare module neither shared nor node:",
    "server.ts",
    "lodash",
    `"lodash" cannot be imported: only Uraeda's shared modules, node: modules, and the extension's own files`,
  ],
  [
    "page",
    "a node: module",
    "page.tsx",
    "node:fs",
    `"node:fs" is a server module: a page cannot import it`,
  ],
  ["page", "a bare module, the page runtime's to check", "page.tsx", "lodash", null],
  [
    "server",
    "a missing relative file",
    "server.ts",
    "./lib/gone",
    `"./lib/gone" is not a file of the extension, with .ts, .tsx, /index.ts, or /index.tsx`,
  ],
])("a %s file importing %s", (_, __, file, specifier, message) => {
  const problems = problemsOf({ [file]: importing(specifier) });
  expect(problems).toEqual(message === null ? [] : [{ file, message }]);
});

test("a file over 2 MB is refused before it is read", () => {
  const big = `export default function activate() {}\n// ${"x".repeat(2 * 1024 * 1024)}\n`;
  expect(problemsOf({ "server.ts": big })).toEqual([
    { file: "server.ts", message: "server.ts is over 2 MB" },
  ]);
});

test("an entry that links out of the folder is refused", () => {
  const outside = temporaryFolder("outside");
  writeFiles(outside, { "server.ts": `export default function activate() {}\n` });
  const folder = temporaryFolder("wiki");
  symlinkSync(join(outside, "server.ts"), join(folder, "server.ts"));
  const compiled = compileVersion(
    { folder, server: join(folder, "server.ts") },
    { compileModule, compilePage: identityPage, shared: {} },
  );
  expect(compiled).toEqual({
    missing: [],
    problems: [{ file: "", message: `${join(folder, "server.ts")} leaves the extension's folder` }],
  });
});

test("an import not found gives the paths it was looked for at", () => {
  const folder = temporaryFolder("wiki");
  writeFiles(folder, {
    "lib/other.ts": `export const other = 1;\n`,
    "server.ts": `import { v } from "./lib/v";\nimport { w } from "./w.ts";\nexport default function activate() {\n  return [v, w];\n}\n`,
  });
  const compiled = compileVersion(
    { folder, server: join(folder, "server.ts") },
    { compileModule, compilePage: identityPage, shared: {} },
  );
  expect("missing" in compiled && compiled.missing).toEqual([
    "lib/v.ts",
    "lib/v.tsx",
    "lib/v/index.ts",
    "lib/v/index.tsx",
    "w.ts",
  ]);
});

// Break: the page's imports keyed by the specifier only, which the page runtime resolved against
// the link's own path, not the file it links to.
test("a page's import of a link inside the folder names the file it links to", () => {
  const folder = temporaryFolder("wiki");
  writeFiles(folder, {
    "lib/title.ts": `export const title = "Wiki";\n`,
    "page.tsx": `import { title } from "./alias";\nexport default function page() {\n  return title;\n}\n`,
  });
  symlinkSync(join(folder, "lib", "title.ts"), join(folder, "alias.ts"));
  const compiled = compileVersion(
    { folder, page: join(folder, "page.tsx") },
    { compileModule, compilePage: identityPage, shared: {} },
  );
  expect("page" in compiled && compiled.page?.imports).toEqual({
    "lib/title.ts": {},
    "page.tsx": { "./alias": "lib/title.ts" },
  });
});
