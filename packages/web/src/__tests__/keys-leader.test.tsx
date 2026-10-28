// The leader menu on the registry (US1, US5; review focus 3, 5, 7, 8, 10), with fake timers: Space
// and `g` start a sequence, the menu shows 300 ms after the last key and stays, and what ends it. A
// menu that ends slides away first, drawn until its slide is over: a check that it is gone waits
// that out, and so does a check that it stays, which a closing menu would pass while it slides. The
// state machine itself is `keys-sequence.test.ts`'s.
import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { SLIDE_MS } from "../keys/LeaderMenu.tsx";
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
    {
      icon: "uraeda:pencil",
      keys: "space b",
      label: "Button only",
      run: () => void ran.push("space b"),
      when: (target) => (target as Element | null)?.closest?.("button") != null,
    },
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

/** Presses a key, and says whether it went on to the browser (not prevented). */
const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
  fireEvent.keyDown(target, { key, ...init });
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

/** The menu, by the keys it is titled with: its unseen twin, which sizes its frame, is left out. */
const menu = (title: string) => screen.queryByRole("group", { name: title });

/** Waits out a closed menu's slide, after which only a menu still open is drawn. */
const slid = () => wait(SLIDE_MS);

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

test("Space shows the menu at 300 ms, and not before", () => {
  show();
  press(" ");
  wait(299);
  expect(menu("Space")).toBeNull();
  wait(1);
  expect(menu("Space")).not.toBeNull();
  expect(within(menu("Space")!).getByText("New →")).toBeTruthy();
});

test("Backspace goes up a level, Escape closes and nothing runs", () => {
  show();
  press(" ");
  press("n");
  wait(500);
  expect(within(menu("Space n")!).getByText("Note")).toBeTruthy();
  press("Backspace");
  expect(menu("Space")).not.toBeNull();
  press("Escape");
  slid();
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
  wait(200);
  press("n");
  wait(200);
  expect(menu("Space n")).toBeNull();
  wait(100);
  expect(menu("Space n")).not.toBeNull();
});

test("the menu lists an entry whose guard holds at the focus, and not one whose guard does not", () => {
  show();
  press(" ");
  wait(500);
  expect(within(menu("Space")!).queryByText("Button only")).toBeNull();
  press("Escape");
  slid();
  const button = screen.getByRole("button", { name: "Note button" });
  button.focus();
  press(" ", {}, button);
  wait(500);
  expect(within(menu("Space")!).getByText("Button only")).toBeTruthy();
  press("b", {}, button);
  expect(ran).toEqual(["space b"]);
});

test("a pending g shows its menu at 300 ms, ends at 2 s, and then a is a again", () => {
  show();
  press("g");
  wait(299);
  expect(menu("g")).toBeNull();
  wait(1);
  expect(menu("g")).not.toBeNull();
  wait(1700);
  // Ended at 2 s, as its slide starts: `a` is the page's own again.
  press("a");
  expect(ran).toEqual(["a"]);
  slid();
  expect(menu("g")).toBeNull();
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

// Break: a shown g menu that stays open on a wrong key, so the next i runs g i.
test("g, a pause, a key no g sequence uses, then i: the shown menu ended and nothing runs", () => {
  show();
  press("g");
  wait(500);
  expect(menu("g")).not.toBeNull();
  press("x");
  slid();
  expect(menu("g")).toBeNull();
  press("i");
  expect(ran).toEqual([]);
});

// Break: a key the field already prevented returning before the pending step ends.
test("a key the focused field already handled ends a shown menu", () => {
  ran.length = 0;
  render(
    <KeysProvider>
      <Page />
      <LeaderMenuHost />
      <div
        contentEditable
        onKeyDown={(event) => event.preventDefault()}
        role="textbox"
        suppressContentEditableWarning
        tabIndex={0}
      />
    </KeysProvider>,
  );
  press(" ");
  wait(500);
  expect(menu("Space")).not.toBeNull();
  press("Enter", {}, screen.getByRole("textbox"));
  slid();
  expect(menu("Space")).toBeNull();
});

// Break: any null token (a dead key, a lone modifier) ending the menu.
test("a lone modifier does not end a shown menu", () => {
  show();
  press(" ");
  wait(500);
  press("Shift");
  slid();
  expect(menu("Space")).not.toBeNull();
});

test("a key bound to nothing keeps a shown menu open and runs nothing", () => {
  show();
  press(" ");
  wait(500);
  press("z");
  press("a");
  slid();
  expect(menu("Space")).not.toBeNull();
  expect(ran).toEqual([]);
});

// Break: a pending sequence or a shown menu preventing every key, so `g` then F5 never reloads.
test("a pending g or a shown menu lets F5, PageDown, Enter, and the arrows through, and ends", () => {
  show();
  for (const key of ["F5", "F1", "PageDown", "Enter", "ArrowDown", "Tab"]) {
    press("g");
    expect(press(key), `${key} after g`).toBe(true);
    press(" ");
    wait(500);
    expect(menu("Space")).not.toBeNull();
    expect(press(key), `${key} in the menu`).toBe(true);
    slid();
    expect(menu("Space")).toBeNull();
    // Nothing is pending: `i` is no `g i`.
    press("i");
  }
  expect(ran).toEqual([]);
});

test("a printable key the menu has no use for is consumed: x does nothing", () => {
  show();
  press("g");
  expect(press("x")).toBe(false);
  press(" ");
  wait(500);
  expect(press("z")).toBe(false);
  slid();
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

// Break: no keyup rule, so Firefox clicks the button when Space is released.
test("the keyup of a Space the leader took is prevented too, and no other keyup is", () => {
  show();
  const button = screen.getByRole("button", { name: "Note button" });
  expect(fireEvent.keyDown(button, { key: " " })).toBe(false);
  expect(fireEvent.keyUp(button, { key: " " })).toBe(false);
  // Only that one: the next Space, if the leader does not take it, keeps its keyup.
  press("Escape");
  const box = document.createElement("input");
  box.type = "checkbox";
  document.body.append(box);
  expect(fireEvent.keyDown(box, { key: " " })).toBe(true);
  expect(fireEvent.keyUp(box, { key: " " })).toBe(true);
  expect(fireEvent.keyUp(button, { key: " " })).toBe(true);
  // A key of the menu is taken on keydown, and nothing of it is left to release.
  press(" ");
  press("n");
  expect(fireEvent.keyUp(document.body, { key: "n" })).toBe(true);
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
  slid();
  expect(menu("Space")).toBeNull();
  // And what was pending is gone: `n` is no group key now.
  press("n");
  expect(ran).toEqual([]);
});

// Break: the host closing only when the pathname changes (/new, then /new?kind=change).
test("a change of the query alone, the Change card's, closes a shown menu", () => {
  act(() => navigate("/new"));
  show();
  press(" ");
  wait(500);
  expect(menu("Space")).not.toBeNull();
  act(() => navigate("/new?kind=change"));
  slid();
  expect(menu("Space")).toBeNull();
});

test("a layer opening while the menu is shown closes it", async () => {
  show();
  press(" ");
  wait(500);
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  // The document's observer tells the host at the next frame (R133).
  await act(async () => {
    document.body.append(dialog);
    await vi.advanceTimersByTimeAsync(16);
  });
  slid();
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
  slid();
  expect(menu("Space n")).toBeNull();
});

test("turning the switch off with the menu open closes it", () => {
  const { setSingleKeys } = show();
  press(" ");
  wait(500);
  expect(menu("Space")).not.toBeNull();
  setSingleKeys(false);
  slid();
  expect(menu("Space")).toBeNull();
  press("n");
  expect(ran).toEqual([]);
});

test("a pending g ends when the switch turns off, and is not back when it turns on", () => {
  const { setSingleKeys } = show();
  press("g");
  setSingleKeys(false);
  setSingleKeys(true);
  press("i");
  expect(ran).toEqual([]);
});

test("a copy while the menu is open ends it and is left to the browser", () => {
  show();
  press(" ");
  wait(500);
  expect(fireEvent.keyDown(document.body, { ctrlKey: true, key: "c" })).toBe(true);
  slid();
  expect(menu("Space")).toBeNull();
});
