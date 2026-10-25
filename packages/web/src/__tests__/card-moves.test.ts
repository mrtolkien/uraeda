// Review focus 4: a menu's move up, down, to the top, and to the bottom lands where a drag over the
// same screen position would, never between the running entries that show in Ongoing.
import { describe, expect, test } from "vite-plus/test";
import type { PriorityEntry } from "uraeda-server/fate";
import { fileIndex, moveIndex, movesOf } from "../lists/cardMoves.ts";

/** Entries of a section in file order: a letter each, running or not. */
function entries(...keys: ReadonlyArray<string>): ReadonlyArray<PriorityEntry> {
  return keys.map(
    (key) => ({ key, running: key.endsWith("*") ? { step: "plan" } : undefined }) as PriorityEntry,
  );
}

// On screen the running B* is apart, in Ongoing: A, C, D show in Now.
const SECTION = entries("a", "b*", "c", "d");

describe("moveIndex", () => {
  test("up, down, top, and bottom skip the running entries that show in Ongoing", () => {
    // D up lands before C, as a drag over C's top does.
    expect(moveIndex(SECTION, "d", "up")).toBe(fileIndex(SECTION, "d", 1));
    expect(moveIndex(SECTION, "d", "up")).toBe(2);
    // A down lands after C: the running B* is no stop.
    expect(moveIndex(SECTION, "a", "down")).toBe(fileIndex(SECTION, "a", 1));
    expect(moveIndex(SECTION, "a", "down")).toBe(2);
    expect(moveIndex(SECTION, "d", "top")).toBe(0);
    expect(moveIndex(SECTION, "a", "bottom")).toBe(fileIndex(SECTION, "a", 2));
    expect(moveIndex(SECTION, "a", "bottom")).toBe(3);
  });

  test("C up with a running entry above it lands before A, not between A and the running entry", () => {
    // On screen A, C, D: C's place above is A's. The file index before A is 0, not C's file place
    // less one.
    expect(moveIndex(SECTION, "c", "up")).toBe(0);
    expect(moveIndex(SECTION, "c", "down")).toBe(fileIndex(SECTION, "c", 2));
    expect(moveIndex(SECTION, "c", "down")).toBe(3);
  });

  test("the first card on screen has nothing above it, and the last nothing below", () => {
    expect(movesOf(SECTION, "a")).toEqual({ down: true, up: false });
    expect(movesOf(SECTION, "c")).toEqual({ down: true, up: true });
    expect(movesOf(SECTION, "d")).toEqual({ down: false, up: true });
    // Alone on screen among running entries: no move changes what shows.
    expect(movesOf(entries("a*", "b"), "b")).toEqual({ down: false, up: false });
  });
});
