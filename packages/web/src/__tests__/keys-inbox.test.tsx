// US3 1, 3, 4 on the inbox, an outliner: `a` opens the add-note form, `o` a new row under the
// selected note, in its category, `i` turns the note into its field in place, `m` puts it in the
// move mode, `c` moves it to the category a picker chose, and `K` and `L` move the note as a drag
// would. The note picked shows its own keys in a bar under it, and the status line names only the
// page's: `o`, then the categories' `C`, `D`, `R`. A key pressed on the focused note reaches the
// window as a user's does; none of them acts in a text field or under a dialog.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { atWidth, fixtureRepo, read, renderPage, type } from "./helpers.tsx";

const PATH = "specs/INBOX.md";

const INBOX = `# Inbox

- Loose note

## Ideas

- Idea one
- Idea two

## Later

- Later one
`;

beforeEach(() => {
  atWidth(1440);
  forgetUnsaved();
});

/**
 * The control of a note's text: a button, as the list opens its rows itself, not the buttons of the
 * row's bar under it.
 */
function controlOf(note: string) {
  return screen
    .getAllByRole("button", { name: new RegExp(note) })
    .find((one) => one.closest("[data-row-link]") !== null) as HTMLElement;
}

/** The row of a note, with its bar once it shows. */
function rowOf(note: string) {
  return controlOf(note).closest("[data-row]") as HTMLElement;
}

/** The page over a repository holding `INBOX`, with the focus on the row of `note`. */
async function onNote(note: string) {
  const repo = fixtureRepo();
  writeFileSync(join(repo, PATH), INBOX);
  await renderPage("/inbox", repo);
  await screen.findByRole("heading", { name: "Ideas · 2" });
  const link = controlOf(note);
  act(() => link.focus());
  return { link, repo };
}

/** Presses a key on an element, as a user's reaches the window; a capital is typed with Shift. */
async function press(key: string, target: Element = document.body) {
  await act(async () => {
    fireEvent.keyDown(target, { key, shiftKey: /^[A-Z]$/.test(key) });
  });
}

/** Types `text` in a field and presses Enter. */
async function save(field: HTMLElement, text: string) {
  await type(field, text);
  await act(async () => {
    fireEvent.keyDown(field, { key: "Enter" });
  });
}

/** The category the open add form shows. */
async function formCategory() {
  const form = within(await screen.findByRole("dialog", { name: "Add a note" }));
  await form.findByPlaceholderText("What did you notice?");
  return form.getByRole("combobox", { name: "Category" }).textContent;
}

test("o opens a new row under the selected note, in its category, and Enter writes it (US3 1)", async () => {
  const { link, repo } = await onNote("Idea two");

  await press("o", link);

  const ideas = screen.getByRole("list", { name: "Ideas lines" });
  await save(await within(ideas).findByRole("textbox", { name: "New note" }), "Idea three");
  await waitFor(() =>
    expect(read(repo, PATH)).toContain("## Ideas\n\n- Idea one\n- Idea two\n- Idea three\n"),
  );
});

test("o on a note before the first category opens the new row there, with no category", async () => {
  const { link, repo } = await onNote("Loose note");

  await press("o", link);

  const none = screen.getByRole("list", { name: "No category lines" });
  await save(await within(none).findByRole("textbox", { name: "New note" }), "Loose two");
  await waitFor(() =>
    expect(read(repo, PATH)).toContain("- Loose note\n- Loose two\n\n## Ideas\n"),
  );
});

test("a opens the add form in its default place, whatever note is selected", async () => {
  const { link } = await onNote("Later one");

  await press("a", link);

  expect(await formCategory()).toContain("No category");
});

test("i turns the selected note into its field, with its text, and Enter saves it", async () => {
  const { link, repo } = await onNote("Idea two");

  await press("i", link);

  const field = await screen.findByRole("textbox", { name: "Edit the note" });
  expect((field as HTMLTextAreaElement).value).toBe("Idea two");
  await save(field, "Idea deux");
  await waitFor(() => expect(read(repo, PATH)).toContain("- Idea deux\n"));
  // In place: the page did not open the note's pane.
  expect(window.location.pathname).toMatch(/\/inbox$/);
});

test("the note the keys pick shows its own keys in a bar under it, with no menu", async () => {
  const { link } = await onNote("Idea one");

  await press("j", link);

  const row = within(rowOf("Idea two"));
  for (const action of ["⏎ edit", "m move", "c category", "⇥ indent", "p promote", "d delete"]) {
    expect(row.getByRole("button", { name: action }), action).toBeTruthy();
  }
  expect(row.queryByRole("button", { name: /^Actions of/ })).toBeNull();
});

test("m puts the note in the move mode, whose j moves it into the next category (US3 3)", async () => {
  const { link, repo } = await onNote("Idea two");

  await press("m", link);

  const row = within(rowOf("Idea two"));
  for (const action of ["k up", "j down", "h previous section", "l next section", "⏎ done"]) {
    expect(row.getByRole("button", { name: action }), action).toBeTruthy();
  }
  // Down from a category's last note: the start of the next one.
  await press("j", controlOf("Idea two"));
  await waitFor(() => expect(read(repo, PATH)).toContain("## Later\n\n- Idea two\n- Later one\n"));
  expect(read(repo, PATH)).toContain("## Ideas\n\n- Idea one\n");
});

test("c moves the note to the end of the category its picker chose", async () => {
  const { link, repo } = await onNote("Idea one");

  await press("c", link);

  const field = await screen.findByRole("combobox", { name: "Move to a category" });
  // The note's own category is no choice.
  await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
  expect(screen.queryByRole("option", { name: /Ideas/ })).toBeNull();
  await type(field, "Later");
  await waitFor(() => expect(screen.getAllByRole("option")[0]?.textContent).toMatch(/Later/));
  await press("Enter", field);

  await waitFor(() => expect(read(repo, PATH)).toContain("## Later\n\n- Later one\n- Idea one\n"));
  expect(read(repo, PATH)).toContain("## Ideas\n\n- Idea two\n");
});

test("K moves the note above the one before it, as a drag writes it (US3 4)", async () => {
  const { link, repo } = await onNote("Idea two");

  await press("K", link);

  await waitFor(() => expect(read(repo, PATH)).toContain("## Ideas\n\n- Idea two\n- Idea one\n"));
});

test("L moves the note to the end of the next category", async () => {
  const { link, repo } = await onNote("Idea two");

  await press("L", link);

  await waitFor(() => expect(read(repo, PATH)).toContain("## Later\n\n- Later one\n- Idea two\n"));
  expect(read(repo, PATH)).toContain("## Ideas\n\n- Idea one\n");
});

test("none of them act in the add form's text field, or under it", async () => {
  const { link, repo } = await onNote("Idea two");
  await press("a", link);
  const field = await screen.findByPlaceholderText("What did you notice?");

  for (const key of ["i", "m", "o", "c", "d", "K", "L"]) {
    await press(key, field);
    await press(key, link);
  }

  expect(screen.queryByRole("textbox", { name: /^(Edit the note|New note)$/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "⏎ done" })).toBeNull();
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(read(repo, PATH)).toBe(INBOX);
});

test("the status line names o, then C, D, and R, and leaves the note's own keys to its bar", async () => {
  await onNote("Idea two");

  const line = (await screen.findByRole("contentinfo", { name: "Status line" })).textContent ?? "";

  const order = ["o add below", "C new category", "D delete category", "R rename category"];
  for (const hint of order) {
    expect(line, hint).toContain(hint);
  }
  const places = order.slice(1).map((hint) => line.indexOf(hint));
  expect(places).toEqual([...places].sort((a, b) => a - b));
  for (const hint of ["a add", "i edit", "m move", "c category", "p promote", "d delete"]) {
    expect(line, hint).not.toContain(hint);
  }
});
