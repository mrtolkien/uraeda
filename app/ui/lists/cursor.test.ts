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
