// US3 1, 3, and the priorities' own keys: `a` opens the add form in its default place, `o` in the
// selected line's section, `i` turns the line into its editor in place, and `m` opens its card's menu.
// A key pressed on the focused line reaches the window as a user's does; none of them acts in a text
// field or under a dialog. The moves of the line itself are in `__browser__/keys-shift.test.tsx`.
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

/** The page over a repository holding `PRIORITIES`, with the focus on the card of `line`. */
async function onLine(line: string) {
  const repo = fixtureRepo();
  writeFileSync(join(repo, PATH), PRIORITIES);
  await renderPage("/priorities", repo);
  await screen.findByRole("heading", { name: "Next · 2" });
  const link = screen
    .getAllByRole("link", { name: new RegExp(line) })
    .find((one) => one.closest("[data-row]") !== null) as HTMLElement;
  act(() => link.focus());
  return { link, repo };
}

/** Presses a key on an element, as a user's reaches the window. */
async function press(key: string, target: Element = document.body) {
  await act(async () => {
    fireEvent.keyDown(target, { key });
  });
}

/** Checks that the open add form is set to `section`. */
async function expectSection(section: string) {
  const form = within(await screen.findByRole("dialog", { name: "New priority" }));
  await form.findByRole("textbox", { name: "Priority" });
  expect(form.getByRole("radio", { checked: true, name: section })).toBeTruthy();
}

test("o opens the add form in the section of the selected line (US3 1)", async () => {
  const { link } = await onLine("Later line 1");

  await press("o", link);

  await expectSection("Later");
});

test("o on a line of Now opens the form in Now", async () => {
  const { link } = await onLine("Now line 1");

  await press("o", link);

  await expectSection("Now");
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

test("i turns the selected line into its editor, with the line's text, and Enter saves it (US3)", async () => {
  const { link, repo } = await onLine("Next line 2");

  await press("i", link);

  const field = await screen.findByRole("textbox", { name: "Edit Next line 2" });
  expect((field as HTMLInputElement).value).toBe("Next line 2");
  await type(field, "Next line two");
  await act(async () => {
    fireEvent.keyDown(field, { key: "Enter" });
  });
  await waitFor(() => expect(read(repo)).toContain("- Next line two\n"));
  expect(read(repo)).not.toContain("Next line 2");
  // In place: the page did not open the line's pane.
  expect(window.location.pathname).toMatch(/\/priorities$/);
});

test("Escape closes the editor and leaves the line as it was", async () => {
  const { link, repo } = await onLine("Next line 2");
  await press("i", link);
  const field = await screen.findByRole("textbox", { name: "Edit Next line 2" });

  await press("Escape", field);

  await waitFor(() =>
    expect(screen.queryByRole("textbox", { name: "Edit Next line 2" })).toBeNull(),
  );
  expect(read(repo)).toBe(PRIORITIES);
});

test("m opens the move menu of the selected line, the card menu's items (US3 3)", async () => {
  const { link } = await onLine("Next line 2");

  await press("m", link);

  expect(await screen.findByRole("menuitem", { name: "Move to Later" })).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "Move to Now" })).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "Move up" })).toBeTruthy();
});

test("o, i, and m do nothing with no line selected", async () => {
  await onLine("Next line 2");
  // The focus on the page: the selection is the open pane's, and none is open.
  act(() => (document.activeElement as HTMLElement | null)?.blur());

  await press("o");
  await press("i");
  await press("m");

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("textbox", { name: /^Edit / })).toBeNull();
  expect(screen.queryByRole("menuitem")).toBeNull();
});

test("none of them act in the add form's text field", async () => {
  const { link } = await onLine("Later line 1");
  await press("o", link);
  const field = await screen.findByRole("textbox", { name: "Priority" });

  await press("i", field);
  await press("m", field);
  await press("o", field);

  expect(screen.queryByRole("textbox", { name: /^Edit / })).toBeNull();
  expect(screen.queryByRole("menuitem")).toBeNull();
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
});

test("none of them act while a dialog is open", async () => {
  const { link } = await onLine("Next line 2");
  await press("a", link);
  await screen.findByRole("dialog", { name: "New priority" });

  await press("i", link);
  await press("m", link);

  expect(screen.queryByRole("textbox", { name: /^Edit / })).toBeNull();
  expect(screen.queryByRole("menuitem")).toBeNull();
});

test("the status line names a, o, i, and m on the page", async () => {
  await onLine("Next line 2");

  const line = await screen.findByRole("contentinfo", { name: "Status line" });

  for (const hint of ["a add", "o add beside", "i edit", "m move"]) {
    expect(line.textContent, hint).toContain(hint);
  }
});
