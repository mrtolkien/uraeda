// US3 1, 3, 4 on the inbox: `a` opens the add-note form, `o` in the selected note's category, `i`
// turns the note into its editor in place, `m` opens its card's menu, and `K` and `L` move the note
// as a drag would. A key pressed on the focused note reaches the window as a user's does; none of
// them acts in a text field or under a dialog.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { atWidth, click, fixtureRepo, read, renderPage, type } from "./helpers.tsx";

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

/** The page over a repository holding `INBOX`, with the focus on the card of `note`. */
async function onNote(note: string) {
  const repo = fixtureRepo();
  writeFileSync(join(repo, PATH), INBOX);
  await renderPage("/inbox", repo);
  await screen.findByRole("heading", { name: "Ideas · 2" });
  const link = screen
    .getAllByRole("link", { name: new RegExp(note) })
    .find((one) => one.closest("[data-row]") !== null) as HTMLElement;
  act(() => link.focus());
  return { link, repo };
}

/** Presses a key on an element, as a user's reaches the window; a capital is typed with Shift. */
async function press(key: string, target: Element = document.body) {
  await act(async () => {
    fireEvent.keyDown(target, { key, shiftKey: /^[A-Z]$/.test(key) });
  });
}

/** The category the open add form shows. */
async function formCategory() {
  const form = within(await screen.findByRole("dialog", { name: "Add a note" }));
  await form.findByPlaceholderText("What did you notice?");
  return form.getByRole("combobox", { name: "Category" }).textContent;
}

test("o opens the add form with the category of the selected note (US3 1)", async () => {
  const { link } = await onNote("Idea two");

  await press("o", link);

  expect(await formCategory()).toContain("Ideas");
});

// Break: the remembered new-category name beating the category `o` chose.
test("o opens on the note's category, though an unsaved new category's name was left behind", async () => {
  const { link } = await onNote("Idea two");
  await press("a", link);
  const form = within(await screen.findByRole("dialog", { name: "Add a note" }));
  await click(form.getByRole("combobox", { name: "Category" }));
  await click(await screen.findByRole("option", { name: "New category…" }));
  await type(form.getByRole("textbox", { name: "Category name" }), "Foo");
  await click(form.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add a note" })).toBeNull());

  act(() => link.focus());
  await press("o", link);

  expect(await formCategory()).toContain("Ideas");
});

test("o on a note before the first category opens the form with No category", async () => {
  const { link } = await onNote("Loose note");

  await press("o", link);

  expect(await formCategory()).toContain("No category");
});

test("a opens the add form in its default place, whatever note is selected", async () => {
  const { link } = await onNote("Later one");

  await press("a", link);

  expect(await formCategory()).toContain("No category");
});

test("i turns the selected note into its editor, with its text, and Enter saves it", async () => {
  const { link, repo } = await onNote("Idea two");

  await press("i", link);

  const field = await screen.findByRole("textbox", { name: "Edit Idea two" });
  expect((field as HTMLInputElement).value).toBe("Idea two");
  await type(field, "Idea deux");
  await act(async () => {
    fireEvent.keyDown(field, { key: "Enter" });
  });
  await waitFor(() => expect(read(repo, PATH)).toContain("- Idea deux\n"));
  // In place: the page did not open the note's pane.
  expect(window.location.pathname).toMatch(/\/inbox$/);
});

test("m opens the menu of the selected note, with its category choices (US3 3)", async () => {
  const { link } = await onNote("Idea two");

  await press("m", link);

  expect(await screen.findByRole("menuitem", { name: "Category" })).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "Delete" })).toBeTruthy();
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
  const { link } = await onNote("Idea two");
  await press("o", link);
  const field = await screen.findByPlaceholderText("What did you notice?");

  for (const key of ["i", "m", "o", "K", "L"]) {
    await press(key, field);
    await press(key, link);
  }

  expect(screen.queryByRole("textbox", { name: /^Edit / })).toBeNull();
  expect(screen.queryByRole("menuitem")).toBeNull();
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
});

test("the status line names a, o, i, and m on the page", async () => {
  await onNote("Idea two");

  const line = await screen.findByRole("contentinfo", { name: "Status line" });

  for (const hint of ["a add", "o add beside", "i edit", "m move"]) {
    expect(line.textContent, hint).toContain(hint);
  }
});
