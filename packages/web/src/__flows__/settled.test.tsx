// Flow: comments on the points a round settled without the human. A comment is written at the end
// of the round's notes only when added, kept as unsaved text until then, and shown under its point;
// a point that left the round refuses it. Each test comments on a round of its own.
import { readFileSync } from "node:fs";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { fixture, git } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { PHONE, atWidth, click, fixtureRepo, refreshUntil, startApp, type } from "./harness.tsx";
import { addRound, checkOut, editElsewhere, roundNow, withAnswers } from "./rounds.ts";

const SETTLED = "## Settled without the human";
const UNDO = "Undoing a completion";
const DELETE = "Deleting a repeating task";
const COMMENT = "Keep the undo, but say what it restored.";
const FOLDERS = {
  add: "2026-10-22-add",
  edit: "2026-10-22-edit",
  gone: "2026-10-22-gone",
  phone: "2026-10-22-phone",
  restore: "2026-10-22-restore",
  submit: "2026-10-22-submit",
};

/** The recurring-tasks example's settled points, as its answered round holds them. */
const settled = (() => {
  const round = readFileSync(
    fixture(
      "repo/branches/2026-10-06-recurring-tasks/specs/2026-10-06-recurring-tasks/clarifications-01.md",
    ),
    "utf8",
  );
  return round.slice(round.indexOf(SETTLED), round.indexOf("**Notes:**"));
})();

/** The web UI's round with these settled points, and these notes. */
function withSettled(notes = "") {
  return (round: string) =>
    `${round.slice(0, round.indexOf(SETTLED))}${settled}**Notes:**${notes ? ` ${notes}` : ""}\n`;
}

const app = startApp({
  repo: () => {
    const repo = fixtureRepo();
    addRound(repo, FOLDERS.add, {}, withSettled());
    addRound(repo, FOLDERS.edit, {}, withSettled(`- **${UNDO}**: ${COMMENT}`));
    addRound(repo, FOLDERS.gone, {}, withSettled());
    addRound(repo, FOLDERS.phone, {}, withSettled());
    addRound(repo, FOLDERS.restore, {}, withSettled());
    addRound(repo, FOLDERS.submit, {}, (round) =>
      withAnswers(withSettled(`- **${UNDO}**: ${COMMENT}\n- **${DELETE}**: Ask first.`)(round), {
        Q1: "A",
        Q2: "A",
        Q3: "A",
      }),
    );
    checkOut(repo, FOLDERS.gone);
    return repo;
  },
});

const page = (folder: string) => `/f/${folder}/clarifications-01.md`;

/** The notes on disk: what follows the `**Notes:**` marker, trimmed. */
function notesOnDisk(folder: string) {
  const all = roundNow(app.repo, folder);
  return all.slice(all.indexOf("**Notes:**") + "**Notes:**".length).trim();
}

/** A settled point's toggle, named by its text, which starts with its bold subject. */
const point = (subject: string) => screen.findByRole("button", { name: new RegExp(`^${subject}`) });

/** The comments shown under a settled point. */
const commentsOn = (subject: string) =>
  screen.queryAllByRole("group", { name: `Your comment on "${subject}"` });

/** The open comment form's text box: the only one inside a form. */
const field = () =>
  screen.getAllByRole("textbox").find((box) => box.closest("form")) as HTMLTextAreaElement;

/** A button of the open comment form, by its action. */
const formButton = (name: string) =>
  within(field().closest("form") as HTMLElement).getByRole("button", { name });

async function open(folder: string) {
  await app.open(page(folder));
  await point(UNDO);
}

test("a comment on a point is written at the end of the notes only when added, and shows under its point", async () => {
  await open(FOLDERS.add);
  await click(await point(UNDO));
  await type(field(), COMMENT);

  // Typed, not added: nothing is written, and the point shows no comment yet.
  expect(notesOnDisk(FOLDERS.add)).toBe("");
  expect(commentsOn(UNDO)).toHaveLength(0);
  await click(formButton("Add comment"));

  await waitFor(() => expect(notesOnDisk(FOLDERS.add)).toBe(`- **${UNDO}**: ${COMMENT}`));
  await waitFor(() => expect(commentsOn(UNDO)).toHaveLength(1));
  const shown = within(commentsOn(UNDO)[0]);
  expect(shown.getByText(COMMENT)).toBeTruthy();
  // The comment can be changed or taken away, and the form is gone.
  expect(shown.getByRole("button", { name: "Edit" })).toBeTruthy();
  expect(shown.getByRole("button", { name: "Remove" })).toBeTruthy();
  expect(screen.getAllByRole("textbox").some((box) => box.closest("form"))).toBe(false);
});

test("a comment is edited with an explicit save, and removed from the notes with its point's mark", async () => {
  await open(FOLDERS.edit);

  await click(within(commentsOn(UNDO)[0]).getByRole("button", { name: "Edit" }));
  expect(field().value).toBe(COMMENT);
  // Nothing changed: the form's Save is disabled.
  expect(formButton("Save comment").hasAttribute("disabled")).toBe(true);
  await type(field(), "Keep the undo.");
  expect(notesOnDisk(FOLDERS.edit)).toBe(`- **${UNDO}**: ${COMMENT}`);
  await click(formButton("Save comment"));
  await waitFor(() => expect(notesOnDisk(FOLDERS.edit)).toBe(`- **${UNDO}**: Keep the undo.`));

  await waitFor(() => expect(within(commentsOn(UNDO)[0]).getByText("Keep the undo.")).toBeTruthy());
  await click(within(commentsOn(UNDO)[0]).getByRole("button", { name: "Remove" }));
  await waitFor(() => expect(notesOnDisk(FOLDERS.edit)).toBe(""));
  await waitFor(() => expect(commentsOn(UNDO)).toHaveLength(0));
});

test("a comment typed is kept across a reload, and cancelling it asks first", async () => {
  await open(FOLDERS.restore);
  await click(await point(UNDO));
  await type(field(), "Half a thought");

  forgetUnsaved();
  await app.open(page(FOLDERS.restore), { reload: true });

  // The form opens again with the text, and the file was never written.
  await waitFor(() => expect(field().value).toBe("Half a thought"));
  expect(notesOnDisk(FOLDERS.restore)).toBe("");
  await click(formButton("Cancel"));
  // Never dropped without asking: a confirmation, which can keep the text.
  const dialog = await screen.findByRole("dialog");
  const buttons = within(dialog).getAllByRole("button");
  await click(buttons[0]);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(field().value).toBe("Half a thought");
});

test("a comment on a point that left the round is refused, its text kept", async () => {
  await open(FOLDERS.gone);
  await click(await point(UNDO));
  await type(field(), COMMENT);
  editElsewhere(app.repo, FOLDERS.gone, (round) =>
    round.replace(`**${UNDO}**`, "**Another point**"),
  );

  await act(async () => {
    fireEvent.keyDown(field(), { ctrlKey: true, key: "Enter" });
  });

  await waitFor(() => expect(field().value).toBe(COMMENT));
  expect(notesOnDisk(FOLDERS.gone)).not.toContain(COMMENT);
  await refreshUntil(() => expect(field().value).toBe(COMMENT));
});

test("on the phone the comment form is a sheet", async () => {
  atWidth(PHONE);
  await open(FOLDERS.phone);

  await click(await point(UNDO));

  const sheet = await screen.findByRole("dialog");
  expect(within(sheet).getAllByRole("textbox")).toHaveLength(1);
});

test("a submitted round keeps its comments, read-only under their points", async () => {
  await open(FOLDERS.submit);

  await click(screen.getByRole("button", { name: "Submit answers" }));

  await waitFor(() =>
    expect(
      git(app.repo, "show", `${FOLDERS.submit}:specs/${FOLDERS.submit}/clarifications-01.md`),
    ).toContain(`- **${UNDO}**: ${COMMENT}\n- **${DELETE}**: Ask first.`),
  );
  await waitFor(() => expect(screen.queryByRole("button", { name: "Edit" })).toBeNull());
  expect(within(commentsOn(UNDO)[0]).getByText(COMMENT)).toBeTruthy();
  expect(within(commentsOn(DELETE)[0]).getByText("Ask first.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
});
