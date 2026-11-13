// Run by `nsh test`, without a display: where a list's cursor goes when its row goes.
import { signal } from "nsh";
import { expect, test } from "nsh/test";
import { createCursor } from "./cursor";

test("a row put under the cursor by a press, then removed, leaves the cursor on its neighbour", () => {
  const rows = signal(["a", "b", "c", "d", "e"].map((id) => ({ id })));
  const cursor = createCursor(rows);
  cursor.set("d");
  rows.set(rows().filter((row) => row.id !== "d"));
  expect(cursor.at()).toBe("e");
});

test("a cursor on the last row stays on the last when that row becomes several", () => {
  // A transcript's turn, a row of its own until its page is read, then the page's items.
  const rows = signal(["t1/a", "t1/b", "t2"].map((id) => ({ id })));
  const cursor = createCursor(rows);
  // Put there as a following list starts its cursor, which does not look for its place.
  cursor.set("t2");
  rows.set(["t1/a", "t1/b", "t2/a", "t2/b", "t2/c"].map((id) => ({ id })));
  expect(cursor.at()).toBe("t2/c");
});
