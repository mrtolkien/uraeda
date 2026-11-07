// The phone's sheet follows a swipe on its top, its handle and title row: down closes it, up takes
// it to the whole screen. Astryx's sheet closes on a swipe only when its purpose is `info`, and
// most sheets are forms: a swipe down sprang back, and did nothing else.
import { act, fireEvent, render } from "@testing-library/react";
import { createRef } from "react";
import { beforeEach, expect, test, vi } from "vite-plus/test";
import { Sheet } from "../layout/Sheet.tsx";
import { atWidth } from "./helpers.tsx";

beforeEach(() => {
  atWidth(402);
});

/** Where the sheet's top is on the screen, in the tests. */
const TOP = 100;

/** Renders an open sheet of `purpose`, its top at `TOP`, and returns its panel and Close. */
function openSheet(purpose: "form" | "info", content = <p>Body</p>) {
  const onClose = vi.fn();
  const ref = createRef<HTMLDivElement>();
  render(
    <Sheet isOpen label="Session" onClose={onClose} purpose={purpose} ref={ref}>
      {content}
    </Sheet>,
  );
  const panel = ref.current;
  if (!panel) {
    throw new Error("no panel");
  }
  panel.getBoundingClientRect = () => ({ top: TOP }) as DOMRect;
  return { onClose, panel };
}

/** A finger's swipe on `target`, from `from` to `to`, on the screen's y axis. */
function swipe(target: Element, from: number, to: number) {
  const at = (clientY: number) => [{ clientX: 50, clientY, identifier: 0, target }];
  act(() => {
    fireEvent.touchStart(target, { changedTouches: at(from), touches: at(from) });
    fireEvent.touchMove(target, {
      changedTouches: at((from + to) / 2),
      touches: at((from + to) / 2),
    });
    fireEvent.touchMove(target, { changedTouches: at(to), touches: at(to) });
    fireEvent.touchEnd(target, { changedTouches: at(to), touches: [] });
  });
}

// Break: take the swipe down out of `useTopSwipe`.
test("a swipe down on a form sheet's top closes it", () => {
  const { onClose, panel } = openSheet("form");

  swipe(panel.firstElementChild ?? panel, TOP + 10, TOP + 150);

  expect(onClose).toHaveBeenCalledTimes(1);
});

// Astryx closes an `info` sheet on a swipe itself: a second close would go Back twice, leaving the
// page. Break: give `useTopSwipe` the `onClose` of every sheet.
test("a swipe down on an info sheet is Astryx's to close, so it closes once", () => {
  const { onClose, panel } = openSheet("info");

  swipe(panel.firstElementChild ?? panel, TOP + 10, TOP + 150);
  act(() => {
    fireEvent.click(panel.querySelector('[aria-label="Close"]') ?? panel);
  });

  expect(onClose).toHaveBeenCalledTimes(1);
});

test("a short drag, or a swipe below the sheet's top, keeps it open", () => {
  const { onClose, panel } = openSheet("form");

  swipe(panel, TOP + 10, TOP + 20);
  swipe(panel, TOP + 200, TOP + 400);

  expect(onClose).not.toHaveBeenCalled();
});

// Break: drop the scroll check: a swipe down that scrolls the content back up would close it.
test("a swipe down on content scrolled down scrolls it, and keeps the sheet open", () => {
  const { onClose, panel } = openSheet(
    "form",
    <div data-testid="list">
      <p>Line</p>
    </div>,
  );
  const list = panel.querySelector<HTMLElement>('[data-testid="list"]');
  if (!list) {
    throw new Error("no list");
  }
  list.scrollTop = 80;

  swipe(list, TOP + 30, TOP + 200);

  expect(onClose).not.toHaveBeenCalled();
});

// Break: listen to pointer events alone, which iOS WebKit cancels on the handle.
test("a swipe up on the sheet's top takes it to the whole screen", () => {
  const { panel } = openSheet("form");
  expect(panel.outerHTML).not.toContain("100dvh");

  swipe(panel.firstElementChild ?? panel, TOP + 10, TOP - 60);

  expect(panel.outerHTML).toContain("100dvh");
});
