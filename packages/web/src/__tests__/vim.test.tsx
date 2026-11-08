// Vim's keys in the shared editor, with the Vim mode setting on and a fine pointer: the engine's own
// keys, over the field's own actions (Text editing decision). Typed through the engine as a browser
// would: a key the engine does not take inserts its character.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EditorView } from "@codemirror/view";
import { getCM, Vim } from "@replit/codemirror-vim";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { modeNow } from "../fields/editor/modeStore.ts";
import { slotContent } from "../fields/editor/slot.ts";
import { temporaryFolder } from "uraeda-binding/test-utils";
import {
  click,
  fieldText,
  fixture,
  fixtureRepo,
  git,
  read,
  refreshUntil,
  renderPage,
  today,
  type,
} from "./helpers.tsx";

today("2026-10-11");

const FOLDER = "2026-10-11-web-ui";
const ROUND = join(".worktrees", FOLDER, "specs", FOLDER, "clarifications-01.md");

/** The comment field's label, which says a comment alone answers. */
const COMMENT = "Comment, or your own answer instead of a letter";

/** A config folder whose settings file turns Vim on, with the human's `jj`. */
function vimOn() {
  const config = temporaryFolder("uraeda-config");
  writeFileSync(
    join(config, "config.toml"),
    '[keyboard]\nvim_mode = true\nvim_commands = ["imap jj <Esc>"]\n',
  );
  return config;
}

// A mouse's pointer: the engine loads.
beforeEach(() => {
  const matchMedia = window.matchMedia.bind(window);
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) =>
    query === "(pointer: fine)" ? { ...matchMedia(query), matches: true } : matchMedia(query),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** The mode the status line reads. */
const mode = () => modeNow().mode;

/** Keys pressed in a field, one by one, `<Esc>` and `<S-Esc>` among them, as a browser sends them. */
async function keys(field: HTMLElement, typed: string) {
  for (const [key] of typed.matchAll(/<S-Esc>|<Esc>|<CR>|./g)) {
    await act(async () => {
      const named = { "<CR>": "Enter", "<Esc>": "Escape", "<S-Esc>": "Escape" }[key!];
      const target = (document.activeElement as HTMLElement | null) ?? field;
      const taken = !fireEvent.keyDown(target, {
        key: named ?? key,
        // The engine's prompt reads the key's code.
        keyCode: { Enter: 13, Escape: 27 }[named ?? ""],
        shiftKey: key === "<S-Esc>",
      });
      // The browser's own: a character the engine left inserts itself.
      const view = EditorView.findFromDOM(field);
      if (!taken && !named && view && target === view.contentDOM) {
        view.dispatch(view.state.replaceSelection(key!), { userEvent: "input.type" });
      }
    });
  }
}

/** The round's page, Vim on, with its questions blank: the first comment field, focused. */
async function roundPage() {
  const config = vimOn();
  const repo = fixtureRepo();
  git(repo, "worktree", "add", "--quiet", join(".worktrees", FOLDER), FOLDER);
  writeFileSync(
    join(repo, ROUND),
    readFileSync(fixture("round-merge-chats/clarifications-01.md"), "utf8"),
  );
  await renderPage(`/f/${FOLDER}/clarifications-01.md`, repo, { config });
  const [field] = await screen.findAllByRole("textbox", { name: COMMENT });
  // The engine is in the field once its chunk loaded.
  await waitFor(() => expect(getCM(EditorView.findFromDOM(field!)!)).not.toBeNull());
  return { config, field: field!, repo };
}

/** The priorities, with one row to edit. */
const PRIORITIES = `# Priorities

## Now

- Review the UI guidelines properly

## Next

## Later

## Blocked
`;

/** The label of a priority's field, edited in place. */
const ROW = "Edit the proposal";

/** The priorities' page, Vim on, its one row edited in place: the row's field, focused. */
async function rowPage() {
  const config = vimOn();
  const repo = fixtureRepo();
  writeFileSync(join(repo, "specs/PRIORITIES.md"), PRIORITIES);
  await renderPage("/priorities", repo, { config });
  await screen.findByRole("heading", { name: /^Now/ });
  // The engine is in every field once its chunk loaded: the row opens with it.
  await waitFor(() => expect(slotContent()).toHaveLength(1));
  const control = screen
    .getAllByRole("button", { name: /Review the UI guidelines properly/ })
    .find((one) => one.closest("[data-row-link]") !== null)!;
  act(() => control.focus());
  await act(async () => {
    fireEvent.keyDown(control, { key: "i" });
  });
  const field = await screen.findByRole("textbox", { name: ROW });
  await waitFor(() => expect(mode()).toBe("insert"));
  return { field, repo };
}

/** Runs an ex command, like `q`, in the engine's prompt, which `:` opened in `field`. */
async function ex(field: HTMLElement, command: string) {
  await keys(field, ":");
  const prompt = within(field.closest(".cm-editor") as HTMLElement).getByRole("textbox", {
    name: "",
  });
  act(() => {
    (prompt as HTMLInputElement).value = command;
  });
  await keys(prompt, "<CR>");
}

/** Focuses a field, as a click or a page's key does. */
const focus = (field: HTMLElement) => act(() => field.focus());

test("a field opens in insert mode", async () => {
  const { field } = await roundPage();
  await type(field, "Review the UI guidelines properly");
  act(() => EditorView.findFromDOM(field)!.contentDOM.blur());

  await focus(field);
  await keys(field, "x");

  // Breaks if the field opens in normal mode, where `x` deletes a character.
  expect(fieldText(field)).toBe("Review the UI guidelines properlyx");
  await waitFor(() => expect(mode()).toBe("insert"));
});

test("Escape in normal mode does the field's Escape, the first leaving insert mode", async () => {
  const { field } = await roundPage();
  await focus(field);
  await type(field, "Review the UI guidelines properly");

  // The first Escape goes to normal mode, in the field still.
  await keys(field, "<Esc>");
  await waitFor(() => expect(mode()).toBe("normal"));
  expect(document.activeElement).toBe(field);
  await keys(field, "0dw");
  expect(fieldText(field)).toBe("the UI guidelines properly");

  // The second is the field's own: a comment's leaves it keeping its text, a row's asks first.
  await keys(field, "<Esc>");
  // Breaks if the first Escape runs the field's, or if the second does nothing.
  expect(document.activeElement).not.toBe(field);
  expect(fieldText(field)).toBe("the UI guidelines properly");
  await waitFor(() => expect(mode()).toBe("nav"));
});

test("Shift+Escape leaves a comment from insert mode, keeping its text", async () => {
  const { field } = await roundPage();
  await focus(field);
  await keys(field, "draft");

  await keys(field, "<S-Esc>");

  // Breaks if Shift+Escape only goes to normal mode, or drops the text.
  expect(document.activeElement).not.toBe(field);
  expect(fieldText(field)).toBe("draft");
  await waitFor(() => expect(mode()).toBe("nav"));
});

test("visual mode's selection is drawn, as the engine hides the browser's", async () => {
  const { field } = await roundPage();
  await focus(field);
  await type(field, "Review the UI guidelines properly");

  await keys(field, "<Esc>0v$");

  await waitFor(() => expect(mode()).toBe("visual"));
  const view = EditorView.findFromDOM(field)!;
  expect(view.state.selection.main.empty).toBe(false);
  // Breaks if nothing draws CodeMirror's own selection, whose layer the engine's look relies on.
  expect(view.dom.querySelector(".cm-selectionLayer")).not.toBeNull();
});

test("visual block mode selects a block, one range a line", async () => {
  const { field } = await roundPage();
  await focus(field);
  await type(field, "first line\nsecond line");

  // `gg` and `+`, as `j` and `0` move along the lines shown, which happy-dom does not lay out.
  await keys(field, "<Esc>gg");
  const view = EditorView.findFromDOM(field)!;
  await act(async () => {
    Vim.handleKey(getCM(view)!, "<C-v>", "user");
  });
  await keys(field, "+l");

  await waitFor(() => expect(mode()).toBe("visual-block"));
  // Breaks if the editor keeps only the main range, as CodeMirror does unless told otherwise.
  expect(view.state.selection.ranges.map(({ from, to }) => view.state.sliceDoc(from, to))).toEqual([
    "fi",
    "se",
  ]);
});

test("a yank reaches the clipboard", async () => {
  const { field } = await roundPage();
  await focus(field);
  await type(field, "first line\nsecond line");

  await keys(field, "<Esc>yy");

  // Breaks if a yank stays in the engine's register only.
  expect(await navigator.clipboard.readText()).toBe("second line\n");
});

test("`:w` saves a comment", async () => {
  const { field, repo } = await roundPage();
  await focus(field);
  await keys(field, "<Esc>");
  await type(field, "Saved by the engine");

  await ex(field, "w");

  // Breaks if `:w` is the engine's own, which saves nothing.
  await waitFor(() => expect(read(repo, ROUND)).toContain("Saved by the engine"));
});

test("the human's commands run when Vim starts", async () => {
  const { field } = await roundPage();
  await focus(field);
  await keys(field, "draft");

  await keys(field, "jj");

  // Breaks if the commands never ran: `jj` would be typed.
  expect(fieldText(field)).toBe("draft");
  await waitFor(() => expect(mode()).toBe("normal"));
});

test("turning Vim off keeps the field's text", async () => {
  const { config, field } = await roundPage();
  const view = EditorView.findFromDOM(field)!;
  await focus(field);
  await keys(field, "unsaved");

  // The file says Vim is off, as the settings page writes it.
  writeFileSync(join(config, "config.toml"), "[keyboard]\nvim_mode = false\n");

  // Breaks if the switch rebuilds the field, losing its text, or keeps the engine in it.
  await refreshUntil(() => expect(getCM(view)).toBeNull());
  expect(EditorView.findFromDOM(field)).toBe(view);
  expect(fieldText(field)).toBe("unsaved");
});

test("Escape twice in a changed row asks before dropping the change", async () => {
  const { field, repo } = await rowPage();
  await keys(field, "<Esc>0dw");
  expect(fieldText(field)).toBe("the UI guidelines properly");

  // The first Escape went to normal mode; the second is the row's own, which asks.
  await keys(field, "<Esc>");

  // Breaks if Escape in normal mode drops the change unasked, or saves it.
  await screen.findByRole("dialog", { name: "Discard your changes?" });
  expect(read(repo)).toBe(PRIORITIES);
});

test("`:q` in a changed row asks before dropping the change, saving nothing", async () => {
  const { field, repo } = await rowPage();
  await type(field, "Review the UI guidelines, changed");
  await keys(field, "<Esc>");

  await ex(field, "q");

  // Breaks if the prompt taking the focus is the row's blur, which saves the change unasked.
  await screen.findByRole("dialog", { name: "Discard your changes?" });
  await click(
    within(screen.getByRole("dialog", { name: "Discard your changes?" })).getByRole("button", {
      name: /^Discard/,
    }),
  );
  await waitFor(() => expect(screen.queryByRole("textbox", { name: ROW })).toBeNull());
  expect(read(repo)).toBe(PRIORITIES);
});

test("`:w` saves a row", async () => {
  const { field, repo } = await rowPage();
  await type(field, "Review the UI guidelines, saved");
  await keys(field, "<Esc>");

  await ex(field, "w");

  // Breaks if `:w` runs a submit the row has none of.
  await waitFor(() => expect(read(repo)).toContain("- Review the UI guidelines, saved\n"));
});

test("`:wq` in a changed row saves it and asks nothing", async () => {
  const { field, repo } = await rowPage();
  await type(field, "Review the UI guidelines, written");
  await keys(field, "<Esc>");

  await ex(field, "wq");

  // Breaks if `:wq` runs the row's Escape after its save, which asks to discard the saved change.
  await waitFor(() => expect(read(repo)).toContain("- Review the UI guidelines, written\n"));
  await waitFor(() => expect(screen.queryByRole("textbox", { name: ROW })).toBeNull());
  expect(screen.queryByRole("dialog", { name: "Discard your changes?" })).toBeNull();
});

test("clicking away while the `:` prompt is open saves the row", async () => {
  const { field, repo } = await rowPage();
  await type(field, "Review the UI guidelines, left");
  await keys(field, "<Esc>:");
  const prompt = within(field.closest(".cm-editor") as HTMLElement).getByRole("textbox", {
    name: "",
  });
  expect(document.activeElement).toBe(prompt);

  // The focus goes to the page's heading, outside the field, as a click there moves it.
  const heading = screen.getByRole("heading", { name: /^Now/ });
  heading.tabIndex = -1;
  act(() => heading.focus());

  // Breaks if only the text's own blur is the row's leave: the prompt's is missed.
  await waitFor(() => expect(read(repo)).toContain("- Review the UI guidelines, left\n"));
});

// Break: the blank lines kept in the field after the save drops them from the list, so the engine's
// "Line 2" names the field's third line.
test("saved commands lose their blank lines in the field, which an error's line number counts", async () => {
  const config = vimOn();
  await renderPage("/settings", fixtureRepo(), { config });
  const field = await screen.findByRole("textbox", { name: "Vim commands" });
  await waitFor(() => expect(slotContent()).not.toHaveLength(0));
  await type(field, "imap jj <Esc>\n\nnmpa Q dd");

  await click(screen.getByRole("button", { name: "Save" }));

  await refreshUntil(() =>
    expect(screen.getByText('Line 2: Not an editor command ":nmpa Q dd"')).toBeTruthy(),
  );
  expect(fieldText(field).split("\n")[1]).toBe("nmpa Q dd");
});

test("in the picker's filter, normal mode's `j` and `k` move the highlighted row, and Enter opens it", async () => {
  const config = vimOn();
  await renderPage("/inbox", fixtureRepo(), { config });
  await screen.findByRole("heading", { name: "Inbox" });
  await waitFor(() => expect(slotContent()).not.toHaveLength(0));
  fireEvent.keyDown(document.body, { key: " " });
  fireEvent.keyDown(document.body, { key: " " });
  const field = await screen.findByRole("combobox", { name: "Find anything" });
  await waitFor(() => expect(document.activeElement).toBe(field));
  await waitFor(() => expect(getCM(EditorView.findFromDOM(field)!)).not.toBeNull());
  expect(mode()).toBe("insert");

  await keys(field, "ui");
  await waitFor(() =>
    expect(screen.getAllByRole("option")[0]?.textContent).toMatch(/^UI behaviour/),
  );
  const highlighted = () =>
    document.getElementById(field.getAttribute("aria-activedescendant") ?? "")?.textContent;
  await waitFor(() => expect(highlighted()).toMatch(/^UI behaviour/));
  const second = screen.getAllByRole("option")[1]!.textContent;
  // In insert mode, the arrows move, as without Vim.
  await act(async () => void fireEvent.keyDown(field, { key: "ArrowDown" }));
  await waitFor(() => expect(highlighted()).toBe(second));
  await act(async () => void fireEvent.keyDown(field, { key: "ArrowUp" }));
  await waitFor(() => expect(highlighted()).toMatch(/^UI behaviour/));

  // Escape goes to normal mode, the picker open: `j` and `k` move, typing nothing.
  await keys(field, "<Esc>");
  expect(mode()).toBe("normal");
  expect(screen.getByRole("combobox", { name: "Find anything" })).toBe(field);
  await keys(field, "j");
  await waitFor(() => expect(highlighted()).toBe(second));
  await keys(field, "k");
  await waitFor(() => expect(highlighted()).toMatch(/^UI behaviour/));
  await act(async () => void fireEvent.keyDown(field, { key: "ArrowDown" }));
  await waitFor(() => expect(highlighted()).toBe(second));
  await act(async () => void fireEvent.keyDown(field, { key: "ArrowUp" }));
  await waitFor(() => expect(highlighted()).toMatch(/^UI behaviour/));
  expect(fieldText(field)).toBe("ui");

  await keys(field, "<CR>");
  await waitFor(() => expect(window.location.pathname).toMatch(/\/decisions\/ui-behaviour$/));
  expect(screen.queryByRole("combobox", { name: "Find anything" })).toBeNull();
});

test("Escape in the picker's normal mode closes it", async () => {
  const config = vimOn();
  await renderPage("/inbox", fixtureRepo(), { config });
  await screen.findByRole("heading", { name: "Inbox" });
  await waitFor(() => expect(slotContent()).not.toHaveLength(0));
  fireEvent.keyDown(document.body, { key: " " });
  fireEvent.keyDown(document.body, { key: " " });
  const field = await screen.findByRole("combobox", { name: "Find anything" });
  await waitFor(() => expect(document.activeElement).toBe(field));
  await waitFor(() => expect(getCM(EditorView.findFromDOM(field)!)).not.toBeNull());

  await keys(field, "<Esc>");
  expect(screen.getByRole("combobox", { name: "Find anything" })).toBe(field);
  await keys(field, "<Esc>");
  await waitFor(() => expect(screen.queryByRole("combobox", { name: "Find anything" })).toBeNull());
});

/** A key pressed outside any field, as the page hears it. */
const pressOutside = (key: string) =>
  act(async () => void fireEvent.keyDown(document.body, { key }));

// Break caught: outside a buffer's text, Enter, `i`, `o`, and `a` do nothing, or run as the page's
// keys, rather than bringing the focus back to the text, as Vim's keys there.
test("outside a buffer's text, Enter and Vim's `i`, `o`, and `a` go back to it", async () => {
  const config = vimOn();
  const repo = fixtureRepo();
  await renderPage("/buffer/specs/PRIORITIES.md", repo, { config });
  const field = await screen.findByRole("textbox", { name: "specs/PRIORITIES.md" });
  const view = EditorView.findFromDOM(field)!;
  await waitFor(() => expect(getCM(view)).not.toBeNull());
  const inserting = () => getCM(view)!.state.vim?.insertMode;
  const away = async () => {
    await act(async () => view.contentDOM.blur());
    expect(view.hasFocus).toBe(false);
  };

  await away();
  await pressOutside("Enter");
  expect(view.hasFocus).toBe(true);
  expect(inserting()).toBe(false);

  for (const key of ["i", "a"]) {
    await keys(field, "<Esc>");
    await away();
    await pressOutside(key);
    expect(view.hasFocus).toBe(true);
    expect(inserting()).toBe(true);
  }

  await keys(field, "<Esc>");
  await away();
  const lines = view.state.doc.lines;
  await pressOutside("o");
  expect(inserting()).toBe(true);
  expect(view.state.doc.lines).toBe(lines + 1);
});
