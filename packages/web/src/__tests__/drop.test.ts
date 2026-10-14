import { expect, test } from "vite-plus/test";
import { dropIndex, dropMove } from "../PrioritiesPage.tsx";

/** Review I5: a line dropped above another lands just above it, in either direction. */
test("a line dropped above another lands there", () => {
  // Next is [A, B, C, D]: A dropped above C lands between B and C.
  expect(dropIndex({ index: 0, section: "next" }, { index: 2, section: "next" })).toBe(1);
  // D dropped above B lands between A and B.
  expect(dropIndex({ index: 3, section: "next" }, { index: 1, section: "next" })).toBe(1);
  // Into another section, the index is the target's.
  expect(dropIndex({ index: 0, section: "now" }, { index: 2, section: "next" })).toBe(2);
});

/** US4 5 and the cancelled drag: the order dnd-kit leaves gives the core's move, or none. */
test("a drag's order gives the core's move", () => {
  const before = { next: ["e"], now: ["a", "b", "c", "d"] };
  // B dragged below D: it ends Now.
  expect(dropMove(before, { next: ["e"], now: ["a", "c", "d", "b"] }, "b")).toEqual({
    index: Number.MAX_SAFE_INTEGER,
    section: "now",
  });
  // D dragged above B: among A, B, C, it lands at 1.
  expect(dropMove(before, { next: ["e"], now: ["a", "d", "b", "c"] }, "d")).toEqual({
    index: 1,
    section: "now",
  });
  // A dragged above E, into Next.
  expect(dropMove(before, { next: ["a", "e"], now: ["b", "c", "d"] }, "a")).toEqual({
    index: 0,
    section: "next",
  });
  // Dropped where it started.
  expect(dropMove(before, before, "c")).toBeUndefined();
});
