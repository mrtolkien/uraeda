import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import {
  answered as readAnswered,
  answersSoFar,
  atWidth,
  fieldText,
  fixtureRepo,
  git,
  hold,
  renderPage,
  today,
  type,
} from "./helpers.tsx";

const FOLDER = "2026-10-11-web-ui";
const PAGE = `/f/${FOLDER}/clarifications-01.md`;
const ROUND = `specs/${FOLDER}/clarifications-01.md`;
today("2026-10-11");

/** The round's text: in the feature's worktree once written, else at the branch's tip. */
function text(repo: string) {
  const path = join(repo, ".worktrees", FOLDER, ROUND);
  return existsSync(path) ? readFileSync(path, "utf8") : git(repo, "show", `${FOLDER}:${ROUND}`);
}

/** A repository whose round has these answers written in the feature's worktree. */
function answered(answers: Record<string, string>) {
  const repo = fixtureRepo();
  git(repo, "worktree", "add", "--quiet", join(".worktrees", FOLDER), FOLDER);
  let round = text(repo);
  for (const [id, answer] of Object.entries(answers)) {
    const lines = round.split("\n");
    const heading = lines.findIndex((line) =>
      line.match(new RegExp(`^#{2,3} ${id.replace(".", String.raw`\.`)}:`)),
    );
    const at = lines.findIndex((line, index) => index > heading && line.startsWith("**Answer:**"));
    lines[at] = answer ? `**Answer:** ${answer}` : "**Answer:**";
    round = lines.join("\n");
  }
  writeFileSync(join(repo, ".worktrees", FOLDER, ROUND), round);
  return repo;
}

function question(id: string) {
  return document.getElementById(id) as HTMLElement;
}

/** The comment field's label, which says a comment alone answers. */
const COMMENT = "Comment, or your own answer instead of a letter";

/** The comment field of a question. */
function comment(id: string) {
  return within(question(id)).getByLabelText(COMMENT);
}

/** The button saving a question's comment, not its follow-ups'. */
function saveButton(id: string) {
  return within(question(id)).getAllByRole("button", { name: "Save comment" })[0];
}

async function tap(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

test("a comment being written is not replaced by an answer changed elsewhere", async () => {
  const repo = answered({});
  await renderPage(PAGE, repo);
  await screen.findByText("How does your iPhone reach the server?");
  await type(comment("Q2"), "half a tho");
  const path = join(repo, ".worktrees", FOLDER, ROUND);
  const lines = readFileSync(path, "utf8").split("\n");
  const heading = lines.findIndex((line) => line.startsWith("## Q2:"));
  const at = lines.findIndex((line, index) => index > heading && line.startsWith("**Answer:**"));
  lines[at] = "**Answer:** C";
  writeFileSync(path, lines.join("\n"));

  const from = answersSoFar();
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });

  // The page read the file again, with the answer changed elsewhere, and drew it.
  await readAnswered("WorkflowFile", from);
  expect(fieldText(comment("Q2"))).toBe("half a tho");
  expect(saveButton("Q2").hasAttribute("disabled")).toBe(false);
});

/** The round's single Commit, at its end, under its notes: not the app's way to the Git page. */
const commitButton = () =>
  within(document.getElementById("notes") as HTMLElement).getByRole("button", {
    name: "Commit answers",
  });

test("Commit saves a comment not saved yet", async () => {
  const repo = answered({ Q1: "A", Q2: "A", Q3: "A" });
  await renderPage(PAGE, repo);
  await screen.findByText("How does your iPhone reach the server?");

  await type(comment("Q2"), "unsaved");
  await tap(commitButton());

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s", FOLDER).trim()).toBe(
      "discovery(web-ui): answer round 01",
    ),
  );
  expect(git(repo, "show", `${FOLDER}:${ROUND}`)).toContain("**Answer:** A: unsaved");
});

/** Codex review: Commit stops when what was typed could not be saved. */
test("Commit stops when an answer could not be saved", async () => {
  const repo = answered({ Q1: "A", Q2: "A", Q3: "A" });
  await renderPage(PAGE, repo);
  await screen.findByText("How does your iPhone reach the server?");
  const path = join(repo, ".worktrees", FOLDER, ROUND);
  writeFileSync(path, readFileSync(path, "utf8").replace("**Answer:** A", "**Answer:** B"));

  await type(comment("Q1"), "mine");
  await tap(commitButton());

  expect(await screen.findByText(/Some answers were not saved/)).toBeTruthy();
  expect(git(repo, "log", "-1", "--format=%s", FOLDER).trim()).not.toBe(
    "discovery(web-ui): answer round 01",
  );
});

/** A question's answer line in the round's file, as written. */
function answerLine(repo: string, id: string) {
  const lines = text(repo).split("\n");
  const heading = lines.findIndex((line) => line.startsWith(`## ${id}:`));
  return lines.find((line, index) => index > heading && line.startsWith("**Answer:**"));
}

/** A key pressed where the focus is, as the keyboard sends it. */
async function press(key: string) {
  await act(async () => {
    fireEvent.keyDown(document.activeElement ?? document.body, { key });
  });
}

// Breaks: a letter that does nothing on a held card; a pick shown but not saved.
test("a held question's letter picks and saves its option, and unpicks it", async () => {
  const repo = answered({});
  await renderPage(PAGE, repo);
  await screen.findByText("Which repositories does the UI open now?");

  hold(question("Q3"));
  await press("b");
  await waitFor(() => expect(answerLine(repo, "Q3")).toBe("**Answer:** B"));

  await press("b");
  await waitFor(() => expect(answerLine(repo, "Q3")).toBe("**Answer:**"));
});

// Break: each card declared its keys from a hook always mounted: held from the next card, the one
// before declared its letters while the next still had them, and the registry threw "a key means
// two things".
test("the cursor moves back from a card to the one before, each declaring its keys alone", async () => {
  const repo = answered({});
  await renderPage(PAGE, repo);
  await screen.findByText("Which repositories does the UI open now?");

  hold(question("Q3"));
  hold(question("Q2"));
  await press("b");
  await waitFor(() => expect(answerLine(repo, "Q2")).toBe("**Answer:** B"));
});

/** The subject of the round's answers' commit. */
const ROUND_COMMIT = "discovery(web-ui): answer round 01";

/** The first point the fixture's round settled without the human, and the second. */
const COMMITS = "The actions' commits move into the core";
const WRITTEN = "An answer is written";

/** Opens "Under the hood", which holds the fixture's settled points, unless it is open. */
async function openHood() {
  const hood = await screen.findByRole("region", { name: "Under the hood" });
  const toggle = within(hood).getByRole("button", { name: /^Under the hood/ });
  if (toggle.getAttribute("aria-expanded") !== "true") {
    await tap(toggle);
  }
}

/** A settled point's toggle, named by its text, which starts with its bold subject. */
async function settledPoint(subject: string) {
  await openHood();
  return screen.findByRole("button", { name: new RegExp(`^${subject}`) });
}

/** The comment field of the settled point's form open. */
const settledField = () => screen.getByLabelText("Comment text");

/** A round answered, whose notes hold a comment on each settled point. */
function withTwoComments() {
  const repo = answered({ Q1: "A", Q2: "A", Q3: "A" });
  const path = join(repo, ".worktrees", FOLDER, ROUND);
  writeFileSync(
    path,
    readFileSync(path, "utf8").replace(
      /\*\*Notes:\*\*\n?$/,
      `**Notes:**\n\n- **${COMMITS}**: Undo comment.\n- **${WRITTEN}**: Delete comment.\n`,
    ),
  );
  return { path, repo };
}

/** A settled point's comment shown, by its subject. */
const settledComment = (subject: string) =>
  screen.getByRole("group", { name: `Your comment on "${subject}"` });

/** Edits a settled point's comment, then taps the other point: the edit stays unsaved. */
async function editThenLeave(subject: string, text: string, other: string) {
  await openHood();
  await tap(
    within(await waitFor(() => settledComment(subject))).getByRole("button", { name: "Edit" }),
  );
  await type(settledField(), text);
  await tap(await settledPoint(other));
}

/** The round's notes as committed by Commit. */
async function committedNotes(repo: string) {
  await tap(commitButton());
  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s", FOLDER).trim()).toBe(ROUND_COMMIT),
  );
  const committed = git(repo, "show", `${FOLDER}:${ROUND}`);
  return committed.slice(committed.indexOf("**Notes:**")).trimEnd();
}

/** Final review: an edit pending on a later comment follows it as a removal renumbers it. */
test("Commit writes the edit of a comment renumbered by a removal into that comment", async () => {
  const { repo } = withTwoComments();
  await renderPage(PAGE, repo);
  await editThenLeave(WRITTEN, "Edited delete comment.", COMMITS);

  await tap(within(settledComment(COMMITS)).getByRole("button", { name: "Remove" }));
  await waitFor(() =>
    expect(screen.queryByRole("group", { name: `Your comment on "${COMMITS}"` })).toBeNull(),
  );

  expect(await committedNotes(repo)).toBe(`**Notes:**\n\n- **${WRITTEN}**: Edited delete comment.`);
});

/** The sticky header of a question: the box holding its title. */
function stickyHead(id: string) {
  return document.getElementById(`${id}-title`)!.parentElement as HTMLElement;
}

// Break: on the phone, a question's header stuck over the comment being typed, which the keyboard
// leaves a third of the screen to (T3).
test("on the phone, a question's header lets go while its comment is typed in", async () => {
  atWidth(402);
  try {
    await renderPage(PAGE, fixtureRepo());
    const field = await waitFor(() => comment("Q1"));
    expect(getComputedStyle(stickyHead("Q1")).position).toBe("sticky");
    act(() => field.focus());
    await waitFor(() => expect(getComputedStyle(stickyHead("Q1")).position).toBe("static"));
    act(() => field.blur());
    await waitFor(() => expect(getComputedStyle(stickyHead("Q1")).position).toBe("sticky"));
  } finally {
    atWidth(1440);
  }
});
