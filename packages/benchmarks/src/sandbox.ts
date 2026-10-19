import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Case } from "./case.ts";
import { makeConfigDir, upstreamHosts } from "./config-dir.ts";
import { writeWrapper } from "./docker-wrapper.ts";
import { git } from "./git.ts";
import { run } from "./run-command.ts";

/** What a run's agent works in. */
export type Sandbox = {
  /** The bare repository the agent pushes to, as `origin`. */
  bareOrigin: string;
  /** The commit the image's repository was at, before the project's specs: the diff's base. */
  base: string;
  close(): Promise<void>;
  /** The adapter's `command`: Claude Code in the case's image. */
  command: string;
  /** Claude Code's configuration folder for the run. */
  configDir: string;
  /** What the runner sets in its own environment, for the sessions it runs on the host. */
  env: { CLAUDE_CONFIG_DIR: string };
  /** The host copy of the case's repository, mounted at `/app`. */
  repo: string;
};

export type SandboxOptions = {
  case: Case;
  /** Claude Code's binary on this machine, mounted into the container. */
  claude: string;
  /** The constitution file the project gets, which a human wrote. */
  constitution: string;
  effort: string;
  model: string;
  /** Whether the project gets a `specs/` folder and a constitution: the plain arm has none. */
  specs?: boolean;
  /** A folder of this run's, which `close` removes. Made when missing. */
  work?: string;
};

/**
 * Copies the case's repository out of its image, gives it a `specs/` folder, a constitution, and a
 * bare `origin`, and makes the wrapper and the configuration folder. `close` removes the
 * containers and the folders on success, failure, and cancellation alike.
 */
export async function prepareSandbox(options: SandboxOptions): Promise<Sandbox> {
  const work = options.work ?? mkdtempSync(join(tmpdir(), "benchmarks-run-"));
  mkdirSync(work, { recursive: true });
  const label = work.split("/").at(-1) ?? "run";
  const repo = join(work, "repo");
  const bareOrigin = join(work, "origin.git");
  const close = async () => {
    await run("sh", [
      "-c",
      `docker ps -aq --filter label=benchmark-run=${label} | xargs -r docker rm -f`,
    ]).catch(() => {});
    rmSync(work, { force: true, recursive: true });
  };
  try {
    await copyRepository(options.case, repo, label);
    const base = await prepareGit(
      repo,
      bareOrigin,
      options.specs === false ? undefined : options.constitution,
    );
    const configDir = makeConfigDir({
      deniedHosts: upstreamHosts(options.case.upstream),
      effort: options.effort,
      folder: join(work, "config"),
      model: options.model,
    });
    const command = writeWrapper({
      bareOrigin,
      claude: options.claude,
      configDir,
      image: options.case.image,
      label,
      path: join(work, "claude-in-image"),
      repository: repo,
    });
    return {
      bareOrigin,
      base,
      close,
      command,
      configDir,
      env: { CLAUDE_CONFIG_DIR: configDir },
      repo,
    };
  } catch (error) {
    await close();
    throw error;
  }
}

/** The repository's files out of the image, through a container that never runs. */
async function copyRepository(found: Case, repo: string, label: string): Promise<void> {
  const created = (
    await run("docker", ["create", "--label", `benchmark-run=${label}`, found.image, "true"])
  ).trim();
  try {
    mkdirSync(repo, { recursive: true });
    await run("docker", ["cp", `${created}:${found.repository}/.`, repo]);
  } finally {
    await run("docker", ["rm", "-f", created]).catch(() => {});
  }
}

/**
 * A repository at its base commit with the project's specs, and `origin` a bare repository the
 * agent can push to. The feature starts in this checkout, not a worktree: a worktree's absolute
 * paths would not hold in the container's mount.
 */
async function prepareGit(
  repo: string,
  bareOrigin: string,
  constitution: string | undefined,
): Promise<string> {
  const fresh = !existsSync(join(repo, ".git"));
  if (fresh) {
    await git(repo, ["init", "-q", "-b", "main"]);
  }
  await git(repo, ["config", "user.name", "benchmark"]);
  await git(repo, ["config", "user.email", "benchmark@example.com"]);
  if (fresh) {
    await git(repo, ["add", "-A"]);
    await git(repo, ["commit", "-q", "--allow-empty", "-m", "base"]);
  }
  const base = (await git(repo, ["rev-parse", "HEAD"])).trim();
  if (constitution !== undefined) {
    await run("ura", ["init", "--no-input"], repo);
    copyFileSync(constitution, join(repo, "specs/CONSTITUTION.md"));
    await git(repo, ["add", "specs"]);
    await git(repo, ["commit", "-q", "-m", "specs"]);
  }
  await git(bareOrigin.replace(/\/[^/]*$/, ""), ["init", "-q", "--bare", bareOrigin]);
  await git(repo, ["remote", "add", "origin", bareOrigin]);
  const branch = (await git(repo, ["branch", "--show-current"])).trim();
  await git(repo, ["push", "-q", "origin", branch]);
  return base;
}
