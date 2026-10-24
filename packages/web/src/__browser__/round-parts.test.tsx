// The round's panes in WebKit, as ruling R3 opens them on the phone: only their titled top border,
// so their text takes the screen's width, the page's own text edge, with no side inset; a desktop
// keeps the pane's borders and its inset. Measured on the merge-chats round's Scope.
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { atSize, colorScheme, commands, drawn, show } from "./helpers.tsx";

const FEATURE = "2026-10-11-web-ui";
const PAGE = `/f/${FEATURE}/clarifications-01.md`;
const FILE = `specs/${FEATURE}/clarifications-01.md`;
const SCOPE = /^Starting and listing chats and changes/;

/** The merge-chats round, as the web-ui feature's round, on its branch. */
async function mergeChats() {
  const round = await commands.fixtureText("round-merge-chats/clarifications-01.md");
  await commands.commitOnBranch(FEATURE, { [FILE]: round });
  await show(PAGE, "Who may move a chat up to a change, or a change up to a feature?");
  await drawn();
}

/** The left and right edges of the Scope pane, of its paragraph, and of the round's title. */
function edges() {
  const pane = screen.getByRole("region", { name: "Scope" }).getBoundingClientRect();
  const text = screen.getByText(SCOPE).getBoundingClientRect();
  const title = screen.getByRole("heading", { level: 1 }).getBoundingClientRect();
  return { pane, text, title };
}

describe("the round's panes on the phone", () => {
  atSize("phone");

  test("on the phone, a pane's text takes the screen's width, with no side inset", async () => {
    await mergeChats();

    const { pane, text, title } = edges();
    expect(Math.abs(text.left - pane.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(text.right - pane.right)).toBeLessThanOrEqual(1);
    // The pane is as wide as the page's text: the round's title starts at its edge.
    expect(Math.abs(pane.left - title.left)).toBeLessThanOrEqual(1);
    expect(pane.width).toBeGreaterThanOrEqual(window.innerWidth - 2 * 20);
  });
});

/** The colour an element shows behind its text: its own background, or what it sits on. */
function paint(element: Element): string {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const colour = getComputedStyle(node).backgroundColor;
    if (colour !== "transparent" && !/^rgba\(.*, 0\)$/.test(colour)) {
      return colour;
    }
  }
  return getComputedStyle(document.documentElement).backgroundColor;
}

// The layout-look round, whose Q4 has an Example and a Why, over the page's background on the
// phone, with no band of another colour.
describe("the round's open panes on the phone, over the page", () => {
  atSize("phone");

  test.each(["light", "dark"] as const)(
    "in %s, a pane open on the phone shows the page's background, its title too",
    async (mode) => {
      await colorScheme(mode);
      const round = await commands.fixtureText("round-layout-look/clarifications-01.md");
      await commands.commitOnBranch(FEATURE, { [FILE]: round });
      await show(PAGE, "Where should the session open on the questions page?");
      await drawn();

      for (const name of ["Example", "Why it matters", "Scope"]) {
        const pane = screen.getAllByRole("region", { name })[0]!;
        const page = paint(pane.parentElement!);
        expect(paint(pane), name).toBe(page);
        expect(paint(pane.querySelector("h2, h3")!), `${name}'s title`).toBe(page);
      }
    },
  );
});

describe("the round's panes on the desktop", () => {
  atSize("desktop");

  test("on the desktop, a pane keeps its inset", async () => {
    await mergeChats();

    const { pane, text } = edges();
    expect(text.left - pane.left).toBeGreaterThan(1);
  });
});
