// US1, US3, and US5 3 of the inbox: a note added from the sidebar's ＋, the inbox page, and Home's
// Inbox group; and the sidebar's ＋ next to Priorities, which replaces the top bar's. Adding with
// Enter, and the form as a dialog or a sheet, are tested in the browser
// (__browser__/inbox.test.tsx).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { addChange } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import {
  atRepo,
  atWidth,
  click,
  fixture,
  fixtureRepo,
  git,
  quiet,
  read,
  refreshUntil,
  renderPage,
  serverFetch,
  type,
} from "./helpers.tsx";

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

/** Picks an image with "Attach an image", as the system's picker gives it. */
async function attachImage(form: ReturnType<typeof within>, name = "spec-headings.png") {
  const bytes = readFileSync(fixture("images/phone.png"));
  const input = form.getByLabelText("Attach an image", { selector: "input" });
  await act(async () => {
    fireEvent.change(input, {
      target: { files: [new File([bytes], name, { type: "image/png" })] },
    });
  });
}

/**
 * Ruling R21: the image waits for Add as the text does, kept as the form closes and opens again;
 * Remove drops it, and Cancel asks first, then drops it.
 */
test("the form keeps its image when closed, Remove drops it, and Cancel asks first", async () => {
  await renderPage("/inbox");
  let form = await openForm();
  await attachImage(form);
  expect(form.getByRole("button", { name: "Add as a draft" })).toBeTruthy();

  await click(form.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add a note" })).toBeNull());
  form = await openForm();
  expect(form.getByText("spec-headings.png")).toBeTruthy();
  await click(form.getByRole("button", { name: "Remove spec-headings.png" }));
  expect(form.queryByText("spec-headings.png")).toBeNull();
  expect(form.getByRole("button", { name: "Add" })).toBeTruthy();

  await attachImage(form);
  await click(form.getByRole("button", { name: "Cancel" }));
  const confirm = await screen.findByRole("dialog", { name: "Discard your changes?" });
  await click(within(confirm).getByRole("button", { name: "Discard" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add a note" })).toBeNull());
  form = await openForm();
  expect(form.queryByText("spec-headings.png")).toBeNull();
});

/** US6, and the UI behaviour decision's Undo: it takes the note back out, with its draft. */
test("Undo of a note added with an image takes it back out, with its draft", async () => {
  const { repo } = await renderPage("/inbox");
  const before = read(repo, PATH);
  const form = await openForm();
  await type(form.getByPlaceholderText("What did you notice?"), "Headings are flat");
  await attachImage(form);
  await click(form.getByRole("button", { name: "Add as a draft" }));
  await toast("Added to the inbox as a draft, not committed");
  expect(read(repo, "specs/drafts/headings-are-flat/proposal.md")).toContain(
    "Headings are flat\n\n![spec-headings](images/spec-headings.webp)\n",
  );

  await click(screen.getByRole("button", { name: "Undo" }));

  await waitFor(() => expect(read(repo, PATH)).toBe(before));
  await waitFor(() => expect(existsSync(join(repo, "specs/drafts/headings-are-flat"))).toBe(false));
});

/** Undo of a draft note is refused once the note changed, and the draft stays. */
test("Undo of a note added with an image is refused once the note changed", async () => {
  const { repo } = await renderPage("/inbox");
  const form = await openForm();
  await type(form.getByPlaceholderText("What did you notice?"), "Headings are flat");
  await attachImage(form);
  await click(form.getByRole("button", { name: "Add as a draft" }));
  await toast("Added to the inbox as a draft, not committed");
  writeFileSync(
    join(repo, PATH),
    read(repo, PATH).replace("[Headings are flat]", "[Headings are flat, and dull]"),
  );

  await click(screen.getByRole("button", { name: "Undo" }));

  expect(
    await screen.findByText('Could not undo: "Headings are flat" is no longer in INBOX.md.', {
      ignore: "script, style, [aria-live]",
    }),
  ).toBeTruthy();
  expect(existsSync(join(repo, "specs/drafts/headings-are-flat/proposal.md"))).toBe(true);
});

/** The address of a request, whatever form it takes. */
const urlOf = (input: RequestInfo | URL) =>
  typeof input === "object" && "url" in input ? input.url : input.toString();

/**
 * A note with an image whose answer is lost, though the server added it: the note is added, once,
 * as the inbox now shows, so pressing Add again cannot add it twice.
 */
test("an add with an image whose answer is lost is found in the inbox, once", async () => {
  const repo = fixtureRepo();
  const server = serverFetch(repo);
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const response = await server(input, init);
    if (urlOf(input).includes("/inbox/note-image")) {
      throw new DOMException("The operation timed out.", "TimeoutError");
    }
    return response;
  };
  await renderPage("/inbox", repo, { fetch });
  const form = await openForm();
  await type(form.getByPlaceholderText("What did you notice?"), "Headings are flat");
  await attachImage(form);

  await click(form.getByRole("button", { name: "Add as a draft" }));

  await toast("Added to the inbox as a draft, not committed");
  expect(read(repo, PATH).match(/\[Headings are flat\]/g)).toHaveLength(1);
  expect(existsSync(join(repo, "specs/drafts/headings-are-flat-2"))).toBe(false);
});

/** A lost answer's note is found by its markdown as typed: inline code and brackets included. */
test("an add with an image whose answer is lost is found with its inline code", async () => {
  const repo = fixtureRepo();
  const server = serverFetch(repo);
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const response = await server(input, init);
    if (urlOf(input).includes("/inbox/note-image")) {
      throw new DOMException("The operation timed out.", "TimeoutError");
    }
    return response;
  };
  await renderPage("/inbox", repo, { fetch });
  const form = await openForm();
  await type(form.getByPlaceholderText("What did you notice?"), "The `[x]`  heading is flat");
  await attachImage(form);

  await click(form.getByRole("button", { name: "Add as a draft" }));

  await toast("Added to the inbox as a draft, not committed");
  expect(read(repo, PATH).match(/heading is flat/g)).toHaveLength(1);
});

/** An add with an image that never reached the server says so under the image, and keeps all. */
test("an add with an image that gets no answer says so, and keeps the note", async () => {
  const repo = fixtureRepo();
  const server = serverFetch(repo);
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (urlOf(input).includes("/inbox/note-image")) {
      throw new TypeError("Failed to fetch");
    }
    return server(input, init);
  };
  await renderPage("/inbox", repo, { fetch });
  const before = read(repo, PATH);
  const form = await openForm();
  await type(form.getByPlaceholderText("What did you notice?"), "Headings are flat");
  await attachImage(form);

  await click(form.getByRole("button", { name: "Add as a draft" }));

  expect((await form.findAllByText("Could not reach the Uraeda server.")).length).toBeGreaterThan(
    0,
  );
  expect(form.getByPlaceholderText("What did you notice?")).toHaveProperty(
    "value",
    "Headings are flat",
  );
  expect(form.getByText("spec-headings.png")).toBeTruthy();
  expect(read(repo, PATH)).toBe(before);
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

/** US1 4, for a change: its folder is in `specs/changes/`, its pages at `/f/<folder>` too. */
test("a note added from a change's page is marked with its slug", async () => {
  const changed = fixtureRepo();
  addChange(changed, "2026-10-14-login-crash", { "proposal.md": "# Login crash\n" });
  const { repo } = await renderPage("/f/2026-10-14-login-crash", changed);

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

// US2: organizing a note by hand, in its view, and the one commit bar.

const LOOK = "specs/drafts/look-and-feel.md";
const LOOK_TEXT =
  "# Look and feel pass\n\n## What\n\nA pass over the app's spacing and icons.\n\n## Why\n\nIt looks unfinished.\n";

/** A copy of the fixture repository with the draft "Look and feel pass", committed. */
function withLookDraft() {
  const repo = fixtureRepo();
  writeFileSync(join(repo, LOOK), LOOK_TEXT);
  git(repo, "add", LOOK);
  git(repo, "commit", "--quiet", "--no-verify", "--message", "docs: look and feel");
  return repo;
}

/** The note's view, in the pane beside the inbox, as it is drawn now. */
function detail() {
  return within(screen.getByRole("region", { name: "Detail" }));
}

/** Opens a menu of the note's view, by its button, and picks one of its items. */
async function choose(menu: string, item: string) {
  await click(await screen.findByRole("button", { name: menu }));
  await click(await screen.findByRole("menuitem", { name: item }));
}

/** Picks the category a note moves to, in its view's Category menu. */
async function moveTo(category: string) {
  await click(await screen.findByRole("combobox", { name: "Category" }));
  await click(await screen.findByRole("option", { name: category }));
}

/** Picks a draft in the note's "Add to a draft" list, after filtering it with a text. */
async function addToDraft(filter: string, title: string) {
  await click(await screen.findByRole("button", { name: "Add to a draft" }));
  await type(await screen.findByPlaceholderText("Find a draft"), filter);
  await click(await screen.findByRole("option", { name: title }));
}

/** The text of the section `## <name>` of a file, up to the next `##` heading. */
function section(text: string, name: string) {
  return text.split(`## ${name}\n`)[1]?.split("\n## ")[0] ?? "";
}

/** The inbox's rows link to their note's view, which opens at `/inbox/<key>`. */
test("a note's row opens its view", async () => {
  await renderPage("/inbox");
  const page = await main();

  await click(await page.findByRole("link", { name: /Draft to proposal on mobile went 404/ }));

  expect(window.location.pathname).toBe(atRepo("/inbox/draft-to-proposal-on-mobile-went-404"));
  expect(await screen.findByText("Note, in UI")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Move to priorities" })).toBeTruthy();
});

/** US2 1 */
test("Move to priorities, then Next, ends Next with the note", async () => {
  const { repo } = await renderPage("/inbox/draft-to-proposal-on-mobile-went-404");

  await choose("Move to priorities", "Next");

  expect(await toast("Moved to Next, not committed")).toBeTruthy();
  expect(read(repo)).toContain(
    "- [Git listener process](drafts/git-listener.md)\n- Draft to proposal on mobile went 404\n\n## Later",
  );
  expect(read(repo, PATH)).not.toContain("Draft to proposal on mobile went 404");
  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/inbox")));
});

/** US2 1, Undo: the note goes back to its place, and the line leaves Next. */
test("Undo of a move to the priorities puts both files back", async () => {
  const { repo } = await renderPage("/inbox/draft-to-proposal-on-mobile-went-404");
  const inbox = read(repo, PATH);
  const priorities = read(repo);
  await choose("Move to priorities", "Next");
  await toast("Moved to Next, not committed");

  await click(screen.getByRole("button", { name: "Undo" }));

  await waitFor(() => expect([read(repo, PATH), read(repo)]).toEqual([inbox, priorities]));
});

/** US2 2 */
test("Make a draft, then Later, writes the draft and opens it in the editor", async () => {
  const { repo } = await renderPage("/inbox/we-need-a-home-icon");

  await choose("Make a draft", "Later");

  await waitFor(() =>
    expect(window.location.pathname).toBe(atRepo("/edit/specs/drafts/we-need-a-home-icon.md")),
  );
  expect(read(repo, "specs/drafts/we-need-a-home-icon.md")).toContain("# We need a home icon\n");
  expect(section(read(repo), "Later")).toContain(
    "- [We need a home icon](drafts/we-need-a-home-icon.md)\n",
  );
  expect(read(repo, PATH)).not.toContain("We need a home icon");
});

/** US2 3, with the "Find a draft" filter. */
test("Add to a draft appends the note to the draft's What", async () => {
  const { repo } = await renderPage("/inbox/icons-are-blurry-on-retina-screens", withLookDraft());

  await addToDraft("Look", "Look and feel pass");

  expect(await toast("Added to Look and feel pass, not committed")).toBeTruthy();
  expect(read(repo, LOOK)).toBe(
    "# Look and feel pass\n\n## What\n\nA pass over the app's spacing and icons.\n\n- Icons are blurry on retina screens\n\n## Why\n\nIt looks unfinished.\n",
  );
  expect(read(repo, PATH)).not.toContain("Icons are blurry on retina screens");
});

test("Undo of an add to a draft puts the note and the draft back", async () => {
  const { repo } = await renderPage("/inbox/icons-are-blurry-on-retina-screens", withLookDraft());
  const inbox = read(repo, PATH);
  await addToDraft("Look", "Look and feel pass");
  await toast("Added to Look and feel pass, not committed");

  await click(screen.getByRole("button", { name: "Undo" }));

  await waitFor(() => expect([read(repo, PATH), read(repo, LOOK)]).toEqual([inbox, LOOK_TEXT]));
});

/** US2 4 */
test("Delete asks nothing, and Undo puts the note back at its place", async () => {
  const { repo } = await renderPage("/inbox/draft-to-proposal-on-mobile-went-404");
  const before = read(repo, PATH);

  await click(await screen.findByRole("button", { name: "Delete" }));

  expect(await toast("Deleted, not committed")).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(read(repo, PATH)).not.toContain("Draft to proposal on mobile went 404");
  await click(screen.getByRole("button", { name: "Undo" }));
  await waitFor(() => expect(read(repo, PATH)).toBe(before));
});

/** US2 5 */
test("Category, then UI, makes the note the last of UI", async () => {
  const { repo } = await renderPage("/inbox/we-need-a-home-icon");

  await moveTo("UI");

  expect(await toast("Moved to UI, not committed")).toBeTruthy();
  expect(read(repo, PATH)).toContain(
    "- Text input feels laggy on the sessions page\n- We need a home icon\n\n## CLI\n",
  );
  expect(await screen.findByText("Note, in UI")).toBeTruthy();
});

/** A move can change the keys of notes of the same text: the view follows its note to its new key. */
test("a note moved before another of the same text keeps its view, and Delete takes it", async () => {
  const { repo } = await renderPage(
    "/inbox/dark-mode",
    withInbox("# Inbox\n\n## UI\n\n- Dark mode\n  - for the editor\n\n## CLI\n\n- Dark mode\n"),
  );
  expect(await screen.findByText("Note, in UI")).toBeTruthy();

  await moveTo("CLI");

  await toast("Moved to CLI, not committed");
  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/inbox/dark-mode-2")));
  expect(await screen.findByText("Note, in CLI")).toBeTruthy();
  await click(screen.getByRole("button", { name: "Delete" }));
  await toast("Deleted, not committed");
  await waitFor(() => expect(read(repo, PATH)).not.toContain("for the editor"));
  expect(read(repo, PATH)).toContain("## CLI\n\n- Dark mode\n");
});

/** Edge case: Undo after the note changed elsewhere is refused. */
test("Undo of a moved note that changed since is refused", async () => {
  const { repo } = await renderPage("/inbox/we-need-a-home-icon");
  await moveTo("UI");
  await toast("Moved to UI, not committed");
  writeFileSync(join(repo, PATH), read(repo, PATH).replace("We need a home icon", "A home icon"));

  await click(screen.getByRole("button", { name: "Undo" }));

  expect(
    await screen.findByText('Could not undo: "We need a home icon" is no longer in INBOX.md.'),
  ).toBeTruthy();
  expect(read(repo, PATH)).toContain("- A home icon\n\n## CLI\n");
});

/** US2 6 */
test("Edit replaces the note's text, and keeps its marks", async () => {
  const { repo } = await renderPage("/inbox/in-failures-the-x-is-not-centered-in-the-circle");
  await click(await screen.findByRole("button", { name: "Edit" }));
  const field = screen.getByRole("textbox", { name: "Note" });

  await type(field, "Specs are too long");
  await act(async () => {
    fireEvent.keyDown(field, { key: "Enter" });
  });

  await waitFor(() => expect(read(repo, PATH)).toContain("- [run-ui] Specs are too long\n"));
  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/inbox/specs-are-too-long")));
  // The note's view, drawn again at its new address.
  await waitFor(() => expect(detail().getByText("Specs are too long")).toBeTruthy());
  expect(detail().getByText("run-ui")).toBeTruthy();
});

/** Edge case: a note that links a draft is one already. */
test("a note that links a draft offers no Make a draft", async () => {
  const repo = withLookDraft();
  writeFileSync(
    join(repo, PATH),
    "# Inbox\n\n## UI\n\n- [Look and feel pass](drafts/look-and-feel.md)\n",
  );
  await renderPage("/inbox/look-and-feel-pass", repo);

  expect(await screen.findByRole("button", { name: "Move to priorities" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Make a draft" })).toBeNull();
});

/** Shows a path of the repository the page is on, as a link followed in the app would. */
async function open(repo: string, path: string) {
  window.history.replaceState(null, "", atRepo(path));
  await renderPage(path, repo, { reload: true });
}

/** Moves the note of a key to Next from its view, and waits for its toast. */
async function moveToNext(repo: string, key: string) {
  await open(repo, `/inbox/${key}`);
  await choose("Move to priorities", "Next");
  await toast("Moved to Next, not committed");
}

/** US2 7 and 8 */
test("one bar on both pages counts and commits the moves, and the draft", async () => {
  const repo = withLookDraft();
  await renderPage("/inbox", repo);
  await moveToNext(repo, "draft-to-proposal-on-mobile-went-404");
  await moveToNext(repo, "text-input-feels-laggy-on-the-sessions-page");
  await open(repo, "/inbox/make-sure-agents-are-resumable");
  await click(await screen.findByRole("button", { name: "Delete" }));
  await toast("Deleted, not committed");

  expect(await screen.findByText("3 changes to commit")).toBeTruthy();
  await open(repo, "/priorities");
  expect(await screen.findByText("3 changes to commit")).toBeTruthy();
  await click(screen.getByRole("button", { name: "Commit" }));

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s").trim()).toBe(
      'chore: move "Draft to proposal on mobile went 404" from the inbox to Next, and 2 more',
    ),
  );
  expect(git(repo, "show", "--name-only", "--format=", "HEAD").trim().split("\n").sort()).toEqual([
    PATH,
    "specs/PRIORITIES.md",
  ]);
  await waitFor(() => expect(screen.queryByText("3 changes to commit")).toBeNull());
});

/** US2 8 */
test("a note added to a draft is committed with the draft", async () => {
  const repo = withLookDraft();
  await renderPage("/inbox/icons-are-blurry-on-retina-screens", repo);
  await addToDraft("Look", "Look and feel pass");
  await toast("Added to Look and feel pass, not committed");
  await open(repo, "/inbox");

  await click(await screen.findByRole("button", { name: "Commit" }));

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s").trim()).toBe(
      'chore: move "Icons are blurry on retina screens" from the inbox to the draft Look and feel pass',
    ),
  );
  expect(git(repo, "show", "--name-only", "--format=", "HEAD").trim().split("\n").sort()).toEqual([
    PATH,
    LOOK,
  ]);
});

/** Edge case: Discard restores the inbox, the priorities, and the draft. */
test("Discard them restores every file", async () => {
  const repo = withLookDraft();
  const before = [read(repo, PATH), read(repo), read(repo, LOOK)];
  await renderPage("/inbox", repo);
  await moveToNext(repo, "draft-to-proposal-on-mobile-went-404");
  await open(repo, "/inbox/icons-are-blurry-on-retina-screens");
  await addToDraft("Look", "Look and feel pass");
  await toast("Added to Look and feel pass, not committed");
  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/inbox")));
  await quiet();

  await click(await screen.findByRole("button", { name: "Discard" }));
  await click(screen.getByRole("button", { name: "Discard them" }));

  await waitFor(() => expect([read(repo, PATH), read(repo), read(repo, LOOK)]).toEqual(before));
  expect(await (await main()).findByText("Draft to proposal on mobile went 404")).toBeTruthy();
});

/** Edge case: a move from a stale page is refused, and the page reads the inbox again. */
test("a move over a change made elsewhere is refused, and the inbox reads again", async () => {
  const { repo } = await renderPage("/inbox/draft-to-proposal-on-mobile-went-404");
  await screen.findByRole("button", { name: "Move to priorities" });
  writeFileSync(join(repo, PATH), read(repo, PATH).replace("We need a home icon", "A home icon"));

  await choose("Move to priorities", "Next");

  expect(
    await screen.findByText("INBOX.md changed on disk. Your change was not applied."),
  ).toBeTruthy();
  expect(read(repo)).not.toContain("Draft to proposal on mobile went 404");
  expect(await (await main()).findByText("A home icon")).toBeTruthy();
});

/** Review: an Undo writes over the inbox as it is now, so a change made meanwhile stays. */
test("Undo of a move to the priorities keeps a change made meanwhile", async () => {
  const { repo } = await renderPage("/inbox/draft-to-proposal-on-mobile-went-404");
  const inbox = read(repo, PATH);
  const priorities = read(repo);
  await choose("Move to priorities", "Next");
  await toast("Moved to Next, not committed");
  writeFileSync(join(repo, PATH), read(repo, PATH).replace("We need a home icon", "A home icon"));

  await click(screen.getByRole("button", { name: "Undo" }));

  await waitFor(() =>
    expect([read(repo, PATH), read(repo)]).toEqual([
      inbox.replace("We need a home icon", "A home icon"),
      priorities,
    ]),
  );
});

/** Review: a line of the same text the human wrote in the section after the move is theirs. */
test("Undo of a move to the priorities leaves the human's line of the same text", async () => {
  const { repo } = await renderPage("/inbox/draft-to-proposal-on-mobile-went-404");
  const inbox = read(repo, PATH);
  await choose("Move to priorities", "Next");
  await toast("Moved to Next, not committed");
  const line = "- Draft to proposal on mobile went 404\n";
  writeFileSync(join(repo, "specs/PRIORITIES.md"), read(repo).replace(line, `${line}${line}`));

  await click(screen.getByRole("button", { name: "Undo" }));

  await waitFor(() => expect(read(repo, PATH)).toBe(inbox));
  expect(section(read(repo), "Next").split(line).length - 1).toBe(1);
});

/** Review: an Undo takes the note's lines back out of the draft, and keeps the human's typing. */
test("Undo of an add to a draft keeps what the human typed in it since", async () => {
  const { repo } = await renderPage("/inbox/icons-are-blurry-on-retina-screens", withLookDraft());
  const inbox = read(repo, PATH);
  await addToDraft("Look", "Look and feel pass");
  await toast("Added to Look and feel pass, not committed");
  writeFileSync(
    join(repo, LOOK),
    read(repo, LOOK).replace("unfinished.", "unfinished, and dated."),
  );

  await click(screen.getByRole("button", { name: "Undo" }));

  await waitFor(() =>
    expect([read(repo, PATH), read(repo, LOOK)]).toEqual([
      inbox,
      LOOK_TEXT.replace("unfinished.", "unfinished, and dated."),
    ]),
  );
});

/** Review: an id is a place: once the note is gone, the view never shows the note now there. */
test("a note edited, then removed elsewhere, is not taken for the note at its place", async () => {
  const { repo } = await renderPage("/inbox/we-need-a-home-icon");
  await click(await screen.findByRole("button", { name: "Edit" }));
  const field = screen.getByRole("textbox", { name: "Note" });
  await type(field, "We need a home icon!");
  await act(async () => {
    fireEvent.keyDown(field, { key: "Enter" });
  });
  await waitFor(() => expect(read(repo, PATH)).toContain("- We need a home icon!\n"));
  await waitFor(() => expect(screen.queryByRole("textbox", { name: "Note" })).toBeNull());
  writeFileSync(join(repo, PATH), read(repo, PATH).replace("- We need a home icon!\n", ""));

  await refreshUntil(() =>
    expect(detail().getByText("This note is no longer in INBOX.md.")).toBeTruthy(),
  );
  expect(detail().queryByRole("button", { name: "Delete" })).toBeNull();
});

/** Review: a note opened from the inbox returns to it once moved, so Back leaves the inbox. */
test("a note deleted from the inbox's pane goes back to the inbox's own entry", async () => {
  await renderPage("/inbox");
  const list = window.history.state?.id;
  await click(await (await main()).findByRole("link", { name: /Draft to proposal/ }));
  await click(await screen.findByRole("button", { name: "Delete" }));

  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/inbox")));
  expect(window.history.state?.id).toBe(list);
});

/** Edge case: an edit from a stale page is refused, and the page reads the inbox again. */
test("an edit over a change made elsewhere is refused, and the inbox reads again", async () => {
  const { repo } = await renderPage("/inbox/draft-to-proposal-on-mobile-went-404");
  await click(await screen.findByRole("button", { name: "Edit" }));
  writeFileSync(join(repo, PATH), read(repo, PATH).replace("We need a home icon", "A home icon"));
  const field = screen.getByRole("textbox", { name: "Note" });
  await type(field, "Draft to proposal 404s on mobile");
  await act(async () => {
    fireEvent.keyDown(field, { key: "Enter" });
  });

  expect(
    (await screen.findAllByText("INBOX.md changed on disk. Your change was not applied.")).length,
  ).toBeGreaterThan(0);
  expect(await (await main()).findByText("A home icon")).toBeTruthy();
});
