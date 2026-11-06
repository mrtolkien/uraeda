import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
import { keyboardFit } from "../layout/Sheet.tsx";
import { useKeyboardInset } from "../layout/useKeyboardInset.ts";

/** A visual viewport the test moves, as a phone's keyboard does as it opens. */
class Viewport extends EventTarget {
  height = window.innerHeight;
  offsetTop = 0;
}

afterEach(() => {
  Reflect.deleteProperty(window, "visualViewport");
});

/** A sheet that hugs its content stays above the keyboard: the inset follows the keyboard. */
test("the inset is how much of the screen's bottom the keyboard covers", () => {
  const viewport = new Viewport();
  Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  const { result } = renderHook(() => useKeyboardInset());
  expect(result.current).toBe(0);

  act(() => {
    viewport.height = window.innerHeight - 300;
    viewport.dispatchEvent(new Event("resize"));
  });
  expect(result.current).toBe(300);

  act(() => {
    viewport.offsetTop = 100;
    viewport.dispatchEvent(new Event("scroll"));
  });
  expect(result.current).toBe(200);
});

/**
 * A short sheet lifts by the whole keyboard, so its buttons stay above it, and a tall one, a capped
 * sheet with a field, shrinks to the room left, so its top, its title and Close, stays on the
 * screen. Break: a lift capped to keep the sheet's height, which left a 62% sheet's end, its Add
 * comment, under the keyboard.
 */
test("a sheet lifts by the keyboard, and shrinks to keep its top on the screen", () => {
  expect(keyboardFit(300, 844)).toEqual({ lift: 300, most: 844 - 300 - 16 });
  expect(keyboardFit(336, 844)).toEqual({ lift: 336, most: 492 });
  expect(keyboardFit(0, 844)).toBeUndefined();
});
