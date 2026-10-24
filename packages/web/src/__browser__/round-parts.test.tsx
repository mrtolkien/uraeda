// The round's panes in WebKit, as ruling R3 opens them on the phone: only their titled top border,
// so their text takes the screen's width, the page's own text edge, with no side inset; a desktop
// keeps the pane's borders and its inset. Measured on the merge-chats round's Scope.
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { atSize, commands, drawn, show } from "./helpers.tsx";

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

describe("the round's panes on the desktop", () => {
  atSize("desktop");

  test("on the desktop, a pane keeps its inset", async () => {
    await mergeChats();

    const { pane, text } = edges();
    expect(text.left - pane.left).toBeGreaterThan(1);
  });
});
