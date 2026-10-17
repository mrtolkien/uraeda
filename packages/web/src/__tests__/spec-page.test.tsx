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
test("the contents list every part, decision, and story, with Approve at their foot", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const column = await contents();
  // The unlisted change, "Due dates", joins the decisions once the file view carries the branch's
  // changes (R60).
  expect(entriesOf(column)).toEqual([
    "What you approve",
    "Your review, answered",
    "Decisions",
    "Repeating tasks",
    "Task storage",
    "Task history",
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
  expect(within(column).getByRole("button", { name: "Approve" })).toBeTruthy();
  expect(within(column).getByRole("button", { name: "Request changes" })).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Approve" })).toHaveLength(1);
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
  commitOnBranch(repo, SPEC_FEATURE, {
    [REVIEW]: review.replace(/## C2:[\s\S]*?(?=## C3)/, ""),
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
test("an approved revision does not quote the approval's comments", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo, { status: "approved" });
  await renderPage(PAGE, repo);

  const card = await region("Your review, answered");
  expect(card.textContent).toContain("C1 · add weekends");
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
