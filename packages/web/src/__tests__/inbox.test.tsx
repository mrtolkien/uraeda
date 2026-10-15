// US1, US3, and US5 3 of the inbox: a note added from the sidebar's ＋, the inbox page, and Home's
// Inbox group; and the sidebar's ＋ next to Priorities, which replaces the top bar's. Adding with
// Enter, and the form as a dialog or a sheet, are tested in the browser
// (__browser__/inbox.test.tsx).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { atRepo, atWidth, click, fixtureRepo, git, read, renderPage, type } from "./helpers.tsx";

const PATH = "specs/INBOX.md";

/** A toast's text, not its announcement to screen readers, which repeats it a moment later. */
function toast(text: string) {
  return screen.findByText(text, { ignore: "script, style, [aria-live]" });
}

/** The page's own content, without the navigation. */
async function main() {
  return within(await screen.findByRole("main"));
}

/** The row of the note holding a text. */
async function noteRow(text: RegExp) {
  await screen.findByText(text);
  return within(
    screen.getAllByRole("listitem").find((item) => within(item).queryByText(text) !== null)!,
  );
}

/** A copy of the fixture repository whose `INBOX.md` holds a text. */
function withInbox(text: string) {
  const repo = fixtureRepo();
  writeFileSync(join(repo, PATH), text);
  return repo;
}

/** Opens the add form from the sidebar's ＋ next to Inbox. */
async function openForm() {
  await click(await screen.findByRole("button", { name: "Add a note to the inbox" }));
  const form = within(await screen.findByRole("dialog", { name: "Add a note" }));
  // Drawn once it read the inbox.
  await form.findByPlaceholderText("What did you notice?");
  return form;
}

/** Picks a category in the form's Category menu. */
async function pick(form: ReturnType<typeof within>, category: string) {
  await click(form.getByRole("combobox", { name: "Category" }));
  await click(await screen.findByRole("option", { name: category }));
}

/** Types a note in the add form, picks its category when given, and presses Add. */
async function addNote(text: string, category?: string) {
  const form = await openForm();
  await type(form.getByPlaceholderText("What did you notice?"), text);
  if (category) {
    await pick(form, category);
  }
  await click(form.getByRole("button", { name: "Add" }));
  return form;
}

/** US1 1 */
test("a note added in a category ends it, with a toast, and shows under it", async () => {
  const { repo } = await renderPage("/inbox");

  await addNote("The plan's task list scrolls under the top bar", "UI");

  expect(await toast("Added to the inbox, not committed")).toBeTruthy();
  expect(read(repo, PATH)).toContain(
    "- Text input feels laggy on the sessions page\n- The plan's task list scrolls under the top bar\n\n## CLI\n",
  );
  expect(git(repo, "status", "--porcelain")).toContain("INBOX.md");
  const ui = within(screen.getByRole("list", { name: "UI" }));
  expect(await ui.findByText("The plan's task list scrolls under the top bar")).toBeTruthy();
});

/** US1 2 */
test("a note with no category goes before the first category", async () => {
  const { repo } = await renderPage("/inbox");

  await addNote("Sessions need a model selector");

  expect(await toast("Added to the inbox, not committed")).toBeTruthy();
  expect(read(repo, PATH)).toContain(
    "- We need a home icon\n- Sessions need a model selector\n\n## UI\n",
  );
  const none = within(screen.getByRole("list", { name: "No category" }));
  expect(await none.findByText("Sessions need a model selector")).toBeTruthy();
});

/** US1 3 */
test("New category… adds its heading at the end of the file, with the note", async () => {
  const { repo } = await renderPage("/inbox");
  const form = await openForm();
  await type(form.getByPlaceholderText("What did you notice?"), "Folding is slow");

  await pick(form, "New category…");
  await type(form.getByRole("textbox", { name: "Category name" }), "Editor");
  await click(form.getByRole("button", { name: "Add" }));

  await toast("Added to the inbox, not committed");
  expect(read(repo, PATH)).toMatch(
    /- Make sure agents are resumable\n\n## Editor\n\n- Folding is slow\n$/,
  );
  const editor = within(await screen.findByRole("list", { name: "Editor" }));
  expect(editor.getByText("Folding is slow")).toBeTruthy();
});

/** US1 7 */
test("Undo removes the note it added, and the file is as before", async () => {
  const { repo } = await renderPage("/");
  const before = read(repo, PATH);
  await addNote("Icons are too small", "CLI");
  await toast("Added to the inbox, not committed");
  expect(read(repo, PATH)).not.toBe(before);

  await click(screen.getByRole("button", { name: "Undo" }));

  await waitFor(() => expect(read(repo, PATH)).toBe(before));
});

/** US1 4 */
test("a note added from a feature's page is marked with its slug", async () => {
  const { repo } = await renderPage("/f/2026-10-12-cli-tuis");

  await addNote("The x is not centered");

  await toast("Added to the inbox, not committed");
  expect(read(repo, PATH)).toContain("- We need a home icon\n- [cli-tuis] The x is not centered\n");
});

/** Edge case: blank text. */
test("Add is disabled while the note is blank", async () => {
  await renderPage("/inbox");
  const form = await openForm();
  const add = () => form.getByRole("button", { name: "Add" });

  expect(add()).toHaveProperty("disabled", true);
  await type(form.getByPlaceholderText("What did you notice?"), "   ");
  expect(add()).toHaveProperty("disabled", true);
  await type(form.getByPlaceholderText("What did you notice?"), "A note");
  expect(add()).toHaveProperty("disabled", false);
});

/** The UI behaviour decision: closed with Close, the form keeps its text; Cancel asks first. */
test("the form keeps its text when closed, and Cancel asks first", async () => {
  await renderPage("/inbox");
  let form = await openForm();
  await type(form.getByPlaceholderText("What did you notice?"), "A half-typed note");

  await click(form.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add a note" })).toBeNull());
  form = await openForm();
  expect(form.getByPlaceholderText("What did you notice?")).toHaveProperty(
    "value",
    "A half-typed note",
  );

  await click(form.getByRole("button", { name: "Cancel" }));
  const confirm = await screen.findByRole("dialog", { name: "Discard your changes?" });
  await click(within(confirm).getByRole("button", { name: "Discard" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add a note" })).toBeNull());
});

/** US3 1, 2, 3: Home's Inbox group, and its plural. */
test("Home shows how many notes wait, and opens the inbox", async () => {
  await renderPage("/");
  const page = await main();

  const row = await page.findByRole("link", { name: /10 notes to organize/ });
  expect(page.getByRole("heading", { name: "Inbox" })).toBeTruthy();
  await click(row);

  expect(window.location.pathname).toBe(atRepo("/inbox"));
});

test("Home says 1 note to organize for one note (US3 2)", async () => {
  await renderPage("/", withInbox("# Inbox\n\n## UI\n\n- One thing\n"));

  expect(await (await main()).findByRole("link", { name: /1 note to organize/ })).toBeTruthy();
});

test("Home shows no Inbox group without notes (US3 3)", async () => {
  await renderPage("/", withInbox("# Inbox\n\n## UI\n"));
  const page = await main();

  await page.findByRole("link", { name: "All priorities" });
  expect(page.queryByRole("heading", { name: "Inbox" })).toBeNull();
  expect(page.queryByText(/to organize/)).toBeNull();
});

/** The inbox page: its count, its categories in file order with "No category" first. */
test("the inbox page lists the notes by category, in file order", async () => {
  await renderPage("/inbox");
  const page = await main();

  expect(await page.findByRole("heading", { level: 1, name: "Inbox" })).toBeTruthy();
  expect(page.getByText("10 notes")).toBeTruthy();
  expect(page.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
    "No category",
    "UI",
    "CLI",
  ]);
  expect(
    within(page.getByRole("list", { name: "CLI" })).getByText("Make sure agents are resumable"),
  ).toBeTruthy();
});

/** US5 3 */
test("an agent's note shows its marks as tags", async () => {
  await renderPage("/inbox");

  const note = await noteRow(/Opening a session with 2,000 messages takes 4 s/);
  expect(note.getByText("agent")).toBeTruthy();
  expect(note.getByText("session-view")).toBeTruthy();
  const marked = await noteRow(/is not centered in the circle/);
  expect(marked.getByText("run-ui")).toBeTruthy();
  expect(marked.queryByText("agent")).toBeNull();
});

/** Edge cases: an empty category is hidden; the empty inbox says how to fill it. */
test("an empty category is hidden, and the empty inbox says so", async () => {
  const repo = withInbox("# Inbox\n\n## UI\n\n## CLI\n\n- One thing\n");
  await renderPage("/inbox", repo);
  const page = await main();
  await page.findByText("One thing");
  expect(page.queryByRole("heading", { name: "UI" })).toBeNull();
  expect(page.getByText("1 note")).toBeTruthy();

  writeFileSync(join(repo, PATH), "# Inbox\n");
  await renderPage("/inbox", repo, { reload: true });
  expect(
    await screen.findByText("The inbox is empty. Notes you add with ＋ next to Inbox land here."),
  ).toBeTruthy();
});

/** The spec's sidebar: ＋ next to Priorities opens the priorities' own form. */
test("the sidebar's ＋ next to Priorities opens the priorities form", async () => {
  const { repo } = await renderPage("/inbox");

  await click(await screen.findByRole("button", { name: "Add to the priorities" }));
  const form = within(await screen.findByRole("dialog", { name: "New priority" }));
  await type(await form.findByLabelText("Priority"), "An idea");
  await act(async () => {
    fireEvent.click(form.getByRole("button", { name: "Add" }));
  });

  expect(await toast("Added to Next, not committed")).toBeTruthy();
  expect(read(repo)).toContain("- [Git listener process](drafts/git-listener.md)\n- An idea\n");
});

/** The spec's sidebar: the top bar's ＋ is gone from Home and the priorities page. */
test.each(["/", "/priorities"])("every ＋ outside %s's page is the sidebar's", async (path) => {
  await renderPage(path);
  await screen.findByRole("button", { name: "Add a note to the inbox" });
  // The page's own Add rows, like the priorities' "＋ Add to Later", are in its main region.
  const page = await screen.findByRole("main");

  const plus = screen
    .getAllByRole("button")
    .filter((button) => button.textContent?.includes("＋") && !page.contains(button))
    .map((button) => button.getAttribute("aria-label"));
  expect(plus).toEqual(["Add to the priorities", "Add a note to the inbox"]);
});

test.each(["/", "/priorities"])("no ＋ in the phone's top bar of %s", async (path) => {
  atWidth(402);
  await renderPage(path);
  const bar = await screen.findByRole("banner");
  await screen.findByRole("button", { name: "Open navigation" });

  expect(
    within(bar)
      .queryAllByRole("button")
      .filter((button) => button.textContent?.includes("＋")),
  ).toEqual([]);
});

/** Edge case and error handling: an add over a change made elsewhere is refused, text kept. */
test("an add over a change made elsewhere is refused, and the note's text is kept", async () => {
  const { repo } = await renderPage("/inbox");
  const form = await openForm();
  writeFileSync(join(repo, PATH), read(repo, PATH).replace("We need a home icon", "A home icon"));

  await type(form.getByPlaceholderText("What did you notice?"), "Icons are too small");
  await click(form.getByRole("button", { name: "Add" }));

  expect(
    await form.findByText("INBOX.md changed on disk. Your change was not applied."),
  ).toBeTruthy();
  expect(form.getByPlaceholderText("What did you notice?")).toHaveProperty(
    "value",
    "Icons are too small",
  );
  expect(read(repo, PATH)).not.toContain("Icons are too small");
});

/** The UI behaviour decision: unsaved text, the new category's name too, comes back after a reload. */
test("the note and a new category's name are restored after a reload, with a notice", async () => {
  const { repo } = await renderPage("/inbox");
  let form = await openForm();
  await type(form.getByPlaceholderText("What did you notice?"), "Folding is slow");
  await pick(form, "New category…");
  await type(form.getByRole("textbox", { name: "Category name" }), "Editor");
  await click(form.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add a note" })).toBeNull());

  forgetUnsaved();
  await renderPage("/inbox", repo, { reload: true });
  form = await openForm();

  expect(form.getByPlaceholderText("What did you notice?")).toHaveProperty(
    "value",
    "Folding is slow",
  );
  expect(form.getByRole("textbox", { name: "Category name" })).toHaveProperty("value", "Editor");
  expect(form.getByText(/^Unsaved text restored from \d\d:\d\d\.$/)).toBeTruthy();
});

/** A new category's name typed alone: Cancel asks first, as for the note's text. */
test("Cancel asks first when only a new category's name was typed", async () => {
  await renderPage("/inbox");
  const form = await openForm();
  await pick(form, "New category…");
  await type(form.getByRole("textbox", { name: "Category name" }), "Editor");

  await click(form.getByRole("button", { name: "Cancel" }));

  expect(await screen.findByRole("dialog", { name: "Discard your changes?" })).toBeTruthy();
});

test("a blank new category's name keeps Add disabled", async () => {
  await renderPage("/inbox");
  const form = await openForm();
  await type(form.getByPlaceholderText("What did you notice?"), "Folding is slow");
  await pick(form, "New category…");
  const add = () => form.getByRole("button", { name: "Add" });

  expect(add()).toHaveProperty("disabled", true);
  await type(form.getByRole("textbox", { name: "Category name" }), "  ");
  expect(add()).toHaveProperty("disabled", true);
  await type(form.getByRole("textbox", { name: "Category name" }), "Editor");
  expect(add()).toHaveProperty("disabled", false);
});

/** US1 4, for a bug: its folder is in `specs/bugs/`, its pages at `/f/<folder>` too. */
test("a note added from a bug's page is marked with its slug", async () => {
  const { repo } = await renderPage("/f/2026-10-14-login-crash");

  await addNote("The banner hides the button");

  await toast("Added to the inbox, not committed");
  expect(read(repo, PATH)).toContain(
    "- We need a home icon\n- [login-crash] The banner hides the button\n",
  );
});

test("a note added from a page whose folder is not dated has no mark", async () => {
  const { repo } = await renderPage("/f/notes");

  await addNote("Plain note");

  await toast("Added to the inbox, not committed");
  expect(read(repo, PATH)).toContain("- We need a home icon\n- Plain note\n");
});
