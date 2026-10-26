// @vitest-environment node
// Where a key of a list leads. In columns, `j k` stay inside a column, and `h l` go to the same row
// of the neighbouring column, or its last card when it is shorter; Home and End go to the column's
// first and last card. Without columns, they move through the whole list.
import { expect, test } from "vite-plus/test";
import { destination, type Move } from "../lists/destination.ts";

/** The priorities' columns as the keys see them: Now holds four cards, Next five, Later six. */
const NOW = [0, 1, 2, 3];
const NEXT = [4, 5, 6, 7, 8];
const LATER = [9, 10, 11, 12, 13, 14];
const COLUMNS = [NOW, NEXT, LATER];
const COUNT = 15;

test.each<[string, Move, number, number]>([
  ["l: the same row of the next column", "right", 5, 10],
  ["h: the same row of the previous column", "left", 10, 5],
  ["l: the last card, when the next column is shorter", "right", 8, 13],
  ["h: the last card, when the previous column is shorter", "left", 8, 3],
  ["l from the last of a short column: the same row of the next", "right", 3, 7],
  ["h in the first column stays on the card", "left", 2, 2],
  ["l in the last column stays on the card", "right", 12, 12],
  ["from no card, l goes to the first card of the first column", "right", -1, 0],
  ["from no card, h goes to the first card of the first column", "left", -1, 0],
  ["j: the next card of the column", "next", 5, 6],
  ["j stops at the column's last card", "next", 8, 8],
  ["k: the previous card of the column", "previous", 6, 5],
  ["k stops at the column's first card", "previous", 4, 4],
  ["Home: the column's first card", "first", 7, 4],
  ["End: the column's last card", "last", 5, 8],
  ["End in a column of another size", "last", 10, 14],
])("in columns, %s", (_, move, current, to) => {
  expect(destination(move, current, COUNT, COLUMNS)).toBe(to);
});

test.each<[string, Move, number, number]>([
  ["↓: the next card", "next", 0, 1],
  ["↓ stops at the last card", "next", 6, 6],
  ["↑: the previous card", "previous", 2, 1],
  ["↑ stops at the first card", "previous", 0, 0],
  ["from no card, ↓ goes to the first card", "next", -1, 0],
  ["End: the last card", "last", 0, 6],
  ["Home: the first card", "first", 6, 0],
  ["h goes nowhere", "left", 3, -1],
  ["l goes nowhere", "right", 3, -1],
])("in a list without columns, %s", (_, move, current, to) => {
  expect(destination(move, current, 7, undefined)).toBe(to);
});

test("h and l go nowhere in a list of no columns", () => {
  expect(destination("right", 0, 0, [])).toBe(-1);
});
