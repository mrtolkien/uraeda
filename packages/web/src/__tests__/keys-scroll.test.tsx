// The base keymap's defaults (US2 5, US2 more 1; review focus 6, 11): the vertical keys scroll the
// area holding the focus, else the page, only where no binding of the page handled the key; the two
// folds are the shell's and the column's own keys, with the focus anywhere; and the rail's Escape
// folds an open rail, under the one layer rule. The scrolling is checked on the real page and the
// rest on a bare registry, whose keys a test presses on the focused element as a user's reach the
// window.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Button } from "@astryxdesign/core/Button";
import { useRef } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { KeysProvider, useKeys } from "../keys/registry.tsx";
import { ScrollKeys } from "../keys/scroll.ts";
import { addSpecFeature, SPEC_FEATURE } from "uraeda-binding/test-utils";
import { NAV_KEY } from "../shell/columnWidth.ts";
import { useRail } from "../shell/Rail.tsx";
import { atWidth, fixtureRepo, renderPage } from "./helpers.tsx";

const scrollBy = vi.fn();
const scrollTo = vi.fn();

beforeEach(() => {
  atWidth(1440);
  window.localStorage.clear();
  window.scrollBy = scrollBy;
  window.scrollTo = scrollTo;
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: 5000,
  });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  document.body.replaceChildren();
  scrollBy.mockReset();
  scrollTo.mockReset();
});

/** Presses a key on `target`, as a user's reaches the window: a capital is typed with Shift. */
const press = (key: string, target: Element = document.body, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(target, { key, shiftKey: /^[A-Z]$/.test(key), ...init });

/** The `top` of each call of a mocked scroll. */
const tops = (mock: typeof scrollBy) =>
  mock.mock.calls.map(([options]) => (options as { top: number }).top);

/** A region that scrolls, as a column of its own does: it says it holds more than it shows. */
function scrollable(parent: Element = document.body) {
  const region = document.createElement("div");
  region.style.overflowY = "auto";
  Object.defineProperty(region, "scrollHeight", { value: 900 });
  Object.defineProperty(region, "clientHeight", { value: 100 });
  region.scrollBy = vi.fn();
  region.scrollTo = vi.fn();
  const button = document.createElement("button");
  button.textContent = "Inside";
  region.append(button);
  parent.append(region);
  return { button, region };
}

test("on a page with no rows, the down keys scroll the page down and the up keys back (US2 5)", () => {
  render(
    <KeysProvider>
      <ScrollKeys />
    </KeysProvider>,
  );
  for (const key of ["j", "ArrowDown", "+"]) {
    press(key);
  }
  expect(scrollBy).toHaveBeenCalledTimes(3);
  expect(tops(scrollBy).every((top) => top > 0)).toBe(true);

  scrollBy.mockClear();
  for (const key of ["k", "ArrowUp", "-"]) {
    press(key);
  }
  expect(scrollBy).toHaveBeenCalledTimes(3);
  expect(tops(scrollBy).every((top) => top < 0)).toBe(true);
});

test("a step is a few lines at once, and never animated", () => {
  render(
    <KeysProvider>
      <ScrollKeys />
    </KeysProvider>,
  );
  press("j");
  press("k");
  const [down, up] = scrollBy.mock.calls.map(([options]) => options as ScrollToOptions);
  expect(down?.top).toBeGreaterThan(0);
  expect(down?.top).toBeLessThan(window.innerHeight);
  expect(up?.top).toBe(-(down?.top ?? 0));
  expect(down?.behavior).toBe("instant");
});

test("G scrolls to the bottom, and Home and End to the top and the bottom", () => {
  render(
    <KeysProvider>
      <ScrollKeys />
    </KeysProvider>,
  );
  press("G");
  expect(tops(scrollTo)).toEqual([5000]);
  press("Home");
  press("End");
  expect(tops(scrollTo)).toEqual([5000, 0, 5000]);
});

test("with the focus in a scrollable region, the region scrolls and the page stays (US2 more 1)", () => {
  render(
    <KeysProvider>
      <ScrollKeys />
    </KeysProvider>,
  );
  const { button, region } = scrollable();
  press("j", button);
  expect(region.scrollBy).toHaveBeenCalledTimes(1);
  expect(tops(region.scrollBy as typeof scrollBy)[0]).toBeGreaterThan(0);
  press("G", button);
  expect(tops(region.scrollTo as typeof scrollTo)).toEqual([900]);
  expect(scrollBy).not.toHaveBeenCalled();
  expect(scrollTo).not.toHaveBeenCalled();

  // The focus outside it: the page.
  press("j");
  expect(scrollBy).toHaveBeenCalledTimes(1);
  expect(region.scrollBy).toHaveBeenCalledTimes(1);
});

// Break: a fallback that scrolls as well as the list's own move.
test("a page whose list declared j moves its selection, and nothing scrolls (US2 4)", () => {
  const moved: Array<string> = [];
  function List() {
    useKeys([{ keys: "j", label: "Next row", run: () => void moved.push("j") }]);
    return null;
  }
  render(
    <KeysProvider>
      <ScrollKeys />
      <List />
    </KeysProvider>,
  );
  press("j");
  expect(moved).toEqual(["j"]);
  expect(scrollBy).not.toHaveBeenCalled();
  // The list has no `k` of its own here, so the fallback keeps it.
  press("k");
  expect(scrollBy).toHaveBeenCalledTimes(1);
});

/** A list whose `j` found nothing to do, which it says by returning `false`. */
function IdleList() {
  useKeys([{ keys: "j", label: "Next row", run: () => false }]);
  return null;
}

test("a list that does nothing with the key leaves it to the scroll", () => {
  render(
    <KeysProvider>
      <ScrollKeys />
      <IdleList />
    </KeysProvider>,
  );
  press("j");
  expect(scrollBy).toHaveBeenCalledTimes(1);
});

test("nothing scrolls in a text field, or under a dialog", () => {
  render(
    <KeysProvider>
      <ScrollKeys />
    </KeysProvider>,
  );
  const field = document.createElement("textarea");
  document.body.append(field);
  press("j", field);
  press("ArrowDown", field);
  expect(scrollBy).not.toHaveBeenCalled();

  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  document.body.append(dialog);
  press("j");
  press("G");
  expect(scrollBy).not.toHaveBeenCalled();
  expect(scrollTo).not.toHaveBeenCalled();
});

test("with single-key shortcuts off, the named keys still scroll and the letters do not", () => {
  render(
    <KeysProvider singleKeys={false}>
      <ScrollKeys />
    </KeysProvider>,
  );
  for (const key of ["j", "k", "+", "-", "G"]) {
    press(key);
  }
  expect(scrollBy).not.toHaveBeenCalled();
  expect(scrollTo).not.toHaveBeenCalled();
  press("ArrowDown");
  press("Home");
  expect(scrollBy).toHaveBeenCalledTimes(1);
  expect(scrollTo).toHaveBeenCalledTimes(1);
});

/** The page's own scroll and folds: on the real page, the status line names `[ fold` and no `j k`. */
test("on the settings, `[` folds the navigation with the focus on a button, and scrolling is not hinted", async () => {
  await renderPage("/settings", fixtureRepo());
  const status = await screen.findByRole("contentinfo", { name: "Status line" });
  await waitFor(() => expect(status.textContent).toContain("[ fold"));
  expect(status.textContent).not.toContain("j k");
  expect(status.textContent).not.toContain("scroll");

  const button = (await screen.findAllByRole("button"))[0]!;
  button.focus();
  press("[", button);
  await waitFor(() =>
    expect(JSON.parse(window.localStorage.getItem(NAV_KEY) ?? "{}")).toMatchObject({
      folded: true,
    }),
  );
  press("[", button);
  await waitFor(() =>
    expect(JSON.parse(window.localStorage.getItem(NAV_KEY) ?? "{}").folded).not.toBe(true),
  );

  scrollBy.mockClear();
  press("j", button);
  expect(scrollBy).toHaveBeenCalledTimes(1);
});

/** The column's own fold, `]` and the leader's `space u ]` (US2 4): the same key, with the focus anywhere. */
test("on a spec page, `]` and `space u ]` fold the column beside it, with the focus on a button", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(`/f/${SPEC_FEATURE}/spec.md`, repo);
  const hide = await screen.findByRole("button", { name: /^Hide the .* column$/ });
  hide.focus();

  press("]", hide);
  await screen.findByRole("button", { name: /^Show the .* column$/ });
  press("]");
  await screen.findByRole("button", { name: /^Hide the .* column$/ });

  press(" ");
  press("u");
  press("]");
  await screen.findByRole("button", { name: /^Show the .* column$/ });
});

/** A bare rail, and two controls of the page beside it. */
function Rail() {
  const ref = useRef<HTMLElement>(null);
  const logo = useRef<HTMLButtonElement>(null);
  const rail = useRail(true, ref, logo);
  return (
    <>
      <nav aria-label={rail.isOpen ? "Open" : "Folded"} ref={ref} {...rail.handlers} />
      <Button ref={logo}>Logo</Button>
      <Button>Page</Button>
    </>
  );
}

/** Opens the rail as a mouse resting on it does, and returns a control of the page. */
function openRail() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  render(
    <KeysProvider>
      <Rail />
    </KeysProvider>,
  );
  fireEvent.pointerOver(screen.getByRole("navigation"), { pointerType: "mouse" });
  act(() => vi.advanceTimersByTime(250));
  expect(screen.getByRole("navigation", { name: "Open" })).toBeTruthy();
  return screen.getByRole("button", { name: "Page" });
}

test("Escape folds the open rail, wherever the focus is", () => {
  const page = openRail();
  act(() => {
    press("Escape", page);
  });
  expect(screen.getByRole("navigation", { name: "Folded" })).toBeTruthy();
});

// Break: the rail's Escape under a dialog, which the dialog's own Escape takes.
test("Escape under an open dialog leaves the rail open", () => {
  const page = openRail();
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  document.body.append(dialog);
  act(() => {
    press("Escape", page);
  });
  expect(screen.getByRole("navigation", { name: "Open" })).toBeTruthy();
  dialog.remove();
  act(() => {
    press("Escape", page);
  });
  expect(screen.getByRole("navigation", { name: "Folded" })).toBeTruthy();
});

test("with the rail folded, Escape goes to the page's own binding", () => {
  const ran: Array<string> = [];
  function Pane() {
    useKeys([{ keys: "Escape", label: "Close", run: () => void ran.push("close") }]);
    return null;
  }
  render(
    <KeysProvider>
      <Rail />
      <Pane />
    </KeysProvider>,
  );
  press("Escape");
  expect(ran).toEqual(["close"]);
  expect(screen.getByRole("navigation", { name: "Folded" })).toBeTruthy();
});

// R31: the rail's Escape is a fallback of the registry, below the page's own Escape: with a pane open
// and the rail open, one Escape closes the pane only, and the second, with nothing left to close,
// folds the rail.
test("with the rail open and a pane to close, one Escape closes the pane and the next folds the rail", () => {
  let isPaneOpen = true;
  function Pane() {
    useKeys([
      {
        keys: "Escape",
        label: "Close",
        run: () => {
          if (!isPaneOpen) {
            return false;
          }
          isPaneOpen = false;
        },
      },
    ]);
    return null;
  }
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  render(
    <KeysProvider>
      <Rail />
      <Pane />
    </KeysProvider>,
  );
  fireEvent.pointerOver(screen.getByRole("navigation"), { pointerType: "mouse" });
  act(() => vi.advanceTimersByTime(250));
  const page = screen.getByRole("button", { name: "Page" });

  act(() => {
    press("Escape", page);
  });
  expect(isPaneOpen).toBe(false);
  expect(screen.getByRole("navigation", { name: "Open" })).toBeTruthy();

  act(() => {
    press("Escape", page);
  });
  expect(screen.getByRole("navigation", { name: "Folded" })).toBeTruthy();
});
