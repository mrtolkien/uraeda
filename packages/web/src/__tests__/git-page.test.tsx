// The Git page's writes the human could lose without seeing it: Space stages the file its row's
// box is, leaving the row in its place (US3 1); a typed commit message stays through a hook's
// refusal and goes once its commit lands (US3 more 6), and `c` goes to the message, filled with
// the default, which Enter commits; Discard asks before it restores a file
// (US3 more 4, SC-003); a conflicted file's editor never keeps a text that no longer conflicts
// (US4); and a working tree's diff never shows a file that has changed since.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { navigate } from "../routes.tsx";
import {
  atRepo,
  atWidth,
  click,
  fieldText,
  fixtureRepo,
  git,
  read,
  refreshUntil,
  renderPage,
  type,
} from "./helpers.tsx";

const OUTPUT = "PRIORITIES.md:3: a line too long";

/** Writes `text` to `path` of `repo`, its folders made. */
function write(repo: string, path: string, text: string) {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
}

/** The fixture, with `docs/web-ui.md` committed, then it and `specs/INBOX.md` changed. */
function changedRepo() {
  const repo = fixtureRepo();
  write(repo, "docs/web-ui.md", "# The web UI\n");
  git(repo, "add", "docs/web-ui.md");
  git(repo, "commit", "--quiet", "--no-verify", "-m", "docs: the web UI");
  write(repo, "docs/web-ui.md", "# The web UI\n\nIt draws the specs.\n");
  write(repo, "specs/INBOX.md", `${read(repo, "specs/INBOX.md")}\n- A note\n`);
  return repo;
}

/**
 * The fixture stopped on a merge of `other` into `main`, both of which changed the first line of
 * `specs/PRIORITIES.md`.
 */
function stoppedMerge() {
  const repo = fixtureRepo();
  const text = read(repo);
  git(repo, "checkout", "--quiet", "-b", "other");
  write(repo, "specs/PRIORITIES.md", `Other's first line\n${text}`);
  git(repo, "commit", "--quiet", "--no-verify", "-am", "other");
  git(repo, "checkout", "--quiet", "main");
  write(repo, "specs/PRIORITIES.md", `Main's first line\n${text}`);
  git(repo, "commit", "--quiet", "--no-verify", "-am", "main");
  expect(() => git(repo, "merge", "--quiet", "other")).toThrow();
  return repo;
}

/** The changed files' boxes, in the page's order, by their paths. */
const boxes = () =>
  screen.getAllByRole("checkbox").map((box) => (box as HTMLInputElement).labels?.[0]?.textContent);

/** The box of the changed file at `path`. */
const boxOf = (path: string) => screen.getByRole("checkbox", { name: path });

/**
 * Presses a key on `target`, as the browser does: a Space no listener took, on a checkbox, ticks
 * it, as the key comes up.
 */
async function press(target: HTMLElement, key: string) {
  await act(async () => {
    target.focus();
    const free = fireEvent.keyDown(target, { key });
    if (free && key === " " && target.getAttribute("type") === "checkbox") {
      fireEvent.keyUp(target, { key });
      fireEvent.click(target);
    }
  });
}

/** The commit message's field. */
const message = () => screen.getByRole("textbox", { name: "Message" });

/** The files staged in `repo`, one per line. */
const staged = (repo: string) => git(repo, "diff", "--cached", "--name-only");

// Break: the registry taking Space on a file's box for the leader menu, so nothing is staged.
test("Space on a file row stages it, and the row keeps its place", async () => {
  const repo = changedRepo();
  await renderPage("/git", repo);
  await screen.findByRole("checkbox", { name: "specs/INBOX.md" });
  const before = boxes();
  expect(before).toEqual(["docs", "docs/web-ui.md", "specs", "specs/INBOX.md"]);

  await press(boxOf("specs/INBOX.md"), " ");

  await waitFor(() => expect(staged(repo)).toBe("specs/INBOX.md\n"));
  await waitFor(() => expect((boxOf("specs/INBOX.md") as HTMLInputElement).checked).toBe(true));
  expect(boxes()).toEqual(before);
  expect(document.activeElement).toBe(boxOf("specs/INBOX.md"));
  expect(screen.queryByRole("dialog")).toBeNull();
});

// Break: dropping the typed message as the commit is sent, so a hook's refusal loses it; or
// keeping it once landed, so the next commit's field starts with it.
test("a typed message stays once its commit is refused, and goes once it lands", async () => {
  const repo = fixtureRepo();
  const hook = join(repo, ".git/hooks/pre-commit");
  mkdirSync(dirname(hook), { recursive: true });
  writeFileSync(hook, `#!/bin/sh\necho "${OUTPUT}"\nexit 1\n`, { mode: 0o755 });
  write(repo, "specs/PRIORITIES.md", `${read(repo)}\n- Global undo\n`);
  await renderPage("/git", repo);
  await click(await screen.findByRole("checkbox", { name: "specs/PRIORITIES.md" }));
  await waitFor(() => expect(staged(repo)).toBe("specs/PRIORITIES.md\n"));
  await type(screen.getByRole("textbox", { name: "Message" }), "chore: plan the undo");

  await click(screen.getByRole("button", { name: "Commit 1 file" }));

  await refreshUntil(() => expect(document.body.textContent).toContain(OUTPUT));
  expect(fieldText(screen.getByRole("textbox", { name: "Message" }))).toBe("chore: plan the undo");
  expect(staged(repo)).toBe("specs/PRIORITIES.md\n");

  writeFileSync(hook, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  await click(screen.getByRole("button", { name: "Commit 1 file" }));

  await waitFor(() => expect(git(repo, "log", "-1", "--format=%s")).toBe("chore: plan the undo\n"));
  write(repo, "specs/PRIORITIES.md", `${read(repo)}\n- Global redo\n`);
  await refreshUntil(() =>
    expect(fieldText(screen.getByRole("textbox", { name: "Message" }))).toBe(""),
  );
});

// Break: the field empty though a default is offered, `c` committing without the field, or Enter
// adding a line instead of committing.
test("`c` goes to the message, filled with the default, and Enter commits it", async () => {
  const repo = fixtureRepo();
  write(repo, "specs/PRIORITIES.md", `${read(repo)}\n- Global undo\n`);
  await renderPage("/git", repo);
  await click(await screen.findByRole("checkbox", { name: "specs/PRIORITIES.md" }));
  await waitFor(() => expect(staged(repo)).toBe("specs/PRIORITIES.md\n"));
  await refreshUntil(() => expect(fieldText(message())).toBe("chore: add Global undo"));

  await press(boxOf("specs/PRIORITIES.md"), "c");

  expect(document.activeElement).toBe(message());
  expect(git(repo, "log", "-1", "--format=%s")).not.toBe("chore: add Global undo\n");
  await type(message(), "chore: add Global undo now");
  await press(message(), "Enter");
  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s")).toBe("chore: add Global undo now\n"),
  );
});

// Break: Commit back in the pane's border, a second copy beside the one under the field, the
// boilerplate line under the field back, or Commit not saying what it commits.
test("one Commit, under the message, names the files it commits", async () => {
  const repo = fixtureRepo();
  write(repo, "specs/PRIORITIES.md", `${read(repo)}\n- Global undo\n`);
  await renderPage("/git", repo);
  const box = await screen.findByRole("checkbox", { name: "specs/PRIORITIES.md" });
  const none = screen.getByRole("button", { name: "Commit" });
  expect(
    none.getAttribute("aria-disabled") === "true" || (none as HTMLButtonElement).disabled,
  ).toBe(true);

  await click(box);

  const commit = await screen.findByRole("button", { name: "Commit 1 file" });
  expect(screen.getAllByRole("button", { name: /^Commit/ })).toHaveLength(1);
  // Under the field, after it in the page's order, and in no pane's title.
  expect(message().compareDocumentPosition(commit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(commit.closest("h2, h3, legend")).toBeNull();
  expect(screen.queryByText(/commits what is staged/)).toBeNull();
  await click(commit);
  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s")).toBe("chore: add Global undo\n"),
  );
});

// Break: `d` discarding at once, with no question, or Keep discarding too.
test("discard asks first, and only Discard restores the file", async () => {
  const repo = changedRepo();
  const changed = read(repo, "docs/web-ui.md");
  await renderPage("/git", repo);
  const box = await screen.findByRole("checkbox", { name: "docs/web-ui.md" });

  await press(box, "d");
  const asked = await screen.findByRole("dialog", {
    name: "Discard the changes to docs/web-ui.md?",
  });
  await click(within(asked).getByRole("button", { name: /^Keep\b/ }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(read(repo, "docs/web-ui.md")).toBe(changed);

  await press(boxOf("docs/web-ui.md"), "d");
  const again = await screen.findByRole("dialog", {
    name: "Discard the changes to docs/web-ui.md?",
  });
  await click(within(again).getByRole("button", { name: /^Discard\b/ }));

  await waitFor(() => expect(read(repo, "docs/web-ui.md")).toBe("# The web UI\n"));
});

// Review I1. Break: the editor drawn from its first read whatever the page lists, so after its row's
// "Use main" it keeps the old markers, and its save is refused as stale.
test("a conflict resolved from its row leaves the editor", async () => {
  const repo = stoppedMerge();
  await renderPage("/git?conflict=specs/PRIORITIES.md", repo);
  const field = await screen.findByRole("textbox", { name: "specs/PRIORITIES.md" });
  expect(fieldText(field)).toContain("<<<<<<< HEAD");

  // The row's "Use main", not the editor's bar's.
  const [row] = screen
    .getAllByRole("button", { name: "Use main" })
    .filter((button) => !button.closest(".cm-editor"));
  await click(row!);

  // Main's side is HEAD's: once taken, the file is no longer unmerged, and nothing is staged.
  await waitFor(() => expect(git(repo, "ls-files", "--unmerged")).toBe(""));
  expect(read(repo)).toMatch(/^Main's first line\n/);
  await refreshUntil(() =>
    expect(document.body.textContent).toContain("specs/PRIORITIES.md no longer conflicts."),
  );
  expect(screen.queryByRole("textbox", { name: "specs/PRIORITIES.md" })).toBeNull();
});

// Review I1. Break: the editor shown from the browser's copy of the file, read before it changed.
test("a conflict's editor reads the file afresh as it opens", async () => {
  const repo = stoppedMerge();
  await renderPage("/git?conflict=specs/PRIORITIES.md", repo);
  await screen.findByRole("textbox", { name: "specs/PRIORITIES.md" });
  await act(async () => navigate(atRepo("/priorities")));
  await waitFor(() =>
    expect(screen.queryByRole("textbox", { name: "specs/PRIORITIES.md" })).toBeNull(),
  );
  write(repo, "specs/PRIORITIES.md", `${read(repo)}- Typed elsewhere\n`);

  await act(async () => navigate(atRepo("/git?conflict=specs/PRIORITIES.md")));

  await waitFor(() =>
    expect(fieldText(screen.getByRole("textbox", { name: "specs/PRIORITIES.md" }))).toContain(
      "- Typed elsewhere",
    ),
  );
});

// Review (R30 pass). Break: Merge, and its `M`, left enabled while a merge is stopped, which the
// core refuses.
test("a stopped merge disables Merge and its key", async () => {
  const repo = stoppedMerge();
  await renderPage("/git", repo);
  const merge = await screen.findByRole("button", { name: "Merge into main…" });

  // Disabled, yet focusable through `aria-disabled`, as Astryx keeps a button with a tooltip.
  expect(merge.getAttribute("aria-disabled")).toBe("true");
  await click(merge);
  await act(async () => void fireEvent.keyDown(document.body, { key: "M", shiftKey: true }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

/** Whether the page draws `text`. */
const shows = (text: string) => expect(document.body.textContent).toContain(text);

// Review (diff cache). Break: a working tree's diff read from the cache, which nothing updates.
test("a working tree's diff reads the file afresh, open and opened again", async () => {
  const repo = changedRepo();
  await renderPage("/git?file=docs/web-ui.md", repo);
  await waitFor(() => shows("It draws the specs."));

  write(repo, "docs/web-ui.md", "# The web UI\n\nIt draws the specs.\n\nAnd the git.\n");
  await refreshUntil(() => shows("And the git."));

  await act(async () => navigate(atRepo("/priorities")));
  await waitFor(() => expect(document.body.textContent).not.toContain("And the git."));
  write(repo, "docs/web-ui.md", "# The web UI\n\nIt draws the specs.\n\nAnd the work.\n");
  await act(async () => navigate(atRepo("/git?file=docs/web-ui.md")));

  await waitFor(() => shows("And the work."));
});

// Break: the Enter key's icon on Commit on a phone, which hints no key, Commit being the tap (T3).
test("on the phone, Commit hints no key", async () => {
  const repo = fixtureRepo();
  write(repo, "specs/PRIORITIES.md", `${read(repo)}\n- Global undo\n`);
  const commitButton = async () => {
    await renderPage("/git", repo);
    await click(await screen.findByRole("checkbox", { name: "specs/PRIORITIES.md" }));
    return screen.findByRole("button", { name: "Commit 1 file" });
  };
  expect((await commitButton()).innerHTML).toContain("Enter");
  atWidth(402);
  try {
    expect((await commitButton()).innerHTML).not.toContain("Enter");
  } finally {
    atWidth(1440);
  }
});

// Break: git's header of the file, `--- a/` and `+++ b/`, drawn over the hunks again, or a hunk
// dropped with it.
test("a file's diff leaves out git's header of the file, and keeps its hunks", async () => {
  const repo = changedRepo();
  await renderPage("/git?file=docs/web-ui.md", repo);
  await waitFor(() => shows("It draws the specs."));

  shows("@@");
  const text = document.querySelector("[data-git-diff]")?.textContent ?? "";
  expect(text).not.toMatch(/--- a\/|\+\+\+ b\/|diff --git/);
});
