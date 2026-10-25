// US5, SC-003, and review focus 5 and 10: every card's `…` menu does what the pane does, by tap and
// by keyboard, a running priority's offers no move and no Delete, and a press on `…` never starts a
// drag. Each test takes the repository in turn, on a fresh copy of the fixture.
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { commands as browserCommands, userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { atSize, drawn, middle, show } from "./helpers.tsx";

const commands = browserCommands as unknown as RepoCommands;

/** A card's `…` button, by its line's text. */
const more = (text: string) =>
  screen.getByRole("button", { name: new RegExp(`^Actions of ${text}`) });

/** How much of a card's `…` button shows: 0 hidden, 1 whole. */
const visible = (text: string) => Number(getComputedStyle(more(text)).opacity);

/** A menu's row by its label: a menu item in a popover, a button in the sheet of a narrow screen. */
function row(label: string) {
  return waitFor(() => {
    const name = new RegExp(`^${label}$`);
    const dialog = screen.queryByRole("dialog");
    const found =
      screen.queryByRole("menuitem", { name }) ??
      (dialog ? within(dialog).queryByRole("button", { name }) : null);
    expect(found, label).not.toBeNull();
    return found as HTMLElement;
  });
}

/** Opens a card's menu and picks an item by its label, or a path of labels through submenus. */
async function pick(text: string, ...labels: ReadonlyArray<string>) {
  await userEvent.click(more(text));
  for (const label of labels) {
    await userEvent.click(await row(label));
  }
}

/** The text of a section's lines, `## Now` up to the next heading. */
function section(file: string, title: string) {
  return file.match(new RegExp(`## ${title}\\n([\\s\\S]*?)(?=\\n## |$)`))?.[1] ?? "";
}

/** Moves the pressed mouse from a point to another in steps, as a drag needs. */
async function dragTo(from: { x: number; y: number }, to: { x: number; y: number }) {
  for (let step = 1; step <= 8; step++) {
    await commands.mouse([
      {
        type: "move",
        x: from.x + ((to.x - from.x) * step) / 8,
        y: from.y + ((to.y - from.y) * step) / 8,
      },
    ]);
    await drawn();
  }
}

/** Whether the page asked the server to move a line, from the call on. */
function watchMoves() {
  const fetch = vi.spyOn(window, "fetch");
  return () =>
    fetch.mock.calls.some(
      ([, init]) => typeof init?.body === "string" && init.body.includes("priorities.move"),
    );
}

// A test that fails with the mouse button down would leave it pressed for the next one.
afterEach(async () => {
  vi.restoreAllMocks();
  await commands.mouse([{ type: "up" }]);
});

describe("a card's menu", () => {
  atSize("both");

  test("Move to Now writes the line last of Now and offers Undo", async () => {
    await show("/priorities", "Git listener process");
    const original = await commands.readRepo();

    await pick("Git listener process", "Move to Now");

    await expect
      .poll(async () => section(await commands.readRepo(), "Now").trimEnd())
      .toMatch(/Git listener process\]\(drafts\/git-listener\.md\)$/);
    expect(section(await commands.readRepo(), "Next")).not.toContain("Git listener process");
    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await expect.poll(() => commands.readRepo()).toBe(original);
  });

  test("a note moved to a priority in Later is the last entry of Later and leaves the inbox", async () => {
    await show("/inbox", "We need a home icon");
    await pick("We need a home icon", "Move to a priority", "Later");

    await expect
      .poll(async () => section(await commands.readRepo(), "Later").trimEnd())
      .toMatch(/We need a home icon$/);
    expect(await commands.readRepo("specs/INBOX.md")).not.toContain("We need a home icon");
    expect(await screen.findByRole("button", { name: "Undo" })).toBeTruthy();
  });

  test("a priority moved up goes before the card above it", async () => {
    await show("/priorities", "Git listener process");
    await pick("Git listener process", "Move up");
    await expect
      .poll(async () => section(await commands.readRepo(), "Next"))
      .toMatch(/Git listener process[\s\S]*Claude Code runner/);
    // The write is settled once the toast shows: the test ends after the page's last read.
    expect(await screen.findByRole("button", { name: "Undo" })).toBeTruthy();
  });
});

describe("a card's menu in a section with running entries", () => {
  atSize("desktop");

  test("Move up and Move down step over the lines that show, past the running ones", async () => {
    const original = await commands.readRepo();
    // Now's four running lines show in Ongoing: the file has them between the plain ones.
    const lines = original.split("\n");
    const withPlain = lines.flatMap((line) =>
      /^- \[(Recurring tasks|CLI TUIs|Plan review)\]/.test(line)
        ? [`- Plain after ${line.slice(3, line.indexOf("]"))}`.replace("[", ""), line]
        : [line],
    );
    await commands.writeRepo(withPlain.join("\n"));
    await show("/priorities", "Plain after Plan review");
    const order = async () =>
      [...section(await commands.readRepo(), "Now").matchAll(/^- (?:\[)?([^\]\n]+)/gm)].map(
        (found) => found[1],
      );
    expect(await order()).toEqual([
      "Web UI for the workflow files",
      "Plain after Recurring tasks",
      "Recurring tasks",
      "Plain after CLI TUIs",
      "CLI TUIs",
      "Plain after Plan review",
      "Plan review",
    ]);

    await pick("Plain after CLI TUIs", "Move up");
    await expect
      .poll(order)
      .toEqual([
        "Web UI for the workflow files",
        "Plain after CLI TUIs",
        "Plain after Recurring tasks",
        "Recurring tasks",
        "CLI TUIs",
        "Plain after Plan review",
        "Plan review",
      ]);

    await pick("Plain after CLI TUIs", "Move down");
    // On screen it is again between the two others: in the file, just before the one below it.
    await expect
      .poll(order)
      .toEqual([
        "Web UI for the workflow files",
        "Plain after Recurring tasks",
        "Recurring tasks",
        "CLI TUIs",
        "Plain after CLI TUIs",
        "Plain after Plan review",
        "Plan review",
      ]);
  });
});

describe("on the desktop, a card's menu", () => {
  atSize("desktop");

  test("a card without a card above it offers no Move up", async () => {
    await show("/priorities", "Claude Code runner");
    await userEvent.click(more("Claude Code runner"));
    const up = await screen.findByRole("menuitem", { name: "Move up" });
    expect(up.getAttribute("aria-disabled")).toBe("true");
  });

  test("the button shows under the pointer, and on the selected card, not on the others", async () => {
    await show("/priorities", "Git listener process");
    expect(visible("Git listener process")).toBe(0);
    const link = screen.getAllByRole("link", { name: /Git listener process/ })[0];
    const at = middle(link);
    await commands.mouse([{ type: "move", x: at.x, y: at.y }]);
    await expect.poll(() => visible("Git listener process")).toBe(1);
    expect(visible("Claude Code runner")).toBe(0);
  });

  test("Tab reaches … and Enter opens the menu", async () => {
    await show("/priorities", "Git listener process");
    const link = screen
      .getAllByRole("link", { name: /Git listener process/ })
      .find((one) => one.closest("[data-row]"));
    link!.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(more("Git listener process"));
    await expect.poll(() => visible("Git listener process")).toBe(1);
    await userEvent.keyboard("{Enter}");
    (await screen.findByRole("menuitem", { name: "Move to Now" })).focus();
    await userEvent.keyboard("{Enter}");
    await expect
      .poll(async () => section(await commands.readRepo(), "Now"))
      .toContain("Git listener process");
    expect(await screen.findByRole("button", { name: "Undo" })).toBeTruthy();
  });

  test("a running card's menu offers neither a move nor Delete", async () => {
    await show("/priorities", "Plan review");
    await userEvent.click(more("Plan review"));
    const menu = await screen.findByRole("menu");
    const items = within(menu)
      .getAllByRole("menuitem")
      .map((item) => item.textContent);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item).not.toMatch(/Move|top|bottom|Delete|Start|draft/i);
    }
  });
});

describe("on the desktop, a press on …", () => {
  atSize("desktop");

  test("a press on … does not drag, and a card's drag does not open the menu", async () => {
    const moveSent = watchMoves();
    await show("/priorities", "Git listener process");
    const original = await commands.readRepo();
    const button = more("Git listener process");
    // The button shows under the pointer: it is pressed where it is.
    const link = screen
      .getAllByRole("link", { name: /Git listener process/ })
      .find((one) => one.closest("[data-row]"))!;
    // Next's column may reach past the window's edge: the card is brought into view.
    link.scrollIntoView({ block: "center", inline: "center" });
    await drawn();
    const over = middle(link);
    await commands.mouse([{ type: "move", x: over.x, y: over.y }]);
    await expect.poll(() => Number(getComputedStyle(button).opacity)).toBe(1);
    const start = middle(button);
    const now = middle(screen.getByRole("button", { name: "Add to Now" }));
    // A press and release on the button is its click: the menu opens, with no drag started.
    await commands.mouse([
      { type: "move", x: start.x, y: start.y },
      { type: "down" },
      { type: "up" },
    ]);
    expect(await screen.findByRole("menu")).toBeTruthy();
    expect(moveSent()).toBe(false);
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => screen.queryByRole("menu")).toBeNull();
    await commands.mouse([{ type: "move", x: start.x, y: start.y }, { type: "down" }]);
    // The press is on the button, and a drag past it moves nothing.
    expect(button.contains(document.elementFromPoint(start.x, start.y))).toBe(true);
    await dragTo(start, now);
    await commands.mouse([{ type: "up" }]);
    await drawn();
    expect(moveSent()).toBe(false);
    expect(await commands.readRepo()).toBe(original);
    // Close whatever the press opened, then drag the card from its text.
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => screen.queryByRole("menu")).toBeNull();

    const text = middle(link);
    await commands.mouse([{ type: "move", x: text.x, y: text.y }, { type: "down" }]);
    await dragTo(text, { x: text.x + 40, y: text.y });
    await commands.mouse([{ type: "up" }]);
    await drawn();
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("on a phone, a card's menu", () => {
  atSize("phone");

  test("every card shows its … button", async () => {
    expect(window.matchMedia("(hover: none)").matches).toBe(true);
    await show("/priorities", "Git listener process");
    const buttons = screen.getAllByRole("button", { name: /^Actions of / });
    expect(buttons.length).toBeGreaterThan(4);
    for (const button of buttons) {
      expect(Number(getComputedStyle(button).opacity)).toBe(1);
    }
    await show("/inbox", "We need a home icon");
    for (const button of screen.getAllByRole("button", { name: /^Actions of / })) {
      expect(Number(getComputedStyle(button).opacity)).toBe(1);
    }
  });
  test("no card's text runs under its … button", async () => {
    await show("/inbox", "Specs are still way too long and hard to read");
    for (const button of screen.getAllByRole("button", { name: /^Actions of / })) {
      const card = button.closest("[data-row]");
      if (!card) {
        continue;
      }
      const text = card.querySelector("a");
      expect(text).not.toBeNull();
      const range = document.createRange();
      range.selectNodeContents(text as Element);
      const at = button.getBoundingClientRect();
      for (const line of range.getClientRects()) {
        const crosses =
          line.right > at.left &&
          line.left < at.right &&
          line.bottom > at.top &&
          line.top < at.bottom;
        expect(crosses, card.textContent ?? "").toBe(false);
      }
    }
  });
});
