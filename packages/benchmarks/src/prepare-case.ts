import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** `owner/repo` of a V2 task's instance ID: `instance_<owner>__<repo>-<commit>-v<hash>`. */
export function upstreamOf(task: string): string {
  const match = /^instance_(.+?)__(.+)-[0-9a-f]{40}/.exec(task);
  if (match === null) {
    throw new Error(`${task}: not a SWE-bench Pro instance ID`);
  }
  return `https://github.com/${match[1]}/${match[2]}`;
}

/**
 * Writes `<root>/cases/<id>/`: its `proposal.md`, the task's instruction word for word, and its
 * `case.toml`, with the image's digest as pulled and where the repository sits in it.
 */
export async function prepareCase(options: {
  docker: (args: Array<string>) => Promise<string>;
  fetchInstruction: (task: string) => Promise<string>;
  id: string;
  root: string;
  task: string;
}): Promise<string> {
  const tag = `ghcr.io/scaleapi/swe-bench_pro-v2:${options.task}`;
  await options.docker(["pull", "-q", tag]);
  const repoDigest = (
    await options.docker(["inspect", "--format", "{{index .RepoDigests 0}}", tag])
  ).trim();
  const repository = (
    await options.docker([
      "run",
      "--rm",
      "--entrypoint",
      "sh",
      tag,
      "-c",
      "test -d /app && echo /app || echo /testbed",
    ])
  ).trim();
  const folder = join(options.root, "cases", options.id);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "proposal.md"), await options.fetchInstruction(options.task));
  writeFileSync(
    join(folder, "case.toml"),
    [
      'source = "swe-bench-pro-v2"',
      `task = "${options.task}"`,
      `image = "${repoDigest}"`,
      `upstream = "${upstreamOf(options.task)}"`,
      `repository = "${repository}"`,
      "",
    ].join("\n"),
  );
  return folder;
}
