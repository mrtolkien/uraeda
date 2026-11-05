// Clean outside the Git page: a merged feature whose worktree is gone, its branch and its line of
// the priorities left, is cleaned from its feature page, where Enter presses Next's Clean, and from
// its row of the priorities, by `c` in its bar. Either asks first, then deletes the branch and
// removes the line, as `ura clean` does.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { atWidth, click, fixtureRepo, git, read, renderPage } from "./helpers.tsx";

const FOLDER = "2026-11-01-sweep";
const LINE = "Sweep the floor";

const PRIORITIES = `# Priorities

## Now

- [${LINE}](${FOLDER}/proposal.md)
- Other line

## Next

## Later
`;

const RECORD = [
  "---\nkind: feature\nfinished: 2026-11-02\n---\n\n# Record: Sweep the floor\n\n> [!NOTE]\n>\n> A record.\n",
  "## What and why\n\nSwept.\n",
  "## Behaviour\n\nIt works.\n",
  "## Design\n\nPlain.\n",
].join("\n");

/** Writes `files` in `repo` and commits them. */
function commit(repo: string, files: Record<string, string>, message: string) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(repo, path, ".."), { recursive: true });
    writeFileSync(join(repo, path), text);
  }
  git(repo, "add", "-A");
  git(repo, "commit", "--quiet", "--no-verify", "-m", message);
}

/**
 * A repository where the feature was finished on its branch and merged into `main`, its branch
 * kept, no worktree, and the priorities still listing it.
 */
function merged() {
  const repo = fixtureRepo();
  commit(
    repo,
    {
      [`specs/${FOLDER}/proposal.md`]: `# ${LINE}\n\nSweep it.\n`,
      "specs/PRIORITIES.md": PRIORITIES,
    },
    "feat: sweep",
  );
  git(repo, "switch", "--quiet", "-c", FOLDER);
  git(repo, "rm", "-r", "--quiet", `specs/${FOLDER}`);
  commit(repo, { [`specs/done/${FOLDER}.md`]: RECORD }, `finish(${FOLDER}): Sweep the floor`);
  git(repo, "switch", "--quiet", "main");
  git(repo, "merge", "--quiet", "--no-ff", "--no-edit", FOLDER);
  return repo;
}

/** Whether the feature's branch is still there. */
const hasBranch = (repo: string) => git(repo, "branch", "--list", FOLDER).trim() !== "";

/** Presses a key on an element, as a user's reaches the window. */
async function press(key: string, target: Element = document.body) {
  await act(async () => {
    fireEvent.keyDown(target, { key });
  });
}

/** The row of `line` on the priorities, selected by the keys, so that its bar shows. */
async function selectRow(line: RegExp) {
  const controlOf = () =>
    screen
      .getAllByRole("button", { name: line })
      .find((one) => one.closest("[data-row-link]") !== null) as HTMLElement;
  await screen.findAllByRole("button", { name: line });
  act(() => controlOf().focus());
  // Down and back up: the keys select the row, which shows its bar.
  await press("j", controlOf());
  await press("k", document.activeElement as HTMLElement);
  const control = controlOf();
  return { control, row: control.closest("[data-row]") as HTMLElement };
}

/** Confirms the question Clean asks. */
async function confirmClean() {
  const dialog = await screen.findByRole("dialog", { name: `Clean ${LINE}?` });
  await click(within(dialog).getByRole("button", { name: /^Clean\b/ }));
}

beforeEach(() => {
  atWidth(1440);
  forgetUnsaved();
});

test("Enter on a merged feature's page cleans its branch and its line of the priorities", async () => {
  const repo = merged();
  await renderPage(`/f/${FOLDER}`, repo);
  await screen.findByRole("button", { name: "Clean" });

  await press("Enter");
  await confirmClean();

  await waitFor(() => expect(hasBranch(repo)).toBe(false));
  await waitFor(() => expect(read(repo)).not.toContain(LINE));
  expect(read(repo)).toContain("- Other line");
  await waitFor(() => expect(screen.queryByRole("button", { name: "Clean" })).toBeNull());
});

test("c on a merged row of the priorities cleans it, from its bar", async () => {
  const repo = merged();
  await renderPage("/priorities", repo);
  const { control, row } = await selectRow(new RegExp(LINE));
  expect(within(row).getByRole("button", { name: "c clean" })).toBeTruthy();
  expect(within(row).queryByRole("button", { name: "d delete" })).toBeNull();

  await press("c", control);
  await confirmClean();

  await waitFor(() => expect(hasBranch(repo)).toBe(false));
  await waitFor(() => expect(read(repo)).not.toContain(LINE));
});

test("c does nothing on a line that is not merged", async () => {
  const repo = merged();
  await renderPage("/priorities", repo);
  const { control, row } = await selectRow(/Other line/);
  expect(within(row).queryByRole("button", { name: "c clean" })).toBeNull();

  await press("c", control);

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(hasBranch(repo)).toBe(true);
});
