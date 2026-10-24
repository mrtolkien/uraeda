// The UI layout decision: an address that names a section scrolls to it, shown whole, below the
// phone's tabs, which stay in view, and with the title a pane draws over its top border.
import { screen } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { atSize, scrollStopped, show } from "./helpers.tsx";

atSize("both");

/** The element that scrolls `element`: its nearest ancestor with a scrolling overflow, or none. */
function scroller(element: Element): Element | undefined {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      parent.scrollHeight > parent.clientHeight
    ) {
      return parent;
    }
  }
  return undefined;
}

/**
 * The top of what shows of `element`'s scroller: the bottom of the phone's tabs, else the
 * scroller's top, else the window's.
 */
function visibleTop(element: Element): number {
  const tabs = screen.queryByRole("navigation", { name: "Tabs" });
  const box = scroller(element)?.getBoundingClientRect().top ?? 0;
  return Math.max(box, tabs?.getBoundingClientRect().bottom ?? 0);
}

/** How far a heading's top lies below the top of what shows: negative when it is cut. */
function room(name: RegExp) {
  const heading = screen.getByRole("heading", { name });
  return heading.getBoundingClientRect().top - visibleTop(heading);
}

/** Whether `name`'s heading's scroller, or the window, is scrolled to its end. */
function atEnd(name: RegExp) {
  const box = scroller(screen.getByRole("heading", { name })) ?? document.documentElement;
  return Math.ceil(box.scrollTop) >= box.scrollHeight - box.clientHeight - 1;
}

/** Whether a heading is scrolled to: near the top of what shows, or as near as the end lets it. */
function reached(name: RegExp) {
  return room(name) < 40 || atEnd(name);
}

async function scrolledTo(path: string, text: string, name: RegExp) {
  await show(path, text);
  await expect.poll(() => reached(name)).toBe(true);
  await scrollStopped();
  expect(reached(name)).toBe(true);
  // Shown whole: below the tabs, its title's top half over the pane's border too.
  expect(room(name)).toBeGreaterThanOrEqual(0);
}

test("a settings category's address shows its pane's title whole", async () => {
  await scrolledTo("/settings/runs", "Runs", /^Runs/);
});

test("a principle's address shows its heading whole", async () => {
  await scrolledTo(
    "/decisions/constitution/iii",
    "Asynchronous by default",
    /III\. Asynchronous by default/,
  );
});
