// The spec page of the specs redesign: on the phone, each part takes the screen's width, without a
// card, its title and breadcrumbs sticking under the top bar while it scrolls (US5 2, 3).
import { fireEvent, screen, within } from "@testing-library/react";
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

  test("on the phone, a part's head pushed away slides under the top bar", async () => {
    await commands.addSpecFeature();
    await show(PAGE, "Complete a repeating task");
    // US1's end at the bar's bottom: its head, pushed up by it, overlaps the bar.
    const story = screen.getByRole("region", { name: "Make a task repeat" });
    window.scrollBy(0, story.getBoundingClientRect().bottom - barBottom());
    await drawn();
    const head = within(story).getByRole("heading", { name: "Make a task repeat" });
    expect(head.getBoundingClientRect().bottom).toBeLessThan(barBottom());
    expect(head.getBoundingClientRect().bottom).toBeGreaterThan(0);

    const banner = screen.getByRole("banner");
    const box = banner.getBoundingClientRect();
    for (const y of [box.top + 8, head.getBoundingClientRect().top + 8]) {
      const shown = document.elementFromPoint(box.left + box.width / 2, y);
      expect(banner.contains(shown), `${y}: ${shown?.textContent?.slice(0, 40)}`).toBe(true);
    }
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

/** The width of a "0" in an element's font: its `ch`. */
function characterWidth(element: Element) {
  const style = getComputedStyle(element);
  const context = document.createElement("canvas").getContext("2d")!;
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return context.measureText("0").width;
}

/** The width of an element's widest line of text, in px. */
function widestLine(element: Element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  const lines = new Map<number, { left: number; right: number }>();
  for (const rect of range.getClientRects()) {
    if (rect.width === 0) {
      continue;
    }
    const key = Math.round(rect.bottom);
    const seen = lines.get(key);
    lines.set(key, {
      left: Math.min(seen?.left ?? rect.left, rect.left),
      right: Math.max(seen?.right ?? rect.right, rect.right),
    });
  }
  return Math.max(0, ...[...lines.values()].map(({ left, right }) => right - left));
}

/** A computed colour's red, green, and blue, from 0 to 1, whatever the form WebKit gives it in. */
function rgb(colour: string): [number, number, number] {
  const numbers = [...colour.matchAll(/[\d.]+/g)].map((match) => Number(match[0]));
  const scale = colour.startsWith("color(") ? 1 : 255;
  return [numbers[0]! / scale, numbers[1]! / scale, numbers[2]! / scale];
}

/** Due dates, its rules one of each strength. */
const DUE_DATES = [
  "---\nstatus: proposed\napproved-by:\n---\n\n# Due dates\n",
  "Due dates are calendar days.\n\n## Rules\n",
  "- Due dates MUST be stored as `YYYY-MM-DD` text. Checked by the `CalendarDay` type.",
  "- Date arithmetic SHOULD go through `date-fns`. Checked by review.",
  "- Due dates SHOULD NOT show a time. Checked by the UI tests.",
  "- Due dates MUST NOT carry a timezone. Checked by the store's tests.",
  "- Lists MAY sort by due date. Checked by review.\n",
].join("\n");

describe("on a wide screen", () => {
  atSize("desktop");

  /** US2 more 3 */
  test("a decision card's lines hold at most 75 characters at 1440 px", async () => {
    await commands.addSpecFeature();
    await show(PAGE, "Task storage");
    // "Contents" hidden, the card takes the page's whole width, where the page's measure would not
    // hold its lines.
    fireEvent.keyDown(document.body, { code: "BracketRight", key: "]" });
    await drawn();
    expect(screen.queryByRole("complementary", { name: "Contents" })).toBeNull();
    const card = screen.getByRole("region", { name: "Task storage" });
    for (const fold of within(card).getAllByRole("button", { expanded: false })) {
      fireEvent.click(fold);
    }
    await drawn();

    // 75ch, the round's measure, of the card's reading text: each line of each part, the note's
    // and the intent's included, and of the muted checks, is at most 75 of its "0"s wide (R82).
    const zero = characterWidth(within(card).getByText(/^Data MUST be stored in IndexedDB/));
    const parts = within(card)
      .getAllByRole("button", { pressed: false })
      .map((toggle) => document.getElementById(toggle.getAttribute("aria-labelledby") ?? "")!);
    expect(parts.length).toBeGreaterThan(5);
    for (const part of parts) {
      expect(widestLine(part), part.textContent?.slice(0, 60)).toBeLessThanOrEqual(75 * zero + 1);
    }
  });

  /** Review comment C1 of the spec, and US2 1: colours by strength, no side bar, nothing struck. */
  test("the strength icon takes its strength's colour, and the card has no side bar", async () => {
    await commands.addSpecFeature();
    await commands.commitOnBranch(FOLDER, { "specs/decisions/due-dates.md": DUE_DATES });
    await show(PAGE, "Due dates");
    const card = screen.getByRole("region", { name: "Due dates" });
    const colour = (name: string) =>
      rgb(getComputedStyle(within(card).getByRole("img", { name })).color);

    const [must, should, shouldNot, mustNot, may] = [
      "Must",
      "Should",
      "Should not",
      "Must not",
      "May",
    ].map(colour);
    for (const [name, [r, g, b]] of Object.entries({ must, should })) {
      expect(g, name).toBeGreaterThan(Math.max(r, b));
    }
    for (const [name, [r, g, b]] of Object.entries({ mustNot, shouldNot })) {
      expect(r, name).toBeGreaterThan(Math.max(g, b));
    }
    // A soft colour is apart from its hard one; the neutral is grey.
    expect(should).not.toEqual(must);
    expect(shouldNot).not.toEqual(mustNot);
    expect(Math.max(...may!) - Math.min(...may!)).toBeLessThan(0.15);

    for (const element of [card, ...card.querySelectorAll("*")]) {
      const style = getComputedStyle(element);
      const name = element.textContent?.slice(0, 60);
      expect(style.textDecorationLine, name).not.toContain("line-through");
      // A bar is a border on one side alone: a card's own border goes all around.
      const start = Number.parseFloat(style.borderLeftWidth);
      const visible = start > 0 && rgb(style.borderLeftColor).length === 3;
      if (visible && !/rgba\(.*, 0\)$|transparent/.test(style.borderLeftColor)) {
        expect(style.borderLeftColor, name).toBe(style.borderRightColor);
        expect(style.borderLeftWidth, name).toBe(style.borderRightWidth);
      }
    }
  });
});
