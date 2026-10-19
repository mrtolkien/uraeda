// The session page's look, in WebKit: the human's messages in a filled bubble on the right and the
// agent's text flat across the page (US2, SC-003, SC-004), then the actions by the composer: its
// field's height at each width class (SC-005, US2.3), and "Jump to the latest" and "Allow all" (US4.3).
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { backdrop, contrast, over, tinted } from "./colours.ts";
import { userEvent } from "vite-plus/test/browser";
import { agent, atSize, colorScheme, drawn, LIVE, show, startTurn } from "./helpers.tsx";

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

/** The composer's text field. */
function field() {
  return screen.getByRole("textbox", { name: "Message Claude Code" });
}

/** The box around the text, which holds the field's height and scrolls its text. */
function box() {
  return field().parentElement!;
}

/** The centre of a rectangle, across. */
function centre(rect: DOMRect) {
  return rect.left + rect.width / 2;
}

/** Types `count` lines into the composer's field, one per row. */
async function typeLines(count: number) {
  await userEvent.click(field());
  for (let line = 1; line <= count; line++) {
    await userEvent.keyboard(`Line ${line}`);
    if (line < count) {
      await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    }
  }
  await drawn();
}

/** Two blocked actions, each of a rule of its own. */
const DENIALS = [
  { input: { command: "git push origin HEAD" }, tool: "Bash" },
  { input: { command: "git tag -d v0.3.0" }, tool: "Bash" },
];

// The composer under a feature's session: its field's rows, and the buttons by it.
describe("the actions by the composer", () => {
  atSize("both");

  test("SC-005 and US2.3: the empty field's height, and its growth up to the rows its width class allows", async () => {
    await show(`/f/${CLI}/session`, "CLI TUIs");
    const phone = window.innerWidth < 768;
    // 3 rows on the phone, 7 on wide screens; 9 and 20 rows at most, 22 px each.
    const [empty, rows] = phone ? [66, 9] : [154, 20];
    expect(Math.round(box().getBoundingClientRect().height)).toBe(empty);

    await typeLines(rows + 3);

    expect(Math.round(box().getBoundingClientRect().height)).toBe(rows * 22);
    // Past the rows, its text scrolls inside them.
    expect(field().scrollHeight).toBeGreaterThan(box().clientHeight);
  });

  test("US4.3: Jump to the latest is centred over the composer, with Allow all beside Send", async () => {
    await show(`/f/${CLI}/session`, "CLI TUIs");
    await startTurn(
      "Plan the CLI.",
      Array.from({ length: 40 }, (_, index) => ({
        text: `Line ${index + 1}.`,
        type: "text" as const,
      })),
    );
    const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
    await within(log).findByText("Line 40.", undefined, LIVE);
    await agent.agentEmit([
      { denials: DENIALS, errors: [], interrupted: false, ok: true, type: "result" },
    ]);
    await expect.poll(() => screen.queryByRole("button", { name: "Stop" }), LIVE).toBeNull();
    await drawn();
    const page = document.scrollingElement!;
    page.scrollTo(0, page.scrollTop - 400);

    const jump = await screen.findByRole("button", { name: "Jump to the latest" }, LIVE);
    const all = await screen.findByRole("button", { name: "Allow all (2)" }, LIVE);
    await drawn();

    const input = box().getBoundingClientRect();
    expect(Math.abs(centre(jump.getBoundingClientRect()) - centre(input))).toBeLessThanOrEqual(2);
    expect(jump.getBoundingClientRect().bottom).toBeLessThanOrEqual(input.top);
    // Beside Send: on its row, before it.
    const send = screen.getByRole("button", { name: "Send" }).getBoundingClientRect();
    const beside = all.getBoundingClientRect();
    expect(Math.abs(beside.top + beside.height / 2 - (send.top + send.height / 2))).toBeLessThan(6);
    expect(beside.right).toBeLessThanOrEqual(send.left + 1);
  });
});
