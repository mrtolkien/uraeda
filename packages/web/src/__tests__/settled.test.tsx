// US4: comments on the points a round settled without the human, written at the end of its notes.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { atWidth, click, fixture, fixtureRepo, git, renderPage, today, type } from "./helpers.tsx";

const FOLDER = "2026-10-11-web-ui";
const PAGE = `/f/${FOLDER}/clarifications-01.md`;
const ROUND = `specs/${FOLDER}/clarifications-01.md`;
const SETTLED = "## Settled without the human";
const UNDO = "Undoing a completion";
const DELETE = "Deleting a repeating task";
const COMMENT = "Keep the undo, but say what it restored.";

today("2026-10-11");

/** The recurring-tasks example's settled points, as its answered round holds them. */
const recurringSettled = (() => {
  const round = readFileSync(
    fixture(
      "repo/branches/2026-10-06-recurring-tasks/specs/2026-10-06-recurring-tasks/clarifications-01.md",
    ),
    "utf8",
  );
  return round.slice(round.indexOf(SETTLED), round.indexOf("**Notes:**"));
})();

/** The round's file in the feature's worktree. */
const file = (repo: string) => join(repo, ".worktrees", FOLDER, ROUND);

/** The round's text on disk. */
const text = (repo: string) => readFileSync(file(repo), "utf8");

/** The notes on disk: what follows the `**Notes:**` marker, trimmed. */
function notesOnDisk(repo: string) {
  const all = text(repo);
  return all.slice(all.indexOf("**Notes:**") + "**Notes:**".length).trim();
}

/**
 * A repository whose round, in the feature's worktree, settles the recurring-tasks example's
 * points, with these notes and these answers.
 */
function round({ answers = {}, notes = "" }: { answers?: Record<string, string>; notes?: string }) {
  const repo = fixtureRepo();
  git(repo, "worktree", "add", "--quiet", join(".worktrees", FOLDER), FOLDER);
  let all = text(repo);
  all = `${all.slice(0, all.indexOf(SETTLED))}${recurringSettled}**Notes:**${notes ? ` ${notes}` : ""}\n`;
  for (const [id, answer] of Object.entries(answers)) {
    const lines = all.split("\n");
    const heading = lines.findIndex((line) => line.startsWith(`## ${id}:`));
    const at = lines.findIndex((line, index) => index > heading && line.startsWith("**Answer:**"));
    lines[at] = `**Answer:** ${answer}`;
    all = lines.join("\n");
  }
  writeFileSync(file(repo), all);
  return repo;
}

/** A settled point's toggle, named by its text, which starts with its bold subject. */
const point = (subject: string) => screen.findByRole("button", { name: new RegExp(`^${subject}`) });

/** The comments shown under a settled point. */
const commentsOn = (subject: string) =>
  screen.queryAllByRole("group", { name: `Your comment on "${subject}"` });

const commentField = () => screen.getByLabelText("Comment text") as HTMLTextAreaElement;
/** The open comment form's own button. */
const formButton = (name: string) =>
  within(commentField().closest("form") as HTMLElement).getByRole("button", { name });
const notesField = () => screen.getByLabelText("Notes") as HTMLTextAreaElement;

/** Taps a point, types a comment, and adds it. */
async function addComment(subject: string, comment: string) {
  await click(await point(subject));
  await type(commentField(), comment);
  await click(formButton("Add comment"));
}

/** US4 1 */
test("a comment on a settled point is written at the end of the notes, and shows under it", async () => {
  const repo = round({});
  await renderPage(PAGE, repo);

  await addComment(UNDO, COMMENT);

  await waitFor(() => expect(notesOnDisk(repo)).toBe(`- **${UNDO}**: ${COMMENT}`));
  await waitFor(() => expect(commentsOn(UNDO)).toHaveLength(1));
  const shown = commentsOn(UNDO)[0];
  expect(within(shown).getByText(COMMENT)).toBeTruthy();
  expect(within(shown).getByRole("button", { name: "Edit" })).toBeTruthy();
  expect(within(shown).getByRole("button", { name: "Remove" })).toBeTruthy();
  expect(screen.queryByLabelText("Comment text")).toBeNull();
});

/** US4 2 and 3 */
test("the notes field shows the free notes only, and saving it keeps the comments", async () => {
  const repo = round({ notes: `Overall fine.\n\n- **${UNDO}**: ${COMMENT}` });
  await renderPage(PAGE, repo);
  await point(UNDO);

  expect(notesField().value).toBe("Overall fine.");
  expect(commentsOn(UNDO)).toHaveLength(1);

  await type(notesField(), "Overall fine, icon bigger.");
  await click(screen.getByRole("button", { name: "Save notes" }));

  await waitFor(() =>
    expect(notesOnDisk(repo)).toBe(`Overall fine, icon bigger.\n\n- **${UNDO}**: ${COMMENT}`),
  );
});

/** US4 4 */
test("a comment edited is saved with Save comment", async () => {
  const repo = round({ notes: `- **${UNDO}**: ${COMMENT}` });
  await renderPage(PAGE, repo);
  await point(UNDO);

  await click(within(commentsOn(UNDO)[0]).getByRole("button", { name: "Edit" }));
  expect(commentField().value).toBe(COMMENT);
  expect(formButton("Save comment").hasAttribute("disabled")).toBe(true);
  await type(commentField(), "Keep the undo.");
  await click(formButton("Save comment"));

  await waitFor(() => expect(notesOnDisk(repo)).toBe(`- **${UNDO}**: Keep the undo.`));
  await waitFor(() => expect(screen.queryByLabelText("Comment text")).toBeNull());
  await waitFor(() => expect(within(commentsOn(UNDO)[0]).getByText("Keep the undo.")).toBeTruthy());
});

/** US4 5 */
test("a comment removed leaves the notes, and its point", async () => {
  const repo = round({ notes: `Overall fine.\n\n- **${UNDO}**: ${COMMENT}` });
  await renderPage(PAGE, repo);
  await point(UNDO);

  await click(within(commentsOn(UNDO)[0]).getByRole("button", { name: "Remove" }));

  await waitFor(() => expect(notesOnDisk(repo)).toBe("Overall fine."));
  await waitFor(() => expect(commentsOn(UNDO)).toHaveLength(0));
});

/** US4 6 */
test("a submitted round keeps its comments, shown read-only under their points", async () => {
  const repo = round({
    answers: { Q1: "A", Q2: "A", Q3: "A" },
    notes: `- **${UNDO}**: ${COMMENT}\n- **${DELETE}**: Ask first.`,
  });
  await renderPage(PAGE, repo);
  await point(UNDO);

  await click(screen.getByRole("button", { name: "Submit answers" }));

  await waitFor(() => expect(screen.getByText("Answered on 2026-10-11.")).toBeTruthy());
  const committed = git(repo, "show", `${FOLDER}:${ROUND}`);
  expect(committed).toContain(`- **${UNDO}**: ${COMMENT}\n- **${DELETE}**: Ask first.`);
  expect(within(commentsOn(UNDO)[0]).getByText(COMMENT)).toBeTruthy();
  expect(within(commentsOn(DELETE)[0]).getByText("Ask first.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  expect(screen.queryByRole("button", { name: new RegExp(`^${UNDO}`) })).toBeNull();
});

/** US4 7 */
test("adding a comment leaves the notes being typed unsaved", async () => {
  const repo = round({});
  await renderPage(PAGE, repo);
  await point(UNDO);
  await type(notesField(), "Half a thought");

  await addComment(UNDO, COMMENT);

  await waitFor(() => expect(notesOnDisk(repo)).toBe(`- **${UNDO}**: ${COMMENT}`));
  await waitFor(() => expect(commentsOn(UNDO)).toHaveLength(1));
  expect(notesField().value).toBe("Half a thought");
  expect(screen.getByText("Unsaved changes")).toBeTruthy();
});

/** US4 8 */
test("a comment of two lines is written indented, and reads back the same", async () => {
  const repo = round({});
  await renderPage(PAGE, repo);

  await addComment(UNDO, "Keep the undo.\nAlso for deletes.");

  await waitFor(() =>
    expect(notesOnDisk(repo)).toBe(`- **${UNDO}**: Keep the undo.\n  Also for deletes.`),
  );
  await waitFor(() => expect(commentsOn(UNDO)).toHaveLength(1));
  await click(within(commentsOn(UNDO)[0]).getByRole("button", { name: "Edit" }));
  expect(commentField().value).toBe("Keep the undo.\nAlso for deletes.");
});

/** US5 7 */
test("Cancel on a comment typed asks first", async () => {
  await renderPage(PAGE, round({}));
  await click(await point(UNDO));
  await type(commentField(), "Too vague");

  await click(formButton("Cancel"));
  const dialog = await screen.findByRole("dialog", { name: "Discard your comment?" });
  await click(within(dialog).getByRole("button", { name: "Keep editing" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(commentField().value).toBe("Too vague");

  await click(formButton("Cancel"));
  await click(
    within(await screen.findByRole("dialog", { name: "Discard your comment?" })).getByRole(
      "button",
      { name: "Discard" },
    ),
  );
  await waitFor(() => expect(screen.queryByLabelText("Comment text")).toBeNull());
  await click(await point(UNDO));
  expect(commentField().value).toBe("");
});

/** US5 8 */
test("Cancel on an empty comment closes it without asking", async () => {
  await renderPage(PAGE, round({}));
  await click(await point(UNDO));

  await click(formButton("Cancel"));

  expect(screen.queryByRole("dialog")).toBeNull();
  await waitFor(() => expect(screen.queryByLabelText("Comment text")).toBeNull());
});

/** The spec's edge case: the point left the round while its comment was typed. */
test("a comment on a point no longer in the round is refused, its text kept", async () => {
  const repo = round({});
  await renderPage(PAGE, repo);
  await click(await point("Skipping one occurrence"));
  await type(commentField(), "Fine.");
  writeFileSync(
    file(repo),
    text(repo).replace(/- \*\*Skipping one occurrence\*\*[^]*?(?=\n- \*\*)/, ""),
  );

  await click(formButton("Add comment"));

  expect(await screen.findByText("That point is no longer in the round.")).toBeTruthy();
  expect(commentField().value).toBe("Fine.");
  expect(notesOnDisk(repo)).toBe("");
});

/** US5 1, on a settled point: its form opens again with its text, and the notice. */
test("a comment typed on a settled point is restored after a reload", async () => {
  const repo = round({});
  await renderPage(PAGE, repo);
  await click(await point(UNDO));
  await type(commentField(), "Half typed");

  forgetUnsaved();
  await renderPage(PAGE, repo, { reload: true });

  await point(UNDO);
  expect(commentField().value).toBe("Half typed");
  expect(screen.getByText("Unsaved text restored from", { exact: false })).toBeTruthy();
});

/** The UI layout decision: on the phone, the form is in a sheet, with Close. */
test("on the phone, a settled point's comment is written in a sheet", async () => {
  atWidth(402);
  const repo = round({});
  await renderPage(PAGE, repo);

  await click(await point(UNDO));

  const sheet = await screen.findByRole("dialog", { name: "Comment" });
  expect(within(sheet).getByText(`On "${UNDO}"`)).toBeTruthy();
  expect(within(sheet).getByRole("button", { name: "Close" })).toBeTruthy();
  await type(within(sheet).getByLabelText("Comment text"), COMMENT);
  await click(within(sheet).getByRole("button", { name: "Add comment" }));
  await waitFor(() => expect(notesOnDisk(repo)).toBe(`- **${UNDO}**: ${COMMENT}`));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Comment" })).toBeNull());
});
