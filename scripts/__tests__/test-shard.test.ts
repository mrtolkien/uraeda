import { expect, test } from "vite-plus/test";
import { slice } from "../test-shard.ts";

const weights: Record<string, number> = { a: 150, b: 60, c: 50, d: 40, e: 30, f: 5, g: 5 };
const weigh = (file: string) => ({ key: file, weight: weights[file] ?? 5 });
const files = Object.keys(weights);

test("the slices together hold every file, once", () => {
  for (const count of [1, 2, 3, 4, 7, 9]) {
    const slices = Array.from({ length: count }, (_, index) =>
      slice(files, weigh, index + 1, count),
    );
    expect(slices.flat().toSorted()).toEqual(files.toSorted());
  }
});

test("the heaviest file has a slice to itself when it outweighs the rest's share", () => {
  expect(slice(files, weigh, 1, 3)).toEqual(["a"]);
  expect(slice(files, weigh, 2, 3)).toEqual(["b", "e", "f"]);
  expect(slice(files, weigh, 3, 3)).toEqual(["c", "d", "g"]);
});

test("the split does not depend on the files' order", () =>
  expect(slice(files.toReversed(), weigh, 2, 3)).toEqual(slice(files, weigh, 2, 3)));
