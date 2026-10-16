// US3.6 and US3.7 of the interface's redesign: the session's column resizes from its edge, its
// width kept; one button at the page's top right hides and shows it, at the same spot in both
// states (C3), and `]` does the same; the page beside it stays as it is.
import { screen, within } from "@testing-library/react";
import { userEvent } from "vite-plus/test/browser";
import { describe, expect, test } from "vite-plus/test";
import { agent, atSize, drawn, LIVE, reload, show, startTurn } from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";

/** The column, while shown. */
const column = () => screen.queryByRole("complementary", { name: "Progress" });

/** The column's width, as drawn. */
const width = () => Math.round(column()!.getBoundingClientRect().width);

/** Where a control is drawn, to the pixel. */
const at = (element: Element) => {
  const { x, y } = element.getBoundingClientRect();
  return [Math.round(x), Math.round(y)];
};

/** The feature's session, at its implementation, with its column. */
async function session() {
  await agent.addPlan(CLI);
  await show(`/f/${CLI}/session`, "CLI TUIs");
  await screen.findByRole("complementary", { name: "Progress" }, LIVE);
  await drawn();
}

describe("on a desktop", () => {
  atSize("desktop");

  /** US3.6, C2 */
  test("the column resizes between 280 and 560 px, its width kept after a reload", async () => {
    await session();
    expect(width()).toBe(320);
    const handle = screen.getByRole("separator", { name: "Resize progress" });

    handle.focus();
    await userEvent.keyboard("{End}");
    await expect.poll(() => width()).toBe(560);
    await userEvent.keyboard("{Home}");
    await expect.poll(() => width()).toBe(280);
    for (let step = 0; step < 12; step++) {
      await userEvent.keyboard("{ArrowLeft}");
    }
    await expect.poll(() => width()).toBe(400);

    await reload("CLI TUIs");
    await screen.findByRole("complementary", { name: "Progress" }, LIVE);
    await expect.poll(() => width()).toBe(400);
  });

  /** US3.7, C3 */
  test("one button hides and shows the column at the same spot, and so does ]", async () => {
    await session();
    await userEvent.hover(column()!);
    const hide = screen.getByRole("button", { name: "Hide progress" });
    await expect.poll(() => getComputedStyle(hide).opacity).toBe("1");
    const before = at(hide);

    await userEvent.click(hide);

    await expect.poll(() => column()).toBeNull();
    const shows = screen.getByRole("button", { name: "Show progress" });
    expect(at(shows)).toEqual(before);
    expect(getComputedStyle(shows).opacity).toBe("1");

    await userEvent.keyboard("]");
    await expect.poll(() => column()).not.toBeNull();
    await userEvent.keyboard("]");
    await expect.poll(() => column()).toBeNull();
  });

  test("hiding the column keeps the transcript, the focus, and what the composer holds", async () => {
    await session();
    await startTurn("Plan the CLI.", [{ text: "Investigating.", type: "text" }]);
    const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
    await within(log).findByText("Investigating.", undefined, LIVE);
    const field = screen.getByRole("textbox", { name: "Message Claude Code" });
    await userEvent.click(field);
    // Typed in a field, `]` is text.
    await userEvent.keyboard("A note]");
    expect(column()).not.toBeNull();

    const crumb = screen.getAllByRole("link", { name: "CLI TUIs" })[0];
    crumb.focus();
    await userEvent.keyboard("]");

    await expect.poll(() => column()).toBeNull();
    expect(log.isConnected).toBe(true);
    expect(document.activeElement).toBe(crumb);
    expect(screen.getByRole("textbox", { name: "Message Claude Code" }).textContent).toContain(
      "A note]",
    );
  });
});
