// US2 and review focus 5, on the desktop: the shared list moves its selection with the keyboard, ↑ ↓
// or j k, Home and End, which opens nothing; Enter opens the selected card in its overlay, and
// Escape closes it. No key acts while a text field has the focus, or while a Selector, a menu, or a
// dialog is open. Each test takes the repository in turn, on a fresh copy of the fixture.
import { screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { commands as browserCommands, userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { atRepo, atSize, drawn, show } from "./helpers.tsx";

const commands = browserCommands as unknown as RepoCommands;

atSize("desktop");

/** Now's lines, none started, so they show in Now with the fixture's Next, Later, and Blocked. */
const NOW = [
  "Line one",
  "Line two",
  "Line three",
  "Line four",
  "Line five",
  "Line six",
  "Line seven",
];

/** The fixture's priorities with seven lines in Now: twelve rows, in four sections. */
async function longList() {
  const original = await commands.readRepo();
  await commands.writeRepo(
    original.replace(
      /## Now\n\n[^#]*## Next/,
      `## Now\n\n${NOW.map((line) => `- ${line}\n`).join("")}\n## Next`,
    ),
  );
}

/** A row's link, by its text. */
function row(name: string | RegExp) {
  return screen.getByRole("link", { name });
}

/** The rows of the page's lists marked current, `aria-current`: the selected one. */
function current() {
  return within(screen.getByRole("main")).queryAllByRole("listitem", { current: true });
}

/** Waits for the row of a text to be selected and focused, with nothing opened. */
async function selected(name: string | RegExp) {
  await expect.poll(() => document.activeElement).toBe(row(name));
  await expect
    .poll(() => current().map((item) => within(item).queryByRole("link", { name }) === row(name)))
    .toEqual([true]);
}

/** Opens the priorities with the focus on Now's first line's card. */
async function fromFirst() {
  await longList();
  await show("/priorities", "Line seven");
  row(/Line one/).focus();
  await drawn();
}

test("↓ selects the next card and opens nothing (US2 1, US4)", async () => {
  await fromFirst();
  const entries = window.history.length;

  await userEvent.keyboard("{ArrowDown}");
  await selected(/Line two/);
  // The selection does not open the card.
  expect(window.location.pathname).toBe(atRepo("/priorities"));
  expect(screen.queryByRole("dialog")).toBeNull();

  // Nine presses from the first card reach the tenth: Later's line.
  for (let press = 0; press < 8; press += 1) {
    await userEvent.keyboard("{ArrowDown}");
  }
  await selected(/Nix \+ Docker/);
  expect(window.history.length).toBe(entries);
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("j crosses sections (US2 2)", async () => {
  await longList();
  await show("/priorities", "Line seven");
  row(/Line seven/).focus();

  await userEvent.keyboard("j");
  await selected(/Claude Code runner/);
});

test("Enter opens the selected card in its overlay, and Escape closes it (US2 3, 4)", async () => {
  await fromFirst();
  await userEvent.keyboard("{ArrowDown}");
  await selected(/Line two/);

  await userEvent.keyboard("{Enter}");
  expect(await screen.findByRole("dialog", { name: "Priority" })).toBeTruthy();
  await expect.poll(() => window.location.pathname).toBe(atRepo("/priorities/line-two"));
  // No key of the list acts under the overlay: ↓ does not move the selection.
  await userEvent.keyboard("{ArrowDown}");
  await drawn();
  expect(window.location.pathname).toBe(atRepo("/priorities/line-two"));

  await userEvent.keyboard("{Escape}");
  await expect.poll(() => screen.queryByRole("dialog")).toBeNull();
  await expect.poll(() => window.location.pathname).toBe(atRepo("/priorities"));
  await selected(/Line two/);
  // The keys go on from the card the overlay showed.
  await userEvent.keyboard("{ArrowDown}");
  await selected(/Line three/);
});

test("End and Home (US2 5)", async () => {
  await fromFirst();

  await userEvent.keyboard("{End}");
  await selected(/Benchmarks/);
  await userEvent.keyboard("{Home}");
  await selected(/Line one/);
});

test("k in the inbox (US2 7)", async () => {
  await show("/inbox", "We need a home icon");
  row(/We'll need a model selector/).focus();

  await userEvent.keyboard("k");
  await selected(/Specs are still way too long/);
});

test("keys do nothing while a Selector is open (review focus 5)", async () => {
  await show("/inbox/we-need-a-home-icon", "Note, in No category");
  const at = window.location.pathname;
  await userEvent.click(screen.getByRole("combobox", { name: "Category" }));
  await screen.findByRole("listbox");

  for (const key of ["{ArrowDown}", "j", "{End}"]) {
    await userEvent.keyboard(key);
    await drawn();
    expect(window.location.pathname).toBe(at);
  }
  // A tap beside its options, which WebKit does not focus, leaves the focus on the page: the
  // Selector, still open, keeps the keys.
  (document.activeElement as HTMLElement | null)?.blur();
  expect(screen.getByRole("listbox")).toBeTruthy();
  for (const key of ["{ArrowDown}", "j", "{Escape}"]) {
    await userEvent.keyboard(key);
    await drawn();
    expect(window.location.pathname).toBe(at);
  }
  expect(screen.getByRole("dialog", { name: "Note" })).toBeTruthy();
});

test("keys do nothing while a menu is open (review focus 5)", async () => {
  await show("/inbox/we-need-a-home-icon", "Note, in No category");
  const at = window.location.pathname;
  await userEvent.click(screen.getByRole("button", { name: "Move to priorities" }));
  await screen.findByRole("menu");
  // Off its items, the keys reach the page: the open menu still keeps them from the list.
  (document.activeElement as HTMLElement | null)?.blur();
  expect(screen.getByRole("menu")).toBeTruthy();

  for (const key of ["{ArrowDown}", "j", "{End}"]) {
    await userEvent.keyboard(key);
    await drawn();
    expect(window.location.pathname).toBe(at);
  }
  await userEvent.keyboard("{Escape}");
  await drawn();
  expect(window.location.pathname).toBe(at);
  expect(screen.getByRole("dialog", { name: "Note" })).toBeTruthy();
});

test("keys do nothing while a dialog is open (review focus 5)", async () => {
  await show("/inbox", "We need a home icon");
  const at = window.location.pathname;
  await userEvent.click(screen.getByRole("button", { name: "Add a note to the inbox" }));
  await screen.findByRole("dialog", { name: "Add a note" });
  // Off its text field, the keys reach the page: the open dialog still keeps them from the list.
  (document.activeElement as HTMLElement | null)?.blur();

  for (const key of ["{ArrowDown}", "j", "{End}"]) {
    await userEvent.keyboard(key);
    await drawn();
    expect(window.location.pathname).toBe(at);
  }
});

/** An element's own background, or the first one behind it: a transparent one shows its parent's. */
function background(element: Element | null): string {
  for (let at = element; at; at = at.parentElement) {
    const colour = getComputedStyle(at).backgroundColor;
    if (colour !== "rgba(0, 0, 0, 0)" && colour !== "transparent") {
      return colour;
    }
  }
  return "";
}

// The spec's "the selected row is highlighted": in dark, the neutral theme's selection was the
// page's own colour, so the open row did not show.
test.each((["light", "dark"] as const).map((mode) => ({ mode })))(
  "the selected row stands out from the list, in $mode",
  async ({ mode }) => {
    window.localStorage.setItem("uraeda.theme", mode);
    await show("/priorities/git-listener", "Open draft");
    const next = within(screen.getByRole("list", { name: "Next lines" }));
    const open = await next.findByRole("listitem", { current: true });
    expect(within(open).getByRole("link", { name: /Git listener process/ })).toBeTruthy();
    const other = next
      .getAllByRole("listitem")
      .find((item) => within(item).queryByRole("link", { name: /Claude Code runner/ }));
    expect(other).toBeTruthy();
    expect(background(open)).not.toBe(background(other ?? null));
  },
);
