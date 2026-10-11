import { expect, test } from "vite-plus/test";
import { dropIndex } from "../PrioritiesPage.tsx";

/** Review I5: a line dropped above another lands just above it, in either direction. */
test("a line dropped above another lands there", () => {
  // Next is [A, B, C, D]: A dropped above C lands between B and C.
  expect(dropIndex({ section: "next", index: 0 }, { section: "next", index: 2 })).toBe(1);
  // D dropped above B lands between A and B.
  expect(dropIndex({ section: "next", index: 3 }, { section: "next", index: 1 })).toBe(1);
  // Into another section, the index is the target's.
  expect(dropIndex({ section: "now", index: 0 }, { section: "next", index: 2 })).toBe(2);
});
