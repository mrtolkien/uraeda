import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { git } from "./git.ts";
import { run } from "./run-command.ts";

/**
 * The project's `specs/` folder as the run left it, with the feature's own folder as it was before
 * the finish step replaced it with its record: the spec the judge reads, and the files the run
 * keeps, are the folder's, not the record's. Copied into `into/specs`, which is returned.
 */
export async function featureSnapshot(
  repo: string,
  feature: string,
  into: string,
): Promise<string> {
  const specs = join(into, "specs");
  mkdirSync(into, { recursive: true });
  cpSync(join(repo, "specs"), specs, { recursive: true });
  if (existsSync(join(repo, "specs", feature, "spec.md"))) {
    return specs;
  }
  const removed = (
    await git(repo, [
      "log",
      "-1",
      "--format=%H",
      "--diff-filter=D",
      "--",
      `specs/${feature}/proposal.md`,
    ])
  ).trim();
  if (removed !== "") {
    const archive = join(into, "feature.tar");
    await git(repo, ["archive", "-o", archive, `${removed}^`, `specs/${feature}`]);
    await run("tar", ["-x", "-C", into, "-f", archive]);
  }
  return specs;
}
