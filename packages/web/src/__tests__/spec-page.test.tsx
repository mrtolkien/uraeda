import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { addSpecFeature, commitOnBranch, SPEC_FEATURE } from "uraeda-binding/test-utils";
import { beforeEach, expect, test } from "vite-plus/test";
import { atWidth, fixtureRepo, git, renderPage } from "./helpers.tsx";

const PAGE = `/f/${SPEC_FEATURE}/spec.md`;
const SPEC = `specs/${SPEC_FEATURE}/spec.md`;
const REVIEW = `specs/${SPEC_FEATURE}/spec-review.md`;

beforeEach(() => {
  window.localStorage.clear();
  atWidth(1440);
});

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

/**
 * Whether an element is folded away: inside the region a closed trigger controls, which a screen
 * reader skips and the browser does not draw (the browser tests check what shows).
 */
function folded(element: Element) {
  return [...document.querySelectorAll("[aria-expanded='false'][aria-controls]")].some((trigger) =>
    document.getElementById(trigger.getAttribute("aria-controls") ?? "")?.contains(element),
  );
}

/** A part of the page, a region named by its title, once drawn. */
const region = (name: string) => screen.findByRole("region", { name });

/** "Contents", once drawn. */
const contents = () => screen.findByRole("complementary", { name: "Contents" });

/** The entries of "Contents", by the text of their links. */
function entriesOf(column: HTMLElement) {
  return within(column)
    .getAllByRole("link")
    .map((link) => link.textContent);
}

/** The line of the spec holding a phrase, on the feature's branch. */
function lineOf(repo: string, phrase: string) {
  const lines = git(repo, "show", `${SPEC_FEATURE}:${SPEC}`).split("\n");
  return lines.findIndex((line) => line.includes(phrase)) + 1;
}

/** A pending review, on the spec at its branch's tip, with one comment per given line. */
function pendingReview(repo: string, lines: ReadonlyArray<number>) {
  const tip = git(repo, "rev-parse", "--short=7", SPEC_FEATURE).trim();
  const comments = lines.map(
    (line, index) => `## C${index + 1}: Line ${line}, under "Somewhere"\n\n> Quoted.\n\nWhy?\n`,
  );
  commitOnBranch(repo, SPEC_FEATURE, {
    [REVIEW]: `---\nverdict: pending\ncommit: ${tip}\n---\n\n# Review: Spec, Recurring tasks\n\n${comments.join("\n")}`,
  });
}

/** US5 1 */
test("the contents list every part, decision, and story", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const column = await contents();
  expect(entriesOf(column)).toEqual([
    "What you approve",
    "Your review, answered",
    "Decisions",
    "Repeating tasks",
    "Task storage",
    "Task history",
    "Due dates",
    "What changes for users",
    "US1 Make a task repeat",
    "US2 Complete a repeating task",
    "US3 Repeat on a custom schedule",
    "US4 Type a repeat in the title",
    "Data",
    "Architecture",
    "Edge cases",
    "Success criteria",
    "Assumptions",
  ]);
  // The verdict is at the page's end, not in the column.
  expect(within(column).queryByRole("button", { name: "Approve" })).toBeNull();
  expect(screen.getAllByRole("button", { name: "Approve" })).toHaveLength(1);
});

/** On a tablet, 420 px of "Contents" would leave the page under 350 px: it starts hidden. */
test("on a window under 1100 px wide, the contents start hidden, until you show them", async () => {
  atWidth(800);
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  await region("What you approve");
  expect(screen.queryByRole("complementary", { name: "Contents" })).toBeNull();
  await click(screen.getByRole("button", { name: "Show contents" }));
  expect(await contents()).toBeTruthy();
});

test("a window of 1100 px shows the contents at first, and keeps your choice", async () => {
  atWidth(1100);
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);
  expect(await contents()).toBeTruthy();
  await click(screen.getByRole("button", { name: "Hide contents" }));
  expect(window.localStorage.getItem("uraeda.specContents")).toBe("hidden");
});

/** US5 more 1 */
test("a part's pending comments are counted in the contents", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  const journey = lineOf(repo, "In a task's edit panel, a repeat menu offers");
  const scenario = lineOf(repo, 'the user picks "never"');
  const criterion = lineOf(repo, "**SC-001**");
  pendingReview(repo, [journey, scenario, criterion]);
  await renderPage(PAGE, repo);

  const column = await contents();
  expect(
    within(column).getByRole("link", { name: "US1 Make a task repeat 2 comments" }),
  ).toBeTruthy();
  expect(within(column).getByRole("link", { name: "Success criteria 1 comment" })).toBeTruthy();
  expect(within(column).getByRole("link", { name: "What changes for users" })).toBeTruthy();
  expect(within(column).getByRole("link", { name: "US2 Complete a repeating task" })).toBeTruthy();
});

/** A comment on the paragraph that opens the stories' section counts for that section. */
test("a pending comment on the stories' intro is counted on their section", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  const spec = git(repo, "show", `${SPEC_FEATURE}:${SPEC}`);
  commitOnBranch(repo, SPEC_FEATURE, {
    [SPEC]: spec.replace(
      "## User stories\n\n",
      "## User stories\n\nThe stories share one menu.\n\n",
    ),
  });
  pendingReview(repo, [lineOf(repo, "The stories share one menu.")]);
  await renderPage(PAGE, repo);

  const column = await contents();
  expect(
    within(column).getByRole("link", { name: "What changes for users 1 comment" }),
  ).toBeTruthy();
});

/** A level-2 section the page does not know is drawn as written, with its entry in the contents. */
test("a section the page does not know is drawn, and listed in the contents", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  const spec = git(repo, "show", `${SPEC_FEATURE}:${SPEC}`);
  commitOnBranch(repo, SPEC_FEATURE, {
    [SPEC]: spec.replace("## History", "## Rollout\n\nShip it behind a flag first.\n\n## History"),
  });
  await renderPage(PAGE, repo);

  expect(await screen.findByRole("heading", { level: 2, name: "Rollout" })).toBeTruthy();
  expect(screen.getByText("Ship it behind a flag first.")).toBeTruthy();
  const entries = entriesOf(await contents());
  expect(entries.at(-1)).toBe("Rollout");
  expect(entries.at(-2)).toBe("Assumptions");
});

/** What comes right before "Your review, answered" in the page. */
const beforeAnswers = async () =>
  (await region("Your review, answered")).previousElementSibling as HTMLElement;

/** On the phone, a band, empty, sets the answers apart from what you approve, as it does the groups. */
test("on the phone, a band comes between what you approve and the answers", async () => {
  atWidth(402);
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const band = await beforeAnswers();
  expect(band.childElementCount).toBe(0);
  expect(band.textContent).toBe("");
});

test("on a wide screen, the answers follow what you approve without a band", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const before = await beforeAnswers();
  expect(before.textContent).not.toBe("");
});

/** A decision comment is counted on its decision, never on the spec's block at the same lines. */
test("a decision's pending comment is counted on the decision alone", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  const tip = git(repo, "rev-parse", "--short=7", SPEC_FEATURE).trim();
  const comment = [
    '## C1: Decision task-storage, lines 19–20, under "Rules"',
    "",
    "> - An upgrade that cannot read a saved value MUST clear it and log it, and MUST NOT delete a task.",
    ">   Checked by the upgrade's test on corrupted data.",
    "",
    "Log it where I can see it.",
    "",
  ].join("\n");
  commitOnBranch(repo, SPEC_FEATURE, {
    [REVIEW]: `---\nverdict: pending\ncommit: ${tip}\n---\n\n# Review: Spec, Recurring tasks\n\n${comment}`,
  });
  await renderPage(PAGE, repo);

  const column = await contents();
  await waitFor(() =>
    expect(entriesOf(column).filter((label) => label?.includes("comment"))).toEqual([
      "Task storage 1 comment",
    ]),
  );
});

/** US5 more 2 */
test("hidden contents stay hidden after a reload, with the verdict at the page's end", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);
  await contents();

  await act(async () => {
    fireEvent.keyDown(document.body, { code: "BracketRight", key: "]" });
  });
  await waitFor(() => expect(screen.queryByRole("complementary", { name: "Contents" })).toBeNull());
  cleanup();
  await renderPage(PAGE, repo);

  await region("What you approve");
  expect(screen.queryByRole("complementary", { name: "Contents" })).toBeNull();
  expect(screen.getByRole("button", { name: "Show contents" })).toBeTruthy();
  const approve = screen.getByRole("button", { name: "Approve" });
  const end = screen.getByRole("heading", { name: "Your review" });
  expect(end.compareDocumentPosition(approve) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole("button", { name: "Request changes" })).toBeTruthy();
});

/** US4 1 */
test("your review comes back answered", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const card = await region("Your review, answered");
  expect(card.textContent).toContain("so for 3 seconds, with an undo button.");
  expect(card.textContent).toContain("3 seconds is too short to reach the button.");
  expect(within(card).getAllByText("done")).toHaveLength(2);
  expect(within(card).getByText("declined")).toBeTruthy();
  expect(card.textContent).toContain("The undo now stays 5 seconds, in the task row.");
});

/** The page drops no text: an item the core does not read, beside those it does, still shows. */
test("a review item and a decision item the core cannot read show beside the ones it reads", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  const spec = git(repo, "show", `${SPEC_FEATURE}:${SPEC}`);
  commitOnBranch(repo, SPEC_FEATURE, {
    [SPEC]: spec
      .replace(
        "- **C1** (add weekends)",
        "- Done.\n- C4 (a nightly sync): declined. No sync.\n- **C1** (add weekends)",
      )
      .replace(
        "- **New: [Repeating tasks]",
        "- **New: [[due-dates]]**. Dates are calendar days.\n- **New: [Repeating tasks]",
      ),
  });
  await renderPage(PAGE, repo);

  const answers = await region("Your review, answered");
  expect(answers.textContent).toContain("Done.");
  expect(answers.textContent).toContain("C4 (a nightly sync): declined. No sync.");
  // They take a comment as the spec's other lines do.
  expect(within(answers).getByRole("button", { name: /^Done\./ })).toBeTruthy();
  expect(within(answers).getAllByText("done")).toHaveLength(2);
  expect(await screen.findByText(/Dates are calendar days\./)).toBeTruthy();
  expect(screen.getByRole("button", { name: /Dates are calendar days/ })).toBeTruthy();
  expect(screen.getByText(/A repeating task is one task/)).toBeTruthy();
});

/** A review section whose every item the core cannot read still shows, as written. */
test("a review section of only unreadable items is still drawn", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  const spec = git(repo, "show", `${SPEC_FEATURE}:${SPEC}`);
  commitOnBranch(repo, SPEC_FEATURE, {
    [SPEC]: spec.replace(
      /## Your review\n[\s\S]*?(?=## Decisions)/,
      "## Your review\n\n- Done.\n- Also done.\n\n",
    ),
  });
  await renderPage(PAGE, repo);

  const answers = await region("Your review, answered");
  expect(answers.textContent).toContain("Also done.");
  expect(entriesOf(await contents())).toContain("Your review, answered");
});

/** US4 1: the answers answer the review that asked for the revision, not the one under way. */
test("your review stays answered, its quotes kept, once you comment on the revision", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  pendingReview(repo, [lineOf(repo, "**SC-001**")]);
  await renderPage(PAGE, repo);

  const card = await region("Your review, answered");
  expect(card.textContent).toContain("so for 3 seconds, with an undo button.");
  expect(card.textContent).toContain("3 seconds is too short to reach the button.");
  expect(card.textContent).not.toContain("Why?");
});

/** US4 2 */
test("a revision 3 keeps one record above the first part, the others in History", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo, { revision: 3 });
  await renderPage(PAGE, repo);

  const approve = await region("What you approve");
  expect(approve.textContent).toContain("Spec to review, revision 3, about 10 minutes.");
  const history = screen.getByRole("button", { name: "History" });
  expect(history.getAttribute("aria-expanded")).toBe("false");
  const notes = screen.getAllByRole("note", { hidden: true });
  expect(notes).toHaveLength(2);
  expect(notes.every(folded)).toBe(true);

  await click(history);

  expect(history.getAttribute("aria-expanded")).toBe("true");
  expect(notes.some(folded)).toBe(false);
  expect(screen.getByText(/Changes requested on 2026-10-07/)).toBeTruthy();
});

/** Edge case: a spec at revision 1. */
test("a revision 1 has no answers card", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo, { revision: 1 });
  await renderPage(PAGE, repo);

  await region("What you approve");
  expect(screen.queryByRole("region", { name: "Your review, answered" })).toBeNull();
  expect(entriesOf(await contents())).not.toContain("Your review, answered");
});

/** Review focus 7; error handling: an answer naming a missing comment. */
test("an answer whose comment is gone shows without a quote", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  const review = git(repo, "show", `${SPEC_FEATURE}:${REVIEW}`);
  const spec = git(repo, "show", `${SPEC_FEATURE}:${SPEC}`);
  // The revision answers the review its first commit holds: there, the review has no C2.
  commitOnBranch(repo, SPEC_FEATURE, {
    [REVIEW]: review.replace(/## C2:[\s\S]*?(?=## C3)/, ""),
    [SPEC]: spec.replace(/^revision: .*$/m, "revision: 3"),
  });
  await renderPage(PAGE, repo);

  const card = await region("Your review, answered");
  expect(card.textContent).not.toContain("so for 3 seconds");
  expect(card.textContent).toContain("C2 · undo too short");
  expect(card.textContent).toContain("The undo now stays 5 seconds, in the task row.");
  expect(card.textContent).toContain("I water the garden on weekends.");
  // C3's words show beside its own answer, not C2's.
  const text = card.textContent ?? "";
  expect(text.indexOf("Could the title parser")).toBeGreaterThan(text.indexOf("C3 · French"));
});

/** Review focus 7: the review file gone after approval. */
test("an approved spec whose review file is gone shows each answer without a quote", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo, { status: "approved" });
  commitOnBranch(repo, SPEC_FEATURE, { [REVIEW]: null });
  await renderPage(PAGE, repo);

  const card = await region("Your review, answered");
  expect(card.textContent).toContain("C1 · add weekends");
  expect(card.textContent).toContain("C3 · French phrases");
  expect(card.textContent).not.toContain("I water the garden on weekends.");
});

/** Review focus 9 */
test("an approved revision quotes the review it answered, never the approval's comments", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  const spec = git(repo, "show", `${SPEC_FEATURE}:${SPEC}`);
  commitOnBranch(repo, SPEC_FEATURE, {
    [REVIEW]: `---\nverdict: approved\ncommit: 9b1d2e7\n---\n\n# Review: Spec, Recurring tasks\n\n## C1: Line 70, under "US2: Complete a repeating task (P1)"\n\n> instead of marking it done.\n\nApproval's own comment, quoted nowhere else.\n`,
    [SPEC]: spec.replace(/^status: .*$/m, "status: approved"),
  });
  await renderPage(PAGE, repo);

  const card = await region("Your review, answered");
  expect(card.textContent).toContain("C1 · add weekends");
  expect(card.textContent).toContain("I water the garden on weekends.");
  expect(card.textContent).toContain("so for 3 seconds, with an undo button.");
  expect(card.textContent).not.toContain("Approval's own comment");
  expect(card.textContent).not.toContain("instead of marking it done");
});

/** Edge case: an approved spec. */
test("an approved spec is the same page, read-only, with its approval record", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo, { status: "approved" });
  await renderPage(PAGE, repo);

  const approve = await region("What you approve");
  expect(approve.textContent).toContain("Approved on 2026-10-18.");
  expect(screen.getByText("Approved")).toBeTruthy();
  expect(await region("Task storage")).toBeTruthy();
  expect(await region("Complete a repeating task")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Add a general comment" })).toBeNull();
  expect(document.querySelector("button[aria-pressed]")).toBeNull();
  expect(entriesOf(await contents())).toContain("What you approve");
});

/** US8 intro; US8 4 */
test("what you approve shows the time, the risk tier, and the principles", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const approve = await region("What you approve");
  expect(within(approve).getByText("About 10 minutes")).toBeTruthy();
  expect(within(approve).getByText("High risk")).toBeTruthy();
  expect(approve.textContent).toContain(
    "You approve tasks that repeat from a menu, a custom screen, or a phrase in their title.",
  );
  // The principles in their order, each with its mark: the third reads ⚠️.
  expect(
    within(approve)
      .getAllByText(/^(I|II|III)\. /)
      .map((p) => p.textContent),
  ).toEqual(["I. Simple", "II. Local first", "III. Fast"]);
  const marks = within(approve)
    .getAllByRole("img")
    .map((icon) => icon.getAttribute("aria-label"))
    .filter((name) => name === "Kept" || name === "Warning");
  expect(marks).toEqual(["Kept", "Kept", "Warning"]);
});

/** The element of an id, if the page has one. */
const byId = (id: string) => document.getElementById(id);

/** A heading's anchor in the spec names the part, story, or group drawn for it. */
test("each section's and story's anchor names the element drawn for it", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const story = await region("Complete a repeating task");
  expect(byId("us2-complete-a-repeating-task-p1")).toBe(story);
  expect(byId("your-review")).toBe(await region("Your review, answered"));
  expect(
    within(byId("user-stories")!).getByRole("heading", { name: "What changes for users" }),
  ).toBeTruthy();
  expect(byId("risk-tier")?.textContent).toContain("it converts every saved due date");
  expect(byId("constitution-check")?.textContent).toContain("Principle III holds with a cost");
  expect(within(await region("What you approve")).getByText(/converts every saved/)).toBeTruthy();

  const column = await contents();
  const href = (name: string) => within(column).getByRole("link", { name }).getAttribute("href");
  expect(href("US2 Complete a repeating task")).toBe("#us2-complete-a-repeating-task-p1");
  expect(href("What changes for users")).toBe("#user-stories");
  expect(href("Your review, answered")).toBe("#your-review");
});

/** A hash naming a heading inside a story's more scenarios opens them. */
test("a hash into a story's more scenarios opens them", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  const spec = git(repo, "show", `${SPEC_FEATURE}:${SPEC}`).replace(
    "   due the day after tomorrow.\n",
    "   due the day after tomorrow.\n\n   #### Twice in a row\n",
  );
  commitOnBranch(repo, SPEC_FEATURE, { [SPEC]: spec });
  await renderPage(`${PAGE}#twice-in-a-row`, repo);

  const story = await region("Complete a repeating task");
  await waitFor(() =>
    expect(within(story).getByRole("button", { name: "Fold the other scenarios" })).toBeTruthy(),
  );
  expect(document.getElementById("twice-in-a-row")).toBeTruthy();
  expect(
    within(await region("Make a task repeat")).getByRole("button", { name: "1 more scenario" }),
  ).toBeTruthy();
});
