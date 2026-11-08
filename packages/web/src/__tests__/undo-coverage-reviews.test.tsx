// The undo coverage of a review's writes (SC-002): a comment's add, edit, and removal, and Start
// over, each undone with `u` and redone with `U`. After each, the review file is as it was, and the
// page shows it so; a comment typed but not sent stays, following its comment.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { GENERAL_ID } from "../YourReview.tsx";
import { click, fieldText, fixtureRepo, git, renderPage, today, type } from "./helpers.tsx";

const FOLDER = "2026-10-06-recurring-tasks";
const PAGE = `/f/${FOLDER}/spec.md`;
const SPEC = `specs/${FOLDER}/spec.md`;
const REVIEW = `specs/${FOLDER}/spec-review.md`;
const WORKTREE = join(".worktrees", FOLDER);

today("2026-10-11");

/** Commits an edit of the spec on its branch, in the feature's worktree, made first if missing. */
function commitSpec(repo: string, edit: (text: string) => string) {
  if (!existsSync(join(repo, WORKTREE))) {
    git(repo, "worktree", "add", "--quiet", WORKTREE, FOLDER);
  }
  const path = join(repo, WORKTREE, SPEC);
  writeFileSync(path, edit(readFileSync(path, "utf8")));
  git(join(repo, WORKTREE), "commit", "--quiet", "--no-verify", "--all", "--message", "spec: edit");
}

/** A repository whose feature has its worktree, with a line more in its spec. */
function repo() {
  const r = fixtureRepo();
  commitSpec(r, (text) => `${text}\nOne more line.\n`);
  return r;
}

const reviewPath = (r: string) => join(r, WORKTREE, REVIEW);

/** The review file, or nothing when there is none. */
const review = (r: string) =>
  existsSync(reviewPath(r)) ? readFileSync(reviewPath(r), "utf8") : undefined;

/** A pending review at the spec's tip: one general comment per text, C1 first. */
function pending(r: string, texts: Array<string>) {
  const tip = git(r, "rev-parse", "--short=7", FOLDER).trim();
  const written = texts.map((text, index) => `## C${index + 1}: General\n\n${text}\n`);
  writeFileSync(
    reviewPath(r),
    `---\nverdict: pending\ncommit: ${tip}\n---\n\n# Review: Spec, Recurring tasks\n\n${written.join("\n")}`,
  );
  return review(r)!;
}

/** Presses a key on the page, outside any field, as `u` and `U` are pressed. */
async function press(key: string) {
  await act(async () => {
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(document.body, { key, shiftKey: /^[A-Z]$/.test(key) });
  });
}

/** The pending comment named `name`, "C1 · general", once shown. */
const comment = (name: string) => screen.findByRole("group", { name });

/** The general comment's field, at the review's end, once shown. */
const generalField = () =>
  waitFor(() =>
    within(document.getElementById(GENERAL_ID) as HTMLElement).getByLabelText("Comment text"),
  );

/** The form of an edit being written, once shown. */
const editForm = () =>
  waitFor(() => {
    const forms = screen
      .queryAllByRole("form", { name: "Comment" })
      .filter((form) => !form.closest(`#${GENERAL_ID}`));
    expect(forms).toHaveLength(1);
    return forms[0]!;
  });

// Break: no entry recorded, the file left with its comment, or the page still showing it.
test("a first comment's undo deletes the review file it created, and its redo writes it", async () => {
  const r = repo();
  await renderPage(PAGE, r);
  await type(await generalField(), "Pointers for the plan.");
  const end = within(document.getElementById(GENERAL_ID) as HTMLElement);
  await click(end.getByRole("button", { name: "Add comment" }));
  await screen.findByText("Added a comment");
  const written = review(r);
  expect(written).toContain("Pointers for the plan.");

  await press("u");
  await screen.findByText("Undone: added a comment");
  expect(review(r)).toBeUndefined();
  await waitFor(() => expect(screen.queryByRole("group", { name: "C1 · general" })).toBeNull());

  await press("U");
  await screen.findByText("Redone: added a comment");
  expect(review(r)).toBe(written);
  await comment("C1 · general");
});

// Break: the mockup page's comment written with no entry, so `u` leaves it in the review.
test("a mockup's comment undoes and redoes, as the review page's do", async () => {
  const r = repo();
  await renderPage(`/f/${FOLDER}/mockups/repeat.html`, r);
  await click(await screen.findByRole("button", { name: "Comment" }));
  const form = within(await screen.findByRole("form", { name: "Comment" }));
  await type(form.getByLabelText("Comment text"), "The mockup's buttons are too small.");
  await click(form.getByRole("button", { name: "Add comment" }));
  await screen.findByText("Added a comment");
  const written = review(r);
  expect(written).toContain("The mockup's buttons are too small.");

  await press("u");
  await screen.findByText("Undone: added a comment");
  expect(review(r)).toBeUndefined();

  await press("U");
  await screen.findByText("Redone: added a comment");
  expect(review(r)).toBe(written);
});

// Break: the edit left on undo, or the page showing the edited text; a redo that is refused.
test("an edited comment's undo puts its text back, and its redo the edit", async () => {
  const r = repo();
  const before = pending(r, ["First."]);
  await renderPage(PAGE, r);
  await click(within(await comment("C1 · general")).getByRole("button", { name: "Edit" }));
  await type(within(await editForm()).getByLabelText("Comment text"), "First, edited.");
  await click(within(await editForm()).getByRole("button", { name: "Save comment" }));
  await screen.findByText("Edited a comment");
  const edited = review(r);
  expect(edited).toContain("First, edited.");

  await press("u");
  await screen.findByText("Undone: edited a comment");
  expect(review(r)).toBe(before);
  await waitFor(async () =>
    expect((await comment("C1 · general")).textContent).toContain("First."),
  );
  expect((await comment("C1 · general")).textContent).not.toContain("edited");

  await press("U");
  await screen.findByText("Redone: edited a comment");
  expect(review(r)).toBe(edited);
  await waitFor(async () =>
    expect((await comment("C1 · general")).textContent).toContain("First, edited."),
  );
});

// Break: the comment not back, or the edit typed for the one after it left on the wrong comment.
test("a removed comment's undo brings it back, and an edit typed after it follows it", async () => {
  const r = repo();
  const before = pending(r, ["First.", "Second."]);
  await renderPage(PAGE, r);
  await click(within(await comment("C2 · general")).getByRole("button", { name: "Edit" }));
  await type(within(await editForm()).getByLabelText("Comment text"), "Second, edited.");
  await click(within(await comment("C1 · general")).getByRole("button", { name: "Remove" }));
  await screen.findByText("Removed a comment");
  const removed = review(r);
  expect(within(await editForm()).getByText("Editing C1")).toBeTruthy();

  await press("u");
  await screen.findByText("Undone: removed a comment");
  expect(review(r)).toBe(before);
  await waitFor(async () =>
    expect((await comment("C1 · general")).textContent).toContain("First."),
  );
  // The edit kept for the second comment is its again, with its text.
  await waitFor(async () => expect(within(await editForm()).getByText("Editing C2")).toBeTruthy());
  expect(fieldText(within(await editForm()).getByLabelText("Comment text"))).toBe(
    "Second, edited.",
  );

  // The redo removes it again: the edit follows the second comment back to C1.
  await press("U");
  await screen.findByText("Redone: removed a comment");
  expect(review(r)).toBe(removed);
  await waitFor(() => expect(screen.queryByRole("group", { name: "C2 · general" })).toBeNull());
  await waitFor(async () => expect(within(await editForm()).getByText("Editing C1")).toBeTruthy());
  expect(fieldText(within(await editForm()).getByLabelText("Comment text"))).toBe(
    "Second, edited.",
  );
});

// Break: the removed comment's own edit, typed but not sent, dropped with it for good.
test("a removed comment's own edit not sent comes back with it on undo", async () => {
  const r = repo();
  pending(r, ["First.", "Second."]);
  await renderPage(PAGE, r);
  await click(within(await comment("C1 · general")).getByRole("button", { name: "Edit" }));
  await type(within(await editForm()).getByLabelText("Comment text"), "First, edited.");
  // The edit of the second comment opens: the first's text stays kept, unsent.
  await click(within(await comment("C2 · general")).getByRole("button", { name: "Edit" }));
  await waitFor(async () => expect(within(await editForm()).getByText("Editing C2")).toBeTruthy());
  await click(within(await comment("C1 · general")).getByRole("button", { name: "Remove" }));
  await screen.findByText("Removed a comment");

  await press("u");
  await screen.findByText("Undone: removed a comment");
  await click(within(await comment("C1 · general")).getByRole("button", { name: "Edit" }));
  await waitFor(async () => expect(within(await editForm()).getByText("Editing C1")).toBeTruthy());
  expect(fieldText(within(await editForm()).getByLabelText("Comment text"))).toBe("First, edited.");
});

// Break: Start over's undo leaving the review deleted, or bringing back only part of it.
test("Start over's undo brings back every comment it dropped", async () => {
  const r = repo();
  const before = pending(r, ["First.", "Second."]);
  // The spec changes under the comments: the page offers Start over.
  commitSpec(r, (text) => `${text}\nAnother line.\n`);
  await renderPage(PAGE, r);
  await click(await screen.findByRole("button", { name: "Start over" }));
  await screen.findByText("Started the review over");
  expect(review(r)).toBeUndefined();

  await press("u");
  await screen.findByText("Undone: started the review over");
  expect(review(r)).toBe(before);
  await comment("C1 · general");
  await comment("C2 · general");

  await press("U");
  await screen.findByText("Redone: started the review over");
  expect(review(r)).toBeUndefined();
  await waitFor(() => expect(screen.queryByRole("group", { name: "C1 · general" })).toBeNull());
});
