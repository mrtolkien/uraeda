// US4 3 of the layout look: the decisions page's palette, opened by `/` or "Jump to…", finds any
// principle or decision by its name or first sentence and previews the one under the cursor; Enter
// opens it in the reader. Review focus 7: `/` does nothing in a text field or the sort menu, and
// the list's keys stay still behind the open palette. SC-005: every entry of this repository's own
// ledger opens with three letters or fewer between `/` and Enter.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { readLedger } from "uraeda-binding";
import type { Ledger } from "uraeda-server/fate";
import { expect, test } from "vite-plus/test";
import { jumpEntries, searchEntries } from "../decisions/jump.ts";
import { atRepo, click, fixture, fixtureRepo, git, renderPage } from "./helpers.tsx";

const NOTIFICATIONS = `---
status: active
approved-by: mrtolkien
icon: bell
---

# Notifications

The server tells the human when a feature waits on them, through the browser's notifications. Nothing
else interrupts them.

## Rules

- The server MUST notify the human when a feature waits on them. Checked by the browser tests.
- A notification SHOULD name the feature and its step. Checked by review.
- A notification MUST NOT repeat itself. Checked by review.
- A notification MAY carry the feature's icon. Checked by review.

## Why

The human works elsewhere while agents run.
`;

/** The fixture repository with a Notifications decision committed on its default branch. */
function withNotifications() {
  const repo = fixtureRepo();
  writeFileSync(join(repo, "specs/decisions/notifications.md"), NOTIFICATIONS);
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "docs: notifications");
  return repo;
}

/** Presses a key on an element, as the keyboard does. */
async function press(element: Element, key: string) {
  await act(async () => {
    fireEvent.keyDown(element, { key });
  });
}

/** Opens the decisions page and its palette with `/`, and returns the palette's search field. */
async function openPalette(repo = withNotifications()) {
  await renderPage("/decisions", repo);
  await screen.findByRole("heading", { name: "Uraeda Constitution" });
  await press(document.body, "/");
  return screen.findByRole("combobox", { name: "Jump to a decision or principle" });
}

/** Types a query in the palette's field. */
async function type(field: HTMLElement, query: string) {
  await act(async () => {
    fireEvent.change(field, { target: { value: query } });
  });
}

/** The palette's preview of the entry under the cursor. */
function preview() {
  return within(screen.getByRole("region", { name: "Preview" }));
}

test("`/` opens the palette, and “noti” previews Notifications, which Enter opens (US4 3)", async () => {
  const field = await openPalette();
  // Before a letter, every entry, the constitution's first.
  expect(await screen.findByRole("option", { name: /Humans stay in control/ })).toBeTruthy();
  expect(screen.getByRole("option", { name: /Agents/ })).toBeTruthy();

  await type(field, "noti");
  await waitFor(() =>
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Notifications",
    ]),
  );
  // The first result is under the cursor, previewed: its first sentence and its first rules.
  await waitFor(() =>
    expect(preview().getByRole("heading", { name: "Notifications" })).toBeTruthy(),
  );
  expect(preview().getByText(/tells the human when a feature waits on them/)).toBeTruthy();
  expect(preview().getByText(/notify the human when a feature waits on them/)).toBeTruthy();
  expect(preview().getByText(/name the feature and its step/)).toBeTruthy();
  expect(preview().getByText("and 1 more · ⏎ to open")).toBeTruthy();

  await press(field, "Enter");
  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/decisions/notifications")));
  const reader = within(await screen.findByRole("region", { name: "Detail" }));
  expect(await reader.findByRole("heading", { level: 2, name: "Notifications" })).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Jump to a decision or principle" })).toBeNull();
});

test("a principle is found by its numeral, and previews its rules", async () => {
  const field = await openPalette();
  await type(field, "iii");
  await waitFor(() =>
    expect(preview().getByRole("heading", { name: /Asynchronous by default/ })).toBeTruthy(),
  );
  expect(preview().getByText(/Constitution · \d+ rules?/)).toBeTruthy();

  await press(field, "Enter");
  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/decisions/constitution/iii")));
});

test("“Jump to…” opens the palette, and ↓ moves its cursor, not the list behind it", async () => {
  await renderPage("/decisions/agents", withNotifications());
  await click(await screen.findByRole("button", { name: /Jump to…/ }));
  const field = await screen.findByRole("combobox", { name: "Jump to a decision or principle" });
  await waitFor(() =>
    expect(preview().getByRole("heading", { name: /Humans stay in control/ })).toBeTruthy(),
  );

  await press(field, "ArrowDown");
  await waitFor(() =>
    expect(preview().getByRole("heading", { name: /Git and plain text first/ })).toBeTruthy(),
  );
  expect(window.location.pathname).toBe(atRepo("/decisions/agents"));

  // Escape closes it, and leaves the reader where it was.
  await press(field, "Escape");
  await waitFor(() =>
    expect(screen.queryByRole("combobox", { name: "Jump to a decision or principle" })).toBeNull(),
  );
  expect(window.location.pathname).toBe(atRepo("/decisions/agents"));
});

test("a search that matches nothing reads “Nothing matches.”", async () => {
  const field = await openPalette();
  await type(field, "zzz");
  expect(await screen.findByText("Nothing matches.")).toBeTruthy();
  expect(screen.queryAllByRole("option")).toEqual([]);
});

test("`/` typed in a text field or the open sort menu opens nothing (review focus 7)", async () => {
  await renderPage("/decisions", fixtureRepo());
  await screen.findByRole("heading", { name: "Uraeda Constitution" });

  const search = await screen.findByRole("searchbox", { name: "Search sessions" });
  search.focus();
  await press(search, "/");
  expect(screen.queryByRole("combobox", { name: "Jump to a decision or principle" })).toBeNull();

  const sort = screen.getByRole("combobox", { name: "Sort decisions" });
  await click(sort);
  const option = await screen.findByRole("option", { name: "A to Z" });
  await press(option, "/");
  expect(screen.queryByRole("combobox", { name: "Jump to a decision or principle" })).toBeNull();
});

/** This repository's own ledger, read from its default branch, as the page receives it. */
async function ownLedger() {
  const ledger = await readLedger(join(fixture("."), ".."));
  const decisions = ledger.decisions.map((decision) => ({
    ...decision,
    icon: decision.icon ?? null,
    summary: decision.summary ?? null,
  })) as unknown as Ledger["decisions"];
  return { constitution: ledger.constitution as unknown as Ledger["constitution"], decisions };
}

/** The queries of one to three letters an entry's title holds, its words' starts first. */
function shortQueries(title: string): Array<string> {
  const text = title.toLowerCase();
  const queries = new Set<string>();
  for (let length = 1; length <= 3; length += 1) {
    for (let start = 0; start + length <= text.length; start += 1) {
      queries.add(text.slice(start, start + length));
    }
  }
  return [...queries].filter((query) => query.trim() === query);
}

test("every entry of this repository's ledger is first for a query of three letters (SC-005)", async () => {
  const { constitution, decisions } = await ownLedger();
  const entries = jumpEntries({ constitution }, decisions);
  expect(entries.length).toBeGreaterThanOrEqual(30);
  const unreachable = entries
    .filter(
      (entry) =>
        !shortQueries(entry.title).some((query) => searchEntries(entries, query)[0] === entry),
    )
    .map((entry) => entry.title);
  expect(unreachable).toEqual([]);
});
