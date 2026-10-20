import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { changedFiles, selectFast } from "../fast-selection.ts";

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
const change = (path: string, deleted = false) => ({ deleted, path });

test("initial commit and clean-tree latest commit are checked", () => {
  const root = repository();
  expect(changedFiles(root)).toEqual([change("first.txt")]);
  writeFileSync(join(root, "second.txt"), "two");
  commit(root);
  expect(changedFiles(root)).toEqual([change("second.txt")]);
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
  expect(changedFiles(root)).toEqual([change("first.txt", true), change("renamed file.txt")]);
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
  expect(selectFast([change("packages/web/src/__tests__/new.test.tsx")]).checks).toContain("ready");
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
