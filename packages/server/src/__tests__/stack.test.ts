import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

const packages = fileURLToPath(new URL("../../..", import.meta.url));
const PARSERS = [
  "marked",
  "markdown-it",
  "remark",
  "micromark",
  "react-markdown",
  "mdast",
  "unified",
];

function files(dir: string): Array<string> {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** SC-004 */
test("no package depends on a markdown parser, and no source imports one", () => {
  for (const name of readdirSync(packages)) {
    const manifest = JSON.parse(
      readFileSync(join(packages, name, "package.json"), "utf8"),
    ) as Record<string, Record<string, string> | undefined>;
    const dependencies = Object.keys({
      ...manifest.dependencies,
      ...manifest.devDependencies,
    });
    expect(
      dependencies.filter((d) => PARSERS.some((p) => d === p || d.startsWith(`${p}-`))),
    ).toEqual([]);
    const source = join(packages, name, "src");
    for (const file of statSync(source, { throwIfNoEntry: false }) ? files(source) : []) {
      const text = readFileSync(file, "utf8");
      for (const parser of [...PARSERS, "@astryxdesign/core/Markdown"]) {
        expect(text.includes(`from "${parser}`), `${file} imports ${parser}`).toBe(false);
      }
    }
  }
});

/** SC-005 */
test("under a coarse pointer, Astryx's elements are 44 px tall", () => {
  const css = readFileSync(join(packages, "web/src/styles.css"), "utf8");
  const rule = /@media \(pointer: coarse\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";

  for (const size of ["sm", "md", "lg"]) {
    expect(rule).toContain(`--size-element-${size}: 44px;`);
  }
});
