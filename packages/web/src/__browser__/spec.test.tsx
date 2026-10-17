// The spec page of the specs redesign: on the phone, each part takes the screen's width, without a
// card, its title and breadcrumbs sticking under the top bar while it scrolls (US5 2, 3).
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { atSize, commands, drawn, show } from "./helpers.tsx";

const FOLDER = "2026-10-17-spec-page";
const PAGE = `/f/${FOLDER}/spec.md`;

/** The top bar's bottom edge, which a sticking title sits right under. */
const barBottom = () => screen.getByRole("banner").getBoundingClientRect().bottom;

describe("on the phone", () => {
  atSize("phone");

  test("on the phone, the part and story stay at the top while you read (US5 2)", async () => {
    await commands.addSpecFeature();
    await show(PAGE, "Complete a repeating task");
    const story = screen.getByRole("region", { name: "Complete a repeating task" });

    // US2's second key scenario, 300 px down the screen: the story's head is above it.
    const scenario = within(story).getByText(/taps undo within 5/);
    window.scrollBy(0, scenario.getBoundingClientRect().top - 300);
    await drawn();

    // The story's head, its breadcrumbs then its title, sticks right below the top bar, over the
    // scenarios scrolled under it.
    const crumbs = within(story).getByText("What changes for users");
    const title = within(story).getByRole("heading", { name: "Complete a repeating task" });
    const top = crumbs.getBoundingClientRect().top;
    expect(top).toBeGreaterThanOrEqual(barBottom() - 0.5);
    expect(top).toBeLessThan(barBottom() + 16);
    expect(title.getBoundingClientRect().top).toBeGreaterThan(crumbs.getBoundingClientRect().top);
    expect(within(story).getByText("US2").getBoundingClientRect().top).toBeLessThan(
      title.getBoundingClientRect().bottom,
    );
    for (const element of [crumbs, title]) {
      const box = element.getBoundingClientRect();
      const shown = document.elementFromPoint(box.left + 4, box.top + box.height / 2);
      expect(element.contains(shown), element.textContent ?? "").toBe(true);
    }
    // The story's start scrolled under its head.
    expect(story.getBoundingClientRect().top).toBeLessThan(barBottom());
  });

  test("on the phone, no part has a card, and text runs to 12 px from the edges (US5 3)", async () => {
    await commands.addSpecFeature({ status: "approved" });
    await show(PAGE, "Complete a repeating task");

    const width = window.innerWidth;
    for (const name of ["What you approve", "Task storage", "Complete a repeating task"]) {
      const part = screen.getByRole("region", { name });
      const title = within(part).getByRole("heading", { name });
      expect(title.getBoundingClientRect().left, name).toBeCloseTo(12, 0);
      // The part takes the page's width, inside its 12 px inset.
      const box = part.getBoundingClientRect();
      expect(box.left, name).toBeCloseTo(12, 0);
      expect(box.right, name).toBeCloseTo(width - 12, 0);
    }
    const journey = screen.getByText(/Completing a repeating task moves it to its next due date/);
    expect(journey.getBoundingClientRect().left).toBeCloseTo(12, 0);
    expect(journey.getBoundingClientRect().right).toBeCloseTo(width - 12, 0);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
  });
});
