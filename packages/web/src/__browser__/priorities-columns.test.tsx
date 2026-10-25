// US1 and US2, review focus 5 and 9, and rulings R1 and R2: the priorities as titled panes in one
// row that scrolls sideways, stacked on the phone, each with its context under its title. Each test
// takes the repository in turn, on a fresh copy of the fixture (see `vite.browser.config.ts`).
import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { commands as browserCommands, page } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { atSize, drawn, middle, pickUp, show } from "./helpers.tsx";

const commands = browserCommands as unknown as RepoCommands;

/** The row the panes are in: the one that scrolls sideways. */
const scroller = () => screen.getByRole("region", { name: "Columns" });

/** A pane, by its title. */
const pane = (title: string) => screen.getByRole("region", { name: title });

/** Ongoing, Now, Next, and Later, in the order they show. */
const panes = () => ["Ongoing", "Now", "Next", "Later"].map(pane);

/** Whether an element is wholly inside the row. */
function isWhole(element: Element) {
  const box = element.getBoundingClientRect();
  const row = scroller().getBoundingClientRect();
  return box.left >= row.left - 1 && box.right <= row.right + 1;
}

/** The middle of the part of an element that shows in the row. */
function shown(element: Element) {
  const box = element.getBoundingClientRect();
  const row = scroller().getBoundingClientRect();
  const left = Math.max(box.left, row.left);
  const right = Math.min(box.right, row.right);
  return { x: (left + right) / 2, y: box.top + box.height / 2 };
}

/** Whether the page asked the server to move a line, from the call on. */
function watchMoves() {
  const fetch = vi.spyOn(window, "fetch");
  return () =>
    fetch.mock.calls.some(
      ([, init]) => typeof init?.body === "string" && init.body.includes("priorities.move"),
    );
}

const CONTEXT = {
  later: "Ideas for one day, and what waits on another line",
  now: "The features worked on today",
  ongoing: "Running now: an agent works or waits on you.",
};

// A test that fails with the mouse button down would leave it pressed for the next one.
afterEach(async () => {
  vi.restoreAllMocks();
  await commands.mouse([{ type: "up" }]);
  await page.viewport(1440, 900);
});

describe("on the desktop", () => {
  atSize("desktop");

  test("at 1150 px the row scrolls and each pane is 400 px or more", async () => {
    await page.viewport(1150, 900);
    await show("/priorities", "Now");
    const row = scroller();
    expect(row.scrollWidth).toBeGreaterThan(row.clientWidth);
    for (const each of panes()) {
      expect(each.getBoundingClientRect().width).toBeGreaterThanOrEqual(400);
    }
    // Cut at the edge: R2.
    expect(isWhole(pane("Later"))).toBe(false);
  });

  test("a running card does not move, and Ongoing says what it is", async () => {
    const moveSent = watchMoves();
    await show("/priorities", "Plan review");
    const original = await commands.readRepo();
    const ongoing = within(pane("Ongoing"));
    expect(ongoing.getByText(CONTEXT.ongoing)).toBeTruthy();
    const card = ongoing.getByRole("link", { name: /Plan review/ });
    const start = middle(card);
    const target = middle(within(pane("Now")).getByText(CONTEXT.now));

    await commands.mouse([{ type: "move", x: start.x, y: start.y }, { type: "down" }]);
    await commands.mouse([{ type: "move", x: target.x, y: target.y + 80 }]);
    await drawn();
    await commands.mouse([{ type: "up" }]);
    await drawn();

    expect(moveSent()).toBe(false);
    expect(await commands.readRepo()).toBe(original);
    expect(within(pane("Ongoing")).getByRole("link", { name: /Plan review/ })).toBeTruthy();
  });

  test("an empty pane shows its context and its Add row", async () => {
    const original = await commands.readRepo();
    await commands.writeRepo(original.replace(/(## Later\n\n(?:>.*\n)+)[\s\S]*$/, "$1"));
    await show("/priorities", CONTEXT.later);
    const later = within(pane("Later"));
    expect(later.getByText(CONTEXT.later)).toBeTruthy();
    expect(later.getByRole("button", { name: "Add to Later" })).toBeTruthy();
    expect(later.queryByRole("link")).toBeNull();
  });

  test("a drop on Ongoing writes nothing", async () => {
    const moveSent = watchMoves();
    await show("/priorities", "Git listener process");
    const original = await commands.readRepo();
    await pickUp("Git listener process");
    const target = shown(within(pane("Ongoing")).getByRole("link", { name: /Plan review/ }));
    await commands.mouse([{ type: "move", x: target.x, y: target.y }]);
    await drawn();
    await commands.mouse([{ type: "up" }]);
    await drawn();

    expect(moveSent()).toBe(false);
    expect(await commands.readRepo()).toBe(original);
    expect(within(pane("Next")).getByRole("link", { name: /Git listener process/ })).toBeTruthy();
  });

  test("a section with a callout shows its text, and one without shows none", async () => {
    const original = await commands.readRepo();
    await commands.writeRepo(original.replace(/(## Later\n\n)(?:>.*\n)+\n/, "$1"));
    await show("/priorities", CONTEXT.now);
    expect(within(pane("Now")).getByText(CONTEXT.now)).toBeTruthy();
    expect(within(pane("Next")).getByText("What comes once Now is done")).toBeTruthy();
    expect(screen.queryByText(CONTEXT.later)).toBeNull();
    // The line stays: only its context is gone.
    expect(within(pane("Later")).getByRole("link", { name: /Nix \+ Docker/ })).toBeTruthy();
  });

  test("no Blocked pane shows for an empty Blocked", async () => {
    await show("/priorities", "Now");
    expect(screen.queryByRole("region", { name: "Blocked" })).toBeNull();
  });

  test("a Blocked pane shows under the columns when it has a line", async () => {
    const original = await commands.readRepo();
    await commands.writeRepo(`${original.trimEnd()}\n\n## Blocked\n\n- Waiting on a licence\n`);
    await show("/priorities", "Waiting on a licence");
    const blocked = pane("Blocked");
    expect(within(blocked).getByRole("link", { name: /Waiting on a licence/ })).toBeTruthy();
    // Under the row, not a column of it.
    expect(blocked.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      scroller().getBoundingClientRect().bottom - 1,
    );
  });

  test("the purpose line reads What is worked on, in order: Ongoing runs now, then Now, Next, and Later.", async () => {
    await show("/priorities", "Now");
    expect(
      screen.getByText("What is worked on, in order: Ongoing runs now, then Now, Next, and Later."),
    ).toBeTruthy();
  });
});

describe("on the phone", () => {
  atSize("phone");

  test("the panes are stacked in the order Ongoing, Now, Next, Later", async () => {
    await show("/priorities", "Now");
    const boxes = panes().map((each) => each.getBoundingClientRect());
    for (const [index, box] of boxes.entries()) {
      expect(box.left).toBe(boxes[0].left);
      expect(box.width).toBe(boxes[0].width);
      if (index > 0) {
        expect(box.top).toBeGreaterThan(boxes[index - 1].bottom - 1);
      }
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });
});
