// The key registry (review focus 6, 7, 9, 12; SC-003, SC-006): a binding runs from the window, never
// in a text field or under an open layer, a key never means two things, the latest closure runs, and
// the single-key switch drops exactly the keys that are one printable character.
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { Component, type ReactNode, memo, useState } from "react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { type Binding, KeysProvider, useHints, useKeys } from "../keys/registry.tsx";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

/** Declares one binding, `keys`, which logs `ran` with its label. */
function Harness({
  fallback,
  keys,
  label = keys,
  ran,
  result,
}: {
  fallback?: boolean;
  keys: string;
  label?: string;
  ran: Array<string>;
  result?: false;
}) {
  useKeys([{ fallback, keys, label, run: () => (ran.push(label), result) }]);
  return null;
}

/** Catches what a conflict throws, and says it. */
class Boundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ?? this.props.children;
  }
}

/** Adds an element to the page, as a layer or a field a component of the page would hold. */
function add(tag: string, attributes: Record<string, string> = {}, text = "") {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  element.textContent = text;
  document.body.append(element);
  return element;
}

/** Presses a key on `target`, as a user's reaches the window. */
const press = (key: string, target: Element = document.body, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(target, { key, ...init });

test("a binding runs on a key pressed on the page", () => {
  const ran: Array<string> = [];
  render(
    <KeysProvider>
      <Harness keys="j" ran={ran} />
    </KeysProvider>,
  );
  press("j");
  press("k");
  expect(ran).toEqual(["j"]);
});

test("it does not run in a text field, or while composing", () => {
  const ran: Array<string> = [];
  render(
    <KeysProvider>
      <Harness keys="j" ran={ran} />
    </KeysProvider>,
  );
  for (const field of [
    add("input"),
    add("textarea"),
    add("div", { contenteditable: "true" }),
    add("div", { role: "textbox" }),
  ]) {
    press("j", field);
  }
  press("j", document.body, { isComposing: true });
  expect(ran).toEqual([]);
});

test("a checkbox, a radio, and a button are no text field: the page's keys run on them", () => {
  const ran: Array<string> = [];
  render(
    <KeysProvider>
      <Harness keys="j" ran={ran} />
    </KeysProvider>,
  );
  for (const type of ["checkbox", "radio", "button", "submit", "range"]) {
    press("j", add("input", { type }));
  }
  expect(ran).toEqual(["j", "j", "j", "j", "j"]);
  // A text-like input is still a text field, typed or not.
  press("j", add("input", { type: "text" }));
  press("j", add("input", { type: "search" }));
  expect(ran).toHaveLength(5);
});

// Break: a layer rule that differs by caller, as the three copies did.
test("under a dialog, an open menu, or an expanded popup, no binding runs", () => {
  const ran: Array<string> = [];
  render(
    <KeysProvider>
      <Harness keys="j" ran={ran} />
    </KeysProvider>,
  );
  // A key pressed inside a menu is the menu's.
  const menu = add("div", { role: "menu" });
  menu.append(document.createElement("span"));
  press("j", menu.firstElementChild as Element);
  menu.remove();
  expect(ran).toEqual([]);
  // The sort menu's trigger is expanded: a popup is open.
  const sort = add("div", { "aria-expanded": "true", "aria-haspopup": "menu" });
  press("j");
  expect(ran).toEqual([]);
  sort.setAttribute("aria-expanded", "false");
  press("j");
  expect(ran).toEqual(["j"]);
  sort.remove();

  // A dialog, by its role or as an open `dialog`.
  for (const dialog of [add("div", { role: "dialog" }), add("dialog", { open: "" })]) {
    press("j");
    dialog.remove();
  }
  expect(ran).toEqual(["j"]);
  press("j");
  expect(ran).toEqual(["j", "j"]);
});

/** Puts a new `tag` element in `parent` and gives it. */
function within(parent: Element, tag: string, attributes: Record<string, string> = {}) {
  const child = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    child.setAttribute(name, value);
  }
  parent.append(child);
  return child;
}

/** Whether `j` ran for a key pressed on `target`, with `layer` (any element) added to the page. */
function runsWith(layer: (() => Element) | null, target?: () => Element) {
  const ran: Array<string> = [];
  render(
    <KeysProvider>
      <Harness keys="j" ran={ran} />
    </KeysProvider>,
  );
  layer?.();
  press("j", target?.() ?? document.body);
  cleanup();
  document.body.replaceChildren();
  return ran.length === 1;
}

// Break: each part of the layer rule dropped, one at a time.
test("what is a layer: an alert dialog, an expanded combobox, a key inside a part of one", () => {
  expect(runsWith(null)).toBe(true);
  expect(runsWith(() => add("div", { role: "alertdialog" }))).toBe(false);
  expect(runsWith(() => add("div", { "aria-expanded": "true", role: "combobox" }))).toBe(false);
  // A combobox that is collapsed is no layer.
  expect(runsWith(() => add("div", { "aria-expanded": "false", role: "combobox" }))).toBe(true);
  const parts: Record<string, () => Element> = {
    alertdialog: () => add("div", { role: "alertdialog" }),
    dialog: () => add("dialog"),
    "dialog by role": () => add("div", { role: "dialog" }),
    listbox: () => add("div", { role: "listbox" }),
    popover: () => add("div", { popover: "auto" }),
  };
  for (const [name, part] of Object.entries(parts)) {
    // Nothing else is open: the key is the layer's only because it was pressed inside it.
    expect(
      runsWith(null, () => within(part(), "button")),
      name,
    ).toBe(false);
  }
  // A manual popover, as the toasts', owns no key, inside or not.
  expect(runsWith(null, () => within(add("div", { popover: "manual" }), "a"))).toBe(true);
});

test("a dialog left in the page and hidden is no layer", () => {
  // (`hidden` too, in a real browser: `__browser__/keys-layers.test.tsx`; happy-dom has no UA style.)
  expect(runsWith(() => add("div", { role: "dialog", style: "display: none" }))).toBe(true);
  expect(runsWith(() => add("dialog"))).toBe(true);
  // Hidden by what holds it.
  expect(
    runsWith(() => {
      return within(add("div", { style: "display: none" }), "div", { role: "dialog" });
    }),
  ).toBe(true);
});

test("a dialog inside a popover that is not open, as the repository menu's, is no layer", () => {
  const ran: Array<string> = [];
  render(
    <KeysProvider>
      <Harness keys="j" ran={ran} />
    </KeysProvider>,
  );
  // A window with no popover API opens none, and gives every element a box: the dialog in a closed
  // popover must still not hold the page's keys.
  const popover = add("div", { popover: "auto" });
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  popover.append(dialog);
  press("j");
  expect(ran).toEqual(["j"]);
});

test("an expanded disclosure that is no popup, as the rail's logo, owns no key", () => {
  const ran: Array<string> = [];
  render(
    <KeysProvider>
      <Harness keys="j" ran={ran} />
    </KeysProvider>,
  );
  add("div", { "aria-controls": "x", "aria-expanded": "true" });
  press("j");
  expect(ran).toEqual(["j"]);
});

/** Renders `parts` under a provider, in a boundary, and gives what the boundary caught. */
function conflictOf(...parts: Array<ReactNode>) {
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(
    <KeysProvider>
      <Boundary>{parts}</Boundary>
    </KeysProvider>,
  );
  return document.body.textContent ?? "";
}

/** A component that declares `keys` as its own list, all at once. */
function Own({ keys, ran }: { keys: ReadonlyArray<string>; ran: Array<string> }) {
  useKeys(
    keys.map((entry) => ({ keys: entry, label: `own ${entry}`, run: () => void ran.push(entry) })),
  );
  return null;
}

test("a key declared twice in one component's own list throws", () => {
  const ran: Array<string> = [];
  expect(conflictOf(<Own keys={["j", "k", "j"]} ran={ran} />)).toContain("twice");
  cleanup();
  expect(conflictOf(<Own keys={["g", "g h"]} ran={ran} />)).toContain("sequence");
  cleanup();
  expect(conflictOf(<Own keys={["j", "k", "g h", "g i"]} ran={ran} />)).toBe("");
});

// Break: no conflict check, so two meanings of a key go unseen until a human presses it.
test("two bindings of one key throw, with the labels of both", () => {
  const ran: Array<string> = [];
  const text = conflictOf(
    <Harness key="a" keys="j" label="move" ran={ran} />,
    <Harness key="b" keys="j" label="scroll" ran={ran} />,
  );
  expect(text).toContain("move");
  expect(text).toContain("scroll");
});

// Break: no check of the token, so `mod+ArrowDown` and `Space` are declared and never run.
test("a binding that names a key no keydown gives throws, and says which", () => {
  const ran: Array<string> = [];
  for (const keys of [
    "mod+ArrowDown",
    "mod+K",
    "Space",
    "shift+J",
    "escape",
    "ctrl+k",
    "Shift+ArrowDown",
    "alt+x",
    "arrowdown",
    "g  h",
    "g Space",
    "shift+Shift",
    "",
  ]) {
    cleanup();
    expect(conflictOf(<Harness keys={keys} ran={ran} />), keys).toContain("can never run");
  }
});

test("the keys a keydown gives are all declared without a throw", () => {
  const ran: Array<string> = [];
  for (const keys of [
    "j",
    "J",
    "+",
    "[",
    "space",
    "space n n",
    "g h",
    "mod+k",
    "mod+/",
    "ArrowDown",
    "shift+ArrowDown",
    "Home",
    "Enter",
    "Escape",
    "Backspace",
    "F1",
    "shift+Tab",
  ]) {
    cleanup();
    expect(conflictOf(<Harness keys={keys} ran={ran} />), keys).toBe("");
  }
});

// Break: no check, so a group the menu draws nothing for is found by a human reading the menu.
test("a sequence through a group groups.ts does not name throws, and says which", () => {
  const ran: Array<string> = [];
  expect(conflictOf(<Harness keys="space z z" ran={ran} />)).toContain('"space z"');
  cleanup();
  expect(conflictOf(<Harness keys="space n n z" ran={ran} />)).toContain("groups.ts");
  cleanup();
  // The leader's first key is the root, and a `g` sequence has no group above it.
  for (const keys of ["space n n", "space f f", "space space", "space h", "g i", "g g"]) {
    cleanup();
    expect(conflictOf(<Harness keys={keys} ran={ran} />), keys).toBe("");
  }
});

test("a key that is a leaf and the start of a sequence throws", () => {
  const ran: Array<string> = [];
  expect(
    conflictOf(
      <Harness key="a" keys="g" label="leaf" ran={ran} />,
      <Harness key="b" keys="g h" label="home" ran={ran} />,
    ),
  ).toContain("sequence");
});

test("two sequences that share their first key do not clash", () => {
  const ran: Array<string> = [];
  expect(
    conflictOf(<Harness key="a" keys="g g" ran={ran} />, <Harness key="b" keys="g h" ran={ran} />),
  ).toBe("");
});

test("a key and a fallback of the same key do not clash, two fallbacks do", () => {
  const ran: Array<string> = [];
  expect(
    conflictOf(
      <Harness key="a" keys="j" label="move" ran={ran} />,
      <Harness fallback key="b" keys="j" label="scroll" ran={ran} />,
    ),
  ).toBe("");
  cleanup();
  expect(
    conflictOf(
      <Harness fallback key="a" keys="j" label="scroll" ran={ran} />,
      <Harness fallback key="b" keys="j" label="other" ran={ran} />,
    ),
  ).toContain("two fallbacks");
});

test("unmounting the first of two bindings lifts the conflict", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const ran: Array<string> = [];
  function Page({ retry, withFirst }: { retry: number; withFirst: boolean }) {
    return (
      <KeysProvider>
        {withFirst && <Harness keys="j" label="first" ran={ran} />}
        <Boundary key={retry}>
          <Harness keys="j" label="second" ran={ran} />
        </Boundary>
      </KeysProvider>
    );
  }
  const { rerender } = render(<Page retry={0} withFirst />);
  expect(document.body.textContent).toContain("twice");
  rerender(<Page retry={1} withFirst={false} />);
  expect(document.body.textContent).toBe("");
  press("j");
  expect(ran).toEqual(["second"]);
});

test("a handler that returns false lets the fallback run, any other stops it", () => {
  const ran: Array<string> = [];
  const { rerender } = render(
    <KeysProvider>
      <Harness keys="j" label="move" ran={ran} result={false} />
      <Harness fallback keys="j" label="scroll" ran={ran} />
    </KeysProvider>,
  );
  press("j");
  expect(ran).toEqual(["move", "scroll"]);
  ran.length = 0;
  rerender(
    <KeysProvider>
      <Harness keys="j" label="move" ran={ran} />
      <Harness fallback keys="j" label="scroll" ran={ran} />
    </KeysProvider>,
  );
  press("j");
  expect(ran).toEqual(["move"]);
});

/** Says how many hints it reads, and tells `onRender` each time it renders. */
function Reader({ onRender }: { onRender: () => void }) {
  onRender();
  return <p>{useHints().length}</p>;
}
const MemoReader = memo(Reader);

/** A line of the hints, as the status line reads them. */
function Line() {
  return <p>{useHints().map((hint) => `${hint.keys} ${hint.label}`)}</p>;
}

// Break: the handler captured when the key was declared, run stale.
test("the latest closure runs, and a reader hears nothing of a new one", () => {
  const seen: Array<number> = [];
  const onRender = vi.fn();
  function Page() {
    const [count, setCount] = useState(0);
    useKeys([
      {
        hint: "+",
        keys: "+",
        label: "count",
        run: () => {
          seen.push(count);
          setCount(count + 1);
        },
      },
    ]);
    return <MemoReader onRender={onRender} />;
  }
  render(
    <KeysProvider>
      <Page />
    </KeysProvider>,
  );
  const before = onRender.mock.calls.length;
  for (let time = 0; time < 3; time += 1) {
    press("+", document.body, { shiftKey: true });
  }
  expect(seen).toEqual([0, 1, 2]);
  // Each press re-rendered the page with a new closure; the reader did not render again.
  expect(onRender.mock.calls.length).toBe(before);
});

/** Declares `j` with `hint` as its text. */
function Hinted({ hint }: { hint: string }) {
  useKeys([{ hint, keys: "j", label: "move", run: () => {} }]);
  return null;
}

test("a hint's text changing is heard by the reader", () => {
  const { rerender } = render(
    <KeysProvider>
      <Hinted hint="j" />
      <Line />
    </KeysProvider>,
  );
  expect(document.body.textContent).toBe("j move");
  rerender(
    <KeysProvider>
      <Hinted hint="j k" />
      <Line />
    </KeysProvider>,
  );
  expect(document.body.textContent).toBe("j k move");
});

const SINGLE = ["j", "J", "+", "[", "/", ",", "space"];
const NAMED = ["ArrowDown", "shift+ArrowDown", "Home", "Enter", "Escape", "mod+k"];

/** The key presses of each binding of `SINGLE` and `NAMED`, as an event's init. */
const PRESSES: Record<string, [string, KeyboardEventInit]> = {
  "+": ["+", { shiftKey: true }],
  ArrowDown: ["ArrowDown", {}],
  Enter: ["Enter", {}],
  Escape: ["Escape", {}],
  Home: ["Home", {}],
  J: ["J", { shiftKey: true }],
  "mod+k": ["k", { ctrlKey: true }],
  "shift+ArrowDown": ["ArrowDown", { shiftKey: true }],
  space: [" ", {}],
};

// Break: the switch dropping named keys too, or leaving the shifted letters.
test("with single-key shortcuts off, only the keys that are one printable character stop", () => {
  const ran: Array<string> = [];
  function Page() {
    const bindings: Array<Binding> = [...SINGLE, ...NAMED, "g h"].map((keys) => ({
      keys,
      label: keys,
      run: () => void ran.push(keys),
    }));
    useKeys(bindings);
    return null;
  }
  render(
    <KeysProvider singleKeys={false}>
      <Page />
    </KeysProvider>,
  );
  for (const keys of [...SINGLE, ...NAMED]) {
    const [key, init] = PRESSES[keys] ?? [keys, {}];
    press(key, document.body, init);
  }
  expect(ran).toEqual(NAMED);
});

test("turning the switch back on brings the keys back", () => {
  const ran: Array<string> = [];
  const page = (singleKeys: boolean) => (
    <KeysProvider singleKeys={singleKeys}>
      <Harness keys="j" ran={ran} />
    </KeysProvider>
  );
  const { rerender } = render(page(false));
  press("j");
  expect(ran).toEqual([]);
  rerender(page(true));
  press("j");
  expect(ran).toEqual(["j"]);
});

test("outside a provider, as in a story, a binding declares nothing", () => {
  const ran: Array<string> = [];
  render(<Harness keys="j" ran={ran} />);
  act(() => void press("j"));
  expect(ran).toEqual([]);
});
