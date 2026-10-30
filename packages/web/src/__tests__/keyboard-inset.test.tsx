import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
import { liftOf } from "../layout/Sheet.tsx";
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
 * A short sheet lifts by the keyboard, but a tall one, a capped sheet with a field, keeps its top,
 * its title and Close, on the screen: it lifts by what room is left above it.
 */
test("a sheet lifts by the keyboard, never past the screen's top", () => {
  expect(liftOf(300, 400, 844)).toBe(300);
  expect(liftOf(380, 523, 844)).toBe(844 - 523 - 16);
  expect(liftOf(380, 900, 844)).toBe(0);
  expect(liftOf(0, 400, 844)).toBe(0);
});
