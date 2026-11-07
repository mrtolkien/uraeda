// The keys of the undo stack: `u` takes the human to the action's page, with what came back
// selected, Back leaving it; on that page already, it selects in place. Ctrl+Z in a text field is
// the field's. An action committed since asks first, and its undo commits nothing.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { navigate } from "../routes.tsx";
import { undoStack } from "../undo/stack.ts";
import { atRepo, fixtureRepo, git, read, renderPage } from "./helpers.tsx";

const INBOX = `# Inbox

- Loose note
- Another note
`;

/** Presses a key, as a user's reaches the window; a capital is typed with Shift. */
async function press(key: string, target: Element = document.body, ctrlKey = false) {
  await act(async () => {
    fireEvent.keyDown(target, { ctrlKey, key, shiftKey: /^[A-Z]$/.test(key) });
  });
}

/** The row of a list showing `text`. */
const rowOf = (text: string) =>
  screen
    .queryAllByRole("button", { name: new RegExp(text) })
    .find((one) => one.closest("[data-row-link]") !== null)
    ?.closest("[data-row]");

/** The inbox over a repository holding `INBOX`, its "Loose note" promoted to Now. */
async function promoted() {
  const repo = fixtureRepo();
  writeFileSync(join(repo, "specs/INBOX.md"), INBOX);
  await renderPage("/inbox", repo);
  const link = (await screen.findAllByRole("button", { name: /Loose note/ })).find(
    (one) => one.closest("[data-row-link]") !== null,
  ) as HTMLElement;
  act(() => link.focus());
  await press("p", link);
  await screen.findByRole("combobox", { name: "Promote the note" });
  const now = screen.getAllByRole("option").find((option) => option.textContent === "Now");
  await act(async () => {
    fireEvent.click(now!);
  });
  await screen.findByText("Moved to Now · waits on the Git page");
  expect(read(repo, "specs/INBOX.md")).not.toContain("Loose note");
  return repo;
}

/** The control of the row "Color themes", not the buttons of the row's bar under it. */
const control = () =>
  screen
    .getAllByRole("button", { name: /Color themes/ })
    .find((one) => one.closest("[data-row-link]") !== null) as HTMLElement;

/** The page of a proposal's file, opened from the page on screen. */
async function openFile() {
  await act(async () => navigate(atRepo("/edit/specs/proposals/git-listener.md")));
  return screen.findByRole("textbox", { name: "Text" });
}

// Break: an undo in place without the trip, or a trip that adds an entry on the page open.
test("u from another page opens the action's page with what came back selected", async () => {
  const repo = await promoted();
  await openFile();
  const file = window.location.pathname;

  await press("u");
  await waitFor(() => expect(read(repo, "specs/INBOX.md")).toContain("- Loose note\n"));
  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/inbox")));
  await waitFor(() => expect(rowOf("Loose note")?.getAttribute("aria-current")).toBe("true"));
  await act(async () => window.history.back());
  await waitFor(() => expect(window.location.pathname).toBe(file));

  // On the action's page already: the redo and the undo select there, with no new entry.
  await act(async () => navigate(atRepo("/inbox")));
  await screen.findByRole("heading", { name: "Inbox" });
  const entries = window.history.length;
  await press("U");
  await waitFor(() => expect(read(repo, "specs/INBOX.md")).not.toContain("Loose note"));
  await press("u");
  await waitFor(() => expect(read(repo, "specs/INBOX.md")).toContain("- Loose note\n"));
  await waitFor(() => expect(rowOf("Loose note")?.getAttribute("aria-current")).toBe("true"));
  expect(window.location.pathname).toBe(atRepo("/inbox"));
  expect(window.history.length).toBe(entries);
});

// Break: the stack hearing a field's keys.
test("Ctrl+Z in a text field undoes the typing, not the stack", async () => {
  const repo = await promoted();
  const field = await openFile();

  const undo = vi.spyOn(undoStack, "undo");
  try {
    await press("z", field, true);
    await press("u", field);
    // The stack's undo is called at the press, before it writes: a call would show here.
    expect(undo).not.toHaveBeenCalled();
    expect(undoStack.top()?.label).toBe("Moved to Now");

    // Outside the field, `u` undoes the promotion, the stack's one step.
    await press("u");
    expect(undo).toHaveBeenCalledTimes(1);
    await screen.findByText("Undone: moved to Now");
    await waitFor(() => expect(read(repo, "specs/INBOX.md")).toContain("- Loose note\n"));
    expect(undoStack.top()).toBeUndefined();
  } finally {
    undo.mockRestore();
  }
});

// Break: an undo that skips its question, or one that commits.
test("u on a committed change asks; Keep it keeps it, Undo writes it uncommitted", async () => {
  const repo = await promoted();
  git(repo, "add", "-A");
  git(repo, "commit", "--quiet", "--no-verify", "-m", "chore: promote the note");
  const commits = git(repo, "rev-list", "--count", "HEAD");

  await press("u");
  await screen.findByRole("dialog", { name: "Undo a committed change?" });
  await press("n");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(read(repo, "specs/INBOX.md")).not.toContain("Loose note");

  await press("u");
  await screen.findByRole("dialog", { name: "Undo a committed change?" });
  await press("y");
  await waitFor(() => expect(read(repo, "specs/INBOX.md")).toContain("- Loose note\n"));
  expect(read(repo).split("## Next")[0]).not.toContain("Loose note");
  expect(git(repo, "rev-list", "--count", "HEAD")).toBe(commits);
});

const COLORS = `# Priorities

## Now

- Now line

## Next

- First
- Second
- Third
- Color themes
`;

// Break: a run that undoes one move, or a toast on a move.
test("m, k three times, Enter: no toast, and u puts the row back in one step", async () => {
  const repo = fixtureRepo();
  writeFileSync(join(repo, "specs/PRIORITIES.md"), COLORS);
  await renderPage("/priorities", repo);
  await screen.findByRole("heading", { name: "Next · 4" });
  act(() => control().focus());
  // Each press 100 ms after the last, whatever the machine's speed: the run is pinned by `Date`.
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    let at = Date.now();
    await press("m", control());
    for (const above of ["Third", "Second", "First"]) {
      at += 100;
      vi.setSystemTime(at);
      await press("k", control());
      await waitFor(() => expect(read(repo)).toMatch(new RegExp(`- Color themes\\n- ${above}\\n`)));
    }
    await press("Enter", control());
    expect(read(repo)).toContain("## Next\n\n- Color themes\n- First\n");
    expect(screen.queryByText(/Moved/)).toBeNull();

    await press("u");
    await waitFor(() => expect(read(repo)).toBe(COLORS));
    await screen.findByText("Undone: moved “Color themes”");
  } finally {
    vi.useRealTimers();
  }
});
