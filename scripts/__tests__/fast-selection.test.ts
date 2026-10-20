import { execFileSync } from "node:child_process";
import { existsSync, globSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, matchesGlob, relative } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { fastConfig } from "../../vite.fast.config.ts";
import {
  changedFiles,
  families,
  type Family,
  rustCommands,
  selectFast,
  unproven,
} from "../fast-selection.ts";

const folders: Array<string> = [];
afterEach(() =>
  folders.splice(0).forEach((path) => rmSync(path, { force: true, recursive: true })),
);
function git(root: string, ...args: Array<string>) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}
function repository() {
  const root = mkdtempSync(join(tmpdir(), "fast-selection-"));
  folders.push(root);
  git(root, "init", "-q");
  git(root, "config", "user.email", "test@example.com");
  git(root, "config", "user.name", "Test");
  writeFileSync(join(root, "first.txt"), "one");
  commit(root);
  return root;
}
function commit(root: string) {
  git(root, "add", "-A");
  git(root, "commit", "-qm", "fixture");
}
const change = (path: string, deleted = false, added = false) => ({ added, deleted, path });

test("initial commit and clean-tree latest commit are checked", () => {
  const root = repository();
  expect(changedFiles(root)).toEqual([change("first.txt", false, true)]);
  writeFileSync(join(root, "second.txt"), "two");
  commit(root);
  expect(changedFiles(root)).toEqual([change("second.txt", false, true)]);
});
test("explicit bases include committed, staged, unstaged and untracked whitespace paths", () => {
  const root = repository();
  const base = git(root, "rev-parse", "HEAD").trim();
  writeFileSync(join(root, "committed file.txt"), "two");
  commit(root);
  writeFileSync(join(root, "staged\tfile.txt"), "three");
  git(root, "add", "-A");
  writeFileSync(join(root, "first.txt"), "changed");
  writeFileSync(join(root, "untracked\nfile.txt"), "four");
  expect(
    changedFiles(root, base)
      .map(({ path }) => path)
      .sort(),
  ).toEqual(["committed file.txt", "staged\tfile.txt", "first.txt", "untracked\nfile.txt"].sort());
});
test("invalid explicit base and non-repository errors never become empty success", () => {
  const root = repository();
  expect(() => changedFiles(root, "missing-base")).toThrow();
  expect(() => changedFiles(tmpdir())).toThrow();
});
test("rename retains old deletion and new path, including whitespace", () => {
  const root = repository();
  git(root, "mv", "first.txt", "renamed file.txt");
  expect(changedFiles(root)).toEqual([
    change("first.txt", true),
    change("renamed file.txt", false, true),
  ]);
});
test("Composer chooses related focused UI without App, Rust or native prerequisites", () => {
  const selected = selectFast([change("packages/web/src/Composer.tsx")]);
  expect(selected.related).toContain("packages/web/src/Composer.tsx");
  expect(selected.families).toEqual([]);
  expect(selected.rust).toEqual([]);
  expect(selected.checks).toContain("ts:check");
  expect(selected.checks).not.toContain("binding:touch");
  expect(selected.deferred).toEqual(
    expect.arrayContaining([
      "application journeys",
      "browser phone/desktop",
      "production builds/package smoke",
    ]),
  );
});
test.each(["skills/uraeda/SKILL.md", "crates/core/src/lib.rs", "Cargo.lock"])(
  "%s selects real contracts and Rust",
  (path) => {
    const selected = selectFast([change(path)]);
    expect(selected.families).toContain("binding");
    expect(selected.rust).toContain("uraeda-core");
    expect(selected.checks).toContain("binding:touch");
  },
);
test.each([
  "packages/web/src/deleted.ts",
  "packages/web/src/types.d.ts",
  "packages/web/vite.config.ts",
])("deletion/declaration/config broadens %s", (path) => {
  const selected = selectFast([change(path, path.includes("deleted"))]);
  expect(selected.families).toContain("ui");
});
test("fixtures broaden consumers; unknown tests and config require ready", () => {
  expect(selectFast([change("fixtures/round/spec.md")]).families).toContain("binding");
  expect(
    selectFast([change("packages/web/src/__tests__/new.test.tsx", false, true)]).checks,
  ).toContain("ready");
  expect(selectFast([change("new-runtime.bin")]).checks).toContain("ready");
  expect(selectFast([change("vite.fast.config.ts")]).families).toContain("ui");
});
test("documentation gets format and spec validation without native consumers", () => {
  const selected = selectFast([change("README.md")]);
  expect(selected.checks).toEqual(["ts:check", "specs:check"]);
  expect(selected.related).toEqual([]);
  expect(selected.families).toEqual([]);
  expect(selected.rust).toEqual([]);
});

const projects = (path: string) =>
  fastConfig(selectFast([change(path)])).test.projects.map((project) => project.test?.name);
test.each([
  ["scripts/test-run.ts", "fast-server"],
  ["scripts/coverage-summary.ts", "fast-server"],
  ["packages/binding/test-utils.ts", "fast-ui"],
  ["packages/server/src/limits.ts", "fast-ui"],
  ["packages/server/src/runner/round-messages.ts", "fast-ui"],
  ["packages/server/src/__tests__/request-fixture.ts", "fast-ui"],
])("an edit of %s reaches its consumers in %s", (path, project) =>
  expect(projects(path)).toContain(project),
);
test("a Composer edit instantiates the UI family only", () =>
  expect(projects("packages/web/src/Composer.tsx")).toEqual(["fast-ui"]));

const ROOT = join(import.meta.dirname, "../..");
/** The file a workspace package's export or a relative specifier names, if it is one. */
function resolved(from: string, specifier: string): string | undefined {
  const bare = specifier.replace(/\?.*$/, "");
  const [, name, sub] = /^(uraeda-[a-z]+)(\/.*)?$/.exec(bare) ?? [];
  if (name) {
    const folder = { "uraeda-binding": "binding", "uraeda-server": "server" }[name];
    if (!folder) {
      return undefined;
    }
    const manifest = JSON.parse(
      readFileSync(join(ROOT, "packages", folder, "package.json"), "utf8"),
    );
    const target = manifest.exports[sub ? `.${sub}` : "."];
    return join("packages", folder, typeof target === "string" ? target : target.default);
  }
  const path = bare.startsWith(".") ? relative(ROOT, join(ROOT, dirname(from), bare)) : undefined;
  return path && existsSync(join(ROOT, path)) && /\.[cm]?[jt]sx?$/.test(path) ? path : undefined;
}
/** Every file a family's sources reach through imports, outside its root, transitively. */
function reached(name: Family): Array<string> {
  const { root } = families[name];
  const queue = globSync(`${root}/**/*.{ts,tsx,js,mjs}`, {
    cwd: ROOT,
    exclude: (path) =>
      /(^|\/)(node_modules|dist|storybook-static)$|^packages\/uraeda\/(plugin|web)$/.test(path),
  });
  const seen = new Set(queue);
  const outside = new Set<string>();
  for (const file of queue) {
    const text = readFileSync(join(ROOT, file), "utf8");
    for (const [, specifier] of text.matchAll(/(?:\bfrom|\bimport\(?)\s*["']([^"'\n]+)["']/g)) {
      const path = resolved(file, specifier);
      if (path && !seen.has(path)) {
        seen.add(path);
        queue.push(path);
        if (!path.startsWith(`${root}/`)) {
          outside.add(path);
        }
      }
    }
  }
  return [...outside].sort();
}
test.each(Object.keys(families) as Array<Family>)(
  "every file the %s family's sources import outside its root is one of its inputs",
  (name) =>
    expect(
      reached(name).filter(
        (path) => !families[name].inputs.some((input) => matchesGlob(path, input)),
      ),
    ).toEqual([]),
);

test("a core change checks and tests its reverse dependents, and clippy alone checks the binding", () => {
  expect(selectFast([change("crates/core/src/settings.rs")]).rust.sort()).toEqual([
    "uraeda-binding",
    "uraeda-cli",
    "uraeda-core",
    "uraeda-lsp",
  ]);
  expect(selectFast([change("crates/lsp/src/lib.rs")]).rust.sort()).toEqual([
    "uraeda-cli",
    "uraeda-lsp",
  ]);
  const binding = rustCommands(selectFast([change("crates/binding/src/lib.rs")]).rust);
  const clippy = binding.find(([, args]) => args[0] === "clippy")![1];
  const nextest = binding.find(([, args]) => args[0] === "nextest")![1];
  expect(clippy).toEqual(expect.arrayContaining(["-p", "uraeda-binding"]));
  expect(nextest).not.toContain("uraeda-binding");
  expect(nextest).toEqual(expect.arrayContaining(["-p", "uraeda-core", "-p", "uraeda-cli"]));
});
test("the reverse dependents follow the workspace's manifests", () => {
  const metadata = JSON.parse(
    execFileSync("cargo", ["metadata", "--no-deps", "--format-version", "1"], {
      cwd: ROOT,
      encoding: "utf8",
    }),
  ) as { packages: Array<{ dependencies: Array<{ name: string }>; name: string }> };
  for (const { name } of metadata.packages) {
    const selected = selectFast([change(`crates/${name.replace(/^uraeda-/, "")}/src/lib.rs`)]);
    for (const dependent of metadata.packages) {
      if (dependent.dependencies.some((dependency) => dependency.name === name)) {
        expect(selected.rust, `${dependent.name} depends on ${name}`).toContain(dependent.name);
      }
    }
  }
});
test.each([["workspace"], ["uraeda-core"], ["uraeda-binding", "uraeda-core"]])(
  "fast's nextest never selects the workspace or the binding (%s)",
  (...rust) => {
    const commands = rustCommands(rust);
    const nextest = commands.find(([, args]) => args[0] === "nextest")![1];
    expect(nextest).not.toContain("--workspace");
    expect(nextest).not.toContain("uraeda-binding");
    if (rust.includes("workspace")) {
      expect(commands.find(([, args]) => args[0] === "clippy")![1]).toContain("--workspace");
    }
  },
);
test("the focused UI project keeps the web tests' isolation and page settings", () => {
  const ui = fastConfig(selectFast([change("packages/web/src/Composer.tsx")])).test.projects[0];
  expect(ui.test?.setupFiles).toContain(join(ROOT, "packages/binding/test-setup.ts"));
  expect(ui.test?.environmentOptions).toEqual({
    happyDOM: { settings: { disableIframePageLoading: true }, url: "http://127.0.0.1:4310/" },
  });
});
test("an edit of an existing test outside fast is deferred to ready by name", () => {
  const path = "packages/web/src/__tests__/app.test.tsx";
  const edited = selectFast([change(path)]);
  expect(edited.checks).not.toContain("ready");
  expect(edited.deferred).toContain(`existing test ${path}`);
  expect(selectFast([change(path, true)]).checks).not.toContain("ready");
  expect(selectFast([change(path, false, true)]).checks).toContain("ready");
});
test("only known configuration files broaden every family", () => {
  const source = selectFast([change("crates/core/src/config.rs")]);
  expect(source.rust).not.toContain("workspace");
  expect(source.families).toEqual(["binding"]);
  for (const path of ["tsconfig.json", "tsconfig.base.json", "vite.config.ts", "package.json"]) {
    expect(selectFast([change(path)]).rust, path).toContain("workspace");
  }
  expect(selectFast([change("packages/web/tsconfig.json")]).families).toContain("ui");
});
test("a selected family whose tests were not discovered fails the run", () => {
  expect(unproven(["ui", "binding"], ["fast-ui"])).toEqual(["binding"]);
  expect(unproven(["ui"], ["fast-ui", "fast-server"])).toEqual([]);
});
