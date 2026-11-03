// Vim's keys in the shared editor, with the Vim mode setting on and a fine pointer: the engine's own
// keys, over the field's own actions (Text editing decision). Typed through the engine as a browser
// would: a key the engine does not take inserts its character.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EditorView } from "@codemirror/view";
import { getCM } from "@replit/codemirror-vim";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { modeNow } from "../fields/editor/modeStore.ts";
import { temporaryFolder } from "uraeda-binding/test-utils";
import {
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
  await keys(field, ":");
  const prompt = within(field.closest(".cm-editor") as HTMLElement).getByRole("textbox", {
    name: "",
  });
  act(() => {
    (prompt as HTMLInputElement).value = "w";
  });

  await keys(prompt, "<CR>");

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
