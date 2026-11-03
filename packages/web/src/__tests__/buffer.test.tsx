// A file opened as a buffer (US5): `Space b` on a page showing one file opens the whole file, its
// frontmatter included, and its save writes it on the file's branch, never committing it.
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import {
  atRepo,
  click,
  fieldText,
  fixtureRepo,
  git,
  quiet,
  renderPage,
  today,
  type,
} from "./helpers.tsx";

const FOLDER = "2026-10-06-recurring-tasks";
const PATH = `specs/${FOLDER}/spec.md`;

today("2026-10-11");

const press = (key: string) => fireEvent.keyDown(document.body, { key });

/** The checkout `branch` is in, from git's list of worktrees. */
function checkoutOf(repo: string, branch: string) {
  const entry = git(repo, "worktree", "list", "--porcelain")
    .split("\n\n")
    .find((lines) => lines.split("\n").includes(`branch refs/heads/${branch}`));
  return entry?.match(/^worktree (.*)$/m)?.[1];
}

// Breaks caught: the frontmatter dropped from the buffer's text; a save on the default branch, not
// the feature's; a save that commits.
test("Space b opens the page's file, frontmatter and all", async () => {
  const repo = fixtureRepo();
  await renderPage(`/f/${FOLDER}/spec.md`, repo);
  await screen.findByRole("button", { name: "Approve" });
  const before = git(repo, "rev-parse", FOLDER);

  await act(async () => {
    press(" ");
    press("b");
  });

  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/buffer/${PATH}`)));
  const field = await screen.findByRole("textbox", { name: PATH });
  const text = fieldText(field);
  expect(text.startsWith("---\n")).toBe(true);

  await type(field, `${text}\nA line typed in the buffer.\n`);
  await act(async () => void fireEvent.keyDown(field, { ctrlKey: true, key: "Enter" }));

  await waitFor(() => {
    const checkout = checkoutOf(repo, FOLDER);
    expect(checkout).toBeDefined();
    expect(readFileSync(join(checkout!, PATH), "utf8")).toContain("A line typed in the buffer.");
  });
  // The default branch has no such file: a save there would make it.
  expect(existsSync(join(repo, PATH))).toBe(false);
  expect(git(repo, "rev-parse", FOLDER)).toBe(before);
});

const PRIORITIES = "specs/PRIORITIES.md";

/** The buffer's field of the priorities. */
const prioritiesField = () => screen.findByRole("textbox", { name: PRIORITIES });

// Break caught: text kept unsaved in a buffer comes back with no notice saying so, and no way to
// drop it, though the file changed underneath and a save would replace that change.
test("a buffer's unsaved text comes back with its notice, and the file's change named", async () => {
  const repo = fixtureRepo();
  await renderPage(`/buffer/${PRIORITIES}`, repo);
  const field = await prioritiesField();
  const saved = fieldText(field);
  await type(field, `${saved}\n- Typed, never saved\n`);

  writeFileSync(join(repo, PRIORITIES), `${saved}\n- Changed elsewhere\n`);
  forgetUnsaved();
  await renderPage(`/buffer/${PRIORITIES}`, repo, { reload: true });

  expect(fieldText(await prioritiesField())).toContain("- Typed, never saved");
  expect(
    await screen.findByText(/^Unsaved text restored from \d\d:\d\d\. The file changed since/),
  ).toBeTruthy();
  await click(screen.getByRole("button", { name: "Discard" }));
  await waitFor(async () =>
    expect(fieldText(await prioritiesField())).toContain("Changed elsewhere"),
  );
  expect(screen.queryByText(/^Unsaved text restored from/)).toBeNull();
});

// Break caught: the conflict's banner stays once the text is the file's again, offering to copy
// text that is no longer there.
test("a buffer's conflict banner goes once nothing is unsaved", async () => {
  const repo = fixtureRepo();
  await renderPage(`/buffer/${PRIORITIES}`, repo);
  const field = await prioritiesField();
  const theirs = `${fieldText(field)}\n- Changed elsewhere\n`;
  writeFileSync(join(repo, PRIORITIES), theirs);

  await type(field, `${theirs}- Mine\n`);
  await act(async () => void fireEvent.keyDown(field, { ctrlKey: true, key: "Enter" }));
  expect(await screen.findByRole("button", { name: "Load the new version" })).toBeTruthy();

  await type(field, theirs);
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Load the new version" })).toBeNull(),
  );
});

// Break caught: `Space b` offered for a file that does not exist, opening a page that says so.
test("Space b is not offered for a file that does not exist", async () => {
  const repo = fixtureRepo();
  rmSync(join(repo, PRIORITIES));
  await renderPage("/priorities", repo);
  await quiet();

  await screen.findByRole("heading", { name: /Priorities/ });
  await act(async () => {
    press(" ");
    press("b");
  });
  await quiet();

  expect(window.location.pathname).toBe(atRepo("/priorities"));
});
