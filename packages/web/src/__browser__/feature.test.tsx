// The feature page at both sizes: "Next" with the column of sessions beside the page on a desktop and
// before it on the phone (C8),
// and every layout check in both themes, over the feature page's features of
// `samples/features.ts`, their times read in UTC.
import { screen, within } from "@testing-library/react";
import { userEvent } from "vite-plus/test/browser";
import { describe, expect, test } from "vite-plus/test";
import { FEATURE_PAGES } from "../../.storybook/checkouts.ts";
import { atSize, checkLayout, colorScheme, commands, drawn, show } from "./helpers.tsx";

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
    await show(`/f/${FEATURE_PAGES.working}`, "The agent is building");
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
    await show(`/f/${FEATURE_PAGES.working}`, "The agent is building");
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
  [FEATURE_PAGES.working, "The agent is building"],
  [FEATURE_PAGES.waiting, "You review the spec"],
  [FEATURE_PAGES.blocked, "This feature cannot go on"],
  [FEATURE_PAGES.done, "What and why"],
  [FEATURE_PAGES.doneChange, "What and why"],
];

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
        const folded = () => within(main).queryAllByRole("button", { expanded: false });
        for (let left = 10; left > 0 && folded().length > 0; left -= 1) {
          await userEvent.click(folded()[0]!);
        }
        await drawn();
        await checkLayout();
      }
    },
  );
});
