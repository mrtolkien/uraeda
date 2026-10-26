// The `g` go keys on the real app (US2 1, 2, 3, more 2): `g` then a letter goes to a page, `g g`
// scrolls to the top, and a pending `g` ends after 2 seconds or on a key no sequence uses. The keys
// are pressed on the page as a user's reach it; only the timers are faked, after the page loaded.
import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { atRepo, atWidth, quiet, renderPage } from "./helpers.tsx";

const scrollBy = vi.fn();
const scrollTo = vi.fn();

beforeEach(() => {
  atWidth(1440);
  window.scrollBy = scrollBy;
  window.scrollTo = scrollTo;
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: 5000,
  });
});

afterEach(() => {
  vi.useRealTimers();
  scrollBy.mockReset();
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

test("every go key opens its page: h i p d s and the comma (US2 table)", async () => {
  await loaded("/inbox");
  const pages: Array<[key: string, path: string]> = [
    ["h", "/"],
    ["p", "/priorities"],
    ["d", "/decisions"],
    ["s", "/sessions"],
    [",", "/settings"],
    ["i", "/inbox"],
  ];
  for (const [key, path] of pages) {
    press("g");
    press(key);
    expect(window.location.pathname).toBe(atRepo(path));
  }
});

test("g g scrolls the page to the top (US2 2)", async () => {
  await loaded("/");
  press("g");
  press("g");
  expect(scrollTo).toHaveBeenCalledTimes(1);
  expect(scrollTo.mock.calls[0]?.[0]).toMatchObject({ top: 0 });
});

test("a pending g ends after 2 seconds, and a later key acts as itself (US2 3)", async () => {
  await loaded("/");
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  press("g");
  act(() => void vi.advanceTimersByTime(1999));
  // Still pending: the vertical key is the sequence's, and nothing scrolls.
  press("j");
  expect(scrollBy).not.toHaveBeenCalled();

  press("g");
  act(() => void vi.advanceTimersByTime(2000));
  press("j");
  expect(scrollBy).toHaveBeenCalledTimes(1);
  // And `i` is no longer the second key of a go.
  press("i");
  expect(window.location.pathname).toBe(atRepo("/"));
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
