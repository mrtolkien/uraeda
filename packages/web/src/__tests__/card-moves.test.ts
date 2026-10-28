// Review focus 4: a move to a place on screen lands where a drag over the same screen position
// would, never between the running entries that show in Ongoing.
import { describe, expect, test } from "vite-plus/test";
import type { PriorityEntry } from "uraeda-server/fate";
import { fileIndex } from "../lists/cardMoves.ts";

/** Entries of a section in file order: a letter each, running or not. */
function entries(...keys: ReadonlyArray<string>): ReadonlyArray<PriorityEntry> {
  return keys.map(
    (key) => ({ key, running: key.endsWith("*") ? { step: "plan" } : undefined }) as PriorityEntry,
  );
}

// On screen the running B* is apart, in Ongoing: A, C, D show in Now.
const SECTION = entries("a", "b*", "c", "d");

describe("fileIndex", () => {
  test("up, down, top, and bottom skip the running entries that show in Ongoing", () => {
    // D up lands before C, as a drag over C's top does.
    expect(fileIndex(SECTION, "d", 1)).toBe(2);
    // A down lands after C: the running B* is no stop.
    expect(fileIndex(SECTION, "a", 1)).toBe(2);
    expect(fileIndex(SECTION, "d", 0)).toBe(0);
    expect(fileIndex(SECTION, "a", 2)).toBe(3);
  });

  test("C up with a running entry above it lands before A, not between A and the running entry", () => {
    // On screen A, C, D: C's place above is A's. The file index before A is 0, not C's file place
    // less one.
    expect(fileIndex(SECTION, "c", 0)).toBe(0);
    expect(fileIndex(SECTION, "c", 2)).toBe(3);
  });
});
