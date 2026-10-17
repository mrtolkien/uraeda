// US4: comments on the points a round settled without the human, written at the end of its notes.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import {
  atWidth,
  click,
  fixture,
  fixtureRepo,
  git,
  renderPage,
  serverFetch,
  today,
  type,
} from "./helpers.tsx";

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

/** The round mockup's settled points: 2 to check, 3 of behaviour, and 2 under the hood. */
const groupedSettled = (() => {
  const round = readFileSync(fixture("round-mockup/clarifications-01.md"), "utf8");
  return round.slice(round.indexOf(SETTLED), round.indexOf("**Notes:**"));
})();
const HOOD = "Next dates are computed by date-fns";

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
function round({
  answers = {},
  notes = "",
  settled = recurringSettled,
}: {
  answers?: Record<string, string>;
  notes?: string;
  settled?: string;
}) {
  const repo = fixtureRepo();
  git(repo, "worktree", "add", "--quiet", join(".worktrees", FOLDER), FOLDER);
  let all = text(repo);
  all = `${all.slice(0, all.indexOf(SETTLED))}${settled}**Notes:**${notes ? ` ${notes}` : ""}\n`;
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
const notesField = () => screen.getByLabelText("Anything else") as HTMLTextAreaElement;

/** Taps a point, types a comment, and adds it. */
async function addComment(subject: string, comment: string) {
  await click(await point(subject));
  await type(commentField(), comment);
  await click(formButton("Add comment"));
}

/**
 * What comes right before the settled section in the page: the section is the page's child that
 * holds "Settled without you", and its siblings hold the questions.
 */
function beforeSettled() {
  let section: HTMLElement = screen.getByRole("heading", { level: 2, name: "Settled without you" });
  while (section.parentElement && !section.parentElement.querySelector("#Q1")) {
    section = section.parentElement;
  }
  return section.previousElementSibling as HTMLElement;
}

/** The spec's SettledGroups: a card on a wide screen, after the questions with no band. */
test("on a wide screen, the settled card follows the questions without a band", async () => {
  atWidth(1440);
  await renderPage(PAGE, round({ settled: groupedSettled }));
  await point(UNDO);

  expect(beforeSettled().querySelector("#Q3")).toBeTruthy();
});

/** The spec's SettledGroups: on the phone, a band, then the points with no card. */
test("on the phone, a band comes before the settled points", async () => {
  atWidth(402);
  await renderPage(PAGE, round({ settled: groupedSettled }));
  await point(UNDO);

  const band = beforeSettled();
  expect(band.querySelector("#Q3")).toBeNull();
  expect(band.childElementCount).toBe(0);
  expect(band.textContent).toBe("");
});

/** Redesign US4.1: the groups, "Under the hood" folded with the count of its points. */
test("the settled points show in their groups, Under the hood folded", async () => {
  await renderPage(PAGE, round({ settled: groupedSettled }));
  await point(UNDO);

  expect(screen.getByRole("heading", { level: 2, name: "Settled without you" })).toBeTruthy();
  const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
  expect(
    headings.filter((h) => ["Check these", "Behaviour", "Under the hood"].includes(h ?? "")),
  ).toEqual(["Check these", "Behaviour", "Under the hood"]);
  expect(await point("A task without a due date")).toBeTruthy();
  expect(await point("Repeating tasks show a repeat icon")).toBeTruthy();
  expect(screen.queryByRole("button", { name: new RegExp(`^${HOOD}`) })).toBeNull();
  expect(screen.getByRole("button", { name: "Show the 2 points" })).toBeTruthy();
});

/** Redesign US4.2: "Under the hood" open stays open after a reload, Fold closing it. */
test("Under the hood opened stays open after a reload", async () => {
  const repo = round({ settled: groupedSettled });
  await renderPage(PAGE, repo);
  await click(await screen.findByRole("button", { name: "Show the 2 points" }));
  expect(await point(HOOD)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Fold" })).toBeTruthy();

  await renderPage(PAGE, repo, { reload: true });

  expect(await point(HOOD)).toBeTruthy();
  await click(screen.getByRole("button", { name: "Fold" }));
  expect(screen.queryByRole("button", { name: new RegExp(`^${HOOD}`) })).toBeNull();
  expect(screen.getByRole("button", { name: "Show the 2 points" })).toBeTruthy();
});

/** Redesign review focus 6: an answer saved reads the round again, the fold kept open. */
test("Under the hood stays open when an answer is saved", async () => {
  const repo = round({ settled: groupedSettled });
  await renderPage(PAGE, repo);
  await click(await screen.findByRole("button", { name: "Show the 2 points" }));
  await point(HOOD);

  const q2 = document.getElementById("Q2") as HTMLElement;
  await click(within(q2).getByRole("checkbox", { name: /^Option A\b/ }));
  await waitFor(() => expect(text(repo)).toContain("**Answer:** A"));
  await waitFor(() => expect(within(q2).getByText("saved ✓")).toBeTruthy());

  expect(await point(HOOD)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Fold" })).toBeTruthy();
});

/** Redesign US4.3: a point under the hood takes a comment, as every point does. */
test("a comment on a point under the hood is written at the end of the notes", async () => {
  const repo = round({ settled: groupedSettled });
  await renderPage(PAGE, repo);
  await click(await screen.findByRole("button", { name: "Show the 2 points" }));

  await addComment(HOOD, "Use Temporal instead");

  await waitFor(() => expect(notesOnDisk(repo)).toBe(`- **${HOOD}**: Use Temporal instead`));
});

/** Redesign US4.4: the notes are "Anything else" on the page, `**Notes:**` in the file. */
test("the notes field is labelled Anything else", async () => {
  await renderPage(PAGE, round({}));
  await point(UNDO);

  expect(notesField()).toBeTruthy();
  expect(screen.queryByLabelText("Notes")).toBeNull();
});

/** Redesign edge case: a round with an empty group shows only the groups present. */
test("a group the round leaves out is not drawn", async () => {
  await renderPage(PAGE, round({}));
  await point(UNDO);

  expect(screen.getByRole("heading", { level: 3, name: "Check these" })).toBeTruthy();
  expect(screen.getByRole("heading", { level: 3, name: "Behaviour" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Under the hood" })).toBeNull();
  expect(screen.queryByRole("button", { name: /^Show the/ })).toBeNull();
});

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

/** The spec's Ctrl+Enter, or Cmd+Enter, which saves every multi-line field. */
test.each([
  ["Ctrl", { ctrlKey: true }],
  ["Cmd", { metaKey: true }],
])("%s+Enter in a settled point's comment adds it", async (_, keys) => {
  const repo = round({});
  await renderPage(PAGE, repo);
  await click(await point(UNDO));
  await type(commentField(), COMMENT);

  await act(async () => {
    fireEvent.keyDown(commentField(), { ...keys, key: "Enter" });
  });

  await waitFor(() => expect(notesOnDisk(repo)).toBe(`- **${UNDO}**: ${COMMENT}`));
});

/** Second review: Ctrl+Enter while Add comment's write is under way sends nothing again. */
test("Ctrl+Enter during Add comment adds the comment once", async () => {
  const repo = round({});
  const server = serverFetch(repo);
  const sent: Array<string> = [];
  const waiting: Array<() => void> = [];
  const fetch = (async (input, init) => {
    const body = typeof init?.body === "string" ? init.body : "";
    if (body.includes(`"text":"${COMMENT}"`)) {
      sent.push(body);
      if (sent.length === 1) {
        await new Promise<void>((resolve) => waiting.push(resolve));
      }
    }
    return server(input, init);
  }) as typeof globalThis.fetch;
  await renderPage(PAGE, repo, { fetch });
  await click(await point(UNDO));
  await type(commentField(), COMMENT);
  await click(formButton("Add comment"));
  await waitFor(() => expect(waiting).toHaveLength(1));

  await act(async () => {
    fireEvent.keyDown(commentField(), { ctrlKey: true, key: "Enter" });
  });
  await act(async () => waiting.shift()!());

  await waitFor(() => expect(commentsOn(UNDO)).toHaveLength(1));
  expect(sent).toHaveLength(1);
  expect(notesOnDisk(repo)).toBe(`- **${UNDO}**: ${COMMENT}`);
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
