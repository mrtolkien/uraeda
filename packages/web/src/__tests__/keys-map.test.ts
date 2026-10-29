// The key map's content (the help-keybindings change), pure: which keys it lists for where the
// focus is, in which section, merged by label, with the single-key switch, and its search.
import { expect, test } from "vite-plus/test";
import { keyMapSections, searchKeyMap, written } from "../keys/keyMap.ts";
import type { Binding, Placed } from "../keys/store.ts";

const run = () => {};
const page = (keys: string, label: string, extra: Partial<Binding> = {}): Placed => ({
  binding: { keys, label, run, ...extra },
  place: "page",
});
const shell = (keys: string, label: string): Placed => ({
  binding: { keys, label, run },
  place: "shell",
});

const LISTED: ReadonlyArray<Placed> = [
  shell("g h", "Home"),
  shell("space f d", "Decisions"),
  shell("space n n", "Note (inbox entry)"),
  shell("space h", "Home"),
  shell("b", "Back"),
  shell("?", "Keyboard shortcuts…"),
  page("j", "next row"),
  page("ArrowDown", "next row"),
  page("i", "edit"),
  page("d d", "delete"),
];

/** Each section as its title and its rows, each row its keys as written and its label. */
const shown = (sections: ReturnType<typeof keyMapSections>) =>
  sections.map(({ rows, title }) => [
    title,
    rows.map(
      (row) => `${row.keys.map((keys) => keys.map(written).join(" ")).join(", ")} ${row.label}`,
    ),
  ]);

test("the page's keys come first, then the shell's, the menu's, its groups', and the go keys", () => {
  expect(shown(keyMapSections(LISTED, document.body, true))).toEqual([
    ["This page", ["j, ↓ Next row", "i Edit", "d d Delete"]],
    ["Everywhere", ["b Back", "? Keyboard shortcuts…"]],
    ["Leader menu", ["space h Home"]],
    ["Find", ["space f d Decisions"]],
    ["New", ["space n n Note (inbox entry)"]],
    ["Go", ["g h Home"]],
  ]);
});

// Break: listing a row's keys while the focus is elsewhere names keys that do nothing there.
test("a key whose guard refuses where the focus is is left out", () => {
  const field = document.createElement("input");
  const listed = [page("o", "add", { when: (target) => target === field }), page("i", "edit")];
  expect(shown(keyMapSections(listed, document.body, true))).toEqual([["This page", ["i Edit"]]]);
  expect(shown(keyMapSections(listed, field, true))).toEqual([["This page", ["o Add", "i Edit"]]]);
});

// Break: listing the single keys with the switch off names keys that do nothing.
test("with the single keys off, only the keys that still work are, the leader's from its chord", () => {
  const sections = shown(keyMapSections(LISTED, document.body, false));
  expect(sections).toEqual([
    ["This page", ["↓ Next row"]],
    ["Leader menu", ["Ctrl+K h Home"]],
    ["Find", ["Ctrl+K f d Decisions"]],
    ["New", ["Ctrl+K n n Note (inbox entry)"]],
  ]);
});

test("a key named by the browser is written as its glyph, a chord with its modifiers, `+` alone as itself", () => {
  expect(
    ["ArrowUp", "Enter", "Escape", "shift+ArrowDown", "mod+Enter", "J", "+", "-"].map(written),
  ).toEqual(["↑", "⏎", "esc", "Shift+↓", "Ctrl+⏎", "J", "+", "-"]);
});

test("the search keeps the rows with every word in their label, keys, or section", () => {
  const sections = keyMapSections(LISTED, document.body, true);
  expect(shown(searchKeyMap(sections, "HOME"))).toEqual([
    ["Leader menu", ["space h Home"]],
    ["Go", ["g h Home"]],
  ]);
  expect(shown(searchKeyMap(sections, "find"))).toEqual([["Find", ["space f d Decisions"]]]);
  expect(shown(searchKeyMap(sections, "↓ next"))).toEqual([["This page", ["j, ↓ Next row"]]]);
  expect(searchKeyMap(sections, "nothing like it")).toEqual([]);
  expect(searchKeyMap(sections, "  ")).toEqual(sections);
});
