// US2 and review focus 5, on the desktop: the shared list moves its selection with the keyboard, ↑ ↓
// or j k, Home and End, the pane beside it following; Enter edits the selected item in its pane, and
// Escape closes the field, then the pane. No key acts while a text field or an open Selector has
// the focus. Each test takes the repository in turn, on a fresh copy of the fixture.
import { screen } from "@testing-library/react";
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

/** Where a row leads: the address the pane shows it at. */
function address(name: string | RegExp) {
  return new URL(row(name).getAttribute("href") ?? "", window.location.href).pathname;
}

/** Waits for the row of a text to be selected, focused, and shown in the pane. */
async function selected(name: string | RegExp) {
  await expect.poll(() => window.location.pathname).toBe(address(name));
  await expect.poll(() => document.activeElement).toBe(row(name));
  await expect.poll(() => row(name).closest("li")?.getAttribute("aria-current")).toBe("true");
}

/** Opens the priorities with Now's first line in the pane and the focus on its row. */
async function fromFirst() {
  await longList();
  await show("/priorities/line-one", "Line seven");
  row(/Line one/).focus();
  await drawn();
}

test("↓ selects the next row and the pane follows (US2 1, SC-003)", async () => {
  await fromFirst();
  const entries = window.history.length;

  await userEvent.keyboard("{ArrowDown}");
  await selected(/Line two/);
  expect(window.location.pathname).toBe(atRepo("/priorities/line-two"));
  // The pane shows the row selected.
  expect(await screen.findByText("Now · 2 of 7")).toBeTruthy();
  // The list stayed drawn as the pane followed: the focus is still on the row.
  await drawn();
  expect(document.activeElement).toBe(row(/Line two/));

  // Nine presses from the first row reach the tenth: Later's line.
  for (let press = 0; press < 8; press += 1) {
    await userEvent.keyboard("{ArrowDown}");
  }
  await selected(/Nix \+ Docker/);
  expect(await screen.findByText("Later · 1 of 1")).toBeTruthy();
  await drawn();
  expect(document.activeElement).toBe(row(/Nix \+ Docker/));
  // The pane followed in place: Back leaves the priorities, not each row passed.
  expect(window.history.length).toBe(entries);
});

test("j crosses sections (US2 2)", async () => {
  await longList();
  await show("/priorities/line-seven", "Line seven");
  row(/Line seven/).focus();

  await userEvent.keyboard("j");
  await selected(/Claude Code runner/);
  expect(await screen.findByText("Next · 1 of 2")).toBeTruthy();
});

test("Enter opens the field; ↓ then moves the cursor (US2 3)", async () => {
  await fromFirst();

  await userEvent.keyboard("{Enter}");
  const field = await screen.findByRole("textbox", { name: "Line" });
  expect(document.activeElement).toBe(field);
  await userEvent.keyboard("{ArrowDown}");
  await drawn();
  // The cursor moved in the field: the selection and the pane stayed.
  expect(document.activeElement).toBe(field);
  expect(window.location.pathname).toBe(atRepo("/priorities/line-one"));
});

test("Escape closes the field, then the pane (US2 4)", async () => {
  await fromFirst();
  await userEvent.keyboard("{Enter}");
  await screen.findByRole("textbox", { name: "Line" });

  await userEvent.keyboard("{Escape}");
  await expect.poll(() => screen.queryByRole("textbox", { name: "Line" })).toBeNull();
  await expect.poll(() => document.activeElement).toBe(row(/Line one/));
  expect(window.location.pathname).toBe(atRepo("/priorities/line-one"));

  await userEvent.keyboard("{Escape}");
  await expect.poll(() => window.location.pathname).toBe(atRepo("/priorities"));
  await expect.poll(() => screen.queryByRole("region", { name: "Detail" })).toBeNull();
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
  await userEvent.click(row(/We'll need a model selector/));
  await expect.poll(() => window.location.pathname).toBe(address(/We'll need a model selector/));
  await screen.findByText("Note, in No category");
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
  expect(screen.getByRole("region", { name: "Detail" })).toBeTruthy();
});
