import { basename, join } from "node:path";
import { readToml } from "./suite.ts";

/** One task: `benchmarks/cases/<case-id>/case.toml`, and its `proposal.md`. */
export type Case = {
  id: string;
  /** The image, with its digest. */
  image: string;
  proposal: string;
  /** Where the repository sits in the image. */
  repository: string;
  source: string;
  task: string;
  /** The task's upstream repository, which runs must not read. */
  upstream: string;
};

const FIELDS = ["source", "task", "image", "upstream", "repository"] as const;

export function readCase(folder: string): Case {
  const table = readToml(join(folder, "case.toml"));
  for (const name of FIELDS) {
    if (typeof table[name] !== "string") {
      throw new Error(`${name}: expected text`);
    }
  }
  return {
    id: basename(folder),
    image: table.image as string,
    proposal: join(folder, "proposal.md"),
    repository: table.repository as string,
    source: table.source as string,
    task: table.task as string,
    upstream: table.upstream as string,
  };
}

/**
 * Rejects a case whose repository already has a `specs/` folder, which would confuse the flow.
 * `list` gives the names in a folder of the case's image.
 */
export async function checkCase(
  found: Case,
  list: (image: string, path: string) => Promise<Array<string>>,
): Promise<void> {
  const names = await list(found.image, found.repository);
  if (names.includes("specs")) {
    throw new Error(`${found.id}: its repository has a specs/ folder`);
  }
}
