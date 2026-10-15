// US4 scenarios 5, 6, and 7, the cancelled drag, committing closing the toasts, and review focus 4:
// dragging lines on the priorities page with a mouse, a finger, and the keyboard. Each test takes
// the repository in turn, on a fresh copy of the fixture (see `vite.browser.config.ts`).
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { commands as browserCommands, userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { atSize, drawn, show } from "./helpers.tsx";

const commands = browserCommands as unknown as RepoCommands;

const NEXT_SWAPPED =
  "## Next\n\n- [Git listener process](drafts/git-listener.md)\n- Claude Code runner (triggered manually)\n";

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
      button: type === "pointermove" ? -1 : 0,
      buttons: type === "pointerup" ? 0 : 1,
      cancelable: true,
      clientX: x,
      clientY: y,
      composed: true,
      isPrimary: true,
      pointerId: 1,
      pointerType: "touch",
    }),
  );
}

/** Whether a line was picked up, as the page announces it once its drag starts. */
function lifted(name: string) {
  return new RegExp(`(Picked up|Moved:) ${name}`).test(document.body.textContent ?? "");
}

/**
 * Watches the page's requests from now on: the function returned says whether it asked the server
 * to move a line, which a drop does at once.
 */
function watchMoves() {
  const fetch = vi.spyOn(window, "fetch");
  return () =>
    fetch.mock.calls.some(
      ([, init]) => typeof init?.body === "string" && init.body.includes("priorities.move"),
    );
}

/**
 * Watches the live updates the page receives from now on: `received(text)` says whether one that
 * holds the text has reached it. The page opens its stream once it shows.
 */
function watchLiveUpdates() {
  const updates: Array<string> = [];
  const Original = window.EventSource;
  window.EventSource = class extends Original {
    constructor(url: string | URL, init?: EventSourceInit) {
      super(url, init);
      // Before the page's own listeners: an update is recorded before the page draws it.
      for (const type of ["message", "next"]) {
        this.addEventListener(type, (event) => updates.push(String((event as MessageEvent).data)));
      }
    }
  };
  return {
    received: (text: string) => updates.some((update) => update.includes(text)),
    stop: () => {
      window.EventSource = Original;
    },
  };
}

// A test that fails with the mouse button down would leave it pressed for the next one.
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await commands.mouse([{ type: "up" }]);
});

/** Waits for an announcement: the page shows the last message only. */
const announced = (text: string) => expect.poll(() => document.body.textContent).toContain(text);

describe("on the desktop, with a mouse", () => {
  atSize("desktop");

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
    ]);
    // The line passed over slides down to make room.
    await expect.poll(() => top(/Claude Code runner/)).toBeGreaterThan(before + 10);
    await commands.mouse([{ type: "up" }]);

    await expect.poll(() => commands.readRepo(), { timeout: 10_000 }).toContain(NEXT_SWAPPED);
  });

  test("Escape cancels a drag, and nothing is written", async () => {
    const moveSent = watchMoves();
    await show("/priorities", "Git listener process");
    const original = await commands.readRepo();
    const handle = middle(screen.getByRole("button", { name: "Move Git listener process" }));
    const above = screen.getByRole("link", { name: /Claude Code runner/ }).getBoundingClientRect();

    await commands.mouse([
      { type: "move", x: handle.x, y: handle.y },
      { type: "down" },
      { type: "move", x: handle.x, y: handle.y - 10 },
      { type: "move", x: handle.x, y: above.top + 2 },
    ]);
    // The drag has started: the line is announced where it is now.
    await expect.poll(() => document.body.textContent).toMatch(/(Picked up|Moved:) Git listener/);
    await userEvent.keyboard("[Escape]");
    await expect.poll(() => document.body.textContent).toContain("Move cancelled: Git listener");
    await commands.mouse([{ type: "up" }]);

    // A move is asked for as soon as it is dropped, by then: none was.
    await drawn();
    expect(moveSent()).toBe(false);
    expect(await commands.readRepo()).toBe(original);
  });

  test("a live update during a drag waits for its end (review focus 4)", async () => {
    const live = watchLiveUpdates();
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
    // Once the live update has reached the page, and the page has drawn: the list does not change
    // under the pointer.
    await expect.poll(() => live.received("Live line"), { timeout: 10_000 }).toBe(true);
    live.stop();
    await drawn();
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
});

describe("on the desktop, with the keyboard", () => {
  atSize("desktop");

  test("Space, ↓, ↓, Space moves a line two places, announced (US4 7)", async () => {
    await show("/priorities", "Git listener process");
    const handle = screen.getByRole("button", { name: "Move Web UI for the workflow files" });
    handle.focus();

    // Each key is announced once the drag has taken it, with the line's place.
    await userEvent.keyboard("[Space]");
    await announced("Web UI for the workflow files, 1 of 4 in Now.");
    await userEvent.keyboard("[ArrowDown]");
    await announced("Web UI for the workflow files, 2 of 4 in Now.");
    await userEvent.keyboard("[ArrowDown]");
    await announced("Web UI for the workflow files, 3 of 4 in Now.");
    await userEvent.keyboard("[Space]");
    await announced("Dropped: Web UI for the workflow files, 3 of 4 in Now.");
    await expect
      .poll(() => commands.readRepo(), { timeout: 10_000 })
      .toContain(
        "## Now\n\n- [Recurring tasks](/specs/2026-10-06-recurring-tasks/proposal.md)\n- [CLI TUIs](/specs/2026-10-12-cli-tuis/proposal.md)\n- [Web UI for the workflow files](/specs/2026-10-11-web-ui/proposal.md)\n",
      );
  });
});

describe("on the phone", () => {
  atSize("phone");

  test("a touch press of 500 ms lifts, a quick swipe lifts nothing (US4 6)", async () => {
    await show("/priorities", "Git listener process");
    const original = await commands.readRepo();
    const line = screen.getByRole("link", { name: /Git listener process/ });
    const start = middle(line);
    const before = top(/Claude Code runner/);

    // A quick swipe: the finger moves at once, and no line lifts, even once the half second of a
    // press has passed with the finger still down. The page's clock is the test's, for that half
    // second only.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    touch("pointerdown", line, start.x, start.y);
    touch("pointermove", document, start.x, start.y - 30);
    touch("pointermove", document, start.x, start.y - 80);
    vi.advanceTimersByTime(1000);
    vi.useRealTimers();
    await drawn();
    expect(lifted("Git listener")).toBe(false);
    expect(top(/Claude Code runner/)).toBe(before);
    touch("pointerup", document, start.x, start.y - 80);
    expect(await commands.readRepo()).toBe(original);

    // A press held for half a second lifts the line, which then follows the finger.
    const above = screen.getByRole("link", { name: /Claude Code runner/ }).getBoundingClientRect();
    touch("pointerdown", line, start.x, start.y);
    await expect.poll(() => lifted("Git listener")).toBe(true);
    for (const y of [start.y - 10, start.y - 30, above.top + 2]) {
      touch("pointermove", document, start.x, y);
      await drawn();
    }
    await expect.poll(() => top(/Claude Code runner/)).toBeGreaterThan(before + 10);
    touch("pointerup", document, start.x, above.top + 2);

    await expect.poll(() => commands.readRepo(), { timeout: 10_000 }).toContain(NEXT_SWAPPED);
  });

  test("committing closes the page's toasts", async () => {
    await show("/priorities/nix-docker-based-execution-environments", "Delete");
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("button", { name: "Undo" })).toBeTruthy();

    await userEvent.click(await screen.findByRole("button", { name: "Commit" }));

    // Closed by the commit, well before the toast would close by itself, after 5 seconds.
    await expect
      .poll(() => screen.queryByRole("button", { name: "Undo" }), { timeout: 2000 })
      .toBeNull();
    // Committed: nothing is left to commit.
    await expect.poll(() => screen.queryByRole("button", { name: "Commit" })).toBeNull();
  });

  test("discarding closes the page's toasts", async () => {
    const original = await commands.readRepo();
    await show("/priorities/nix-docker-based-execution-environments", "Delete");
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("button", { name: "Undo" })).toBeTruthy();

    await userEvent.click(await screen.findByRole("button", { name: "Discard" }));
    await userEvent.click(await screen.findByRole("button", { name: "Discard them" }));

    // Discarded: the line is back, and no Undo is left to insert it a second time, well before the
    // toast would close by itself, after 5 seconds.
    await expect.poll(() => commands.readRepo()).toBe(original);
    await expect
      .poll(() => screen.queryByRole("button", { name: "Undo" }), { timeout: 2000 })
      .toBeNull();
  });
});
