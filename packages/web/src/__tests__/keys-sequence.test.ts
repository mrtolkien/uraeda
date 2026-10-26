// The sequences' state machine (US1, US2; review focus 8, 9), pure: no timer, no key event. What
// the delays do is `keys-leader.test.tsx`'s, over this.
import { expect, test } from "vite-plus/test";
import { entriesAt, next, type Step } from "../keys/sequence.ts";

const BINDINGS = [
  "space space",
  "space h",
  "space n n",
  "space n s",
  "space f d",
  "space x y",
  "g g",
  "g i",
].map((keys) => ({ keys, label: keys }));

const hidden = (...path: Array<string>): Step => ({ isShown: false, path });
const shown = (...path: Array<string>): Step => ({ isShown: true, path });
const press = (step: Step | null, token: string) => next(BINDINGS, step, token);

test("Space, or Ctrl or Cmd+K, starts the leader, and a key that starts nothing does not", () => {
  expect(press(null, "space")).toEqual({ consumed: true, ran: null, step: hidden("space") });
  expect(press(null, "mod+k")).toEqual({ consumed: true, ran: null, step: hidden("space") });
  expect(press(null, "g")).toEqual({ consumed: true, ran: null, step: hidden("g") });
  expect(press(null, "j")).toEqual({ consumed: false, ran: null, step: null });
  // `i` ends a sequence of `g`: it starts none of its own.
  expect(press(null, "i")).toEqual({ consumed: false, ran: null, step: null });
});

test("a group key goes down a level, and the last key runs the binding", () => {
  const group = press(hidden("space"), "n");
  expect(group).toEqual({ consumed: true, ran: null, step: hidden("space", "n") });
  expect(press(group.step, "n")).toEqual({ consumed: true, ran: "space n n", step: null });
  expect(press(hidden("space"), "h")).toEqual({ consumed: true, ran: "space h", step: null });
  expect(press(hidden("space"), "space")).toEqual({
    consumed: true,
    ran: "space space",
    step: null,
  });
});

test("a shown menu stays shown as it goes down", () => {
  expect(press(shown("space"), "n").step).toEqual(shown("space", "n"));
});

// Break: a machine that runs the unbound key, or ends the menu on it.
test("an unbound key in a shown menu is consumed, and the menu stays where it was", () => {
  const step = shown("space", "n");
  expect(press(step, "z")).toEqual({ consumed: true, ran: null, step });
  expect(press(step, "ArrowDown")).toEqual({ consumed: true, ran: null, step });
});

test("an unbound key of a menu not yet shown ends the sequence and runs nothing", () => {
  expect(press(hidden("g"), "x")).toEqual({ consumed: true, ran: null, step: null });
  expect(press(hidden("space", "n"), "z")).toEqual({ consumed: true, ran: null, step: null });
});

test("g then g runs gg", () => {
  expect(press(hidden("g"), "g")).toEqual({ consumed: true, ran: "g g", step: null });
  expect(press(hidden("g"), "i")).toEqual({ consumed: true, ran: "g i", step: null });
});

test("Backspace goes up one level and, at the top, ends; Escape ends", () => {
  expect(press(shown("space", "n"), "Backspace")).toEqual({
    consumed: true,
    ran: null,
    step: shown("space"),
  });
  expect(press(shown("space"), "Backspace")).toEqual({ consumed: true, ran: null, step: null });
  expect(press(shown("g"), "Backspace")).toEqual({ consumed: true, ran: null, step: null });
  expect(press(shown("space", "n"), "Escape")).toEqual({ consumed: true, ran: null, step: null });
});

test("Ctrl or Cmd+K in an open menu goes back to the top, and its own chords are not taken", () => {
  expect(press(shown("space", "n"), "mod+k").step).toEqual(shown("space"));
  // A copy, a tab, a shifted arrow: the menu ends, and the key goes on to the page.
  for (const token of ["mod+c", "Tab", "shift+Tab", "alt+x", "shift+ArrowDown"]) {
    expect(press(shown("space"), token)).toEqual({ consumed: false, ran: null, step: null });
  }
  // `+` is a key, not a chord.
  expect(press(shown("space"), "+").consumed).toBe(true);
});

test("the menu at a step lists what the next key does, with its groups", () => {
  const top = entriesAt(
    [...BINDINGS, { icon: "search" as const, keys: "space z", label: "Zoom" }],
    ["space"],
  );
  expect(top.map(({ isGroup, key, label }) => [key, label, isGroup === true])).toEqual([
    ["space", "space space", false],
    ["h", "space h", false],
    ["n", "New", true],
    ["f", "Find", true],
    ["z", "Zoom", false],
  ]);
  // The leaf with an icon draws it, and one with none draws the menu's own.
  expect(top.find((entry) => entry.key === "z")?.icon).toBe("search");
  expect(top.find((entry) => entry.key === "h")?.icon).toBeTruthy();
  expect(entriesAt(BINDINGS, ["space", "n"]).map((entry) => entry.key)).toEqual(["n", "s"]);
  expect(entriesAt(BINDINGS, ["g"]).map((entry) => entry.key)).toEqual(["g", "i"]);
});

test("a group no feature named has no entry, though its keys work", () => {
  const top = entriesAt(BINDINGS, ["space"]);
  expect(top.some((entry) => entry.key === "x")).toBe(false);
  expect(press(hidden("space", "x"), "y").ran).toBe("space x y");
});
