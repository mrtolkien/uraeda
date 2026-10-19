// The session's message look (spec US2, SC-003, SC-004): in WebKit, the human's messages sit in a
// filled bubble on the right, and the agent's text runs flat across the page, at its inset.
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { backdrop, contrast, over, tinted } from "./colours.ts";
import { atSize, colorScheme, drawn, LIVE, show, startTurn } from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";

/** Opens the feature's session with a human's message and the agent's reply `text`. */
async function converse(text: string) {
  await show(`/f/${CLI}/session`, "CLI TUIs");
  await startTurn("Plan the CLI.", [{ text, type: "text" }]);
  const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
  await within(log).findByText(/Reply starts/, undefined, LIVE);
  await drawn();
  return log;
}

/** The inset the page leaves at its sides: the padding of the outermost box that sets it. */
function pageInset(from: Element) {
  let page = from;
  while (
    page.parentElement &&
    getComputedStyle(page.parentElement).getPropertyValue("--page-inset")
  ) {
    page = page.parentElement;
  }
  return Number.parseFloat(getComputedStyle(page).paddingLeft);
}

describe("the message look", () => {
  describe("on the phone", () => {
    atSize("phone");

    test("SC-003: the reply spans the page's inset on both sides, the human's bubble sits right", async () => {
      const log = await converse("Reply starts here and goes on for a while.");
      let bubble: Element = within(log).getByText("Plan the CLI.");
      while (!tinted(bubble) && bubble.parentElement) {
        bubble = bubble.parentElement;
      }
      const human = bubble.getBoundingClientRect();
      const reply = within(log)
        .getByText(/Reply starts/)
        .getBoundingClientRect();
      const inset = pageInset(log);
      const edge = document.documentElement.clientWidth;

      expect(reply.left).toBeCloseTo(inset, 0);
      expect(reply.right).toBeCloseTo(edge - inset, 0);
      expect(human.right).toBeCloseTo(edge - inset, 0);
      expect(human.left).toBeGreaterThan(inset);
    });

    test("US2: a code block wider than the screen scrolls inside the block, not the page", async () => {
      const log = await converse(`Reply starts here.\n\n\`\`\`\n${"x".repeat(200)}\n\`\`\``);
      const block = within(log).getByRole("group", { name: "Code" });

      expect(block.scrollWidth).toBeGreaterThan(block.clientWidth);
      expect(["auto", "scroll"]).toContain(getComputedStyle(block).overflowX);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
        document.documentElement.clientWidth,
      );
    });
  });

  describe.each(["light", "dark"] as const)("in %s", (mode) => {
    test("SC-004: the human's bubble is filled apart from the agent's text, and its text reads AA", async () => {
      await colorScheme(mode);
      const log = await converse("Reply starts here.");
      const human = within(log).getByText("Plan the CLI.");
      const reply = within(log).getByText(/Reply starts/);

      const fill = backdrop(human);
      expect(fill).not.toEqual(backdrop(reply));
      // The blue background token, in both modes: not the grey of a neutral fill.
      expect(fill[2] - fill[0]).toBeGreaterThan(0.1);
      const ratio = contrast(over(getComputedStyle(human).color, fill), fill);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });
});
