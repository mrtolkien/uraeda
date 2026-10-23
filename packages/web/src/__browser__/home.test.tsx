// Layout and look US3, SC-003: home at half a screen, 1205 px, keeps two columns: In progress beside
// Sessions, and the widgets two by two, centred in the page; on the phone, one column in the same
// order. Each passes the layout checks in both schemes.
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { atSize, checkLayout, colorScheme, drawn, show } from "./helpers.tsx";

const MODES = (["light", "dark"] as const).map((mode) => ({ mode }));

/** A pane of home, drawn: its box. */
function box(title: string) {
  return screen.getByRole("region", { name: title }).getBoundingClientRect();
}

describe("at semi-wide", () => {
  atSize("semi");

  /** US3 2, SC-003 */
  test.each(MODES)("two columns at 1205 px, in $mode", async ({ mode }) => {
    await colorScheme(mode);
    await show("/", "Overview");
    await drawn();

    const progress = box("In progress");
    const sessions = box("Sessions");
    expect(Math.round(sessions.top)).toBe(Math.round(progress.top));
    expect(sessions.left).toBeGreaterThan(progress.right);

    const priorities = box("Priorities now");
    const usage = box("Usage");
    const inbox = box("Inbox");
    const recent = box("Recent");
    expect(Math.round(usage.top)).toBe(Math.round(priorities.top));
    expect(usage.left).toBeGreaterThan(priorities.right);
    expect(inbox.top).toBeGreaterThan(priorities.bottom);
    expect(Math.round(recent.top)).toBe(Math.round(inbox.top));
    expect(Math.round(inbox.left)).toBe(Math.round(priorities.left));

    // Centred in the page, beside the rail.
    const main = screen.getByRole("main").getBoundingClientRect();
    const needs = box("Needs you");
    expect(Math.abs(needs.left - main.left - (main.right - needs.right))).toBeLessThan(2);

    await checkLayout();
  });
});

describe("on the phone", () => {
  atSize("phone");

  /** US3 more 2 */
  test.each(MODES)("one column, in the same order, in $mode", async ({ mode }) => {
    await colorScheme(mode);
    await show("/", "Overview");
    await drawn();

    const order = ["Needs you", "In progress", "Sessions", "Priorities now", "Usage", "Inbox"];
    const boxes = [...order, "Recent"].map(box);
    for (const [index, pane] of boxes.entries()) {
      expect(Math.round(pane.left)).toBe(Math.round(boxes[0]!.left));
      if (index > 0) {
        expect(pane.top).toBeGreaterThan(boxes[index - 1]!.bottom);
      }
    }

    await checkLayout();
  });
});
