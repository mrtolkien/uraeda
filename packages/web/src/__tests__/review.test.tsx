import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, expect, test } from "vite-plus/test";
import { fixtureRepo, git, renderPage } from "./helpers.tsx";

const FOLDER = "2026-10-06-recurring-tasks";
const PAGE = `/f/${FOLDER}/spec.md`;
const SPEC = `specs/${FOLDER}/spec.md`;
const REVIEW = `specs/${FOLDER}/spec-review.md`;
const WORKTREE = join(".worktrees", FOLDER);

beforeAll(() => {
  process.env.URA_TODAY = "2026-10-11";
});

/** Commits a change to the spec on its branch, in the feature's worktree. */
function commitSpec(repo: string, edit: (text: string) => string) {
  if (!existsSync(join(repo, WORKTREE))) {
    git(repo, "worktree", "add", "--quiet", WORKTREE, FOLDER);
  }
  const path = join(repo, WORKTREE, SPEC);
  writeFileSync(path, edit(readFileSync(path, "utf8")));
  git(
    join(repo, WORKTREE),
    "commit",
    "--quiet",
    "--no-verify",
    "--all",
    "--message",
    "spec(recurring-tasks): edit",
  );
}

/** A repository whose spec has scenario 1 of US2 on lines 92 and 93, and risk tier medium. */
function repo() {
  const repo = fixtureRepo();
  commitSpec(repo, (text) =>
    text
      .replace("risk-tier: high", "risk-tier: medium")
      .replace("plan-review: true", "plan-review: false")
      .replace("## User stories\n", `${"Padding.\n\n".repeat(17)}## User stories\n`),
  );
  const lines = git(repo, "show", `${FOLDER}:${SPEC}`).split("\n");
  expect(lines[91]).toMatch(/^1\. \*\*Given\*\* a weekly task due Monday the 5th/);
  return repo;
}

function read(repo: string, path: string) {
  return readFileSync(join(repo, WORKTREE, path), "utf8");
}

/** The first tappable block whose text holds a phrase. */
async function scenario(phrase: string) {
  return waitFor(() => {
    const block = [...document.querySelectorAll<HTMLElement>(".block")].find((b) =>
      b.textContent?.includes(phrase),
    );
    expect(block).toBeTruthy();
    return block as HTMLElement;
  });
}

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function comment(text: string) {
  const field = await screen.findByLabelText("Comment text");
  await act(async () => {
    fireEvent.change(field, { target: { value: text } });
  });
  await click(screen.getByRole("button", { name: /^(Add|Save) comment$/ }));
}

const FIRST = "completes it on Monday the 5th, Then it stays in the list, not done";
const SECOND = "completes it on Thursday the 8th, Then it is due Monday the 12th.";

/** US3.1 */
test("a tapped block takes a comment on its lines", async () => {
  const r = repo();
  await renderPage(PAGE, r);

  await click(await scenario(FIRST));
  expect(screen.getByText('Lines 92–93, under "US2: Complete a repeating task (P1)"')).toBeTruthy();
  await comment("Say what the row shows");

  await waitFor(() => expect(existsSync(join(r, WORKTREE, REVIEW))).toBe(true));
  const review = read(r, REVIEW);
  const tip = git(r, "rev-parse", "--short=7", FOLDER).trim();
  expect(review).toContain(`verdict: pending\ncommit: ${tip}\n`);
  expect(review).toContain(
    '## C1: Lines 92–93, under "US2: Complete a repeating task (P1)"\n\n> 1. **Given** a weekly task due Monday the 5th',
  );
  expect(review).toContain("\nSay what the row shows\n");
  expect(git(join(r, WORKTREE), "status", "--porcelain")).toContain("spec-review.md");
});

/** US3.2 */
test("a second tap extends the selection", async () => {
  await renderPage(PAGE, repo());

  await click(await scenario(FIRST));
  await click(await scenario(SECOND));

  expect(screen.getByText('Lines 92–95, under "US2: Complete a repeating task (P1)"')).toBeTruthy();
});

/** US3.3 */
test("a pending comment is edited, then removed with its review file", async () => {
  const r = repo();
  await renderPage(PAGE, r);
  await click(await scenario(FIRST));
  await comment("Say what the row shows");
  const pending = await waitFor(() => {
    const note = document.querySelector(".pending") as HTMLElement;
    expect(note).toBeTruthy();
    return note;
  });

  await click(within(pending).getByRole("button", { name: "Edit" }));
  await comment("Say what the row shows, and for how long");
  await waitFor(() =>
    expect(read(r, REVIEW)).toContain("\nSay what the row shows, and for how long\n"),
  );
  await waitFor(() =>
    expect(document.querySelector(".pending")?.textContent).toContain("and for how long"),
  );

  await click(
    within(document.querySelector(".pending") as HTMLElement).getByRole("button", {
      name: "Remove",
    }),
  );
  await waitFor(() => expect(existsSync(join(r, WORKTREE, REVIEW))).toBe(false));
});

/** US3.4 */
test("approving with a higher tier turns the plan's review on", async () => {
  const r = repo();
  await renderPage(PAGE, r);

  await click(await screen.findByRole("radio", { name: "high" }));
  await click(screen.getByRole("button", { name: "Approve" }));

  await waitFor(() =>
    expect(git(r, "log", "-1", "--format=%s", FOLDER).trim()).toBe(
      "spec(recurring-tasks): approve",
    ),
  );
  const spec = read(r, SPEC);
  expect(spec).toContain("status: approved\n");
  expect(spec).toContain("risk-tier: high\n");
  expect(spec).toContain("plan-review: true\n");
});

/** US3.5 */
test("Request changes waits for a comment", async () => {
  await renderPage(PAGE, repo());

  const button = await screen.findByRole("button", { name: "Request changes" });
  expect(button.hasAttribute("disabled") || button.getAttribute("aria-disabled") === "true").toBe(
    true,
  );
  expect(screen.getAllByText("Add a comment first", { exact: false }).length).toBeGreaterThan(0);
});

/** US3.6 */
test("a plan shows each task's steps checked out of its total", async () => {
  await renderPage("/f/2026-10-13-plan-review/plan.md");

  const task = await screen.findByText("Task 5: Repeats typed in the title");
  expect(within(task.closest(".row") as HTMLElement).getByText("2/5")).toBeTruthy();
  expect(screen.queryByRole("radio", { name: "high" })).toBeNull();
});

/** US3.7 */
test("a new version under pending comments is said", async () => {
  const r = repo();
  const tip = git(r, "rev-parse", "--short=7", FOLDER).trim();
  writeFileSync(
    join(r, WORKTREE, REVIEW),
    `---\nverdict: pending\ncommit: ${tip}\n---\n\n# Review: Spec, Recurring tasks\n\n## C1: General\n\nShorter.\n`,
  );
  commitSpec(r, (text) => `${text}\nOne more line.\n`);

  await renderPage(PAGE, r);

  expect(
    await screen.findByText(
      "The spec changed since your comments: your 1 pending comment is on the previous version. Adding a comment replaces it.",
    ),
  ).toBeTruthy();
  await click(screen.getByRole("button", { name: "Start over" }));
  await waitFor(() => expect(existsSync(join(r, WORKTREE, REVIEW))).toBe(false));
});

/** Review focus 4: a spec without stories still renders, and its blocks take comments. */
test("a spec without stories still takes comments", async () => {
  const r = fixtureRepo();
  commitSpec(r, (text) => text.replace(/### US\d+:.*\n/g, "Story removed.\n"));

  await renderPage(PAGE, r);

  await click(await scenario(FIRST));
  expect(screen.getByText(/^Lines \d+–\d+, under "User stories"$/)).toBeTruthy();
});

/** Review C2: no verdict on a spec whose file differs from what the page shows. */
test("the verdict waits while the spec has changes not committed", async () => {
  const r = repo();
  const path = join(r, WORKTREE, SPEC);
  writeFileSync(path, `${readFileSync(path, "utf8")}\nUnfinished edit.\n`);
  await renderPage(PAGE, r);

  expect(
    await screen.findByText(
      "spec.md has changes not committed: the review is of the committed version. Commit or discard them first.",
    ),
  ).toBeTruthy();
  const approve = screen.getByRole("button", { name: "Approve" });
  expect(approve.hasAttribute("disabled") || approve.getAttribute("aria-disabled") === "true").toBe(
    true,
  );
});

/** Codex review: a general comment is edited and removed like the others. */
test("a general comment is edited, then removed", async () => {
  const r = repo();
  await renderPage(PAGE, r);
  await click(await screen.findByRole("button", { name: "Add a general comment" }));
  await comment("Too long");
  await waitFor(() => expect(existsSync(join(r, WORKTREE, REVIEW))).toBe(true));
  const general = await waitFor(() => {
    const note = [...document.querySelectorAll<HTMLElement>(".pending")].find((n) =>
      n.textContent?.includes("general"),
    );
    expect(note).toBeTruthy();
    return note as HTMLElement;
  });

  await click(within(general).getByRole("button", { name: "Edit" }));
  await comment("Too long by half");
  await waitFor(() => expect(read(r, REVIEW)).toContain("\nToo long by half\n"));
  await click(
    within(document.querySelector(".pending") as HTMLElement).getByRole("button", {
      name: "Remove",
    }),
  );
  await waitFor(() => expect(existsSync(join(r, WORKTREE, REVIEW))).toBe(false));
});

/** Codex review: a table's row takes a comment on its line. */
test("a table row takes a comment on its line", async () => {
  const r = repo();
  await renderPage(PAGE, r);
  const row = await waitFor(() => {
    const found = [...document.querySelectorAll<HTMLElement>("tr")].find((tr) =>
      tr.textContent?.includes("Upgrade of version 1 data"),
    );
    expect(found?.getAttribute("role")).toBe("button");
    return found as HTMLElement;
  });

  await click(row);
  await comment("Which version?");

  await waitFor(() => expect(read(r, REVIEW)).toContain("| Upgrade of version 1 data"));
  await waitFor(() =>
    expect(
      [...document.querySelectorAll(".pending")].some((n) =>
        n.textContent?.includes("Which version?"),
      ),
    ).toBe(true),
  );
});
