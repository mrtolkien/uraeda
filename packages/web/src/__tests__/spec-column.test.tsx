// Spec page US4 key 2, more 2 and 3, US1 key 3, SC-004, and Review focus 4: beside the spec, the
// questions page's column holds Contents, open first, and Review while a review waits. Review lists
// the pending comments by their places, a tap bringing each one's block to the top, then the
// verdict's buttons, which commit the risk tier set at the page's end. A typed comment stays through
// tabs and widths. On the phone, no column: the status line holds Contents, the count, and Verdict.
import { act, screen, waitFor, within } from "@testing-library/react";
import { addSpecFeature, commitOnBranch, SPEC_FEATURE } from "uraeda-binding/test-utils";
import { beforeEach, expect, test } from "vite-plus/test";
import { atWidth, click, fixtureRepo, git, renderPage, type } from "./helpers.tsx";

const PAGE = `/f/${SPEC_FEATURE}/spec.md`;
const SPEC = `specs/${SPEC_FEATURE}/spec.md`;
const REVIEW = `specs/${SPEC_FEATURE}/spec-review.md`;
const PLAN = `specs/${SPEC_FEATURE}/plan.md`;
/** The block's pane, titled by its first line. */
const BLOCK = "Spec to review, revision 2, about 10 minutes.";
/** The scenario the second comment is on. */
const SCENARIO = 'the user picks "never"';

beforeEach(() => {
  window.localStorage.clear();
  atWidth(1440);
});

/** The line of the spec holding a phrase, on the feature's branch. */
function lineOf(repo: string, phrase: string) {
  const lines = git(repo, "show", `${SPEC_FEATURE}:${SPEC}`).split("\n");
  return lines.findIndex((line) => line.includes(phrase)) + 1;
}

/** The spec with two pending comments: C1 on a rule of task storage, C2 on a scenario. */
function twoComments() {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  const tip = git(repo, "rev-parse", "--short=7", SPEC_FEATURE).trim();
  const scenario = lineOf(repo, SCENARIO);
  const comments = [
    '## C1: Decision task-storage, lines 19–20, under "Rules"',
    "",
    "> - An upgrade that cannot read a saved value MUST clear it and log it.",
    "",
    "Log it where I can see it.",
    "",
    `## C2: Line ${scenario}, under "US1"`,
    "",
    "> Quoted.",
    "",
    "What about pausing?",
    "",
  ].join("\n");
  commitOnBranch(repo, SPEC_FEATURE, {
    [REVIEW]: `---\nverdict: pending\ncommit: ${tip}\n---\n\n# Review: Spec, Recurring tasks\n\n${comments}`,
  });
  return repo;
}

/** The column's tab list. */
const tabList = () => screen.getByRole("tablist", { name: /^The (spec|plan)'s column$/ });

/** The open tab's panel, by its tab's name. */
const panel = (name: string) => screen.getByRole("tabpanel", { name: new RegExp(`^${name}`) });

/** A block's toggle, by a phrase of its text. */
async function blockOf(phrase: string) {
  return waitFor(() => {
    const toggle = [...document.querySelectorAll<HTMLElement>("button[aria-pressed]")].find(
      (button) => {
        const label = document.getElementById(button.getAttribute("aria-labelledby") ?? "");
        return label?.textContent?.replaceAll(/\s+/g, " ").includes(phrase);
      },
    );
    expect(toggle).toBeTruthy();
    return toggle as HTMLElement;
  });
}

/** US4 key 1, in jsdom: the widths are the browser test's. */
test("Contents is the open tab, listing the decisions and the stories", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);
  await screen.findByRole("region", { name: BLOCK });

  expect(within(tabList()).getAllByRole("tab")).toHaveLength(2);
  expect(within(tabList()).getByRole("tab", { name: "Review" })).toBeTruthy();
  expect(
    within(tabList()).getByRole("tab", { name: "Contents" }).getAttribute("aria-selected"),
  ).toBe("true");
  const rows = within(panel("Contents"))
    .getAllByRole("link")
    .map((link) => link.textContent);
  expect(rows.slice(0, 7)).toEqual([
    "What you approve",
    "Your review, answered",
    "Decisions · 3",
    "Repeating tasks",
    "Task storage",
    "Task history",
    "Due dates",
  ]);
  expect(rows).toContain("User stories · 4");
  expect(rows).toContain("US2 Complete a repeating task");
});

/** US4 key 2, SC-004 */
test("Review lists the comments, jumps to each, then the verdict", async () => {
  await renderPage(PAGE, twoComments());
  await screen.findByRole("region", { name: BLOCK });

  await click(within(tabList()).getByRole("tab", { name: /^Review/ }));

  const review = panel("Review");
  expect(review.textContent).toContain("2 comments, unsent");
  const rows = within(review).getAllByRole("button", { name: /^C\d · / });
  expect(rows.map((row) => row.textContent?.split(" · ")[0])).toEqual(["C1", "C2"]);
  expect(rows[0]!.textContent).toContain("decision task-storage, lines 19–20");
  expect(rows[1]!.textContent).toContain("What about pausing?");
  expect(within(review).getByRole("button", { name: "General comment" })).toBeTruthy();
  expect(within(review).getByRole("button", { name: "Request changes" })).toBeTruthy();
  expect(within(review).getByRole("button", { name: "Approve" })).toBeTruthy();
  expect(review.textContent).toContain(
    "Risk tier, plan review, and your summary are with the verdict at the page's end.",
  );

  await click(rows[1]!);

  const block = await blockOf(SCENARIO);
  await waitFor(() => expect(document.activeElement).toBe(block));
});

/** US4 more 3, Review focus 4 */
test("approving from Review commits the tier set at the end", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);
  await screen.findByRole("region", { name: BLOCK });

  await click(screen.getByRole("radio", { name: "medium" }));
  await click(within(tabList()).getByRole("tab", { name: /^Review/ }));
  await click(within(panel("Review")).getByRole("button", { name: "Approve" }));

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s", SPEC_FEATURE).trim()).toMatch(/approve/),
  );
  expect(git(repo, "show", `${SPEC_FEATURE}:${SPEC}`)).toMatch(/^risk-tier: medium$/m);
});

/** US4 more 2, the high edge case */
test("a typed comment stays through tabs and widths", async () => {
  await renderPage(PAGE, twoComments());
  await click(await blockOf("instead of marking it done"));
  await type(await screen.findByLabelText("Comment text"), "Half typed");

  await click(within(tabList()).getByRole("tab", { name: /^Review/ }));
  await click(within(tabList()).getByRole("tab", { name: "Contents" }));
  await act(async () => atWidth(402));
  await act(async () => atWidth(1440));

  const field = (await screen.findByLabelText("Comment text")) as HTMLTextAreaElement;
  expect(field.value).toBe("Half typed");
  expect(screen.getByText("Unsaved changes")).toBeTruthy();
});

/** The phone's status line. */
const statusLine = () => document.querySelector<HTMLElement>("footer[aria-label='Status line']")!;

/** US1 key 3 */
test("on the phone, the status line holds Contents, the count, and Verdict", async () => {
  atWidth(402);
  await renderPage(PAGE, twoComments());
  await screen.findByRole("region", { name: BLOCK });
  expect(screen.queryByRole("tablist")).toBeNull();

  const line = within(statusLine());
  await click(line.getByRole("button", { name: "Contents" }));
  const contents = await screen.findByRole("dialog", { name: "Contents" });
  await click(within(contents).getByRole("link", { name: /^Task storage/ }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Contents" })).toBeNull());

  await click(line.getByRole("button", { name: "2 comments" }));
  const review = await screen.findByRole("dialog", { name: "Review" });
  expect(within(review).getAllByRole("button", { name: /^C\d · / })).toHaveLength(2);
  await click(within(review).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Review" })).toBeNull());

  // The verdict's first button, Request changes once there are comments, is focused.
  await click(line.getByRole("button", { name: "Verdict" }));
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Request changes" })),
  );
});

/** US6: the plan has the column too, Contents listing its panes. */
test("a plan waiting for review has Contents and Review", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  commitOnBranch(repo, SPEC_FEATURE, {
    [PLAN]: [
      "---",
      "status: awaiting-human",
      "spec-revision: 2",
      "---",
      "",
      "# Plan: Recurring tasks",
      "",
      "**Goal:** tasks that repeat.",
      "",
      "## Global constraints",
      "",
      "None.",
      "",
      "## Task 1: The repeat menu",
      "",
      "- [ ] **Step 1: Write the test.**",
      "",
    ].join("\n"),
  });
  await renderPage(`/f/${SPEC_FEATURE}/plan.md`, repo);
  await screen.findByRole("region", { name: "Goal" });

  const rows = within(panel("Contents"))
    .getAllByRole("link")
    .map((link) => link.textContent);
  expect(rows).toEqual(["Goal", "Global constraints", "1 The repeat menu"]);
  expect(within(tabList()).getByRole("tab", { name: /^Review/ })).toBeTruthy();
});
