// US3 1, 3, and the priorities' own keys, on the outliner: `a` opens the add form in its default
// place, `o` opens a new row being typed under the selected line, in its section, `i` turns the line
// into its field in place, and `m` puts it in the move mode, which its bar names. The row picked
// shows its own keys in a bar under it, and the status line names only the page's. A key pressed on
// the focused line reaches the window as a user's does; none of them acts in a text field or under
// a dialog. The moves of the line itself are in `__browser__/keys-shift.test.tsx`.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { atWidth, fixtureRepo, read, renderPage, type } from "./helpers.tsx";

const PATH = "specs/PRIORITIES.md";

const PRIORITIES = `# Priorities

## Now

- Now line 1

## Next

- Next line 1
- Next line 2

## Later

- Later line 1
`;

beforeEach(() => {
  atWidth(1440);
  forgetUnsaved();
});

/**
 * The control of a line's text: a button, as the list opens its rows itself, not the buttons of the
 * row's bar under it.
 */
function controlOf(line: string) {
  return screen
    .getAllByRole("button", { name: new RegExp(line) })
    .find((one) => one.closest("[data-row-link]") !== null) as HTMLElement;
}

/** The row of a line, with its bar once it shows. */
function rowOf(line: string) {
  return controlOf(line).closest("[data-row]") as HTMLElement;
}

/** The page over a repository holding `PRIORITIES`, with the focus on the row of `line`. */
async function onLine(line: string) {
  const repo = fixtureRepo();
  writeFileSync(join(repo, PATH), PRIORITIES);
  await renderPage("/priorities", repo);
  await screen.findByRole("heading", { name: "Next · 2" });
  const link = controlOf(line);
  act(() => link.focus());
  return { link, repo };
}

/** Presses a key on an element, as a user's reaches the window. */
async function press(key: string, target: Element = document.body) {
  await act(async () => {
    fireEvent.keyDown(target, { key });
  });
}

/** Types `text` in a field and presses Enter. */
async function save(field: HTMLElement, text: string) {
  await type(field, text);
  await act(async () => {
    fireEvent.keyDown(field, { key: "Enter" });
  });
}

/** Checks that the open add form is set to `section`. */
async function expectSection(section: string) {
  const form = within(await screen.findByRole("dialog", { name: "New proposal" }));
  await form.findByRole("textbox", { name: "Proposal" });
  expect(form.getByRole("radio", { checked: true, name: section })).toBeTruthy();
}

test("o opens a new row under the selected line, in its section, and Enter writes it (US3 1)", async () => {
  const { link, repo } = await onLine("Later line 1");

  await press("o", link);

  const later = screen.getByRole("list", { name: "Later lines" });
  const field = await within(later).findByRole("textbox", { name: "New proposal" });
  await save(field, "Later line 2");
  await waitFor(() => expect(read(repo)).toContain("## Later\n\n- Later line 1\n- Later line 2\n"));
  // Enter opened the next new row under it; Escape drops it, and nothing more is written.
  const next = await within(later).findByRole("textbox", { name: "New proposal" });
  expect((next as HTMLTextAreaElement).value).toBe("");
  await press("Escape", next);
  await waitFor(() => expect(screen.queryByRole("textbox", { name: "New proposal" })).toBeNull());
  expect(read(repo)).toContain("## Later\n\n- Later line 1\n- Later line 2\n");
});

test("o on a line of Now opens the new row in Now", async () => {
  const { link, repo } = await onLine("Now line 1");

  await press("o", link);

  const now = screen.getByRole("list", { name: "Now lines" });
  await save(await within(now).findByRole("textbox", { name: "New proposal" }), "Now line 2");
  await waitFor(() => expect(read(repo)).toContain("## Now\n\n- Now line 1\n- Now line 2\n"));
});

test("a opens the add form in its default place, Next, whatever line is selected", async () => {
  const { link } = await onLine("Later line 1");

  await press("a", link);

  await expectSection("Next");
});

test("a opens the add form with the focus on the page too", async () => {
  await onLine("Later line 1");

  await press("a");

  await expectSection("Next");
});

test("i turns the selected line into its field, with the line's text, and Enter saves it (US3)", async () => {
  const { link, repo } = await onLine("Next line 2");

  await press("i", link);

  const next = screen.getByRole("list", { name: "Next lines" });
  const field = await within(next).findByRole("textbox", { name: "Edit the proposal" });
  expect((field as HTMLTextAreaElement).value).toBe("Next line 2");
  await save(field, "Next line two");
  await waitFor(() => expect(read(repo)).toContain("- Next line two\n"));
  expect(read(repo)).not.toContain("Next line 2");
  // In place: the page did not open the line's pane.
  expect(window.location.pathname).toMatch(/\/priorities$/);
});

test("Escape closes the field and leaves the line as it was", async () => {
  const { link, repo } = await onLine("Next line 2");
  await press("i", link);
  const field = await screen.findByRole("textbox", { name: "Edit the proposal" });

  await press("Escape", field);

  await waitFor(() =>
    expect(screen.queryByRole("textbox", { name: "Edit the proposal" })).toBeNull(),
  );
  expect(read(repo)).toBe(PRIORITIES);
});

test("m puts the selected line in the move mode: its bar names the move keys, and j moves it (US3 3)", async () => {
  const { link, repo } = await onLine("Next line 1");

  await press("m", link);

  const row = within(rowOf("Next line 1"));
  for (const action of ["k up", "j down", "h previous column", "l next column", "⏎ done"]) {
    expect(row.getByRole("button", { name: action }), action).toBeTruthy();
  }
  await press("j", controlOf("Next line 1"));
  await waitFor(() => expect(read(repo)).toContain("## Next\n\n- Next line 2\n- Next line 1\n"));
  // Enter ends the mode: the row's bar names its own keys again.
  await press("Enter", controlOf("Next line 1"));
  await waitFor(() =>
    expect(within(rowOf("Next line 1")).queryByRole("button", { name: "⏎ done" })).toBeNull(),
  );
  expect(within(rowOf("Next line 1")).getByRole("button", { name: "m move" })).toBeTruthy();
});

test("the line the keys pick shows its own keys in a bar under it", async () => {
  const { link } = await onLine("Next line 1");

  await press("j", link);

  const row = within(rowOf("Next line 2"));
  for (const action of ["⏎ edit", "m move", "⇥ indent", "e expand", "s start", "d delete"]) {
    expect(row.getByRole("button", { name: action }), action).toBeTruthy();
  }
  expect(within(rowOf("Next line 1")).queryByRole("button", { name: "m move" })).toBeNull();
});

test("with the focus on the page, i edits the line the page opened on, the first of Now", async () => {
  await onLine("Next line 2");
  // The focus on the page: the keys act on the selected line, which no focus moved.
  act(() => (document.activeElement as HTMLElement | null)?.blur());

  await press("i");

  const field = await screen.findByRole("textbox", { name: "Edit the proposal" });
  expect((field as HTMLTextAreaElement).value).toBe("Now line 1");
});

test("none of them act in the add form's text field", async () => {
  const { link, repo } = await onLine("Later line 1");
  await press("a", link);
  const field = await screen.findByRole("textbox", { name: "Proposal" });

  for (const key of ["i", "m", "o", "d"]) {
    await press(key, field);
  }

  expect(screen.queryByRole("textbox", { name: /^(Edit the proposal|New proposal)$/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "⏎ done" })).toBeNull();
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(read(repo)).toBe(PRIORITIES);
});

test("none of them act while a dialog is open", async () => {
  const { link, repo } = await onLine("Next line 2");
  await press("a", link);
  await screen.findByRole("dialog", { name: "New proposal" });

  for (const key of ["i", "m", "o", "d"]) {
    await press(key, link);
  }

  expect(screen.queryByRole("textbox", { name: /^(Edit the proposal|New proposal)$/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "⏎ done" })).toBeNull();
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(read(repo)).toBe(PRIORITIES);
});

test("the status line names o and v, and leaves the row's own keys to its bar", async () => {
  await onLine("Next line 2");

  const line = await screen.findByRole("contentinfo", { name: "Status line" });

  for (const hint of ["o add below", "v view"]) {
    expect(line.textContent, hint).toContain(hint);
  }
  for (const hint of ["a add", "i edit", "m move", "d delete"]) {
    expect(line.textContent, hint).not.toContain(hint);
  }
});
