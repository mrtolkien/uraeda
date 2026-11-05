// The shared editor (Text editing decision): every several-lines field is CodeMirror's view, whose
// Escape leaves the field keeping its text (US1 3), whose Vim slot swaps without rebuilding it, and
// whose Enter waits while an input method composes (the plan's review focus 6).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EditorView } from "@codemirror/view";
import { vim } from "@replit/codemirror-vim";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { vimSlot } from "../fields/editor/slot.ts";
import { fieldText, fixture, fixtureRepo, git, read, renderPage, today, type } from "./helpers.tsx";

today("2026-10-11");

const FOLDER = "2026-10-11-web-ui";

/** The comment field's label, which says a comment alone answers. */
const COMMENT = "Comment, or your own answer instead of a letter";

/** Presses a key on `target`, as a user's reaches the window. */
const press = (key: string, target: Element = document.body, init: KeyboardEventInit = {}) =>
  act(async () => {
    fireEvent.keyDown(target, { key, ...init });
  });

/** The merge-chats round's page, in the feature's worktree, with its questions blank. */
async function roundPage() {
  const repo = fixtureRepo();
  git(repo, "worktree", "add", "--quiet", join(".worktrees", FOLDER), FOLDER);
  writeFileSync(
    join(repo, ".worktrees", FOLDER, "specs", FOLDER, "clarifications-01.md"),
    readFileSync(fixture("round-merge-chats/clarifications-01.md"), "utf8"),
  );
  await renderPage(`/f/${FOLDER}/clarifications-01.md`, repo);
  const [first] = await screen.findAllByRole("textbox", { name: COMMENT });
  return first!;
}

test("Escape leaves a comment keeping its text, and the page's keys work again", async () => {
  const field = await roundPage();
  act(() => field.focus());
  await type(field, "draft");

  await press("Escape", field);

  // Breaks if Escape clears the text, or keeps the focus in the field.
  expect(document.activeElement).not.toBe(field);
  expect(fieldText(field)).toBe("draft");
  // The page's `n` jumps to the first unanswered question again: its title has the focus.
  await press("n");
  await waitFor(() => expect(document.activeElement?.id).toBe("Q1-title"));
});

test("a field's text survives a Compartment swap", async () => {
  const field = await roundPage();
  await type(field, "draft of a comment");
  const view = EditorView.findFromDOM(field);
  expect(view).not.toBeNull();
  act(() => view!.dispatch({ selection: { anchor: 2, head: 7 } }));

  // Breaks if a swap rebuilds the state: the text or the selection would be lost.
  for (const content of [vim(), []]) {
    act(() => view!.dispatch({ effects: vimSlot.reconfigure(content) }));
    expect(EditorView.findFromDOM(field)).toBe(view);
    expect(view!.state.doc.toString()).toBe("draft of a comment");
    expect(view!.state.selection.main).toMatchObject({ anchor: 2, head: 7 });
  }
});

test("Enter while composing does not save", async () => {
  const repo = fixtureRepo();
  await renderPage("/priorities", repo);
  await screen.findByRole("heading", { name: /^Now/ });
  const before = read(repo);
  await press("a");
  const field = await screen.findByRole("textbox", { name: "Proposal" });
  await type(field, "A line typed with an input method");

  await press("Enter", field, { isComposing: true });

  // Breaks if Enter adds the line while an input method still composes it.
  expect(screen.getByRole("dialog", { name: "New proposal" })).toBeTruthy();
  expect(fieldText(field)).toBe("A line typed with an input method");
  expect(read(repo)).toBe(before);

  // Once composed, Enter adds it.
  await press("Enter", field);
  await waitFor(() => expect(read(repo)).toContain("A line typed with an input method"));
});
