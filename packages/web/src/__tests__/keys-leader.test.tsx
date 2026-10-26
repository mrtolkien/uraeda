// The leader menu on the registry (US1, US5; review focus 3, 5, 7, 8, 10), with fake timers: Space
// and `g` start a sequence, the menu shows half a second after the last key and stays, and
// what ends it. The state machine itself is `keys-sequence.test.ts`'s.
import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { LeaderMenuHost } from "../keys/LeaderMenuHost.tsx";
import { KeysProvider, useKeys } from "../keys/registry.tsx";
import { navigate } from "../routeHistory.ts";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.useRealTimers();
});

const ran: Array<string> = [];

/** A page with a note form and a settings entry in the leader, `g i`, and a key of its own. */
function Page() {
  useKeys([
    {
      icon: "uraeda:pencil",
      keys: "space n n",
      label: "Note",
      run: () => void ran.push("space n n"),
    },
    {
      icon: "uraeda:plus",
      keys: "space n s",
      label: "Session",
      run: () => void ran.push("space n s"),
    },
    {
      icon: "uraeda:inbox",
      keys: "g i",
      label: "Go to the inbox",
      run: () => void ran.push("g i"),
    },
    { keys: "space space", label: "Find anything", run: () => void ran.push("space space") },
    { keys: "a", label: "Add", run: () => void ran.push("a") },
  ]);
  return null;
}

const noop = () => {};

/** The page, with the fields a human types in and a button, over a provider. */
const page = (singleKeys: boolean) => (
  <KeysProvider singleKeys={singleKeys}>
    <Page />
    <LeaderMenuHost />
    <TextInput label="Name" onChange={noop} value="" />
    <TextArea label="Message" onChange={noop} value="" />
    <Button label="Note button" onClick={noop} />
  </KeysProvider>
);

function show({ singleKeys = true }: { singleKeys?: boolean } = {}) {
  ran.length = 0;
  const view = render(page(singleKeys));
  return { setSingleKeys: (on: boolean) => view.rerender(page(on)) };
}

const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
  fireEvent.keyDown(target, { key, ...init });
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

/** The menu, by the keys it is titled with. */
const menu = (title: string) => screen.queryByRole("group", { name: title });

test("Space, n, n typed with no time between runs the binding, and the menu never shows", () => {
  show();
  press(" ");
  press("n");
  press("n");
  expect(ran).toEqual(["space n n"]);
  wait(5000);
  expect(menu("Space")).toBeNull();
  expect(menu("Space n")).toBeNull();
});

test("Space shows the menu at 500 ms, and not before", () => {
  show();
  press(" ");
  wait(499);
  expect(menu("Space")).toBeNull();
  wait(1);
  expect(menu("Space")).not.toBeNull();
  expect(screen.getByText("New →")).toBeTruthy();
});

test("Backspace goes up a level, Escape closes and nothing runs", () => {
  show();
  press(" ");
  press("n");
  wait(500);
  expect(menu("Space n")).not.toBeNull();
  expect(screen.getByText("Note")).toBeTruthy();
  press("Backspace");
  expect(menu("Space")).not.toBeNull();
  press("Escape");
  expect(menu("Space")).toBeNull();
  press("n");
  expect(ran).toEqual([]);
});

test("a shown menu shows the next step at once", () => {
  show();
  press(" ");
  wait(600);
  press("n");
  expect(menu("Space n")).not.toBeNull();
});

// Break: the delay measured from the first key of the sequence, not the last.
test("while hidden, the delay restarts at each key", () => {
  show();
  press(" ");
  wait(300);
  press("n");
  wait(300);
  expect(menu("Space n")).toBeNull();
  wait(200);
  expect(menu("Space n")).not.toBeNull();
});

test("a pending g shows its menu at 500 ms, ends at 2 s, and then a is a again", () => {
  show();
  press("g");
  wait(500);
  expect(menu("g")).not.toBeNull();
  wait(1500);
  expect(menu("g")).toBeNull();
  press("a");
  expect(ran).toEqual(["a"]);
});

test("g then i runs g i, and g then a key no g sequence uses runs nothing", () => {
  show();
  press("g");
  press("i");
  expect(ran).toEqual(["g i"]);
  press("g");
  press("a");
  expect(ran).toEqual(["g i"]);
  wait(5000);
  expect(menu("g")).toBeNull();
});

test("a key bound to nothing keeps a shown menu open and runs nothing", () => {
  show();
  press(" ");
  wait(500);
  press("z");
  press("a");
  expect(menu("Space")).not.toBeNull();
  expect(ran).toEqual([]);
});

test("Space types a space in a text field and a composer, and opens nothing", () => {
  show();
  for (const label of ["Name", "Message"]) {
    const field = screen.getByLabelText(label);
    (field as HTMLElement).focus();
    const notPrevented = fireEvent.keyDown(field, { key: " " });
    expect(notPrevented).toBe(true);
    wait(1000);
    expect(menu("Space")).toBeNull();
  }
});

test("Space opens nothing while a dialog is open", () => {
  show();
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  document.body.append(dialog);
  press(" ");
  wait(1000);
  expect(menu("Space")).toBeNull();
});

test("Space on a button starts the leader and the browser's own press is stopped", () => {
  show();
  const button = screen.getByRole("button", { name: "Note button" });
  const notPrevented = fireEvent.keyDown(button, { key: " " });
  expect(notPrevented).toBe(false);
  wait(500);
  expect(menu("Space")).not.toBeNull();
});

test("Space on a checkbox, radio, switch, or combobox, even by role, keeps its own", () => {
  show();
  for (const html of [
    '<input type="checkbox" aria-label="c1">',
    '<div role="radio" aria-checked="false" tabindex="0">r</div>',
    '<div role="switch" aria-checked="false" tabindex="0">s</div>',
    '<div role="checkbox" aria-checked="false" tabindex="0">k</div>',
    '<div role="combobox" aria-expanded="false" tabindex="0">b</div>',
  ]) {
    const holder = document.createElement("div");
    holder.innerHTML = html;
    document.body.append(holder);
    const notPrevented = fireEvent.keyDown(holder.firstElementChild as Element, { key: " " });
    expect(notPrevented).toBe(true);
  }
  wait(1000);
  expect(menu("Space")).toBeNull();
});

// Break: the repeat guard removed, so a held Space opens the menu and runs the entry under it.
test("a held Space does not open the menu, or run an entry, nor does a held g", () => {
  show();
  press(" ");
  for (let i = 0; i < 5; i += 1) {
    press(" ", { repeat: true });
  }
  expect(ran).toEqual([]);
  wait(500);
  expect(menu("Space")).not.toBeNull();
  press("Escape");
  // The key is still held: a repeat starts nothing.
  press(" ", { repeat: true });
  press("g", { repeat: true });
  wait(1000);
  expect(menu("Space")).toBeNull();
  expect(menu("g")).toBeNull();
});

test("a navigation while the menu is shown closes it", () => {
  show();
  press(" ");
  wait(500);
  expect(menu("Space")).not.toBeNull();
  act(() => navigate("/elsewhere"));
  expect(menu("Space")).toBeNull();
  // And what was pending is gone: `n` is no group key now.
  press("n");
  expect(ran).toEqual([]);
});

test("a layer opening while the menu is shown closes it", async () => {
  show();
  press(" ");
  wait(500);
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  // The document's observer tells the host a moment after.
  await act(async () => {
    document.body.append(dialog);
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(menu("Space")).toBeNull();
});

test("with single-key shortcuts off, Space and g do nothing, and Ctrl+K opens the menu", () => {
  show({ singleKeys: false });
  press(" ");
  press("g");
  wait(1000);
  expect(menu("Space")).toBeNull();
  expect(menu("g")).toBeNull();

  press("k", { ctrlKey: true });
  wait(500);
  expect(menu("Space")).not.toBeNull();
  // Its letters work while it is open.
  press("n");
  expect(menu("Space n")).not.toBeNull();
  press("s");
  expect(ran).toEqual(["space n s"]);
  expect(menu("Space n")).toBeNull();
});

test("turning the switch off with the menu open closes it", () => {
  const { setSingleKeys } = show();
  press(" ");
  wait(500);
  expect(menu("Space")).not.toBeNull();
  setSingleKeys(false);
  expect(menu("Space")).toBeNull();
  press("n");
  expect(ran).toEqual([]);
});

test("a copy while the menu is open ends it and is left to the browser", () => {
  show();
  press(" ");
  wait(500);
  expect(fireEvent.keyDown(document.body, { ctrlKey: true, key: "c" })).toBe(true);
  expect(menu("Space")).toBeNull();
});
