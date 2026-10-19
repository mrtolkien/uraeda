import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { git } from "./git.ts";

/** The skill's folder in this repository, which the plugin carries as it was at a commit. */
const SKILL = "skills/uraeda";

/**
 * Builds the plugin folder a run loads, named `uraeda`, from `git archive` of `commit`: never from
 * the working tree. `dirty` says whether the working tree's skill differs from the commit, which the
 * record shows, and which does not stop the run.
 */
export async function snapshotSkill(options: {
  commit: string;
  into: string;
  repository: string;
}): Promise<{ commit: string; dirty: boolean; pluginDir: string }> {
  const commit = (
    await git(options.repository, ["rev-parse", "--verify", `${options.commit}^{commit}`])
  ).trim();
  const pluginDir = join(options.into, "uraeda");
  const skills = join(pluginDir, "skills");
  mkdirSync(skills, { recursive: true });
  mkdirSync(join(pluginDir, ".claude-plugin"), { recursive: true });
  writeFileSync(join(pluginDir, ".claude-plugin", "plugin.json"), '{ "name": "uraeda" }\n');
  await new Promise<void>((resolve, reject) => {
    // `git archive <commit> skills/uraeda | tar -x -C <pluginDir>`, with the skill's path kept.
    const archive = execFile(
      "git",
      ["archive", commit, SKILL],
      { cwd: options.repository, encoding: "buffer", maxBuffer: 256 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`git archive: ${stderr.toString().trim() || error.message}`));
          return;
        }
        const tar = execFile("tar", ["-x", "-C", pluginDir], (tarError) =>
          tarError ? reject(tarError) : resolve(),
        );
        tar.stdin?.end(stdout);
      },
    );
    archive.on("error", reject);
  });
  const status = await git(options.repository, ["status", "--porcelain", "--", SKILL]);
  const changed = await git(options.repository, ["diff", "--name-only", commit, "--", SKILL]);
  return { commit, dirty: status.trim() !== "" || changed.trim() !== "", pluginDir };
}
