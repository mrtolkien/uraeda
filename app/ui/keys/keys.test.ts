// Run by `nsh test`, without a display: the key registry, its sequences, and what it asks of
// Native Shell. The page of `__checks__/keys.tsx` gets real keys, from the driver's keyboard,
// through Native Shell's keymap; the rules over what is declared are read on a registry of the
// test's own.
import { expect, open, test } from "nsh/test";
import { keyMapSections, searchKeyMap } from "./keyMapSections";
import { searchRanked } from "./pickerSearch";
import { entriesAt, next } from "./sequence";
import { createKeyStore, type KeySpec } from "./store";
import { strokeOf, written } from "./token";

const nothing = () => {};
const key = (keys: string, label: string, more: Partial<KeySpec> = {}): KeySpec => ({
  keys,
  label,
  run: nothing,
  ...more,
});

/** A step of a pending sequence: the keys pressed, and whether its menu is shown. */
const step = (path: Array<string>, isShown = false) => ({ isShown, path });

/** The key map's sections as lines: a title, then each row's keys as written and its label. */
const titles = (sections: ReturnType<typeof keyMapSections>) =>
  sections.map(({ rows, title }) => [
    title,
    ...rows.map(
      (row) => `${row.keys.map((keys) => keys.map(written).join(" ")).join(", ")}: ${row.label}`,
    ),
  ]);

/** The page of the checks, on a desktop, with a clock the test moves. */
const page = () =>
  open("./__checks__/keys.tsx", { clock: {}, height: 800, platform: "linux", width: 1400 });

test("a key means one thing on a page", () => {
  const store = createKeyStore();
  const inbox = store.scope({ name: "Inbox" });
  store.register(inbox, [key("d", "Delete"), key("g i", "Inbox")]);

  // Twice in one scope, in the page under the shell, and as a key that starts a sequence.
  expect(() => store.register(inbox, [key("d", "Done")])).toThrow(
    'A key means two things in Inbox: "d" is bound twice, to Delete and to Done',
  );
  expect(() => store.register(store.shell, [key("d", "Dismiss")])).toThrow(
    '"d" is bound twice, to Delete and to Dismiss',
  );
  expect(() => store.register(inbox, [key("g", "Bottom")])).toThrow(
    '"g" (Bottom) is a key and the start of the sequence "g i" (Inbox)',
  );
  expect(() => store.register(inbox, [key("x", "Cut"), key("x", "Close")])).toThrow(
    '"x" is bound twice, to Cut and to Close',
  );
  // A key no keyboard gives never runs, and says so.
  expect(() => store.register(inbox, [key("ctrl+d", "Down")])).toThrow(
    '"ctrl+d" (Down) can never run',
  );
  // A refused list declares nothing.
  expect(store.listed().map(({ spec }) => spec.label)).toEqual(["Delete", "Inbox"]);

  // Two panes are never focused together, so each has its own `j`, and `d` is still the page's.
  const focus = { list: true };
  const list = store.scope({ kind: "pane", name: "List", on: () => focus.list }, inbox);
  const column = store.scope({ kind: "pane", name: "Column", on: () => !focus.list }, inbox);
  const moved: Array<string> = [];
  store.register(list, [key("j", "Next note", { run: () => void moved.push("note") })]);
  store.register(column, [key("j", "Next row", { run: () => void moved.push("row") })]);
  expect(() => store.register(column, [key("d", "Drop")])).toThrow('"d" is bound twice');
  store.run("j");
  focus.list = false;
  store.run("j");
  expect(moved).toEqual(["note", "row"]);

  // A held selection takes a key of the page while it holds, and gives it back when it did nothing.
  const question = { isOpen: true };
  const held = store.scope({ kind: "selection", name: "Question" }, inbox);
  const done: Array<string> = [];
  store.register(inbox, [key("u", "Undo", { run: () => void done.push("undid") })]);
  store.register(held, [
    key("u", "Pick option U", {
      run: () => (question.isOpen ? void done.push("picked") : false),
    }),
  ]);
  store.run("u");
  question.isOpen = false;
  store.run("u");
  expect(done).toEqual(["picked", "undid"]);
  expect(() => store.register(held, [key("u", "Again")])).toThrow('"u" is bound twice');
  expect(() => store.register(held, [key("g", "Pick option G")])).toThrow(
    "is a key and the start of the sequence",
  );

  // An open layer owns the keys: its `d` is its own, and the page's are off under it.
  const dialog = store.scope({ kind: "layer", name: "Confirm" });
  store.register(dialog, [key("d", "Discard"), key("y", "Yes")]);
  expect(store.active().map(({ spec }) => spec.label)).toEqual(["Discard", "Yes"]);
  store.remove(dialog);
  expect(store.active().map(({ spec }) => spec.label)).toEqual([
    "Pick option U",
    "Delete",
    "Inbox",
    "Next row",
    "Undo",
  ]);

  // A fallback runs only when the key's own binding did nothing; two fallbacks are two meanings.
  const notes = { any: false };
  const ran: Array<string> = [];
  store.register(store.shell, [
    key("G", "Bottom of the page", { fallback: true, run: () => void ran.push("page") }),
  ]);
  store.register(inbox, [
    key("G", "Last note", { run: () => (notes.any ? void ran.push("note") : false) }),
  ]);
  store.run("G");
  notes.any = true;
  store.run("G");
  expect(ran).toEqual(["page", "note"]);
  expect(() => store.register(inbox, [key("G", "End", { fallback: true })])).toThrow(
    '"G" has two fallbacks, Bottom of the page and End',
  );
});

test("in a release build, a key that means two things is named, and the first binding kept", () => {
  const said: Array<string> = [];
  const store = createKeyStore({ report: (words) => void said.push(words), strict: false });
  const inbox = store.scope({ name: "Inbox" });
  const done: Array<string> = [];
  store.register(inbox, [key("d", "Delete", { run: () => void done.push("deleted") })]);

  // Nothing throws: the clash is said, and the rest of the list is declared.
  store.register(inbox, [key("d", "Done"), key("x", "Cut"), key("ctrl+d", "Down")]);
  expect(said[0]).toBe(
    'A key means two things in Inbox: "d" is bound twice, to Delete and to Done',
  );
  expect(said[1]).toContain('A key cannot work in Inbox: "ctrl+d" (Down) can never run');
  expect(store.listed().map(({ spec }) => spec.label)).toEqual(["Delete", "Cut"]);
  store.run("d");
  expect(done).toEqual(["deleted"]);

  // The key map names it first, where the focus is.
  const map = keyMapSections(store.on(), { keepsSpace: false, singleKeys: true }, store.refused());
  const [title, clashed, broken] = titles(map)[0] ?? [];
  expect([title, clashed]).toEqual(["Not bound", 'd: "d" is bound twice, to Delete and to Done']);
  expect(broken).toContain('ctrl+d: "ctrl+d" (Down) can never run');
});

test("a sequence waits for its second key, then gives up", async () => {
  const app = await page();
  // Typed with no time between, the sequence runs and no menu ever shows.
  await app.keyboard.press("g");
  await app.keyboard.press("i");
  expect(app.texts()).toContain("Ran: went to the inbox");
  expect(app.shows("id:leader-menu")).toBe(false);

  // Alone, `g` waits: its menu shows after 300 ms, and still waits long after.
  await app.keyboard.press("g");
  await app.wait(250);
  expect(app.shows("id:leader-menu")).toBe(false);
  await app.wait(100);
  expect(app.shows("id:leader-menu")).toBe(true);
  expect(app.texts()).toContain("Inbox");
  await app.wait(5000);
  expect(app.shows("id:leader-menu")).toBe(true);

  // A key no `g` sequence uses ends it: nothing runs, and `i` alone is no `g i`.
  await app.keyboard.press("x");
  await app.wait(300);
  expect(app.shows("id:leader-menu")).toBe(false);
  await app.keyboard.press("i");
  expect(app.texts()).toContain("Ran: went to the inbox");

  // The leader's menu goes down a group at once, back up with Backspace, and closes on Escape.
  await app.keyboard.press("space");
  await app.wait(350);
  expect(app.texts()).toContain("+New");
  await app.keyboard.press("n");
  expect(app.texts()).toContain("Space n");
  expect(app.texts()).toContain("Note");
  await app.keyboard.press("backspace");
  expect(app.texts()).toContain("+New");
  await app.keyboard.press("escape");
  await app.wait(300);
  expect(app.shows("id:leader-menu")).toBe(false);
  await app.keyboard.press("space");
  await app.keyboard.press("n");
  await app.keyboard.press("n");
  expect(app.texts()).toContain("Ran: went to the inbox, new note");
});

test("single-key shortcuts can be switched off, and a chord then opens the leader menu", async () => {
  const app = await page();
  await app.keyboard.press("j");
  expect(app.texts()).toContain("Ran: down");
  expect(app.texts()).toContain("Hints: space menu · ? keys · j down · d delete");

  await app.press("Turn single keys off");
  // No letter runs, Space and `g` start nothing, and a key that is no character still works.
  await app.keyboard.press("j");
  await app.keyboard.press("space");
  await app.keyboard.press("n");
  await app.keyboard.press("n");
  await app.keyboard.press("g");
  await app.keyboard.press("i");
  await app.wait(400);
  expect(app.shows("id:leader-menu")).toBe(false);
  await app.keyboard.press("down");
  expect(app.texts()).toContain("Ran: down, arrow");
  expect(app.texts()).toContain("Hints: none");

  // The chord opens the menu, whose letters then run.
  await app.keyboard.press("mod+k");
  await app.wait(350);
  expect(app.shows("id:leader-menu")).toBe(true);
  await app.keyboard.press("n");
  await app.keyboard.press("n");
  expect(app.texts()).toContain("Ran: down, arrow, new note");

  // The key map lists only what still works, the leader's keys written from the chord.
  await app.keyboard.press("mod+k");
  await app.keyboard.press("shift+/");
  expect(app.shows("id:key-map")).toBe(true);
  expect(app.texts()).toContain("Ctrl+K");
  expect(app.texts()).not.toContain("Down");
});

test("a text field with the focus gets keys first", async () => {
  const app = await page();
  await app.type("id:field", "jg");
  await app.keyboard.press("i");
  await app.keyboard.press("space");
  await app.keyboard.press("shift+/");
  await app.wait(400);
  expect(app.texts()).toContain("Field: jgi ?");
  expect(app.texts()).toContain("Ran: nothing");
  expect(app.shows("id:leader-menu")).toBe(false);
  expect(app.shows("id:key-map")).toBe(false);

  // A key the layer's owner asks for in its field is the layer's: the picker's arrows and Enter.
  await app.press("Open the picker");
  await app.type("id:key-picker-filter", "se");
  expect(app.texts()).toContain("Preview of Settings");
  await app.keyboard.press("down");
  expect(app.texts()).toContain("Preview of Sessions");
  await app.keyboard.press("enter");
  expect(app.texts()).toContain("Picked: Sessions");
  expect(app.shows("id:key-picker")).toBe(false);
});

test("a key registered by a view goes when the view goes", async () => {
  const app = await page();
  await app.keyboard.press("d");
  expect(app.texts()).toContain("Ran: deleted the row");
  expect(app.texts()).toContain("Hints: space menu · ? keys · j down · d delete");

  await app.press("Remove the row");
  await app.keyboard.press("d");
  expect(app.texts()).toContain("Ran: deleted the row");
  expect(app.texts()).toContain("Hints: space menu · ? keys · j down");

  // The page's keys are off under an open layer, whose own are on, and back when it closes.
  await app.keyboard.press("shift+/");
  expect(app.shows("id:key-map")).toBe(true);
  await app.keyboard.press("j");
  expect(app.texts()).toContain("Ran: deleted the row");
  await app.keyboard.press("escape");
  expect(app.shows("id:key-map")).toBe(false);
  await app.keyboard.press("j");
  expect(app.texts()).toContain("Ran: deleted the row, down");
});

test("a key is written as it is typed, and bound as Native Shell names it", () => {
  const rows: Array<[token: string, stroke: string | null, shown: string]> = [
    ["j", "j", "j"],
    ["J", "shift+j", "J"],
    ["?", "shift+/", "?"],
    ["[", "[", "["],
    ["+", "shift+=", "+"],
    ["space", "space", "space"],
    ["ArrowDown", "down", "↓"],
    ["shift+ArrowDown", "shift+down", "Shift+↓"],
    ["Enter", "enter", "⏎"],
    ["Escape", "escape", "esc"],
    ["mod+k", "mod+k", "Ctrl+K"],
    ["mod+shift+z", "mod+shift+z", "Ctrl+Shift+Z"],
    ["mod+Enter", "mod+enter", "Ctrl+⏎"],
    ["F5", "f5", "F5"],
    // No keyboard gives these to the registry: a modifier it does not name, a word, a character
    // typed with no key of the US layout, and what the system keeps.
    ["ctrl+d", null, ""],
    ["Space", null, ""],
    ["mod+K", null, ""],
    ["é", null, ""],
    ["mod+q", null, ""],
    ["F11", null, ""],
  ];
  for (const [token, stroke, shown] of rows) {
    expect([token, strokeOf(token)]).toEqual([token, stroke]);
    if (stroke !== null) {
      expect([token, written(token)]).toEqual([token, shown]);
    }
  }
});

test("a pending sequence takes its keys, and leaves the others", () => {
  const bindings = [key("space n n", "Note"), key("space space", "Find"), key("g i", "Inbox")];
  const rows: Array<[at: ReturnType<typeof step> | null, token: string, result: unknown]> = [
    [null, "space", { consumed: true, ran: null, step: step(["space"]) }],
    [null, "mod+k", { consumed: true, ran: null, step: step(["space"]) }],
    [null, "j", { consumed: false, ran: null, step: null }],
    [step(["space"]), "n", { consumed: true, ran: null, step: step(["space", "n"]) }],
    [step(["space", "n"]), "n", { consumed: true, ran: "space n n", step: null }],
    [step(["space"]), "space", { consumed: true, ran: "space space", step: null }],
    // An unbound key ends the sequence, shown or not, and is said to be no key of it.
    [step(["space"], true), "x", { consumed: true, missed: true, ran: null, step: null }],
    [step(["space"]), "x", { consumed: true, missed: true, ran: null, step: null }],
    [step(["g"], true), "x", { consumed: true, missed: true, ran: null, step: null }],
    [step(["space", "n"]), "Backspace", { consumed: true, ran: null, step: step(["space"]) }],
    [step(["space"]), "Backspace", { consumed: true, ran: null, step: null }],
    [step(["space", "n"]), "Escape", { consumed: true, ran: null, step: null }],
    [step(["space", "n"]), "mod+k", { consumed: true, ran: null, step: step(["space"]) }],
    // A named key and a chord are no menu key: the sequence ends, and the key goes on.
    [step(["g"]), "ArrowDown", { consumed: false, ran: null, step: null }],
    [step(["space"], true), "mod+c", { consumed: false, ran: null, step: null }],
  ];
  for (const [at, token, result] of rows) {
    expect([at?.path.join(" "), token, next(bindings, at, token)]).toEqual([
      at?.path.join(" "),
      token,
      result,
    ]);
  }
  // The menu at a step: what each next key does, a group named by `groups.ts`.
  expect(entriesAt(bindings, ["space"])).toEqual([
    { icon: "plus", isGroup: true, key: "n", label: "New" },
    { icon: "enter", key: "space", label: "Find" },
  ]);
});

test("the key map lists what works where the focus is, and its search finds it", () => {
  const store = createKeyStore();
  const inbox = store.scope({ name: "Inbox" });
  store.register(store.shell, [
    key("space n n", "note"),
    key("space ?", "Keyboard shortcuts…"),
    key("g i", "Inbox"),
    key("b", "Back"),
    key("G", "Bottom of the page", { fallback: true }),
  ]);
  store.register(inbox, [
    key("j", "move down"),
    key("ArrowDown", "move down"),
    key("G", "Last note"),
    key("mod+z", "Undo"),
    key("p", "Promote", { when: () => false }),
  ]);
  const all = keyMapSections(store.on(), { keepsSpace: false, singleKeys: true });
  expect(titles(all)).toEqual([
    ["Inbox", "j, ↓: Move down", "G: Last note", "Ctrl+Z: Undo"],
    ["Everywhere", "b: Back"],
    ["Leader menu", "space ?: Keyboard shortcuts…"],
    ["New", "space n n: Note"],
    ["Go", "g i: Inbox"],
  ]);
  expect(titles(searchKeyMap(all, "ctrl un"))).toEqual([["Inbox", "Ctrl+Z: Undo"]]);
  expect(titles(searchKeyMap(all, "new"))).toEqual([["New", "space n n: Note"]]);

  // With the single keys off: what still works, the leader's from its chord.
  const chords = keyMapSections(store.on(), { keepsSpace: false, singleKeys: false });
  expect(titles(chords)).toEqual([
    ["Inbox", "↓: Move down", "Ctrl+Z: Undo"],
    ["Leader menu", "Ctrl+K ?: Keyboard shortcuts…"],
    ["New", "Ctrl+K n n: Note"],
  ]);
});

test("the key map lists the focused pane's keys first, under its title, apart from the frame's", () => {
  const store = createKeyStore();
  const frame = store.scope({ name: "Layout" });
  const pane = store.scope({ kind: "pane", name: "Needs you" }, frame);
  store.register(store.shell, [key("b", "Back")]);
  store.register(frame, [key("[", "Fold the sidebar"), key("space w z", "Zoom the pane")]);
  store.register(pane, [key("j", "Move down"), key("Tab", "Next control")]);
  const all = keyMapSections(store.on(), { keepsSpace: false, singleKeys: true });
  expect(titles(all)).toEqual([
    ["Needs you", "j: Move down", "Tab: Next control"],
    ["Layout", "[: Fold the sidebar"],
    ["Everywhere", "b: Back"],
    ["Panes", "space w z: Zoom the pane"],
  ]);
});

test("the picker's search ranks a title's start over a word's, then the rest", () => {
  const items = [
    { summary: "How the app is built", title: "Stack" },
    { summary: null, title: "Sign-in" },
    { summary: "Tests assert what a user sees", title: "Testing" },
    { summary: null, title: "UI design" },
    { summary: "One registry, a Space leader", title: "Keyboard" },
  ];
  const found = (query: string) => searchRanked(items, query, (item) => item).map((i) => i.title);
  expect(found("")).toEqual(["Stack", "Sign-in", "Testing", "UI design", "Keyboard"]);
  expect(found("t")).toEqual(["Testing", "Stack", "Keyboard"]);
  expect(found("in")).toEqual(["Sign-in", "Testing"]);
  expect(found("space")).toEqual(["Keyboard"]);
  expect(found("key registry")).toEqual(["Keyboard"]);
  expect(found("zzz")).toEqual([]);
});

test("the status line hints a guarded key only where its guard holds", () => {
  // Git's conflict keys work on a conflicted file alone: on any other row, no hint says them.
  const store = createKeyStore();
  const git = store.scope({ kind: "pane", name: "Changes" });
  let conflicted = false;
  store.register(git, [
    key("s", "stage", { hint: "s" }),
    key("o", "take ours", { hint: "o", when: () => conflicted }),
  ]);
  expect(store.hints().map((hint) => hint.label)).toEqual(["stage"]);
  conflicted = true;
  expect(store.hints().map((hint) => hint.label)).toEqual(["stage", "take ours"]);

  // A held selection's keys work where the focus is, so the line names them, first, while it holds.
  let asked = true;
  const question = store.scope({ kind: "selection", name: "Question", on: () => asked }, git);
  store.register(question, [key("a", "Answer A", { hint: "a–f", hintLabel: "answer" })]);
  expect(store.hints().map((hint) => hint.label)).toEqual(["answer", "stage", "take ours"]);
  asked = false;
  expect(store.hints().map((hint) => hint.label)).toEqual(["stage", "take ours"]);
});

test("the status line names the menu and the map, then the focused pane's keys, then the frame's", () => {
  const store = createKeyStore();
  store.register(store.shell, [
    key("b", "Back", { hint: "b" }),
    key("?", "Keys", { hint: "?" }),
    key("space h", "Home", { hint: "space", hintLabel: "menu" }),
  ]);
  const frame = store.scope({ name: "Layout" });
  store.register(frame, [key("[", "Fold", { hint: "[ ]" }), key("h", "Pane", { hint: "h l" })]);
  const pane = store.scope({ kind: "pane", name: "Changes" }, frame);
  store.register(pane, [key("s", "stage", { hint: "s" }), key("P", "push", { hint: "P" })]);
  expect(store.hints().map((hint) => hint.keys)).toEqual([
    "space",
    "?",
    "s",
    "P",
    "[ ]",
    "h l",
    "b",
  ]);
});

test("a pane's keys may reuse the keys of the frame's tabs beside it", () => {
  // The tabs hold the keys only while no pane of the frame has them: a pane's `j`, a carried
  // row's included, never meets the tabs' `j`.
  const store = createKeyStore();
  const frame = store.scope({ name: "Panes" });
  const tabs = store.scope({ kind: "selection", name: "Tabs" }, frame);
  const pane = store.scope({ kind: "pane", name: "Order" }, frame);
  store.register(tabs, [key("j", "Back into the pane"), key("Enter", "Into the pane")]);
  store.register(store.scope({ kind: "selection", name: "Carry" }, pane), [key("j", "Carry down")]);
  store.register(pane, [key("Enter", "Pick")]);
  expect(store.listed()).toHaveLength(4);
});
