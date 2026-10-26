// US3 4: where the keys that move an item send it (R9), as a function of the sections on screen.
import { expect, test } from "vite-plus/test";
import { itemTarget, type Placed } from "../lists/itemMoves.ts";

const section = (id: string, keys: ReadonlyArray<string>, isFixed = false): Placed => ({
  id,
  isFixed,
  rows: keys.map((key) => ({ key })),
});

const SECTIONS = [
  section("ongoing", ["run"], true),
  section("now", ["n1", "n2"]),
  section("next", ["x1", "x2", "x3"]),
  section("later", []),
];

test("K and J move one place within the section, the index among the others once the row is out", () => {
  expect(itemTarget(SECTIONS, "x2", "up")).toEqual({ index: 0, section: "next" });
  expect(itemTarget(SECTIONS, "x2", "down")).toEqual({ index: 2, section: "next" });
});

test("the first row has nowhere up, and the last nowhere down", () => {
  expect(itemTarget(SECTIONS, "x1", "up")).toBeUndefined();
  expect(itemTarget(SECTIONS, "x3", "down")).toBeUndefined();
});

test("L goes to the end of the next section, an empty one too", () => {
  expect(itemTarget(SECTIONS, "n1", "right")).toEqual({ index: 3, section: "next" });
  expect(itemTarget(SECTIONS, "x1", "right")).toEqual({ index: 0, section: "later" });
});

test("H goes to the end of the previous section that takes drops, skipping the ongoing entries", () => {
  expect(itemTarget(SECTIONS, "x1", "left")).toEqual({ index: 2, section: "now" });
  // Now is the first section that takes drops: the ongoing one before it is no target.
  expect(itemTarget(SECTIONS, "n1", "left")).toBeUndefined();
});

test("no section further right, or left, leaves the row where it is", () => {
  expect(itemTarget([section("only", ["a"])], "a", "right")).toBeUndefined();
  expect(itemTarget([section("only", ["a"])], "a", "left")).toBeUndefined();
});

test("a row of a fixed section never moves, with any key", () => {
  for (const move of ["up", "down", "left", "right"] as const) {
    expect(itemTarget(SECTIONS, "run", move), move).toBeUndefined();
  }
});

test("a row nobody shows has no move", () => {
  expect(itemTarget(SECTIONS, "missing", "down")).toBeUndefined();
});

test("an inbox note goes left to 'No category', which comes first, and right to the next category", () => {
  const inbox = [
    section("none", ["d"]),
    section("category:UI", ["a", "b"]),
    section("category:API", []),
  ];
  expect(itemTarget(inbox, "a", "left")).toEqual({ index: 1, section: "none" });
  expect(itemTarget(inbox, "b", "right")).toEqual({ index: 0, section: "category:API" });
  expect(itemTarget(inbox, "d", "left")).toBeUndefined();
});
