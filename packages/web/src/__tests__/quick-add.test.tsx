// US3 of the redesign of the priorities: "Add and commit" in the sidebar's ＋ forms, the default on
// Enter, beside "Add". It commits that file alone; when it cannot, the form says why and stays open.
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { runWrite } from "../writes/store.ts";
import { atWidth, click, fixtureRepo, git, holding, read, renderPage, type } from "./helpers.tsx";

const INBOX = "specs/INBOX.md";
const SORT = "Sort done features";

/** The last commit's subject on the default branch. */
const lastCommit = (repo: string) => git(repo, "log", "-1", "--format=%s", "main").trim();

/** A toast's text, not its announcement to screen readers, which repeats it a moment later. */
function toast(text: string) {
  return screen.findByText(text, { ignore: "script, style, [aria-live]" });
}

/** Opens "New priority" from the navigation's ＋, and returns the dialog and its line. */
async function openPriority() {
  await click(await screen.findByRole("button", { name: "Add to the priorities" }));
  const form = within(await screen.findByRole("dialog", { name: "New priority" }));
  return { field: await form.findByLabelText("Priority"), form };
}

/** Opens "Add a note" from the navigation's ＋, and returns the dialog and its line. */
async function openNote() {
  await click(await screen.findByRole("button", { name: "Add a note to the inbox" }));
  const form = within(await screen.findByRole("dialog", { name: "Add a note" }));
  return { field: await form.findByPlaceholderText("What did you notice?"), form };
}

/** Presses Enter in a one-line field. */
async function enter(field: HTMLElement) {
  await act(async () => {
    fireEvent.keyDown(field, { key: "Enter" });
  });
}

/** A copy of the fixture repository whose commits run a `pre-commit` hook refusing them. */
function refusingHook() {
  const repo = fixtureRepo();
  const hook = join(repo, ".git/hooks/pre-commit");
  mkdirSync(join(repo, ".git/hooks"), { recursive: true });
  writeFileSync(
    hook,
    "#!/bin/sh\necho 'Trailing space in PRIORITIES.md' >&2\necho 'line 9' >&2\nexit 1\n",
  );
  chmodSync(hook, 0o755);
  return repo;
}

/** Adds "Sort done features" to Next with Enter, and returns its toast's Undo. */
async function addAndCommit() {
  const { field } = await openPriority();
  await type(field, SORT);
  await enter(field);
  await toast("Added to Next and committed");
  return screen.getByRole("button", { name: "Undo" });
}

test("Enter adds and commits (US3 1)", async () => {
  const { repo } = await renderPage("/");

  await addAndCommit();

  expect(lastCommit(repo)).toBe(`chore: add "${SORT}" to Next`);
  expect(git(repo, "status", "--porcelain")).toBe("");
  expect(read(repo)).toContain(`- ${SORT}\n\n## Later`);
  // Committed, the form closed.
  expect(screen.queryByRole("dialog", { name: "New priority" })).toBeNull();
});

test("Add leaves it uncommitted (US3 2)", async () => {
  const { repo } = await renderPage("/");
  const { field, form } = await openPriority();
  await type(field, SORT);

  await click(form.getByRole("button", { name: "Add" }));

  expect(await toast("Added to Next, not committed")).toBeTruthy();
  expect(lastCommit(repo)).toBe("chore: specs");
  expect(read(repo)).toContain(`- ${SORT}\n`);
});

test("a changed file only adds (US3 3)", async () => {
  const repo = fixtureRepo();
  writeFileSync(join(repo, "specs/PRIORITIES.md"), `${read(repo)}\n- Typed by hand\n`);
  await renderPage("/", repo);
  const { field, form } = await openPriority();
  await type(field, SORT);

  await click(form.getByRole("button", { name: "Add and commit" }));

  expect(
    await form.findByText(
      "Added to Next. Not committed: PRIORITIES.md has other changes to commit or discard.",
    ),
  ).toBeTruthy();
  // The form stays open, its line added and emptied.
  expect(screen.getByRole("dialog", { name: "New priority" })).toBeTruthy();
  expect(form.getByLabelText("Priority")).toHaveProperty("value", "");
  expect(read(repo)).toContain(`- ${SORT}\n`);
  expect(lastCommit(repo)).toBe("chore: specs");
});

test("a note adds and commits (US3 4)", async () => {
  const { repo } = await renderPage("/");
  const { field, form } = await openNote();
  await type(field, "Icons are blurry");

  await click(form.getByRole("button", { name: "Add and commit" }));

  expect(await toast("Added to the inbox and committed")).toBeTruthy();
  expect(lastCommit(repo)).toBe('chore: add "Icons are blurry" to the inbox');
  expect(git(repo, "status", "--porcelain")).toBe("");
  expect(read(repo, INBOX)).toContain("- Icons are blurry\n");
});

test("four taps from the phone's home (US3 5, SC-002)", async () => {
  atWidth(402);
  const { repo } = await renderPage("/");
  let taps = 0;
  const tap = async (element: HTMLElement) => {
    taps += 1;
    await click(element);
  };

  await tap(await screen.findByRole("button", { name: "Open navigation" }));
  await tap(await screen.findByRole("button", { name: "Add to the priorities" }));
  const form = within(await screen.findByRole("dialog", { name: "New priority" }));
  // The line has the focus as the form opens: typing needs no tap of its own.
  const field = await form.findByLabelText("Priority");
  await waitFor(() => expect(document.activeElement).toBe(field));
  await type(field, SORT);
  await tap(form.getByRole("button", { name: "Add and commit" }));

  await toast("Added to Next and committed");
  expect(lastCommit(repo)).toBe(`chore: add "${SORT}" to Next`);
  expect(taps).toBeLessThanOrEqual(4);
});

test("Undo commits the removal (US3 6)", async () => {
  const { repo } = await renderPage("/");
  const undo = await addAndCommit();

  await click(undo);

  await waitFor(() => expect(lastCommit(repo)).toBe(`chore: remove "${SORT}"`));
  expect(read(repo)).not.toContain(SORT);
  expect(git(repo, "status", "--porcelain")).toBe("");
});

test("a failed hook shows its first line", async () => {
  const repo = refusingHook();
  await renderPage("/", repo);
  const { field, form } = await openPriority();
  await type(field, SORT);

  await click(form.getByRole("button", { name: "Add and commit" }));

  expect(await form.findByText("Commit failed: Trailing space in PRIORITIES.md")).toBeTruthy();
  expect(screen.getByRole("dialog", { name: "New priority" })).toBeTruthy();
  // The entry stays written, uncommitted.
  expect(read(repo)).toContain(`- ${SORT}\n`);
  expect(lastCommit(repo)).toBe("chore: specs");
});

test("Undo after a change elsewhere shows the conflict (review focus 6)", async () => {
  const { repo } = await renderPage("/");
  const undo = await addAndCommit();
  const edited = `${read(repo)}\n- Typed by hand\n`;
  writeFileSync(join(repo, "specs/PRIORITIES.md"), edited);

  await click(undo);

  // In the page, not only in a toast, until dismissed.
  expect(
    await screen.findByText("PRIORITIES.md changed on disk. Your change was not applied."),
  ).toBeTruthy();
  expect(read(repo)).toBe(edited);
  expect(lastCommit(repo)).toBe(`chore: add "${SORT}" to Next`);
});

test.each([
  [1440, true],
  [402, false],
])("the ↵ icon shows on wide screens only (C4), at %i px", async (width, shown) => {
  atWidth(width);
  await renderPage("/");
  if (!shown) {
    await click(await screen.findByRole("button", { name: "Open navigation" }));
  }
  const { form } = await openPriority();

  // Its name stays "Add and commit": the icon is hidden from assistive technologies.
  const button = form.getByRole("button", { name: "Add and commit" });
  expect(within(button).queryAllByRole("img", { hidden: true })).toHaveLength(shown ? 1 : 0);
});

/** Runs a git write from elsewhere, as another page's Commit, until the returned `end`. */
function otherWrite() {
  const done = Promise.withResolvers<boolean>();
  let write: Promise<boolean> | undefined;
  act(() => {
    write = runWrite({ label: "Committing…" }, () => done.promise);
  });
  return async () => {
    await act(async () => {
      done.resolve(true);
      await write;
    });
  };
}

/** UI behaviour: a button that writes to git says what it does at once, with a spinner. */
test("Add and commit reads Committing… at once, from a click or Enter", async () => {
  const repo = fixtureRepo();
  const held = await holding(repo, '"priorities.add"');
  try {
    await renderPage("/", repo, { agent: held.fake, fetch: held.fetch });
    const { field, form } = await openPriority();
    await type(field, SORT);

    await enter(field);

    const running = form.getByRole("button", { name: "Committing…" });
    expect(running.querySelector('[role="status"]')).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Saving to git" })).toBeTruthy();
    // A second Enter while it runs sends nothing more.
    await enter(field);
    expect(held.count()).toBe(1);

    await act(async () => held.release());

    expect(await toast("Added to Next and committed")).toBeTruthy();
    expect(screen.queryByRole("progressbar", { name: "Saving to git" })).toBeNull();
  } finally {
    held.release();
  }
});

/** UI behaviour: while any git write runs, every other button that writes to git is blocked. */
test("another git write blocks Add and commit, and Enter, not Add", async () => {
  const repo = fixtureRepo();
  const held = await holding(repo, '"inbox.add"');
  await renderPage("/", repo, { agent: held.fake, fetch: held.fetch });
  const { field, form } = await openNote();
  await type(field, "Toasts hide the bar");
  const end = otherWrite();
  try {
    const commit = form.getByRole("button", { name: "Add and commit" });
    expect(commit.getAttribute("aria-disabled")).toBe("true");
    expect(form.getByRole("button", { name: "Add" }).getAttribute("aria-disabled")).not.toBe(
      "true",
    );
    await click(commit);
    await enter(field);
    expect(held.count()).toBe(0);

    await end();

    expect(commit.getAttribute("aria-disabled")).not.toBe("true");
  } finally {
    await end();
    held.release();
  }
});

/** UI behaviour: the Undo of a committed add commits, so it is a git write too. */
test("the Undo of a committed add reads Undoing… at once, and waits for another write", async () => {
  const repo = fixtureRepo();
  const held = await holding(repo, '"priorities.undoCommitted"');
  try {
    await renderPage("/", repo, { agent: held.fake, fetch: held.fetch });
    const undo = await addAndCommit();
    const end = otherWrite();
    try {
      expect(undo.getAttribute("aria-disabled")).toBe("true");
      await click(undo);
      expect(held.count()).toBe(0);
    } finally {
      await end();
    }

    await click(screen.getByRole("button", { name: "Undo" }));

    const running = screen.getByRole("button", { name: "Undoing…" });
    expect(running.querySelector('[role="status"]')).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Saving to git" })).toBeTruthy();
    await act(async () => held.release());
    await waitFor(() => expect(lastCommit(repo)).toBe(`chore: remove "${SORT}"`));
  } finally {
    held.release();
  }
});
