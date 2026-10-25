// US1 scenario 2, SC-004, and review focus 6: a card drags from anywhere on it, only past 5 px of a
// mouse press; a shorter press is a click that opens it, and a drag never opens the card it ends
// on. Each test takes the repository in turn, on a fresh copy of the fixture.
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { commands as browserCommands } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { atSize, drawn, middle, show } from "./helpers.tsx";

const commands = browserCommands as unknown as RepoCommands;

/** A card's link, by its text: the sidebar may name the same line. */
const card = (text: string) => {
  const links = screen
    .getAllByRole("link", { name: new RegExp(text) })
    .filter((link) => link.closest("[data-row]") !== null);
  expect(links).toHaveLength(1);
  return links[0];
};

/**
 * Presses on a card's text, moves the mouse by (`dx`, `dy`) in steps, and releases; with
 * `backToStart`, it moves back to where it pressed before it releases.
 */
async function pressAndMove(
  text: string,
  dx: number,
  dy: number,
  { backToStart = false }: { backToStart?: boolean } = {},
) {
  const start = middle(card(text));
  await commands.mouse([{ type: "move", x: start.x, y: start.y }, { type: "down" }]);
  const steps = 8;
  for (let step = 1; step <= steps; step++) {
    await commands.mouse([
      { type: "move", x: start.x + (dx * step) / steps, y: start.y + (dy * step) / steps },
    ]);
    await drawn();
  }
  if (backToStart) {
    await commands.mouse([{ type: "move", x: start.x, y: start.y }]);
    await drawn();
  }
  await commands.mouse([{ type: "up" }]);
}

// A test that fails with the mouse button down would leave it pressed for the next one.
afterEach(async () => {
  await commands.mouse([{ type: "up" }]);
});

describe("on the desktop, a card with a mouse", () => {
  atSize("desktop");

  test("a press of 4 px opens the card", async () => {
    await show("/priorities", "Git listener process");
    await pressAndMove("Git listener process", 4, 0);
    await expect.poll(() => window.location.pathname).toMatch(/\/priorities\/git-listener$/);
  });

  test("a press of 40 px over Later writes the line in Later", async () => {
    await show("/priorities", "Git listener process");
    const original = await commands.readRepo();
    const to = middle(screen.getByRole("button", { name: "Add to Later" }));
    const from = middle(card("Git listener process"));

    await pressAndMove("Git listener process", to.x - from.x, to.y - from.y);

    await expect
      .poll(async () => (await commands.readRepo()) !== original, { timeout: 10_000 })
      .toBe(true);
    expect(await commands.readRepo()).toMatch(/## Later[\s\S]*Git listener process/);
    expect(window.location.pathname).toMatch(/\/priorities$/);
  });

  test("a drag that ends on its own card does not open it", async () => {
    await show("/priorities", "Git listener process");
    await pressAndMove("Git listener process", 40, 0, { backToStart: true });
    await drawn();
    expect(window.location.pathname).toMatch(/\/priorities$/);
  });

  test("a running card does not move", async () => {
    await show("/priorities", "Web UI for the workflow files");
    const original = await commands.readRepo();
    const before = card("Web UI for the workflow files").getBoundingClientRect().top;

    await pressAndMove("Web UI for the workflow files", 0, 40);

    expect(card("Web UI for the workflow files").getBoundingClientRect().top).toBe(before);
    expect(await commands.readRepo()).toBe(original);
  });
});
