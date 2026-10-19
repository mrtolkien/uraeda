// US3.6 and US3.7 of the interface's redesign: the session's column resizes from its edge, its
// width kept; one button at the page's top right hides and shows it, at the same spot in both
// states (C3), and `]` does the same; the page beside it stays as it is. Folded, it stays as a
// narrow rail with the step and its count, eased over 200 ms, and a click on the rail's empty
// space opens it again.
import { screen, within } from "@testing-library/react";
import { userEvent } from "vite-plus/test/browser";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { agent, atSize, drawn, LIVE, reducedMotion, reload, show, startTurn } from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";

/** The column, shown or folded. */
const column = () => screen.queryByRole("complementary", { name: "Progress" });

/** The rail's width, in px, as the left sidebar's: the column folded. */
const RAIL = 48;

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

afterEach(async () => {
  await reducedMotion(false);
});

describe("on a desktop, resizing", () => {
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
});

describe("on a desktop, folding", () => {
  atSize("desktop");

  /** US3.7, C3 */
  test("one button folds and unfolds the column at the same spot, and so does ]", async () => {
    await session();
    await userEvent.hover(column()!);
    const hide = screen.getByRole("button", { name: "Hide progress" });
    await expect.poll(() => getComputedStyle(hide).opacity).toBe("1");
    const before = at(hide);

    await userEvent.click(hide);

    await expect.poll(() => width()).toBe(RAIL);
    const shows = screen.getByRole("button", { name: "Show progress" });
    expect(at(shows)).toEqual(before);
    expect(getComputedStyle(shows).opacity).toBe("1");

    await userEvent.keyboard("]");
    await expect.poll(() => width()).toBe(320);
    await userEvent.keyboard("]");
    await expect.poll(() => width()).toBe(RAIL);
  });

  test("its resize handle is drawn along the column's edge, and a drag resizes it", async () => {
    await session();
    const handle = screen.getByRole("separator", { name: "Resize progress" });
    const box = handle.getBoundingClientRect();
    expect(Math.round(box.height)).toBe(window.innerHeight);
    expect(Math.round(column()!.getBoundingClientRect().height)).toBe(window.innerHeight);
    expect(Math.round(box.x)).toBe(Math.round(column()!.getBoundingClientRect().x));

    await userEvent.dragAndDrop(handle, document.body, {
      sourcePosition: { x: 1, y: 100 },
      targetPosition: { x: box.x - 80, y: 100 },
    });

    await expect.poll(() => width()).toBeGreaterThan(380);
    const dragged = width();
    await reload("CLI TUIs");
    await screen.findByRole("complementary", { name: "Progress" }, LIVE);
    await expect.poll(() => width()).toBe(dragged);
  });

  test("folded, it keeps a rail with the step and its count, and a click in its space opens it", async () => {
    await session();
    await userEvent.keyboard("]");
    await expect.poll(() => width()).toBe(RAIL);
    expect(within(column()!).getByRole("img", { name: "Implementation" })).toBeTruthy();
    expect(within(column()!).getByLabelText(/^Task \d+ of \d+$/)).toBeTruthy();
    expect(screen.queryByRole("separator", { name: "Resize progress" })).toBeNull();

    await userEvent.click(column()!, { position: { x: 24, y: 400 } });

    await expect.poll(() => width()).toBe(320);
  });

  test("the fold eases over 200 ms, and at once under reduced motion", async () => {
    await session();
    await userEvent.keyboard("]");
    expect(getComputedStyle(column()!).transitionDuration).toBe("0.2s");
    await expect.poll(() => width()).toBe(RAIL);
    await userEvent.keyboard("]");
    await drawn();

    await reducedMotion(true);
    await userEvent.keyboard("]");
    expect(getComputedStyle(column()!).transitionDuration).toBe("0s");
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

    await expect.poll(() => width()).toBe(RAIL);
    expect(log.isConnected).toBe(true);
    expect(document.activeElement).toBe(crumb);
    expect(screen.getByRole("textbox", { name: "Message Claude Code" }).textContent).toContain(
      "A note]",
    );
  });
});
