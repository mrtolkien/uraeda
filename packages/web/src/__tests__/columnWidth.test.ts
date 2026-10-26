// The navigation column's stored width and fold: kept under `uraeda.nav`, within 220 and 480 px;
// what Astryx's old navigation kept under `astryx-resizable:uraeda.nav` is read once, its width
// clamped and its fold kept, and moved to the new key.
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { NAV_KEY, readColumn } from "../shell/columnWidth.ts";

const OLD_KEY = "astryx-resizable:uraeda.nav";

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

test("nothing kept reads as nothing", () => {
  expect(readColumn()).toEqual({});
});

test.each([
  ["a width, within the limits", { isCollapsed: false, size: 300 }, { width: 300 }],
  ["a width past the most, clamped to 480", { isCollapsed: false, size: 900 }, { width: 480 }],
  ["a width under the least, clamped to 220", { isCollapsed: false, size: 100 }, { width: 220 }],
  ["a fold, with its width", { isCollapsed: true, size: 300 }, { folded: true, width: 300 }],
  ["a fold without a width", { isCollapsed: true }, { folded: true }],
  ["a bare number, a width", 300, { width: 300 }],
])("Astryx's old key with %s is read once, then moved to the new key", (_, old, column) => {
  window.localStorage.setItem(OLD_KEY, JSON.stringify(old));

  expect(readColumn()).toEqual(column);

  expect(window.localStorage.getItem(OLD_KEY)).toBeNull();
  expect(window.localStorage.getItem(NAV_KEY)).toBe(JSON.stringify(column));
  expect(readColumn()).toEqual(column);
});

test("an old key keeping nothing is dropped, and nothing is written", () => {
  window.localStorage.setItem(OLD_KEY, JSON.stringify({ isCollapsed: false }));

  expect(readColumn()).toEqual({});

  expect(window.localStorage.getItem(OLD_KEY)).toBeNull();
  expect(window.localStorage.getItem(NAV_KEY)).toBeNull();
});

test("the new key wins over the old, which stays", () => {
  window.localStorage.setItem(NAV_KEY, JSON.stringify({ width: 320 }));
  window.localStorage.setItem(OLD_KEY, JSON.stringify({ isCollapsed: true, size: 300 }));

  expect(readColumn()).toEqual({ width: 320 });
  expect(window.localStorage.getItem(OLD_KEY)).not.toBeNull();
});

test.each([
  ["a width", { width: 320 }, { width: 320 }],
  ["a fold, with its width", { folded: true, width: 300 }, { folded: true, width: 300 }],
  ["a width past the most, clamped", { width: 900 }, { width: 480 }],
  ["a width under the least, clamped", { width: 10 }, { width: 220 }],
  ["a width that is no number, left out", { folded: true, width: "wide" }, { folded: true }],
])("the new key with %s", (_, kept, column) => {
  window.localStorage.setItem(NAV_KEY, JSON.stringify(kept));

  expect(readColumn()).toEqual(column);
});

test("a key that is not readable reads as nothing", () => {
  window.localStorage.setItem(NAV_KEY, "{wide");

  expect(readColumn()).toEqual({});
});
