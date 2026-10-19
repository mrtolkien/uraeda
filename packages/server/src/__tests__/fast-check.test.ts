// `vp run fast`'s selection, for the US2 scenarios of the fix-testing spec.
import { expect, test } from "vite-plus/test";
import { select } from "../../../../scripts/fast-check.ts";

/** The commands of a plan, each as one line. */
function commands(files: Array<string>, exists?: (file: string) => boolean): Array<string> {
  return select(files, exists).map(({ command }) => command.join(" "));
}

const BINDING_ENTRY = "packages/binding/index.js";

test("a web-only change runs the checks and the web tests that reach it, and no Rust test", () => {
  const plan = commands(["packages/web/src/Composer.tsx"]);
  expect(plan).toContain("vp check");
  expect(
    plan.some((line) => line.startsWith("vp test related packages/web/src/Composer.tsx")),
  ).toBe(true);
  expect(plan.some((line) => line.includes("cargo"))).toBe(false);
  expect(plan.join(" ")).not.toContain(BINDING_ENTRY);
});

test("a core change runs the core's Rust tests and the tests loading the binding", () => {
  const plan = commands(["crates/core/src/steps.rs"]);
  expect(
    plan.some((line) => line.startsWith("cargo nextest run") && line.includes("uraeda-core")),
  ).toBe(true);
  expect(
    plan.some((line) => line.startsWith("vp test related") && line.includes(BINDING_ENTRY)),
  ).toBe(true);
});

test.each(["skills/uraeda/SKILL.md", "fixtures/specs/ok/spec.md", "Cargo.lock"])(
  "a change to %s runs the tests loading the binding",
  (file) => {
    const plan = commands([file]);
    expect(
      plan.some((line) => line.startsWith("vp test related") && line.includes(BINDING_ENTRY)),
    ).toBe(true);
  },
);

test("a change to the task graph or the workflow runs the toolchain test", () => {
  for (const file of ["vite.tasks.ts", ".github/workflows/ci.yml"]) {
    expect(commands([file]).some((line) => line.includes("toolchain.test.ts"))).toBe(true);
  }
});

test("a root config file is not a file to relate tests to, which would run them all", () => {
  expect(commands(["vite.tasks.ts"]).some((line) => line.startsWith("vp test related"))).toBe(
    false,
  );
});

test("a documentation change runs the checks alone", () => {
  expect(commands(["specs/decisions/toolchain.md"])).toEqual(["vp check"]);
});

test("no change still runs the checks", () => {
  expect(commands([])).toEqual(["vp check"]);
});

test("a deleted file is not passed to the related tests, which fail on a path they cannot find", () => {
  const gone = "packages/web/src/Gone.tsx";
  const kept = "packages/web/src/Composer.tsx";
  const plan = commands([gone, kept], (file) => file !== gone);
  expect(plan.some((line) => line.startsWith("vp test related") && line.includes(kept))).toBe(true);
  expect(plan.join(" ")).not.toContain(gone);
});

test("a change that only deletes source files still runs the checks it can", () => {
  expect(commands(["packages/web/src/Gone.tsx"], () => false)).toEqual(["vp check"]);
});

test("a deleted Rust file still runs its crate's tests and the tests loading the binding", () => {
  const plan = commands(["crates/core/src/gone.rs"], () => false);
  expect(plan.some((line) => line.startsWith("cargo nextest run"))).toBe(true);
  expect(plan.some((line) => line.includes(BINDING_ENTRY))).toBe(true);
});

test("a fixtures change runs every crate's Rust tests, which read them, not one crate's", () => {
  expect(commands(["fixtures/specs/ok/spec.md"])).toContain("cargo nextest run");
});

test("a Lua change checks the Neovim plugin's formatting, and a Rust one does not", () => {
  expect(commands(["editors/nvim/lua/uraeda/init.lua"])).toContain("stylua --check editors/nvim");
  expect(commands(["crates/core/src/steps.rs"])).not.toContain("stylua --check editors/nvim");
});
