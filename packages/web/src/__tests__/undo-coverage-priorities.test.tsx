// SC-002 for the priorities and the proposals: every kind of write the page makes has an undo and
// a redo. Each row does the write through the page, then `u` puts the files back as they were, and
// `U` writes them again as the write left them. The inbox's rows and the reviews' are in files of
// their own.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { isLayerOpen } from "../keys/layers.ts";
import { navigate } from "../routes.tsx";
import { undoStack } from "../undo/stack.ts";
import {
  atRepo,
  atWidth,
  click,
  fixture,
  fixtureRepo,
  read,
  renderPage,
  type,
} from "./helpers.tsx";

const PRIORITIES = `# Priorities

## Now

- Now line

## Next

- First
  - First's child
- Second
- Third

## Later

- Later line
`;

const INBOX = "specs/INBOX.md";
const PROPOSAL = "specs/proposals/git-listener.md";

beforeEach(() => {
  atWidth(1440);
  forgetUnsaved();
});

/** The control of a row's text, not the buttons of the row's bar under it. */
function controlOf(text: string) {
  return screen
    .getAllByRole("button", { name: new RegExp(text) })
    .find((one) => one.closest("[data-row-link]") !== null) as HTMLElement;
}

/** Puts the focus on a row's control. */
function focus(text: string) {
  const link = controlOf(text);
  act(() => link.focus());
  return link;
}

/** Presses a key on an element, as a user's reaches the window; a capital is typed with Shift. */
async function press(key: string, target: Element = document.body) {
  await act(async () => {
    fireEvent.keyDown(target, { key, shiftKey: /^[A-Z]$/.test(key) });
  });
}

/** The priorities' page over a repository holding `PRIORITIES`. */
async function onPriorities() {
  const repo = fixtureRepo();
  writeFileSync(join(repo, "specs/PRIORITIES.md"), PRIORITIES);
  await renderPage("/priorities", repo);
  await screen.findByRole("heading", { name: "Next · 3" });
  return repo;
}

/** What `paths` hold now, a file that does not exist as `null`. */
function contents(repo: string, paths: ReadonlyArray<string>) {
  return paths.map((path) => (existsSync(join(repo, path)) ? read(repo, path) : null));
}

/**
 * `u` puts `paths` back as `before` had them, then `U` writes them again as the write left them,
 * which must differ: the write happened, and is undone and redone whole.
 */
async function undoesAndRedoes(
  repo: string,
  paths: ReadonlyArray<string>,
  before: ReadonlyArray<string | null>,
) {
  const after = contents(repo, paths);
  expect(after).not.toEqual(before);
  // A layer, as the pane, owns the keys while it shows: the stack's are pressed on the page.
  await waitFor(() => expect(isLayerOpen()).toBe(false));
  await press("u");
  await waitFor(() => expect(contents(repo, paths)).toEqual(before));
  // The undo lands, and takes the human to its page, before the redo is pressed.
  await waitFor(() => expect(screen.getAllByText(/^Undone: /).length).toBeGreaterThan(0));
  await press("U");
  await waitFor(() => expect(contents(repo, paths)).toEqual(after));
}

/**
 * The rows the list shows, in order: a nested row indented, and each section's Add row, "Add to
 * Next", after its rows.
 */
function shownRows() {
  return Array.from(document.querySelectorAll("[data-row-key]"), (row) => {
    const text = row.querySelector("[data-row-link]")?.textContent ?? "";
    return row.getAttribute("data-row-key")?.includes("/") ? `  ${text}` : text;
  });
}

/** The rows `PRIORITIES.md` holds, as `shownRows` draws them. */
function fileRows(repo: string) {
  const rows: Array<string> = [];
  let section: string | undefined;
  for (const line of read(repo).split("\n")) {
    const heading = /^## (.*)$/.exec(line)?.[1];
    const item = /^(\s*)- (.*)$/.exec(line);
    if (heading !== undefined) {
      rows.push(...(section === undefined ? [] : [`Add to ${section}`]));
      section = heading;
    } else if (item) {
      rows.push(item[1] ? `  ${item[2]}` : item[2]);
    }
  }
  return section === undefined ? rows : [...rows, `Add to ${section}`];
}

/**
 * Waits for the list to show the file as it is: an undo or a redo reads it again as it lands, and
 * the next write is made over the version the list holds.
 */
async function listShowsFile(repo: string) {
  await waitFor(() => expect(shownRows()).toEqual(fileRows(repo)));
}

/** Types `text` in a field and presses Enter. */
async function save(field: HTMLElement, text: string) {
  await type(field, text);
  await act(async () => {
    fireEvent.keyDown(field, { key: "Enter" });
  });
}

// Break: a write that records no entry, or one whose change misses a file it wrote.
test("a line added in place, edited, and deleted each undo and redo", async () => {
  const repo = await onPriorities();
  let before = contents(repo, ["specs/PRIORITIES.md"]);
  await press("o", focus("Second"));
  await save(await screen.findByRole("textbox", { name: "New proposal" }), "Fresh line");
  await waitFor(() => expect(read(repo)).toContain("- Second\n- Fresh line\n"));
  await press("Escape", await screen.findByRole("textbox", { name: "New proposal" }));
  await screen.findByText("Added “Fresh line” · waits on the Git page");
  await undoesAndRedoes(repo, ["specs/PRIORITIES.md"], before);
  await listShowsFile(repo);

  before = contents(repo, ["specs/PRIORITIES.md"]);
  await press("i", focus("Third"));
  await save(await screen.findByRole("textbox", { name: "Edit the proposal" }), "Third edited");
  await waitFor(() => expect(read(repo)).toContain("- Third edited\n"));
  await screen.findByText("Edited “Third edited” · waits on the Git page");
  await undoesAndRedoes(repo, ["specs/PRIORITIES.md"], before);
  await listShowsFile(repo);

  before = contents(repo, ["specs/PRIORITIES.md"]);
  await press("d", focus("Later line"));
  await waitFor(() => expect(read(repo)).not.toContain("Later line"));
  await screen.findByText("Deleted “Later line” · waits on the Git page");
  await undoesAndRedoes(repo, ["specs/PRIORITIES.md"], before);
});

// Break: a move that records no entry, or one that shows a toast.
test("a line indented, outdented, moved, and moved to a section each undo and redo, with no toast", async () => {
  const repo = await onPriorities();
  const moves: Array<[string, string, (text: string) => boolean]> = [
    ["K", "Third", (text) => text.includes("- Third\n- Second\n")],
    ["H", "Later line", (text) => !text.includes("## Later\n\n- Later line")],
    ["Tab", "Second", (text) => text.includes("  - Second\n")],
  ];
  for (const [key, line, moved] of moves) {
    const before = contents(repo, ["specs/PRIORITIES.md"]);
    await press(key, focus(line));
    await waitFor(() => expect(moved(read(repo)), `${key}: ${read(repo)}`).toBe(true));
    // A move shows no toast: its entry is on the stack once its write answered.
    await waitFor(() => expect(undoStack.top()?.label).toBe(`Moved “${line}”`));
    expect(screen.queryByText(/^Moved/)).toBeNull();
    // The undo and the redo end the run: the next move is a step of its own.
    await undoesAndRedoes(repo, ["specs/PRIORITIES.md"], before);
    await listShowsFile(repo);
  }
  // A nested row outdented, with Shift+Tab.
  const before = contents(repo, ["specs/PRIORITIES.md"]);
  const child = focus("First's child");
  expect(before[0]).toContain("- First\n  - First's child\n");
  await act(async () => {
    fireEvent.keyDown(child, { key: "Tab", shiftKey: true });
  });
  await waitFor(() => expect(undoStack.top()?.label).toBe("Moved “First's child”"));
  await undoesAndRedoes(repo, ["specs/PRIORITIES.md"], before);
});

// Break: the pane's writes keeping their own reverses, with no redo, or none at all.
test("the pane's rename, section, and delete each undo and redo", async () => {
  const repo = await onPriorities();
  await act(async () => navigate(atRepo("/priorities/second")));
  await click(await screen.findByRole("button", { name: "Edit" }));
  let before = contents(repo, ["specs/PRIORITIES.md"]);
  await save(screen.getByRole("textbox", { name: "Proposal" }), "Second renamed");
  await waitFor(() => expect(read(repo)).toContain("- Second renamed\n"));
  await screen.findByText("Renamed “Second” · waits on the Git page");
  // The pane is a layer, which the stack's keys do not reach: the list's page is open again.
  await act(async () => navigate(atRepo("/priorities")));
  await undoesAndRedoes(repo, ["specs/PRIORITIES.md"], before);
  await listShowsFile(repo);

  await act(async () => navigate(atRepo("/priorities/third")));
  const section = await screen.findByRole("radiogroup", { name: "Section" });
  before = contents(repo, ["specs/PRIORITIES.md"]);
  await click(within(section).getByRole("radio", { name: "Later" }));
  await waitFor(() => expect(read(repo)).toContain("- Later line\n- Third\n"));
  await waitFor(() => expect(undoStack.top()?.label).toBe("Moved “Third” to Later"));
  await act(async () => navigate(atRepo("/priorities")));
  await undoesAndRedoes(repo, ["specs/PRIORITIES.md"], before);
  await listShowsFile(repo);

  await act(async () => navigate(atRepo("/priorities/first")));
  before = contents(repo, ["specs/PRIORITIES.md"]);
  await click(await screen.findByRole("button", { name: "Delete" }));
  await waitFor(() => expect(read(repo)).not.toContain("- First\n"));
  await screen.findByText("Deleted “First” · waits on the Git page");
  await undoesAndRedoes(repo, ["specs/PRIORITIES.md"], before);
});

// Break: an expand whose undo leaves the file, or the line out of the priorities.
test("e expands a line into a file, which u takes back and U makes again", async () => {
  const repo = await onPriorities();
  const paths = ["specs/PRIORITIES.md", "specs/proposals/second.md"];
  const before = contents(repo, paths);
  await press("e", focus("Second"));
  await waitFor(() => expect(existsSync(join(repo, "specs/proposals/second.md"))).toBe(true));
  await screen.findByText("Expanded “Second” into a file · waits on the Git page");
  await undoesAndRedoes(repo, paths, before);
});

// Break: the sidebar's adds keeping a redo that is refused, or none.
test("the sidebar's adds of a proposal and of a note undo and redo", async () => {
  const repo = await onPriorities();
  let before = contents(repo, ["specs/PRIORITIES.md"]);
  await click(screen.getByRole("button", { name: "Add a proposal" }));
  await save(await screen.findByRole("textbox", { name: "Proposal" }), "Sidebar proposal");
  await waitFor(() => expect(read(repo)).toContain("- Sidebar proposal\n"));
  await screen.findByText("Added to Next · waits on the Git page");
  await undoesAndRedoes(repo, ["specs/PRIORITIES.md"], before);

  before = contents(repo, [INBOX]);
  await click(screen.getByRole("button", { name: "Add a note to the inbox" }));
  const form = within(await screen.findByRole("dialog", { name: "Add a note" }));
  await type(form.getByRole("textbox", { name: "Note" }), "Sidebar note");
  await click(form.getByRole("button", { name: "Add" }));
  await waitFor(() => expect(read(repo, INBOX)).toContain("- Sidebar note\n"));
  await screen.findByText("Added to the inbox · waits on the Git page");
  await undoesAndRedoes(repo, [INBOX], before);
});

/** A PNG, as the clipboard or a drop gives it. */
const png = (name: string) =>
  new File([readFileSync(fixture("images/phone.png"))], name, { type: "image/png" });

/** Pastes `files` in a field, as the clipboard gives a screenshot: files, and no text. */
async function paste(field: Element, files: Array<File>) {
  await act(async () => {
    fireEvent.paste(field, { clipboardData: { files, getData: () => "" } });
  });
}

/** Every file under `folder` of `repo`, by its path from the repository, with its bytes. */
function tree(repo: string, folder: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(join(repo, folder), { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) {
      const path = join(entry.parentPath, entry.name);
      files[path.slice(repo.length + 1)] = readFileSync(path, "base64");
    }
  }
  return files;
}

// Break: an add with images whose undo leaves its note file, or whose redo is refused.
test("the sidebar's add of a note with an image undoes and redoes, its note file with it", async () => {
  const repo = await onPriorities();
  const before = tree(repo, "specs");
  await click(screen.getByRole("button", { name: "Add a note to the inbox" }));
  const form = within(await screen.findByRole("dialog", { name: "Add a note" }));
  const field = form.getByRole("textbox", { name: "Note" });
  await type(field, "Pictured note");
  await paste(field, [png("pictured.png")]);
  await click(await form.findByRole("button", { name: "Add as a file" }));
  await waitFor(() => expect(read(repo, INBOX)).toMatch(/\[Pictured note\]\(/), {
    timeout: 10_000,
  });
  await screen.findByText("Added to the inbox as a file · waits on the Git page");
  const after = tree(repo, "specs");

  await press("u");
  await waitFor(() => expect(tree(repo, "specs")).toEqual(before));
  await waitFor(() => expect(screen.getAllByText(/^Undone: /).length).toBeGreaterThan(0));
  await press("U");
  await waitFor(() => expect(tree(repo, "specs")).toEqual(after));
});

// Break: an image whose undo leaves the image, or the file moved into its folder.
test("an image dropped on a proposal file's page undoes and redoes, its link with it", async () => {
  const repo = fixtureRepo();
  await renderPage(`/edit/${PROPOSAL}`, repo);
  await screen.findByRole("textbox", { name: "Text" });
  const before = tree(repo, "specs/proposals");
  const dataTransfer = { dropEffect: "none", files: [png("listener.png")], types: ["Files"] };
  await act(async () => {
    fireEvent.dragEnter(document.body, { dataTransfer });
    fireEvent.drop(document.body, { dataTransfer });
  });
  // The file becomes a folder holding the image, and its text links it.
  await waitFor(
    () =>
      expect(
        Object.entries(tree(repo, "specs/proposals")).some(
          ([path, bytes]) =>
            path.endsWith(".md") &&
            path.includes("git-listener") &&
            Buffer.from(bytes, "base64").toString().includes("](images/listener"),
        ),
      ).toBe(true),
    { timeout: 10_000 },
  );
  await screen.findByText(/^Added an image to “git-listener” · waits on the Git page/);
  const after = tree(repo, "specs/proposals");

  await press("u");
  await waitFor(() => expect(tree(repo, "specs/proposals")).toEqual(before));
  await waitFor(() => expect(screen.getAllByText(/^Undone: /).length).toBeGreaterThan(0));
  await press("U");
  await waitFor(() => expect(tree(repo, "specs/proposals")).toEqual(after));
});
