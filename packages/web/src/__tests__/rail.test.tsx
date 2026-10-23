// R18: the rail opens under the mouse only once it rests there, 250 ms: a pointer passing over the
// rail on its way to the page leaves it folded.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { useRail } from "../shell/Rail.tsx";

/** The rail's state on a bare navigation, its open state read in its name. */
function Rail() {
  const ref = useRef<HTMLElement>(null);
  const logo = useRef<HTMLButtonElement>(null);
  const rail = useRail(true, ref, logo);
  return <nav aria-label={rail.isOpen ? "Open" : "Folded"} ref={ref} {...rail.handlers} />;
}

afterEach(() => {
  vi.useRealTimers();
});

test("a pointer passing over the rail without resting leaves it folded", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  render(<Rail />);
  const nav = screen.getByRole("navigation");

  fireEvent.pointerOver(nav, { pointerType: "mouse" });
  act(() => vi.advanceTimersByTime(200));
  expect(screen.getByRole("navigation", { name: "Folded" })).toBe(nav);
  fireEvent.pointerOut(nav, { pointerType: "mouse" });
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole("navigation", { name: "Folded" })).toBe(nav);

  // Resting 250 ms opens it.
  fireEvent.pointerOver(nav, { pointerType: "mouse" });
  act(() => vi.advanceTimersByTime(249));
  expect(screen.getByRole("navigation", { name: "Folded" })).toBe(nav);
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("navigation", { name: "Open" })).toBe(nav);
});
