import { expect, test } from "vite-plus/test";
import { dropIndex, dropMove } from "../PrioritiesPage.tsx";

/** Review I5: a line dropped above another lands just above it, in either direction. */
test("a line dropped above another lands there", () => {
  // Next is [A, B, C, D]: A dropped above C lands between B and C.
  expect(dropIndex({ section: "next", index: 0 }, { section: "next", index: 2 })).toBe(1);
  // D dropped above B lands between A and B.
  expect(dropIndex({ section: "next", index: 3 }, { section: "next", index: 1 })).toBe(1);
  // Into another section, the index is the target's.
  expect(dropIndex({ section: "now", index: 0 }, { section: "next", index: 2 })).toBe(2);
});

/** US4 5 and the cancelled drag: the order dnd-kit leaves gives the core's move, or none. */
test("a drag's order gives the core's move", () => {
  const before = { now: ["a", "b", "c", "d"], next: ["e"] };
  // B dragged below D: it ends Now.
  expect(dropMove(before, { now: ["a", "c", "d", "b"], next: ["e"] }, "b")).toEqual({
    section: "now",
    index: Number.MAX_SAFE_INTEGER,
  });
  // D dragged above B: among A, B, C, it lands at 1.
  expect(dropMove(before, { now: ["a", "d", "b", "c"], next: ["e"] }, "d")).toEqual({
    section: "now",
    index: 1,
  });
  // A dragged above E, into Next.
  expect(dropMove(before, { now: ["b", "c", "d"], next: ["a", "e"] }, "a")).toEqual({
    section: "next",
    index: 0,
  });
  // Dropped where it started.
  expect(dropMove(before, before, "c")).toBeUndefined();
});
