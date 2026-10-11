import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../../fixtures");

/** A path inside the repository's shared `fixtures/` folder. */
export function fixture(path: string): string {
  // Not `new URL(path, import.meta.url)`: Vite rewrites that pattern in the UI's tests.
  return join(fixtures, path);
}

/** Runs git in a folder, without hooks, and returns its output. */
export function git(cwd: string, ...args: Array<string>): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/**
 * A git repository in a temporary folder, built from `fixtures/<name>/`: `main/` committed on
 * `main`, then each folder of `branches/` committed on a branch of its name, from `main`. The
 * checkout is left on `main`.
 */
export function fixtureRepo(name = "repo"): string {
  const source = fixture(name);
  const repo = realpathSync(mkdtempSync(join(tmpdir(), "uraeda-repo-")));
  git(repo, "init", "--quiet", "--initial-branch", "main");
  for (const [key, value] of [
    ["user.name", "Test"],
    ["user.email", "test@example.com"],
    ["commit.gpgSign", "false"],
  ]) {
    git(repo, "config", key, value);
  }
  cpSync(join(source, "main"), repo, { recursive: true });
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "chore: specs");
  const branches = join(source, "branches");
  for (const branch of existsSync(branches) ? readdirSync(branches).sort() : []) {
    git(repo, "switch", "--quiet", "--create", branch, "main");
    cpSync(join(branches, branch), repo, { recursive: true });
    git(repo, "add", "--all");
    git(repo, "commit", "--quiet", "--no-verify", "--message", `work on ${branch}`);
    git(repo, "switch", "--quiet", "main");
  }
  return repo;
}
