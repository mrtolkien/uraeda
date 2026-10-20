import { execFileSync } from "node:child_process";
import { matchesGlob } from "node:path";
import { SOURCES } from "../packages/server/src/binding.ts";

/** A changed path; `added` is a path new since the base, untracked ones included. */
export type Change = { added: boolean; deleted: boolean; path: string };
export type FastSelection = {
  checks: Array<string>;
  deferred: Array<string>;
  families: Array<string>;
  related: Array<string>;
  rust: Array<string>;
};

/** What the Rust crates and their tests read: a change runs the core's checks and tests. */
const rustInputs = [...SOURCES.map((path) => `${path}{,/**}`), "fixtures/**"];
/**
 * What the native binding is built or tested from: a change rebuilds it and runs its contracts. The
 * binding package's own files (its loader, declarations and helpers) are no input of the crates, so
 * they do not run the Rust tests.
 */
const nativeInputs = [...rustInputs, "packages/binding/**"];
/** The server's sources and the binding's loaders, which other packages' tests import. */
const server = "packages/server/src/**";
const loaders = "packages/binding/{index.js,test-utils.ts,test-repos.ts}";

/**
 * One owner for test membership, filesystem inputs and optional native prerequisites. A family's
 * inputs are its own files and every file outside its root that its sources import: a test is
 * found from any of them, and the selection test checks the imports against this list.
 */
export const families = {
  benchmarks: {
    inputs: ["packages/benchmarks/**", "benchmarks/**", server, loaders],
    native: true,
    root: "packages/benchmarks",
    tests: ["src/**/*.test.ts"],
  },
  binding: {
    inputs: [...nativeInputs, "packages/server/src/{binding,fresh-binding,paths}.ts"],
    native: true,
    root: "packages/binding",
    tests: ["contracts.test.ts"],
  },
  package: {
    inputs: ["packages/uraeda/**", "packages/server/src/{free-port,paths}.ts"],
    native: false,
    root: "packages/uraeda",
    tests: ["scripts/**/*.test.ts"],
  },
  scripts: {
    inputs: [
      "scripts/**",
      "vite*.ts",
      "packages/web/vite.transforms.ts",
      "packages/server/src/{binding,paths}.ts",
      loaders,
    ],
    native: false,
    root: "scripts",
    tests: ["__tests__/**/*.test.ts"],
  },
  server: {
    inputs: [
      "packages/server/**",
      "fixtures/**",
      loaders,
      "scripts/{coverage-summary,test-policy,test-run}.ts",
      "vite*.ts",
    ],
    native: true,
    root: "packages/server",
    tests: ["src/**/*.test.ts"],
  },
  ui: {
    // The focused tests read the fixtures' images, by path.
    inputs: [
      "packages/web/**",
      server,
      loaders,
      "skills/uraeda/assets/storybook/**",
      "fixtures/images/**",
    ],
    native: false,
    root: "packages/web",
    tests: [
      "src/__focused__/composer.test.tsx",
      "src/__tests__/composer-images.test.tsx",
      "src/__tests__/drop.test.ts",
      "src/__tests__/draft-text.test.ts",
      "src/__tests__/insertLink.test.ts",
      "src/__tests__/keep-place.test.ts",
      "src/__tests__/readLetters.test.ts",
      "src/__tests__/edited.test.ts",
    ],
  },
};
export type Family = keyof typeof families;
const names = Object.keys(families) as Array<Family>;
/** The crates depending on each crate, which its change can break: checked against `cargo metadata`. */
const dependents: Record<string, Array<string>> = {
  "uraeda-core": ["uraeda-binding", "uraeda-cli", "uraeda-lsp"],
  "uraeda-lsp": ["uraeda-cli"],
};
const deferred = [
  "application journeys",
  "browser phone/desktop",
  "production builds/package smoke",
  "full workspace/editor checks",
];
/** The toolchain's configuration files, by name: a source named `config.rs` is not one. */
const config =
  /(?:^|\/)(?:vite[^/]*\.ts|[^/]+\.config\.[cm]?[jt]s|tsconfig[^/]*\.json|package\.json|pnpm-[^/]+|flake\.[^/]+|rust-toolchain\.toml)$/;
export const matches = (path: string, patterns: Array<string>) =>
  patterns.some((pattern) => matchesGlob(path, pattern));

function git(root: string, ...args: Array<string>): string {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
/** Git's NUL records preserve spaces, tabs and newlines; disabling rename detection retains both owners. */
function changes(text: string): Array<Change> {
  const fields = text.split("\0");
  const found: Array<Change> = [];
  for (let index = 0; index + 1 < fields.length; index += 2) {
    found.push({
      added: fields[index] === "A",
      deleted: fields[index] === "D",
      path: fields[index + 1],
    });
  }
  return found;
}

export function changedFiles(root: string, base?: string): Array<Change> {
  const head = git(root, "rev-parse", "--verify", "HEAD").trim();
  const untracked = git(root, "ls-files", "--others", "--exclude-standard", "-z")
    .split("\0")
    .filter(Boolean)
    .map((path) => ({ added: true, deleted: false, path }));
  const from =
    base === undefined
      ? head
      : git(root, "rev-parse", "--verify", "--end-of-options", `${base}^{commit}`).trim();
  let found = changes(git(root, "diff", "--no-renames", "--name-status", "-z", from, "--"));
  if (base === undefined && !found.length && !untracked.length) {
    const parents = git(root, "rev-list", "--parents", "-n", "1", head).trim().split(" ");
    found = parents[1]
      ? changes(git(root, "diff", "--no-renames", "--name-status", "-z", parents[1], head, "--"))
      : changes(
          git(
            root,
            "diff-tree",
            "--root",
            "--no-commit-id",
            "--no-renames",
            "--name-status",
            "-r",
            "-z",
            head,
          ),
        );
  }
  return [...found, ...untracked].sort((a, b) => a.path.localeCompare(b.path));
}

/** Unknown or non-importable inputs broaden rather than disappearing from a successful run. */
export function selectFast(changed: Array<Change>): FastSelection {
  const whole = new Set<Family>();
  const related = new Set<string>();
  const rust = new Set<string>();
  const checks = new Set(["ts:check"]);
  const named = [...deferred];
  for (const { added, deleted, path } of changed) {
    const native = matches(path, nativeInputs);
    if (path.endsWith(".md")) {
      checks.add("specs:check");
    }
    if (path === "Cargo.toml" || path === "Cargo.lock") {
      rust.add("workspace");
    }
    const owners = names.filter((name) => matches(path, families[name].inputs));
    if (native) {
      whole.add("binding");
    }
    if (matches(path, rustInputs)) {
      rust.add("uraeda-core");
    }
    if (path.startsWith("crates/")) {
      rust.add(`uraeda-${path.split("/")[1]}`);
    }
    const broad =
      deleted || path.endsWith(".d.ts") || config.test(path) || !/\.[cm]?[jt]sx?$/.test(path);
    if (config.test(path) && !path.startsWith("packages/")) {
      names.forEach((name) => whole.add(name));
      rust.add("workspace");
    } else if (owners.length) {
      owners.forEach((name) => (broad ? whole.add(name) : related.add(path)));
    } else if (path.endsWith(".md")) {
      checks.add("specs:check");
    } else if (!path.startsWith("crates/")) {
      names.forEach((name) => whole.add(name));
      checks.add("ready");
    }
    if (
      /\.test\.[jt]sx?$/.test(path) &&
      !names.some((name) =>
        matches(
          path,
          families[name].tests.map((test) => `${families[name].root}/${test}`),
        ),
      )
    ) {
      // A new test would otherwise run nowhere before ready; an existing one runs there.
      if (added) {
        checks.add("ready");
      } else {
        named.push(`existing test ${path}`);
      }
    }
  }
  if (
    [...whole].some((name) => families[name].native) ||
    [...related].some((path) =>
      names.some((name) => families[name].native && matches(path, families[name].inputs)),
    )
  ) {
    checks.add("binding:touch");
  }
  for (const name of rust) {
    dependents[name]?.forEach((dependent) => rust.add(dependent));
  }
  if (rust.size) {
    checks.add("rust:checks");
  }
  return {
    checks: [...checks],
    deferred: named,
    families: [...whole],
    related: [...related],
    rust: [...rust],
  };
}

/**
 * The Rust checks of the selected packages. Clippy checks the binding too, but nextest never builds
 * it: selecting it unifies the core's `napi` feature, and the other crates' tests then fail to link
 * (see the root `Cargo.toml`). The workspace's tests are its default members, as in `rust:test`.
 */
export function rustCommands(rust: Array<string>): Array<[string, Array<string>]> {
  const workspace = rust.includes("workspace");
  const tested = rust.filter((name) => name !== "uraeda-binding");
  const commands: Array<[string, Array<string>]> = [
    ["cargo", ["fmt", "--check"]],
    [
      "cargo",
      [
        "clippy",
        ...(workspace ? ["--workspace"] : rust.flatMap((name) => ["-p", name])),
        "--all-targets",
        "--",
        "-D",
        "warnings",
      ],
    ],
  ];
  if (workspace || tested.length) {
    commands.push([
      "cargo",
      ["nextest", "run", ...(workspace ? [] : tested.flatMap((name) => ["-p", name]))],
    ]);
  }
  return commands;
}

/** The selected whole families none of whose tests was discovered, from the projects' names. */
export function unproven(selected: Array<string>, discovered: Array<string>): Array<string> {
  return selected.filter((name) => !discovered.includes(`fast-${name}`));
}
