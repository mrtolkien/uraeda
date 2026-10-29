// The base keymap's defaults (US2 5, US2 more 1; review focus 6, 11): the vertical keys scroll the
// area holding the focus, else the page, only where no binding of the page handled the key, gliding
// there as a browser's arrow keys do; the two folds are the shell's and the column's own keys, with
// the focus anywhere; and the rail's Escape folds an open rail, under the one layer rule. The
// scrolling is checked on the real page and the rest on a bare registry, whose keys a test presses
// on the focused element as a user's reach the window. A glide moves `scrollTop` frame by frame:
// the bare registry's tests fake the frames and run them to the glide's end.
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

const scrollTo = vi.fn();

/** The page's scrolling element, whose `scrollTop` the keys glide. */
const page = () => document.documentElement;

beforeEach(() => {
  atWidth(1440);
  window.localStorage.clear();
  window.scrollTo = scrollTo;
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: 5000,
  });
  page().scrollTop = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  cleanup();
  document.body.replaceChildren();
  scrollTo.mockReset();
});

/** Presses a key on `target`, as a user's reaches the window: a capital is typed with Shift. */
const press = (key: string, target: Element = document.body, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(target, { key, shiftKey: /^[A-Z]$/.test(key), ...init });

/** The `top` of each call of a mocked scroll. */
const tops = (mock: typeof scrollTo) =>
  mock.mock.calls.map(([options]) => (options as { top: number }).top);

/** Fakes the frames a glide runs on, and the clock it reads them with. */
const fakeFrames = () =>
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });

/** The scroll fallback on a bare registry, its glides' frames faked. */
function showScroll({ singleKeys = true }: { singleKeys?: boolean } = {}) {
  fakeFrames();
  render(
    <KeysProvider singleKeys={singleKeys}>
      <ScrollKeys />
    </KeysProvider>,
  );
}

/** Runs the frames of the glides started, `ms` of them: by default until each has ended. */
const glide = (ms = 1000) => act(() => void vi.advanceTimersByTime(ms));

/** Where the page is once the glides of the keys pressed so far have ended. */
function glidedTo() {
  glide();
  return page().scrollTop;
}

/** A region that scrolls, as a column of its own does: it says it holds more than it shows. */
function scrollable(parent: Element = document.body) {
  const region = document.createElement("div");
  region.style.overflowY = "auto";
  Object.defineProperty(region, "scrollHeight", { value: 900 });
  Object.defineProperty(region, "clientHeight", { value: 100 });
  region.scrollTo = vi.fn();
  const button = document.createElement("button");
  button.textContent = "Inside";
  region.append(button);
  parent.append(region);
  return { button, region };
}

test("on a page with no rows, the down keys scroll the page down and the up keys back (US2 5)", () => {
  showScroll();
  for (const key of ["j", "ArrowDown", "+"]) {
    const before = page().scrollTop;
    press(key);
    expect(glidedTo(), key).toBeGreaterThan(before);
  }
  for (const key of ["k", "ArrowUp", "-"]) {
    const before = page().scrollTop;
    press(key);
    expect(glidedTo(), key).toBeLessThan(before);
  }
  expect(page().scrollTop).toBeCloseTo(0, 0);
});

// Break: a step that jumps, or that starts over from where a glide is at each key.
test("a step is a few lines, glided to as a browser's arrow keys do, and quick keys add up", () => {
  showScroll();
  press("j");
  // Nothing moves until the next frame, and the first frame goes part of the way.
  expect(page().scrollTop).toBe(0);
  glide(16);
  const first = page().scrollTop;
  expect(first).toBeGreaterThan(0);
  const step = glidedTo();
  expect(first).toBeLessThan(step);
  expect(step).toBeLessThan(window.innerHeight);

  // Two keys pressed before the glide ends go two steps, in one motion.
  press("j");
  glide(16);
  press("j");
  expect(glidedTo()).toBeCloseTo(3 * step, 0);
  press("k");
  expect(glidedTo()).toBeCloseTo(2 * step, 0);
});

test("with less motion asked for, a step is there at once", () => {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query.includes("prefers-reduced-motion: reduce"),
        media: query,
      }) as MediaQueryList,
  );
  showScroll();
  press("j");
  expect(page().scrollTop).toBeGreaterThan(0);
  press("k");
  expect(page().scrollTop).toBe(0);
});

test("Ctrl+D and Ctrl+U scroll half the window down and up, and Command+D and Command+U do not", () => {
  showScroll();
  press("d", document.body, { ctrlKey: true });
  expect(glidedTo()).toBeCloseTo(window.innerHeight / 2, 0);
  press("u", document.body, { ctrlKey: true });
  expect(glidedTo()).toBeCloseTo(0, 0);
  // Left to the browser, not prevented: on a Mac, Command+D bookmarks the page.
  expect(press("d", document.body, { metaKey: true })).toBe(true);
  expect(press("u", document.body, { metaKey: true })).toBe(true);
  expect(glidedTo()).toBeCloseTo(0, 0);
});

test("G scrolls to the bottom, and Home and End to the top and the bottom", () => {
  showScroll();
  press("G");
  expect(tops(scrollTo)).toEqual([5000]);
  press("Home");
  press("End");
  expect(tops(scrollTo)).toEqual([5000, 0, 5000]);
});

test("with the focus in a scrollable region, the region scrolls and the page stays (US2 more 1)", () => {
  showScroll();
  const { button, region } = scrollable();
  press("j", button);
  glide();
  const step = region.scrollTop;
  expect(step).toBeGreaterThan(0);
  press("G", button);
  expect(tops(region.scrollTo as typeof scrollTo)).toEqual([900]);
  expect(page().scrollTop).toBe(0);
  expect(scrollTo).not.toHaveBeenCalled();

  // The focus outside it: the page.
  press("j");
  expect(glidedTo()).toBeGreaterThan(0);
  expect(region.scrollTop).toBe(step);
});

// Break: a fallback that scrolls as well as the list's own move.
test("a page whose list declared j moves its selection, and nothing scrolls (US2 4)", () => {
  const moved: Array<string> = [];
  function List() {
    useKeys([{ keys: "j", label: "Next row", run: () => void moved.push("j") }]);
    return null;
  }
  fakeFrames();
  page().scrollTop = 500;
  render(
    <KeysProvider>
      <ScrollKeys />
      <List />
    </KeysProvider>,
  );
  press("j");
  expect(moved).toEqual(["j"]);
  expect(glidedTo()).toBe(500);
  // The list has no `k` of its own here, so the fallback keeps it.
  press("k");
  expect(glidedTo()).toBeLessThan(500);
});

/** A list whose `j` found nothing to do, which it says by returning `false`. */
function IdleList() {
  useKeys([{ keys: "j", label: "Next row", run: () => false }]);
  return null;
}

test("a list that does nothing with the key leaves it to the scroll", () => {
  fakeFrames();
  render(
    <KeysProvider>
      <ScrollKeys />
      <IdleList />
    </KeysProvider>,
  );
  press("j");
  expect(glidedTo()).toBeGreaterThan(0);
});

test("nothing scrolls in a text field, or under a dialog", () => {
  showScroll();
  const field = document.createElement("textarea");
  document.body.append(field);
  press("j", field);
  press("ArrowDown", field);
  expect(glidedTo()).toBe(0);

  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  document.body.append(dialog);
  press("j");
  press("G");
  expect(glidedTo()).toBe(0);
  expect(scrollTo).not.toHaveBeenCalled();
});

test("with single-key shortcuts off, the named keys still scroll and the letters do not", () => {
  showScroll({ singleKeys: false });
  for (const key of ["j", "+", "G"]) {
    press(key);
  }
  expect(glidedTo()).toBe(0);
  expect(scrollTo).not.toHaveBeenCalled();
  press("ArrowDown");
  const step = glidedTo();
  expect(step).toBeGreaterThan(0);
  for (const key of ["k", "-"]) {
    press(key);
  }
  expect(glidedTo()).toBe(step);
  press("Home");
  expect(scrollTo).toHaveBeenCalledTimes(1);
});

/** The page's own scroll and folds: on the real page, the status line names `[ ] fold` and no `j k`. */
test("on the settings, `[` folds the navigation with the focus on a button, and scrolling is not hinted", async () => {
  await renderPage("/settings", fixtureRepo());
  const status = await screen.findByRole("contentinfo", { name: "Status line" });
  await waitFor(() => expect(status.textContent).toContain("[ ] fold"));
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

  press("j", button);
  await waitFor(() => expect(page().scrollTop).toBeGreaterThan(0));
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
