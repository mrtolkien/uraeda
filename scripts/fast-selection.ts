import { execFileSync } from "node:child_process";
import { matchesGlob } from "node:path";
import { SOURCES } from "../packages/server/src/binding.ts";

export type Change = { deleted: boolean; path: string };
export type FastSelection = {
  checks: Array<string>;
  deferred: Array<string>;
  families: Array<string>;
  related: Array<string>;
  rust: Array<string>;
};

/** One owner for test membership, filesystem inputs and optional native prerequisites. */
export const families = {
  benchmarks: {
    inputs: ["packages/benchmarks/**", "benchmarks/**"],
    native: true,
    root: "packages/benchmarks",
    tests: ["src/**/*.test.ts"],
  },
  binding: {
    inputs: [...SOURCES.map((path) => `${path}{,/**}`), "packages/binding/**", "fixtures/**"],
    native: true,
    root: "packages/binding",
    tests: ["index.test.ts", "contracts.test.ts"],
  },
  package: {
    inputs: ["packages/uraeda/**"],
    native: false,
    root: "packages/uraeda",
    tests: ["scripts/**/*.test.ts"],
  },
  scripts: {
    inputs: ["scripts/**", "vite*.ts"],
    native: false,
    root: "scripts",
    tests: ["__tests__/**/*.test.ts"],
  },
  server: {
    inputs: ["packages/server/**", "fixtures/**"],
    native: true,
    root: "packages/server",
    tests: ["src/**/*.test.ts"],
  },
  ui: {
    inputs: ["packages/web/**"],
    native: false,
    root: "packages/web",
    tests: [
      "src/__tests__/composer.test.tsx",
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
const deferred = [
  "application journeys",
  "browser phone/desktop",
  "production builds/package smoke",
  "full workspace/editor checks",
];
const config =
  /(?:^|\/)(?:vite[^/]*\.ts|.*config\.[^/]+|package\.json|pnpm-[^/]+|flake\.[^/]+|rust-toolchain\.toml)$/;
const matches = (path: string, patterns: Array<string>) =>
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
    found.push({ deleted: fields[index] === "D", path: fields[index + 1] });
  }
  return found;
}

export function changedFiles(root: string, base?: string): Array<Change> {
  const head = git(root, "rev-parse", "--verify", "HEAD").trim();
  const untracked = git(root, "ls-files", "--others", "--exclude-standard", "-z")
    .split("\0")
    .filter(Boolean)
    .map((path) => ({ deleted: false, path }));
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
  for (const { deleted, path } of changed) {
    const native = matches(path, families.binding.inputs);
    if (path.endsWith(".md")) {
      checks.add("specs:check");
    }
    if (path === "Cargo.toml" || path === "Cargo.lock") {
      rust.add("workspace");
    }
    const owners = names.filter((name) => matches(path, families[name].inputs));
    if (native) {
      whole.add("binding");
      rust.add("uraeda-core");
    }
    if (path.startsWith("crates/")) {
      const crate = path.split("/")[1];
      rust.add(crate === "binding" ? "uraeda-core" : `uraeda-${crate}`);
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
      checks.add("ready");
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
  if (rust.size) {
    checks.add("rust:checks");
  }
  return {
    checks: [...checks],
    deferred,
    families: [...whole],
    related: [...related],
    rust: [...rust],
  };
}
