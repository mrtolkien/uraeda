// US4 scenarios 5, 6, and 7, the cancelled drag, committing closing the toasts, and review focus 4:
// dragging lines on the priorities page with a mouse, a finger, and the keyboard. Each test takes
// the repository in turn, on a fresh copy of the fixture (see `vite.browser.config.ts`).
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { commands as browserCommands, userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { show } from "./helpers.tsx";

const commands = browserCommands as unknown as RepoCommands;

const NEXT_SWAPPED =
  "## Next\n\n- [Git listener process](drafts/git-listener.md)\n- Claude Code runner (triggered manually)\n";

beforeEach(async () => {
  await commands.takeRepo();
});

afterEach(async () => {
  await commands.releaseRepo();
});

/** The middle of an element, in the page's coordinates. */
function middle(element: Element) {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/** Where a line's text is now on screen: it moves with its row. */
function top(name: RegExp) {
  return screen.getByRole("link", { name }).getBoundingClientRect().top;
}

/**
 * A pointer event of a finger, as a touch screen sends it: the WebKit of the tests has no touch
 * screen. It takes the primary pointer's id, the only one the page may capture, as dnd-kit does
 * once a drag starts.
 */
function touch(type: string, target: EventTarget, x: number, y: number) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      button: type === "pointermove" ? -1 : 0,
      buttons: type === "pointerup" ? 0 : 1,
      clientX: x,
      clientY: y,
    }),
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("dragging with a mouse makes room and moves the line (US4 5)", async () => {
  await show("/priorities", "Git listener process");
  const handle = middle(screen.getByRole("button", { name: "Move Git listener process" }));
  const runner = screen.getByRole("link", { name: /Claude Code runner/ });
  const before = top(/Claude Code runner/);
  const above = runner.getBoundingClientRect().top + 2;

  await commands.mouse([
    { type: "move", x: handle.x, y: handle.y },
    { type: "down" },
    { type: "move", x: handle.x, y: handle.y - 10 },
    { type: "move", x: handle.x, y: above },
    { type: "wait", ms: 500 },
  ]);
  // The line passed over slides down to make room.
  expect(top(/Claude Code runner/)).toBeGreaterThan(before + 10);
  await commands.mouse([{ type: "up" }]);

  await expect.poll(() => commands.readRepo(), { timeout: 10_000 }).toContain(NEXT_SWAPPED);
});

test("a touch press of 500 ms lifts, a quick swipe scrolls (US4 6)", async () => {
  if (window.innerWidth >= 768) {
    return;
  }
  await show("/priorities", "Git listener process");
  const original = await commands.readRepo();
  const line = screen.getByRole("link", { name: /Git listener process/ });
  const start = middle(line);
  const before = top(/Claude Code runner/);

  // A quick swipe: the finger moves at once, and no line lifts.
  touch("pointerdown", line, start.x, start.y);
  touch("pointermove", document, start.x, start.y - 30);
  touch("pointermove", document, start.x, start.y - 80);
  await wait(600);
  expect(top(/Claude Code runner/)).toBe(before);
  touch("pointerup", document, start.x, start.y - 80);
  await wait(300);
  expect(await commands.readRepo()).toBe(original);

  // A press held for half a second lifts the line, which then follows the finger.
  const above = screen.getByRole("link", { name: /Claude Code runner/ }).getBoundingClientRect();
  touch("pointerdown", line, start.x, start.y);
  await wait(650);
  for (const y of [start.y - 10, start.y - 30, above.top + 2]) {
    touch("pointermove", document, start.x, y);
    await wait(60);
  }
  await wait(400);
  expect(top(/Claude Code runner/)).toBeGreaterThan(before + 10);
  touch("pointerup", document, start.x, above.top + 2);

  await expect.poll(() => commands.readRepo(), { timeout: 10_000 }).toContain(NEXT_SWAPPED);
});

test("Space, ↓, ↓, Space moves a line two places, announced (US4 7)", async () => {
  if (window.innerWidth < 768) {
    return;
  }
  await show("/priorities", "Git listener process");
  const handle = screen.getByRole("button", { name: "Move Web UI for the workflow files" });
  handle.focus();

  await userEvent.keyboard("[Space]");
  await wait(200);
  await userEvent.keyboard("[ArrowDown]");
  await wait(300);
  await userEvent.keyboard("[ArrowDown]");
  await wait(300);
  await userEvent.keyboard("[Space]");

  await expect
    .poll(() => document.body.textContent)
    .toContain("Web UI for the workflow files, 3 of 4 in Now");
  await expect
    .poll(() => commands.readRepo(), { timeout: 10_000 })
    .toContain(
      "## Now\n\n- [Recurring tasks](/specs/2026-10-06-recurring-tasks/proposal.md)\n- [CLI TUIs](/specs/2026-10-12-cli-tuis/proposal.md)\n- [Web UI for the workflow files](/specs/2026-10-11-web-ui/proposal.md)\n",
    );
});

test("Escape cancels a drag, and nothing is written", async () => {
  await show("/priorities", "Git listener process");
  const original = await commands.readRepo();
  const handle = middle(screen.getByRole("button", { name: "Move Git listener process" }));
  const above = screen.getByRole("link", { name: /Claude Code runner/ }).getBoundingClientRect();

  await commands.mouse([
    { type: "move", x: handle.x, y: handle.y },
    { type: "down" },
    { type: "move", x: handle.x, y: handle.y - 10 },
    { type: "move", x: handle.x, y: above.top + 2 },
    { type: "wait", ms: 300 },
  ]);
  await userEvent.keyboard("[Escape]");
  await commands.mouse([{ type: "up" }]);

  await wait(1000);
  expect(await commands.readRepo()).toBe(original);
});

test("committing closes the page's toasts", async () => {
  await show("/priorities/nix-docker-based-execution-environments", "Delete");
  await userEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(await screen.findByRole("button", { name: "Undo" })).toBeTruthy();

  await userEvent.click(await screen.findByRole("button", { name: "Commit" }));

  await expect.poll(() => screen.queryByRole("button", { name: "Undo" })).toBeNull();
});

test("discarding closes the page's toasts", async () => {
  const original = await commands.readRepo();
  await show("/priorities/nix-docker-based-execution-environments", "Delete");
  await userEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(await screen.findByRole("button", { name: "Undo" })).toBeTruthy();

  await userEvent.click(await screen.findByRole("button", { name: "Discard" }));
  await userEvent.click(await screen.findByRole("button", { name: "Discard them" }));

  // Discarded: the line is back, and no Undo is left to insert it a second time.
  await expect.poll(() => commands.readRepo()).toBe(original);
  await expect.poll(() => screen.queryByRole("button", { name: "Undo" })).toBeNull();
});

test("a live update during a drag waits for its end (review focus 4)", async () => {
  if (window.innerWidth < 768) {
    return;
  }
  await show("/priorities", "Git listener process");
  const original = await commands.readRepo();
  const handle = middle(screen.getByRole("button", { name: "Move Git listener process" }));

  await commands.mouse([
    { type: "move", x: handle.x, y: handle.y },
    { type: "down" },
    { type: "move", x: handle.x, y: handle.y - 10 },
  ]);
  await commands.writeRepo(
    original
      .replace("## Next\n\n", "## Next\n\n- Live line\n")
      .replace("Claude Code runner (triggered manually)", "Claude Code runner, renamed"),
  );
  // Long enough for the live update to arrive: the list does not change under the pointer.
  await wait(2000);
  expect(screen.queryByText("Live line")).toBeNull();
  expect(
    screen.getByRole("link", { name: /Claude Code runner \(triggered manually\)/ }),
  ).toBeTruthy();
  await userEvent.keyboard("[Escape]");
  await commands.mouse([{ type: "up" }]);

  // Once the drag is over, the update applies.
  expect(await screen.findByText("Live line", {}, { timeout: 10_000 })).toBeTruthy();
  expect(screen.getByRole("link", { name: /Claude Code runner, renamed/ })).toBeTruthy();
});
