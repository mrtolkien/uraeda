import { expect, test } from "vite-plus/test";
import { startingLetters } from "../readLetters.ts";

const OPTIONS = ["A", "B", "C"];

/** The core's `letters`: the same rows as its tests of how an answer starts. */
test("a text starts with the letters the core would read", () => {
  const rows: Array<[string, Array<string>]> = [
    ["B", ["B"]],
    ["B and C: both", ["B", "C"]],
    ["A, B and C", ["A", "B", "C"]],
    ["C, we want it", ["C"]],
    ["B, C and D", ["B"]],
    ["C but not now", []],
    ["A and B are both bad", []],
    ["Because", []],
    ["", []],
  ];
  for (const [text, letters] of rows) {
    expect(startingLetters(text, OPTIONS), text).toEqual(letters);
  }
});
