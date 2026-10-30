import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
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
