// The spec page of the specs redesign: on the phone, each part takes the screen's width, without a
// card, its title and breadcrumbs sticking under the top bar while it scrolls (US5 2, 3).
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { atSize, checkLayout, colorScheme, commands, drawn, show } from "./helpers.tsx";

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

/** A colour's red, green, blue, and alpha, from 0 to 1, whatever the form WebKit gives it in. */
function rgba(colour: string): [number, number, number, number] {
  if (colour === "transparent") {
    return [0, 0, 0, 0];
  }
  const [r, g, b] = rgb(colour);
  const numbers = [...colour.matchAll(/[\d.]+/g)].map((match) => Number(match[0]));
  return [r, g, b, numbers.length > 3 ? numbers[3]! : 1];
}

/** Whether an element has a background of its own. */
const tinted = (element: Element) => rgba(getComputedStyle(element).backgroundColor)[3] > 0;

/** `top` laid over `bottom`, an opaque colour, by its alpha. */
function over(top: string, bottom: [number, number, number]): [number, number, number] {
  const [r, g, b, a] = rgba(top);
  return [r * a + bottom[0] * (1 - a), g * a + bottom[1] * (1 - a), b * a + bottom[2] * (1 - a)];
}

/** The opaque colour behind an element's content: its background over those of the boxes around it. */
function backdrop(element: Element | null): [number, number, number] {
  const layers: Array<string> = [];
  for (let at = element; at; at = at.parentElement) {
    layers.push(getComputedStyle(at).backgroundColor);
  }
  return layers.reduceRight<[number, number, number]>(
    (below, layer) => over(layer, below),
    [1, 1, 1],
  );
}

/** A channel of a colour, from 0 to 1, without its gamma. */
const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** A colour's relative luminance, as WCAG counts it. */
function luminance([r, g, b]: [number, number, number]) {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** The contrast ratio of two opaque colours, from 1 to 21. */
function contrast(a: [number, number, number], b: [number, number, number]) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

/**
 * The non-text contrast (WCAG 1.4.11) axe does not check: each strength's icon over what is behind
 * it, and the edge of a removed part's red tint and of the selection over the card around them,
 * each at least 3:1.
 */
function checkNonTextContrast() {
  const main = screen.getByRole("main");
  const icons = ["Must", "Should", "Should not", "Must not", "May"].flatMap((name) =>
    within(main).queryAllByRole("img", { name }),
  );
  expect(icons.length).toBeGreaterThan(3);
  for (const icon of icons) {
    const colour = over(getComputedStyle(icon).color, backdrop(icon));
    const name = icon.getAttribute("aria-label");
    expect(contrast(colour, backdrop(icon)), `${name} icon`).toBeGreaterThanOrEqual(3);
  }
  // A part removed whole, its words not marked one by one: the box around them that has a tint.
  const words = within(main)
    .getAllByRole("deletion")
    .find((element) => !tinted(element))!;
  let tint: Element = words;
  while (!tinted(tint) && tint.parentElement) {
    tint = tint.parentElement;
  }
  const selected = within(main).getByRole("button", { pressed: true }).parentElement!;
  for (const [name, box] of Object.entries({ removed: tint, selection: selected })) {
    const style = getComputedStyle(box);
    const around = backdrop(box.parentElement);
    const edge = Number.parseFloat(style.borderInlineStartWidth) > 0;
    const colour = over(edge ? style.borderInlineStartColor : style.backgroundColor, around);
    expect(contrast(colour, around), name).toBeGreaterThanOrEqual(3);
  }
}

describe("at both sizes", () => {
  atSize("both");

  /** SC-004 */
  test("the spec page is accessible in both themes, every fold open", async () => {
    await commands.addSpecFeature();
    // Due dates with a rule of each strength, so each icon's colour is checked.
    await commands.commitOnBranch(FOLDER, { "specs/decisions/due-dates.md": DUE_DATES });
    await show(PAGE, "Task storage");
    const main = screen.getByRole("main");
    // Every fold open: the stories' more scenarios, the decisions' unchanged and removed parts, the
    // niche edge cases, and the history.
    for (
      let folded = within(main).queryAllByRole("button", { expanded: false });
      folded.length > 0;
    ) {
      for (const fold of folded) {
        fireEvent.click(fold);
      }
      await drawn();
      folded = within(main).queryAllByRole("button", { expanded: false });
    }
    expect(within(main).getByText(/EVERY MONDAY/)).toBeTruthy();
    // A decision's part selected, as a tap starts a comment on it.
    const card = within(main).getByRole("region", { name: "Task storage" });
    fireEvent.click(within(card).getAllByRole("button", { pressed: false })[0]!);
    await drawn();

    for (const mode of ["light", "dark"] as const) {
      await colorScheme(mode);
      await drawn();
      checkNonTextContrast();
      await checkLayout();
    }
  });
});
