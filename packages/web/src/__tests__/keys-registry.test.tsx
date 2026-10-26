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
