// The feature page at both sizes: every stage's line on one line on a desktop (C3), "Next" beside
// the agent on a desktop and first on the phone (C8), and every layout check in both themes, over
// the feature page's features of `.storybook/featurePages.ts`, their times read in UTC.
import { screen, within } from "@testing-library/react";
import { page, userEvent } from "vite-plus/test/browser";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { FEATURE_PAGES } from "../../.storybook/checkouts.ts";
import { atSize, checkLayout, colorScheme, commands, drawn, show } from "./helpers.tsx";

/** The done feature's stages and their lines: its build started the day after its plan. */
const DONE_LINES: Array<[string, string]> = [
  ["Proposal", "10:52 · 26 min"],
  ["Questions", "11:18 · 53 min"],
  ["Spec", "12:11 · 2 h 50 min"],
  ["Plan", "15:01 · 18 h 9 min"],
  ["Build", "Oct 18, 09:10 · 6 h 55 min"],
  ["Pull request", "16:05 · 6 min"],
  ["Merged", "16:11"],
];

/** The stage of this label, in the stages' list. */
function stage(label: string): HTMLElement {
  const item = within(screen.getByRole("list", { name: "Stages" }))
    .getAllByRole("listitem")
    .find((li) => within(li).queryByText(label, { exact: true }));
  if (!item) {
    throw new Error(`No stage ${label}`);
  }
  return item;
}

/** How many line boxes an element's text is drawn in. */
function lineBoxes(element: Element): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
}

/**
 * A stage's label and line, its no-break spaces matched as spaces: how many line boxes each takes,
 * and whether the line stays inside its own stage, rather than running over the next.
 */
function stageLine(label: string, line: string) {
  const item = stage(label);
  const text = within(item).getByText(line);
  // The text itself, not its block, which takes its stage's width whatever the text does.
  const range = document.createRange();
  range.selectNodeContents(text);
  const drawn = range.getBoundingClientRect();
  const own = item.getBoundingClientRect();
  return {
    inside: drawn.left >= own.left - 0.5 && drawn.right <= own.right + 0.5,
    label: lineBoxes(within(item).getByText(label, { exact: true })),
    line: lineBoxes(text),
  };
}

describe("on a desktop", () => {
  atSize("desktop");

  afterEach(async () => {
    await page.viewport(1440, 900);
  });

  // C3, at every desktop width the browser tests use, the sidebar open: one row where it holds, at
  // 1920 and 1440 px, and a column where it would not (R22).
  test("every stage's line fits on one line on a desktop", async () => {
    await commands.addFeaturePages();
    for (const width of [1920, 1440, 1200, 1024]) {
      await page.viewport(width, 900);
      await expect.poll(() => window.innerWidth).toBe(width);
      await show(`/f/${FEATURE_PAGES.done}`, "What it produced");
      await drawn();
      const nav = screen.getByRole("navigation", { name: "Side navigation" });
      expect(within(nav).getByRole("button", { name: "Collapse sidebar" })).toBeTruthy();
      for (const [label, line] of DONE_LINES) {
        expect(stageLine(label, line), `${width}: ${label}`).toEqual({
          inside: true,
          label: 1,
          line: 1,
        });
      }
      if (width === 1200) {
        // Another feature, opened from the sidebar, is measured anew: its shorter lines hold.
        await userEvent.click(
          within(nav).getAllByRole("link", { name: /recurring.reminders/i })[0]!,
        );
        await screen.findByRole("heading", { name: "You review the spec" });
        await drawn();
        expect(stage("Proposal").getBoundingClientRect().top).toBeCloseTo(
          stage("Spec").getBoundingClientRect().top,
          0,
        );
      }
      if (width >= 1440) {
        // One row: Build beside Plan.
        const plan = stage("Plan").getBoundingClientRect();
        const build = stage("Build").getBoundingClientRect();
        expect(Math.round(build.top), `${width}`).toBe(Math.round(plan.top));
        expect(build.left, `${width}`).toBeGreaterThanOrEqual(plan.right - 0.5);
      }
    }
  });
});

/** Where "Next" and the agent's card are drawn. */
function nextAndAgent() {
  return {
    agent: screen.getByRole("region", { name: "Agent" }).getBoundingClientRect(),
    next: screen.getByRole("region", { name: "Next" }).getBoundingClientRect(),
  };
}

describe("Next and the agent", () => {
  atSize("both");

  // C8.
  test("Next comes first on the phone, beside the agent on a desktop", async () => {
    await commands.addFeaturePages();
    await show(`/f/${FEATURE_PAGES.working}`, "The agent is building");
    await drawn();
    const { agent, next } = nextAndAgent();
    if (window.innerWidth >= 768) {
      expect(Math.round(agent.top)).toBe(Math.round(next.top));
      expect(agent.left).toBeGreaterThan(next.right);
      expect(next.width / agent.width).toBeGreaterThan(1.8);
      expect(next.width / agent.width).toBeLessThan(2.2);
    } else {
      expect(next.bottom).toBeLessThanOrEqual(agent.top);
    }
  });
});

/** The red, green, and blue of an element's text colour. */
function rgb(element: Element): Array<number> {
  return (getComputedStyle(element).color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
}

describe("lines changed", () => {
  atSize("desktop");

  // C4: drawn, not only named, in green and red.
  test("lines added read in green and removed in red", async () => {
    await commands.addFeaturePages();
    await show(`/f/${FEATURE_PAGES.done}`, "What it produced");
    const card = screen.getByRole("group", { name: "Lines changed" });
    const [red, green, blue] = rgb(within(card).getByText("+1,222"));
    expect(green).toBeGreaterThan(Math.max(red!, blue!) + 40);
    const [red2, green2, blue2] = rgb(within(card).getByText("−310"));
    expect(red2).toBeGreaterThan(Math.max(green2!, blue2!) + 40);
  });
});

/** Every state the page draws without `gh`, by a text that says it is drawn. */
const STATES: Array<[string, string]> = [
  [FEATURE_PAGES.working, "The agent is building"],
  [FEATURE_PAGES.waiting, "You review the spec"],
  [FEATURE_PAGES.blocked, "This feature cannot go on"],
  [FEATURE_PAGES.done, "What and why"],
  [FEATURE_PAGES.doneChange, "What and why"],
];

describe("in both themes", () => {
  atSize("both");

  test("the feature page is accessible in both themes, every fold open", async () => {
    await commands.addFeaturePages();
    for (const mode of ["light", "dark"] as const) {
      await colorScheme(mode);
      for (const [folder, text] of STATES) {
        await show(`/f/${folder}`, text);
        const main = screen.getByRole("main");
        const folded = () => within(main).queryAllByRole("button", { expanded: false });
        for (let left = 10; left > 0 && folded().length > 0; left -= 1) {
          await userEvent.click(folded()[0]!);
        }
        await drawn();
        await checkLayout();
      }
    }
  });
});
