// The `g` go keys on the real app (US2 1, 2, 3, more 2): `g` then a letter goes to a page, `g g`
// scrolls to the top, and a pending `g`, its menu shown, waits for its key, ending on Escape or a key
// no sequence uses. The keys
// are pressed on the page as a user's reach it; only the timers are faked, after the page loaded.
import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { atRepo, atWidth, quiet, renderPage } from "./helpers.tsx";

const scrollTo = vi.fn();

/** Where the page is scrolled: the vertical keys glide its `scrollTop`. */
const scrolled = () => document.documentElement.scrollTop;

beforeEach(() => {
  atWidth(1440);
  window.scrollTo = scrollTo;
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: 5000,
  });
  document.documentElement.scrollTop = 0;
});

afterEach(() => {
  vi.useRealTimers();
  scrollTo.mockReset();
});

const press = (key: string) => fireEvent.keyDown(document.body, { key, shiftKey: key === "G" });

/** The page's heading is drawn and the requests answered: the shell is listening. */
async function loaded(path: string) {
  await renderPage(path);
  await screen.findByRole("navigation", { name: "Navigation" });
  await quiet();
}

test("g then i on the priorities opens the inbox (US2 1)", async () => {
  await loaded("/priorities");
  press("g");
  press("i");
  expect(window.location.pathname).toBe(atRepo("/inbox"));
});

test("every go key opens its page: h i p d s j and the comma (US2 table)", async () => {
  await loaded("/inbox");
  const pages: Array<[key: string, path: string]> = [
    ["h", "/"],
    ["p", "/priorities"],
    ["d", "/decisions"],
    ["s", "/sessions"],
    ["j", "/jobs"],
    [",", "/settings"],
    ["i", "/inbox"],
  ];
  for (const [key, path] of pages) {
    press("g");
    press(key);
    expect(window.location.pathname).toBe(atRepo(path));
  }
});

// On the settings, a page with no rows: a list's `g g` goes to its first row instead.
test("g g scrolls the page to the top (US2 2)", async () => {
  await loaded("/settings");
  press("g");
  press("g");
  expect(scrollTo).toHaveBeenCalledTimes(1);
  expect(scrollTo.mock.calls[0]?.[0]).toMatchObject({ top: 0 });
});

// On the settings, a page with no rows, where `j` scrolls: home's lists take it. Changed by the
// keyboard walkthrough of 2026-11-05, which asked that a menu being read waits for its key, as
// LazyVim's which-key does: it once ended after 2 seconds, under the reader's eyes (US2 3).
// Break: a pending g ending on its own once its menu shows.
test("a pending g waits for its key past 2 seconds, and Escape ends it, a later key acting as itself", async () => {
  await loaded("/settings");
  // The frames too, which the scroll glides on.
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
    ],
  });
  press("g");
  act(() => void vi.advanceTimersByTime(5000));
  // Still pending: a vertical key is the sequence's, and nothing scrolls (`j` is no such key: it is
  // the go key of Jobs).
  press("k");
  act(() => void vi.advanceTimersByTime(1000));
  expect(scrolled()).toBe(0);

  press("g");
  act(() => void vi.advanceTimersByTime(5000));
  press("Escape");
  press("j");
  act(() => void vi.advanceTimersByTime(1000));
  expect(scrolled()).toBeGreaterThan(0);
  // And `i` is no longer the second key of a go.
  press("i");
  expect(window.location.pathname).toBe(atRepo("/settings"));
});

test("a pending g read past 2 seconds still goes: `g` then `i` opens the inbox (US2 3)", async () => {
  await loaded("/");
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  press("g");
  act(() => void vi.advanceTimersByTime(5000));

  press("i");

  expect(window.location.pathname).toBe(atRepo("/inbox"));
});

test("g then a key no sequence uses ends it, and the key does nothing (US2 more 2)", async () => {
  await loaded("/priorities");
  press("g");
  press("x");
  expect(window.location.pathname).toBe(atRepo("/priorities"));
  // The sequence ended: `i` is no go key now, and the page stays.
  press("i");
  expect(window.location.pathname).toBe(atRepo("/priorities"));
  expect(scrollTo).not.toHaveBeenCalled();
});
