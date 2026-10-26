import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
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
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

/** SC-004 */
test("no package depends on a markdown parser, and no source imports one", () => {
  // Hidden folders are not packages: building the binding stages its files in one for a moment.
  for (const name of readdirSync(packages).filter((name) => !name.startsWith("."))) {
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
      // The lint fixtures are each a banned pattern, imported to be refused.
      if (file.includes(`${sep}__lint__${sep}`)) {
        continue;
      }
      const text = readFileSync(file, "utf8");
      // The stack decision lets an agent's messages, which are not workflow files, render with
      // Astryx's `Markdown`: `Prose.tsx` alone draws it, for the transcript's messages, and the
      // session's mockups, which show them.
      const agentMessages = ["Transcript.tsx", "Prose.tsx", "SessionMockups.stories.tsx"].some(
        (name) => file.endsWith(join("web", "src", name)),
      );
      for (const parser of [
        ...PARSERS,
        ...(agentMessages ? [] : ["@astryxdesign/core/Markdown"]),
      ]) {
        expect(text.includes(`from "${parser}`), `${file} imports ${parser}`).toBe(false);
      }
    }
  }
});
