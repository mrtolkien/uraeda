// The spec page in titled panes: on the phone, each pane takes the page's width (US1); a decision's
// lines keep their measure; a link to a part opens the page at it; the page is accessible.
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { backdrop, contrast, over, rgb } from "./colours.ts";
import { atSize, checkLayout, colorScheme, commands, drawn, show } from "./helpers.tsx";

const FOLDER = "2026-10-17-spec-page";
const PAGE = `/f/${FOLDER}/spec.md`;

describe("on the phone", () => {
  atSize("phone");

  test("on the phone, the panes take the page's width, a story's and a decision's text to 14.4 px from the edges (US1, at 120%)", async () => {
    await commands.addSpecFeature({ status: "approved" });
    await show(PAGE, "US2 · Complete a repeating task");

    const width = window.innerWidth;
    // The page's 12 px inset, at the UI look decision's 120% (R5).
    const inset = 14.4;
    for (const name of [
      "Approved on 2026-10-18.",
      "Task storage",
      "US2 · Complete a repeating task",
    ]) {
      // Each pane takes the page's width, inside its inset.
      const box = screen.getByRole("region", { name }).getBoundingClientRect();
      expect(box.left, name).toBeCloseTo(inset, 0);
      expect(box.right, name).toBeCloseTo(width - inset, 0);
    }
    // Every pane keeps only its titled top border on the phone, a story's and a decision's alike:
    // its title starts at the page's inset, and its text runs to it.
    for (const name of ["Task storage", "US2 · Complete a repeating task"]) {
      const pane = screen.getByRole("region", { name });
      const title = within(pane).getByRole("heading", { name: new RegExp(`^${name}`) });
      expect(title.getBoundingClientRect().left, name).toBeCloseTo(inset, 0);
      expect(getComputedStyle(pane).borderLeftWidth, name).toBe("0px");
      expect(getComputedStyle(pane).borderRightWidth, name).toBe("0px");
    }
    // A decision's note, and its ledger's rows, their signs first, start at the page's inset.
    const storage = screen.getByRole("region", { name: "Task storage" });
    for (const text of [
      /Completing a repeating task moves it to its next due date/,
      /^An upgrade that cannot read a saved\s+value clears it/,
    ]) {
      const box = screen.getByText(text).getBoundingClientRect();
      expect(box.left, String(text)).toBeCloseTo(inset, 0);
      expect(box.right, String(text)).toBeLessThanOrEqual(width - inset + 0.5);
    }
    const sign = within(storage).getAllByRole("img", { name: "Changed" })[0]!;
    expect(sign.getBoundingClientRect().left, "a row's sign").toBeCloseTo(inset, 0);
    const journey = screen.getByText(/Completing a repeating task moves it to its next due date/);
    expect(journey.getBoundingClientRect().right).toBeCloseTo(width - inset, 0);
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
    expect(screen.queryByRole("list", { name: "Parts" })).toBeNull();
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

  /**
   * Review comment C1 of the spec, and US2 1: colours by strength, no side bar, and only removed
   * words struck, as the spec page's ledger strikes them (R6).
   */
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
    // A soft colour is its hard one four fifths over the pane's surface: apart from it, but
    // near it, and never past it.
    for (const [soft, hard] of [
      [should!, must!],
      [shouldNot!, mustNot!],
    ] as const) {
      const gaps = soft.map((channel, at) => Math.abs(channel - hard[at]!));
      expect(Math.max(...gaps)).toBeGreaterThan(0.02);
      expect(Math.max(...gaps)).toBeLessThan(0.5);
    }
    expect(should).not.toEqual(must);
    expect(shouldNot).not.toEqual(mustNot);
    // The neutral is grey.
    expect(Math.max(...may!) - Math.min(...may!)).toBeLessThan(0.15);

    const deletions = within(card).queryAllByRole("deletion");
    for (const element of [card, ...card.querySelectorAll("*")]) {
      const style = getComputedStyle(element);
      const name = element.textContent?.slice(0, 60);
      if (style.textDecorationLine.includes("line-through")) {
        expect(deletions.some((deletion) => deletion.contains(element))).toBe(true);
      }
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

/**
 * The non-text contrast (WCAG 1.4.11) axe does not check: each strength's icon over what is behind
 * it, and the edge of the selection over the card around it, each at least 3:1. A removed part's
 * tint is no edge of its own: its sign and its strike tell it (R6).
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
  const selected = within(main).getByRole("button", { pressed: true }).parentElement!;
  const style = getComputedStyle(selected);
  const around = backdrop(selected.parentElement);
  const edge = Number.parseFloat(style.borderInlineStartWidth) > 0;
  // On the phone, a selected block's bar is a shadow before its text (R24 of the questions page).
  const bar = style.boxShadow === "none" ? undefined : /rgba?\([^)]*\)/.exec(style.boxShadow)?.[0];
  const colour = over(edge ? style.borderInlineStartColor : (bar ?? style.backgroundColor), around);
  expect(contrast(colour, around), "selection").toBeGreaterThanOrEqual(3);
}

/** Whether an element shows at the top of the window, below the phone's top bar. */
function atTop(element: Element | null) {
  const top = element?.getBoundingClientRect().top ?? -1;
  // A wide screen has no top bar.
  const bar = document.querySelector('[role="banner"]')?.getBoundingClientRect().bottom ?? 0;
  return top >= 0 && top < Math.max(bar, 0) + 90;
}

describe("at both sizes", () => {
  atSize("both");

  test("a link to a section or a story of the spec opens the page at it", async () => {
    await commands.addSpecFeature();
    for (const anchor of ["us2-complete-a-repeating-task-p1", "user-stories", "risk-tier"]) {
      await show(`${PAGE}#${anchor}`, "US2 · Complete a repeating task");
      await expect
        .poll(() => atTop(document.getElementById(anchor)), { message: anchor })
        .toBe(true);
    }
    expect(document.getElementById("us2-complete-a-repeating-task-p1")).toBe(
      screen.getByRole("region", { name: "US2 · Complete a repeating task" }),
    );
  });

  /**
   * WCAG 1.4.11: each strength's icon, a graphic that tells the rule's strength, at 3:1 over the
   * surface it sits on: the pane's body on a wide screen, the page's on the phone, where the pane
   * has no background of its own.
   */
  test("the five strength icons read at 3:1 over their surface, in both schemes", async () => {
    await commands.addSpecFeature();
    await commands.commitOnBranch(FOLDER, { "specs/decisions/due-dates.md": DUE_DATES });
    await show(PAGE, "Due dates");
    const card = screen.getByRole("region", { name: "Due dates" });
    for (const mode of ["light", "dark"] as const) {
      await colorScheme(mode);
      await drawn();
      for (const name of ["Must", "Should", "Should not", "Must not", "May"]) {
        const icon = within(card).getByRole("img", { name });
        const behind = backdrop(icon);
        const ratio = contrast(over(getComputedStyle(icon).color, behind), behind);
        expect(ratio, `${mode}: ${name}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

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
