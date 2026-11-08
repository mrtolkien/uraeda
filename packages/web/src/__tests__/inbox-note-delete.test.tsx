// `d` on a note of the inbox with a note file deletes the note and its note file at once, asking
// nothing, and `u` brings both back.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { atWidth, fixtureRepo, git, read, renderPage } from "./helpers.tsx";

const PATH = "specs/INBOX.md";
const FILE = "specs/notes/sort-tasks/note.md";
const NOTE_FILE = "# Sort tasks\n\nBy date, then by name.\n";

const INBOX = `# Inbox

## Ideas

- Idea one
- [Sort tasks](notes/sort-tasks/note.md)
`;

beforeEach(() => {
  atWidth(1440);
  forgetUnsaved();
});

/** The control of a note's text, not the buttons of the row's bar under it. */
function controlOf(note: string) {
  return screen
    .getAllByRole("button", { name: new RegExp(note) })
    .find((one) => one.closest("[data-row-link]") !== null) as HTMLElement;
}

/** Presses a key on an element, as a user's reaches the window. */
async function press(key: string, target: Element = document.body) {
  await act(async () => {
    fireEvent.keyDown(target, { key });
  });
}

/**
 * The page over a repository whose committed inbox links the note file, with `d` pressed on the
 * row of `note`.
 */
async function deleting(note: string) {
  const repo = fixtureRepo();
  writeFileSync(join(repo, PATH), INBOX);
  mkdirSync(join(repo, "specs/notes/sort-tasks"), { recursive: true });
  writeFileSync(join(repo, FILE), NOTE_FILE);
  git(repo, "add", "-A");
  git(repo, "commit", "--quiet", "-m", "chore: a note with a note file");
  await renderPage("/inbox", repo);
  await screen.findByRole("heading", { name: "Ideas · 2" });
  const link = controlOf(note);
  act(() => link.focus());
  await press("d", link);
  return repo;
}

// Break: a question still asked, or a delete that leaves the note file or cannot be undone.
test("d on a note with a note file deletes both at once, which u brings back", async () => {
  const repo = await deleting("Sort tasks");

  await waitFor(() => {
    expect(read(repo, PATH)).not.toContain("Sort tasks");
    expect(existsSync(join(repo, "specs/notes/sort-tasks"))).toBe(false);
  });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(read(repo, PATH)).toContain("- Idea one\n");
  await screen.findByText("Deleted “Sort tasks”");

  await press("u");

  // Undo's one write puts back the inbox and the note file, one after the other.
  await waitFor(() => {
    expect(read(repo, PATH)).toBe(INBOX);
    expect(existsSync(join(repo, FILE)) && readFileSync(join(repo, FILE), "utf8")).toBe(NOTE_FILE);
  });
});
