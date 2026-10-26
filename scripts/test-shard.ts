// CI's slices of a Vitest run (`--shard`, see `vite.tasks.ts`), balanced by each file's time instead
// of Vitest's hash of its path, which could put the longest files in one slice.
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { BaseSequencer, type TestSpecification } from "vite-plus/test/node";

/**
 * Each test file's seconds on a CI run, by `<project>:<path from the project's root>`, as Vitest's
 * report names it. Only the slices' balance depends on it: a file missing here, a new one, weighs
 * `UNKNOWN` seconds, and every file still runs in exactly one slice.
 */
const WEIGHTS: Record<string, number> = JSON.parse(
  readFileSync(new URL("test-weights.json", import.meta.url), "utf8"),
);
const UNKNOWN = 5;

/** A test file's key in `WEIGHTS`. */
function key(spec: TestSpecification): string {
  return `${spec.project.name}:${relative(spec.project.config.root, spec.moduleId)}`;
}

/**
 * The files of slice `index` of `count`: the heaviest first, each to the lightest slice so far, ties
 * by key, so every slice computes the same split and their union is every file, once.
 */
export function slice<T>(
  files: Array<T>,
  weigh: (file: T) => { key: string; weight: number },
  index: number,
  count: number,
): Array<T> {
  const weighed = files
    .map((file) => ({ file, ...weigh(file) }))
    .toSorted((a, b) => b.weight - a.weight || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const loads = Array.from({ length: count }, () => 0);
  const slices: Array<Array<T>> = Array.from({ length: count }, () => []);
  for (const { file, weight } of weighed) {
    const lightest = loads.indexOf(Math.min(...loads));
    loads[lightest] += weight;
    slices[lightest].push(file);
  }
  return slices[index - 1];
}

/** Vitest's sequencer, slicing by `WEIGHTS` and ordering as Vitest does. */
export class WeightedSequencer extends BaseSequencer {
  override async shard(files: Array<TestSpecification>): Promise<Array<TestSpecification>> {
    const { count, index } = this.ctx.config.shard!;
    return slice(
      files,
      (spec) => ({ key: key(spec), weight: WEIGHTS[key(spec)] ?? UNKNOWN }),
      index,
      count,
    );
  }
}
