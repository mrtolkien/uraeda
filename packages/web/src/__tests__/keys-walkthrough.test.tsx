// What the keyboard walkthrough of 2026-11-05 (persona Tolki, `specs/ui/personas.md`) found a
// keyboard alone could not do, or did with many keys: the Git page opens with its row focused, so
// Space stages at once, and a file with no change left says so; the inbox opens with its first note
// selected; a review's `n` reaches its verdict, and the session its approval opens has its
// composer focused; the picker's Ctrl+J and Ctrl+K move its cursor; the decisions page marks the principle
// the keys picked; and what the keys bring into view scrolls clear of the status line.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import {
  atWidth,
  fakeAgent,
  fieldText,
  fixtureRepo,
  git,
  quiet,
  read,
  renderPage,
  today,
} from "./helpers.tsx";

today("2026-10-11");

/** The fixture's feature whose spec waits for a review. */
const FEATURE = "2026-10-06-recurring-tasks";

/** Presses a key where the focus is, as a user's reaches the window. */
const press = (key: string, init: Partial<KeyboardEventInit> = {}) =>
  act(async () => {
    fireEvent.keyDown(document.activeElement ?? document.body, { key, ...init });
  });

/** The fixture, with a line added to `specs/INBOX.md`, not committed. */
function changedRepo() {
  const repo = fixtureRepo();
  writeFileSync(join(repo, "specs/INBOX.md"), `${read(repo, "specs/INBOX.md")}\n- A note\n`);
  return repo;
}

// Break: the page opening with its first row tinted but the focus on the page, where Space opens
// the leader's menu instead of staging.
test("the Git page opens with its first row's box focused, where Space stages", async () => {
  atWidth(1440);
  const repo = changedRepo();
  await renderPage("/git", repo);
  const folder = await screen.findByRole("checkbox", { name: "specs" });
  await waitFor(() => expect(document.activeElement).toBe(folder));
});

// Break: the detail drawing the diff of a file git no longer lists, as once its commit landed.
test("a file the Git page's address names, with no change left, says so", async () => {
  atWidth(1440);
  await renderPage("/git?file=specs%2FINBOX.md", fixtureRepo());
  expect(await screen.findByText("specs/INBOX.md has no change left.")).toBeTruthy();
  // Nothing to stage or commit names no key.
  expect(screen.queryByText("stage all")).toBeNull();
});

// Break: the inbox opening with no row selected, so `p` promotes nothing until `j`.
test("the inbox opens with its first note selected: `p` promotes it at once", async () => {
  atWidth(1440);
  await renderPage("/inbox", fixtureRepo());
  await screen.findByRole("heading", { name: "Inbox" });
  await quiet();
  await press("p");
  expect(await screen.findByRole("combobox", { name: "Promote the note" })).toBeTruthy();
});

// Break: the hand-over's session opening with the focus on the page, where Enter starts nothing.
test("`n` then Enter approves a spec, and its session opens with the composer focused", async () => {
  atWidth(1440);
  const repo = fixtureRepo();
  git(repo, "worktree", "add", "--quiet", join(".worktrees", FEATURE), FEATURE);
  await renderPage(`/f/${FEATURE}/spec.md`, repo, { agent: await fakeAgent() });
  const approve = await screen.findByRole("button", { name: "Approve" });
  await quiet();
  await press("n");
  expect(document.activeElement).toBe(approve);
  await act(async () => approve.click());

  await waitFor(() => expect(window.location.pathname).toMatch(/\/session$/));
  const composer = await screen.findByRole("textbox", { name: "Message Claude Code" });
  await waitFor(() => expect(fieldText(composer)).toContain("/uraeda Continue the feature"));
  await waitFor(() => expect(document.activeElement).toBe(composer));
});

// Break: the picker's cursor moving by the arrows alone, as no LazyVim picker does.
test("in a picker, Ctrl+J and Ctrl+K move the cursor down and up", async () => {
  atWidth(1440);
  await renderPage("/inbox", fixtureRepo());
  await screen.findByRole("heading", { name: "Inbox" });
  await quiet();
  await press(" ");
  await press(" ");
  const field = await screen.findByRole("combobox", { name: /^Find/ });
  await waitFor(() => expect(field.getAttribute("aria-activedescendant")).toMatch(/-item-0$/));
  await act(async () => void fireEvent.keyDown(field, { ctrlKey: true, key: "j" }));
  await act(async () => void fireEvent.keyDown(field, { ctrlKey: true, key: "j" }));
  expect(field.getAttribute("aria-activedescendant")).toMatch(/-item-2$/);
  await act(async () => void fireEvent.keyDown(field, { ctrlKey: true, key: "k" }));
  expect(field.getAttribute("aria-activedescendant")).toMatch(/-item-1$/);
});

// Break: the principles sharing one address, so the list marks none as `j` moves over them.
test("on the decisions page, `j` marks the next principle", async () => {
  atWidth(1440);
  await renderPage("/decisions", fixtureRepo());
  const principles = await screen.findByRole("list", { name: "Principles" });
  await quiet();
  const rows = () => Array.from(principles.querySelectorAll(":scope > li"));
  expect(rows()[0]?.getAttribute("aria-current")).toBe("true");
  await press("j");
  await waitFor(() => expect(rows()[1]?.getAttribute("aria-current")).toBe("true"));
  expect(rows()[0]?.getAttribute("aria-current")).toBeNull();
});

// Break: the document with no scroll padding, so a row the keys select ends under the status line.
test("on a desktop, what the keys bring into view scrolls clear of the status line", async () => {
  atWidth(1440);
  await renderPage("/inbox", fixtureRepo());
  await screen.findByRole("heading", { name: "Inbox" });
  expect(document.documentElement.style.scrollPaddingBlockEnd).not.toBe("");
});
