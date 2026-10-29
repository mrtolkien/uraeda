// The walks of an outline's rows (see `lists/nesting.ts`), which the outliner, a drag, the work
// list, and the keys' moves share: each answers as the copy it replaced did.
import { expect, test } from "vite-plus/test";
import {
  ancestorsAt,
  depthByKey,
  depthOf,
  nestedEnd,
  nestedRowsEnd,
  runEnd,
  siblingAbove,
  withNested,
} from "../lists/nesting.ts";

/** Rows at these depths, keyed by their place: `r0`, `r1`, and on. */
const at = (...depths: Array<number>) =>
  depths.map((depth, index) => ({ depth, key: `r${index}` }));

// A line's nested rows, as the outliner holds them: a, its b and c, c's d, then e.
const CHILDREN = at(1, 2, 2, 3, 1);

test("the rows nested under a row run to the next one no deeper", () => {
  expect(nestedEnd(CHILDREN, 0, depthOf)).toBe(4);
  expect(nestedEnd(CHILDREN, 2, depthOf)).toBe(4);
  expect(nestedEnd(CHILDREN, 3, depthOf)).toBe(4);
  // The last row has none, and a place past the rows ends with them.
  expect(nestedEnd(CHILDREN, 4, depthOf)).toBe(5);
  expect(nestedEnd(CHILDREN, 7, depthOf)).toBe(5);
});

test("a run ends at the first row after it that leaves it, or at the end", () => {
  expect(runEnd(["a", "a", "b", "a"], 0, (one) => one === "a")).toBe(2);
  expect(runEnd(["a", "a", "a"], 0, (one) => one === "a")).toBe(3);
});

test("a work list's row's nested rows stop at a row of another line, whatever its depth", () => {
  const rows = [
    { key: "one" },
    { depth: 1, key: "one-a", parent: "one" },
    { depth: 2, key: "one-b", parent: "one" },
    { depth: 2, key: "two-a", parent: "two" },
    { key: "two" },
  ];
  expect(nestedRowsEnd(rows, 0)).toBe(3);
  expect(nestedRowsEnd(rows, 1)).toBe(3);
  expect(nestedRowsEnd(rows, 2)).toBe(3);
  expect(nestedRowsEnd(rows, 4)).toBe(5);
});

test("a row's ancestors are the nearest above it each a level less deep, down to the top", () => {
  expect(ancestorsAt(CHILDREN, 3, 1).map((row) => row.key)).toEqual(["r2", "r0"]);
  expect(ancestorsAt(CHILDREN, 4, 1)).toEqual([]);
  // From the lines: a line is the last ancestor of its rows.
  const lines = at(0, 1, 2, 0, 1);
  expect(ancestorsAt(lines, 2).map((row) => row.key)).toEqual(["r1", "r0"]);
  expect(ancestorsAt(lines, 4).map((row) => row.key)).toEqual(["r3"]);
});

test("a row's sibling above is the nearest at its depth, none past a row less deep", () => {
  expect(siblingAbove(CHILDREN, 2, 2)).toBe(1);
  expect(siblingAbove(CHILDREN, 4, 1)).toBe(0);
  expect(siblingAbove(CHILDREN, 1, 2)).toBe(-1);
  expect(siblingAbove(CHILDREN, 3, 3)).toBe(-1);
});

test("a key's depth is its row's, 0 for a line and for a key of no row", () => {
  const depth = depthByKey(
    new Map([
      ["a", { depth: 2 }],
      ["b", {}],
    ]),
  );
  expect([depth("a"), depth("b"), depth("c")]).toEqual([2, 0, 0]);
});

test("rows with their nested rows are each followed by them", () => {
  const rows = [{ children: [{ key: "a1" }], key: "a" }, { key: "b" }];
  expect(withNested(rows).map((row) => row.key)).toEqual(["a", "a1", "b"]);
});
