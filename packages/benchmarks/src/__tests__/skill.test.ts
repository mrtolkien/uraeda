import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { git } from "../git.ts";
import { snapshotSkill } from "../skill.ts";
import { temporary, write } from "./samples.ts";

/** A repository whose skill says `version`, committed. */
async function repositoryWithSkill(version: string) {
  const repo = temporary("benchmarks-skill-");
  await git(repo, ["init", "-q"]);
  await git(repo, ["config", "user.email", "t@example.com"]);
  await git(repo, ["config", "user.name", "t"]);
  write(join(repo, "skills/uraeda/SKILL.md"), version);
  await git(repo, ["add", "-A"]);
  await git(repo, ["commit", "-q", "-m", "skill"]);
  return { head: (await git(repo, ["rev-parse", "HEAD"])).trim(), repo };
}

const skillIn = (pluginDir: string) =>
  readFileSync(join(pluginDir, "skills/uraeda/SKILL.md"), "utf8");

test("the plugin holds the skill as the commit had it, not the working tree", async () => {
  const { head, repo } = await repositoryWithSkill("v1");
  write(join(repo, "skills/uraeda/SKILL.md"), "v2");

  const { dirty, pluginDir } = await snapshotSkill({
    commit: head,
    into: temporary(),
    repository: repo,
  });

  expect(skillIn(pluginDir)).toBe("v1");
  expect(dirty).toBe(true);
});

test("a clean tree records dirty false and the full commit", async () => {
  const { head, repo } = await repositoryWithSkill("v1");

  const snapshot = await snapshotSkill({ commit: "HEAD", into: temporary(), repository: repo });

  expect({ commit: snapshot.commit, dirty: snapshot.dirty }).toEqual({
    commit: head,
    dirty: false,
  });
  expect(readFileSync(join(snapshot.pluginDir, ".claude-plugin/plugin.json"), "utf8")).toContain(
    '"uraeda"',
  );
});

test("a commit that does not exist is refused", async () => {
  const { repo } = await repositoryWithSkill("v1");

  await expect(
    snapshotSkill({ commit: "nope", into: temporary(), repository: repo }),
  ).rejects.toThrow();
});
