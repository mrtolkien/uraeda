// The picker's order: what needs the human, then what is at work, come before the rest.
import { expect, test } from "vite-plus/test";
import { activeFirst, type PickerItem } from "../keys/pickerSources.ts";

const item = (id: string, status?: string): PickerItem =>
  ({
    icon: "search",
    id,
    kind: "sessions",
    path: id,
    preview: { kind: "text", lines: [] },
    title: id,
    ...(status && {
      card: {
        folder: id,
        kind: "session",
        label: id,
        status: { label: status, status },
        title: id,
      },
    }),
  }) as PickerItem;

// Break: the items kept in each kind's order, an idle feature above one that needs the human.
test("needs-you and attention come first, then working, the rest in their order", () => {
  const items = [
    item("note"),
    item("idle", "idle"),
    item("working", "working"),
    item("unread", "unread"),
    item("attention", "attention"),
    item("needs", "needs-you"),
  ];

  expect(activeFirst(items).map((one) => one.id)).toEqual([
    "attention",
    "needs",
    "working",
    "note",
    "idle",
    "unread",
  ]);
});
