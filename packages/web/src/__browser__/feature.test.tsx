// The feature page at both sizes: "Next" with the column of sessions beside the page on a desktop and
// before it on the phone (C8),
// and every layout check in both themes, over the feature page's features of
// `samples/features.ts`, their times read in UTC.
import { screen, within } from "@testing-library/react";
import { userEvent } from "vite-plus/test/browser";
import { describe, expect, test } from "vite-plus/test";
import { FEATURE_PAGES } from "../../.storybook/checkouts.ts";
import { page } from "vite-plus/test/browser";
import { atSize, checkLayout, checkPage, colorScheme, commands, drawn, show } from "./helpers.tsx";

/** Where "Next" and the sessions' pane are drawn. */
function nextAndAgent() {
  return {
    agent: screen.getByRole("region", { name: "Sessions" }).getBoundingClientRect(),
    next: screen.getByRole("region", { name: "Next" }).getBoundingClientRect(),
  };
}

describe("Next and the Home's column", () => {
  atSize("both");

  // C8.
  test("Next comes before the sessions on the phone, and the column is beside it on a desktop", async () => {
    await commands.addFeaturePages();
    await show(`/f/${FEATURE_PAGES.working}`, "Continue, implement the plan");
    await drawn();
    const { agent, next } = nextAndAgent();
    if (window.innerWidth >= 768) {
      expect(agent.left).toBeGreaterThanOrEqual(next.right);
    } else {
      expect(next.bottom).toBeLessThanOrEqual(agent.top);
    }
  });
});

describe("the Home on the phone", () => {
  atSize("phone");

  test("stacks Next, the timeline, Sessions, Produced, and Links", async () => {
    await commands.addFeaturePages();
    await show(`/f/${FEATURE_PAGES.working}`, "Continue, implement the plan");
    await drawn();
    const tops = [
      screen.getByRole("region", { name: "Next" }),
      screen.getByRole("list", { name: "Stages" }),
      screen.getByRole("region", { name: "Sessions" }),
      screen.getByRole("region", { name: "Produced so far" }),
      screen.getByRole("region", { name: "Links" }),
    ].map((element) => element.getBoundingClientRect().top);
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
  });
});

describe("dropping a feature", () => {
  atSize("both");

  // The UI checks decision: no text cut, a confirmation's buttons included.
  test("the drop's confirmation shows its buttons' words whole", async () => {
    await commands.addFeaturePages();
    await show(`/f/${FEATURE_PAGES.working}`, "Continue, implement the plan");
    await userEvent.click(screen.getByRole("button", { name: "Feature actions" }));
    // A popover's menu item on a desktop, a sheet's button on the phone.
    const drop = await screen.findByText("Drop the feature…");
    await userEvent.click(drop);
    const dialog = await screen.findByRole("dialog", { name: /^Drop the feature/ });
    await drawn();
    expect(within(dialog).getByRole("button", { name: "Drop the feature" })).toBeTruthy();
    checkPage(dialog);
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
    const card = screen.getByRole("group", { name: "lines" });
    const [red, green, blue] = rgb(within(card).getByText("+1,222"));
    expect(green).toBeGreaterThan(Math.max(red!, blue!) + 40);
    const [red2, green2, blue2] = rgb(within(card).getByText("−310"));
    expect(red2).toBeGreaterThan(Math.max(green2!, blue2!) + 40);
  });
});

/** Every state the page draws without `gh`, by a text that says it is drawn. */
const STATES: Array<[string, string]> = [
  [FEATURE_PAGES.working, "Continue, implement the plan"],
  [FEATURE_PAGES.waiting, "You review the spec"],
  [FEATURE_PAGES.blocked, "This feature cannot go on"],
  [FEATURE_PAGES.done, "What and why"],
  [FEATURE_PAGES.doneChange, "What and why"],
];

/** The proposal page of the working feature, whose text the samples write. */
const PROPOSAL = [
  `/f/${FEATURE_PAGES.working}/proposal.md`,
  "Rounds of questions read as a flat list.",
];

describe("at the three widths", () => {
  atSize("desktop");

  // The wide, the semi-wide, and the phone's width: the page scrolls only down, and the status line
  // at the bottom hides none of its text, scrolled to the end.
  test.each([1440, 1205, 390])(
    "the Home and a proposal page scroll only vertically at %i px",
    async (width) => {
      await commands.addFeaturePages();
      try {
        await page.viewport(width, 900);
        await expect.poll(() => window.innerWidth).toBe(width);
        for (const [path, text] of [[`/f/${FEATURE_PAGES.done}`, "What it produced"], PROPOSAL]) {
          await show(path!, text!);
          await drawn();
          const scrolling = document.scrollingElement!;
          expect(scrolling.scrollWidth).toBeLessThanOrEqual(scrolling.clientWidth);
          window.scrollTo(0, scrolling.scrollHeight);
          await drawn();
          const line = screen.getByRole("contentinfo", { name: "Status line" });
          const covered = [...screen.getByRole("main").querySelectorAll("*")].filter((element) => {
            const own = [...element.childNodes].some(
              (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
            );
            const box = element.getBoundingClientRect();
            return (
              own &&
              box.height > 0 &&
              box.bottom > line.getBoundingClientRect().top + 0.5 &&
              box.top < line.getBoundingClientRect().bottom
            );
          });
          expect(covered.map((element) => element.textContent?.slice(0, 40))).toEqual([]);
        }
      } finally {
        await page.viewport(1440, 900);
      }
    },
  );
});

describe("in both themes", () => {
  atSize("both");

  // One test per theme: each page also reads its sessions now, and both themes' ten pages took
  // longer than a test's 30 s.
  test.each(["light", "dark"] as const)(
    "the feature page is accessible in %s, every fold open",
    async (mode) => {
      await commands.addFeaturePages();
      await colorScheme(mode);
      for (const [folder, text] of STATES) {
        await show(`/f/${folder}`, text);
        const main = screen.getByRole("main");
        // The feature's "…" menu is collapsed too, but it opens a menu, not a fold.
        const folded = () =>
          within(main).queryAllByRole("button", { expanded: false, name: /^(?!.*actions$)/ });
        for (let left = 10; left > 0 && folded().length > 0; left -= 1) {
          await userEvent.click(folded()[0]!);
        }
        await drawn();
        await checkLayout();
      }
      // A proposal page, in panes with Contents and the session's column.
      await show(PROPOSAL[0]!, PROPOSAL[1]!);
      await drawn();
      await checkLayout();
    },
  );
});
