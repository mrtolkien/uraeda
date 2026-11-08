// SC-002 for the inbox: every kind of write the inbox makes has an undo and a redo. Each row does
// the write through the page, then `u` puts every file of `specs/` back as it was before, and `U`
// as it was after. A move shows no toast; every other write shows its label. A write refused by its
// hash records nothing to undo.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { undoStack } from "../undo/stack.ts";
import { atWidth, click, fixture, fixtureRepo, read, renderPage, type } from "./helpers.tsx";

const PATH = "specs/INBOX.md";

const INBOX = `# Inbox

- Loose note
- [Dark mode](notes/dark-mode.md)
- [Night mode](notes/night-mode/note.md)

## Ideas

- Idea one
  - Idea sub
- Idea two

## Later

- Later one
`;

beforeEach(() => {
  atWidth(1440);
  forgetUnsaved();
});

/** Every file under `specs/` and its bytes: what an undo and a redo must give back. */
function tree(repo: string) {
  const files: Record<string, string> = {};
  const walk = (folder: string) => {
    for (const name of readdirSync(folder)) {
      const path = join(folder, name);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else {
        files[relative(repo, path)] = readFileSync(path, "latin1");
      }
    }
  };
  walk(join(repo, "specs"));
  return files;
}

/** The control of a row's text, not the buttons of the row's bar under it. */
function controlOf(text: string) {
  return screen
    .getAllByRole("button", { name: new RegExp(text) })
    .find((one) => one.closest("[data-row-link]") !== null) as HTMLElement;
}

/** Presses a key, as a user's reaches the window; a capital is typed with Shift. */
async function press(key: string, target: Element = document.body, shiftKey?: boolean) {
  await act(async () => {
    fireEvent.keyDown(target, { key, shiftKey: shiftKey ?? /^[A-Z]$/.test(key) });
  });
}

/** Types `text` in a field and presses Enter. */
async function save(field: HTMLElement, text: string) {
  await type(field, text);
  await press("Enter", field);
}

/** The inbox over a repository holding `INBOX` and its note files, the focus on `note`. */
async function onNote(note: string) {
  const repo = fixtureRepo();
  writeFileSync(join(repo, PATH), INBOX);
  mkdirSync(join(repo, "specs/notes/night-mode/images"), { recursive: true });
  writeFileSync(join(repo, "specs/notes/dark-mode.md"), "# Dark mode\n\nThe dark.\n");
  writeFileSync(
    join(repo, "specs/notes/night-mode/note.md"),
    "# Night mode\n\nThe night.\n\n![moon](images/moon.webp)\n",
  );
  writeFileSync(join(repo, "specs/notes/night-mode/images/moon.webp"), "moon");
  await renderPage("/inbox", repo);
  await screen.findByRole("heading", { name: "Ideas · 2" });
  const link = controlOf(note);
  act(() => link.focus());
  return { link, repo };
}

/** A label after "Undone: " or "Redone: ", its first letter lowercase. */
const lowered = (label: string) => `${label.charAt(0).toLowerCase()}${label.slice(1)}`;

/**
 * Does `write`, then checks it landed on the stack as `label`, with its toast unless a move; `u`
 * puts `specs/` back as before it, and `U` as after it.
 */
async function undoesAndRedoes(
  repo: string,
  label: string,
  write: () => Promise<void>,
  { move = false } = {},
) {
  const before = tree(repo);
  const earlier = undoStack.top();
  await write();
  // The write's own entry, not one before it, landed on the stack.
  await waitFor(
    () => {
      expect(undoStack.top()).not.toBe(earlier);
      expect(undoStack.top()?.label).toBe(label);
    },
    { timeout: 10_000 },
  );
  const after = tree(repo);
  expect(after).not.toEqual(before);
  if (move) {
    // A tick for a toast the record would have drawn, before checking there is none.
    await act(async () => {});
    expect(screen.queryByText(new RegExp(`${label} · waits`))).toBeNull();
  } else {
    expect(await screen.findByText(`${label}`)).toBeTruthy();
  }

  await press("u");
  await screen.findAllByText(`Undone: ${lowered(label)}`);
  await waitFor(() => expect(tree(repo)).toEqual(before));

  await press("U");
  await screen.findAllByText(`Redone: ${lowered(label)}`);
  await waitFor(() => expect(tree(repo)).toEqual(after));
}

// Break: a write that records no entry, or one whose undo leaves part of it written.
test("a row added", async () => {
  const { link, repo } = await onNote("Idea two");
  await undoesAndRedoes(repo, "Added “Idea three”", async () => {
    await press("o", link);
    const ideas = screen.getByRole("list", { name: "Ideas lines" });
    await save(await within(ideas).findByRole("textbox", { name: "New note" }), "Idea three");
  });
});

test("a row edited", async () => {
  const { link, repo } = await onNote("Idea two");
  await undoesAndRedoes(repo, "Edited “Idea deux”", async () => {
    await press("i", link);
    await save(await screen.findByRole("textbox", { name: "Edit the note" }), "Idea deux");
  });
});

test("a row deleted, and a note with its note file", async () => {
  const { link, repo } = await onNote("Idea two");
  await undoesAndRedoes(repo, "Deleted “Idea two”", () => press("d", link));
  // The redo's reread shown, so that the next delete is based on the inbox as it is.
  await screen.findByRole("heading", { name: "Ideas · 1" });
  await undoesAndRedoes(repo, "Deleted “Night mode”", async () => {
    const night = controlOf("Night mode");
    act(() => night.focus());
    await press("d", night);
  });
});

test("an indent", async () => {
  const { link, repo } = await onNote("Idea two");
  await undoesAndRedoes(repo, "Moved “Idea two”", () => press("Tab", link), { move: true });
});

test("an outdent", async () => {
  const { repo } = await onNote("Idea two");
  const sub = controlOf("Idea sub");
  act(() => sub.focus());
  await undoesAndRedoes(repo, "Moved “Idea sub”", () => press("Tab", sub, true), {
    move: true,
  });
});

test("a move up", async () => {
  const { link, repo } = await onNote("Idea two");
  await undoesAndRedoes(repo, "Moved “Idea two”", () => press("K", link), { move: true });
});

test("a move in the move mode", async () => {
  const { repo } = await onNote("Idea two");
  await undoesAndRedoes(
    repo,
    "Moved “Later one”",
    async () => {
      const later = controlOf("Later one");
      act(() => later.focus());
      await press("m", later);
      await press("k", controlOf("Later one"));
      await waitFor(() => expect(read(repo, PATH)).toContain("- Later one\n\n## Later"));
      await press("Enter", controlOf("Later one"));
    },
    { move: true },
  );
});

test("a move to a category", async () => {
  const { repo } = await onNote("Idea two");
  await undoesAndRedoes(
    repo,
    "Moved “Loose note”",
    async () => {
      const loose = controlOf("Loose note");
      act(() => loose.focus());
      await press("c", loose);
      const field = await screen.findByRole("combobox", { name: "Move to a category" });
      await type(field, "Later");
      await waitFor(() => expect(screen.getAllByRole("option")[0]?.textContent).toMatch(/Later/));
      await press("Enter", field);
    },
    { move: true },
  );
});

// US5 on the inbox: moves of one list less than a second apart are one step, with no toast.
test("moves within a second undo as one step", async () => {
  const { link, repo } = await onNote("Idea two");
  const before = tree(repo);
  // The second move 100 ms after the first, whatever the machine's speed: the run is pinned by
  // `Date`.
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    const at = Date.now();
    await press("K", link);
    await waitFor(() => expect(undoStack.top()?.label).toBe("Moved “Idea two”"));
    const first = undoStack.top();
    vi.setSystemTime(at + 100);
    await press("L", controlOf("Idea two"));
    // The second move joined the first: one entry, made anew.
    await waitFor(() => expect(undoStack.top()).not.toBe(first));
    expect(undoStack.top()?.label).toBe("Moved “Idea two”");
    expect(read(repo, PATH)).toContain("- Later one\n- Idea two\n");
    await act(async () => {});
    expect(screen.queryByText(/Moved “Idea two” · waits/)).toBeNull();

    await press("u");
    await screen.findAllByText("Undone: moved “Idea two”");
    await waitFor(() => expect(tree(repo)).toEqual(before));
    expect(undoStack.top()).toBeUndefined();
  } finally {
    vi.useRealTimers();
  }
});

test("a category added", async () => {
  const { repo } = await onNote("Idea two");
  await undoesAndRedoes(repo, "Added the category Someday", async () => {
    await press("C");
    await save(await screen.findByRole("textbox", { name: "New category" }), "Someday");
  });
});

test("a category renamed", async () => {
  const { repo } = await onNote("Idea two");
  await undoesAndRedoes(repo, "Renamed the category Ideas to Thoughts", async () => {
    await press("R");
    const field = await screen.findByRole("combobox", { name: "Rename a category" });
    await type(field, "Ideas");
    await waitFor(() => expect(screen.getAllByRole("option")[0]?.textContent).toMatch(/Ideas/));
    await press("Enter", field);
    await save(await screen.findByRole("textbox", { name: "Rename Ideas" }), "Thoughts");
  });
});

// The edge case of a category holding notes: it still asks, and its delete is undone.
test("a category deleted with its notes", async () => {
  const { repo } = await onNote("Idea two");
  await undoesAndRedoes(repo, "Deleted the category Later", async () => {
    await click(screen.getByRole("button", { name: "Delete category Later" }));
    const asked = (await screen.findAllByRole("dialog", { name: "Delete the category Later" })).at(
      -1,
    )!;
    await press("y", asked);
  });
});

/** Opens `p` on `note` and picks the item whose title holds `title`. */
async function promote(note: string, title: string) {
  const link = controlOf(note);
  act(() => link.focus());
  await press("p", link);
  await screen.findByRole("combobox", { name: "Promote the note" });
  const option = screen.getAllByRole("option").find((one) => one.textContent?.includes(title));
  await act(async () => {
    fireEvent.click(option!);
  });
}

test("a note moved to a level", async () => {
  const { repo } = await onNote("Idea two");
  await undoesAndRedoes(repo, "Moved to Now", () => promote("Loose note", "Now"));
});

test("a note moved under a proposal", async () => {
  const { repo } = await onNote("Idea two");
  await undoesAndRedoes(repo, "Moved under “Claude Code runner (triggered manually)”", () =>
    promote("Loose note", "Claude Code runner"),
  );
});

test("a promotion of a note file into a proposal's file", async () => {
  const { repo } = await onNote("Idea two");
  await undoesAndRedoes(repo, "Added to “Git listener process”", () =>
    promote("Dark mode", "Git listener"),
  );
});

test("a promotion of a note file into a proposal without a file", async () => {
  const { repo } = await onNote("Idea two");
  await undoesAndRedoes(repo, "Added to “Claude Code runner (triggered manually)”", () =>
    promote("Night mode", "Claude Code runner"),
  );
});

/** A PNG, as a drop gives it. */
const png = (name: string) =>
  new File([readFileSync(fixture("images/phone.png"))], name, { type: "image/png" });

/** Drops `files` on the page, as a file manager does, for the selected note. */
async function drop(files: Array<File>) {
  const dataTransfer = { dropEffect: "none", files, types: ["Files"] };
  await act(async () => {
    fireEvent.dragEnter(document.body, { dataTransfer });
    fireEvent.drop(document.body, { dataTransfer });
  });
}

/** The text of the row selected. */
const selectedText = () => document.querySelector("[aria-current='true']")?.textContent;

test("an image attached to a note", async () => {
  const { link, repo } = await onNote("Idea two");
  await press("k", link);
  // The nested row's images go to its note.
  await waitFor(() => expect(selectedText()).toMatch(/^Idea sub/));
  await undoesAndRedoes(repo, "Added an image to “Idea one”", () => drop([png("dropped.png")]));
});

test("an image removed from a note", async () => {
  const { link, repo } = await onNote("Dark mode");
  await press("j", link);
  await waitFor(() => expect(selectedText()).toMatch(/^Night mode/));
  const shown = within(await screen.findByRole("group", { name: "The note's images" }));
  await undoesAndRedoes(repo, "Removed moon.webp from the note's file", () =>
    click(shown.getByRole("button", { name: "Remove moon.webp" })),
  );
});

// Break: a refused write recorded as if it had landed, its undo then writing over the file.
test("a write refused by its hash leaves nothing to undo", async () => {
  const { link, repo } = await onNote("Idea two");
  // Another tool writes the inbox: the page still holds the version before.
  const elsewhere = INBOX.replace("- Later one\n", "- Later one\n- Later two\n");
  writeFileSync(join(repo, PATH), elsewhere);

  await press("i", link);
  await save(await screen.findByRole("textbox", { name: "Edit the note" }), "Idea deux");
  await screen.findByText(/changed/);

  expect(undoStack.top()).toBeUndefined();
  await press("u");
  expect(read(repo, PATH)).toBe(elsewhere);
});
