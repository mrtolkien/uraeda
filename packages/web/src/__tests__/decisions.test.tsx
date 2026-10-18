// US8: the constitution and decisions page, read-only, over the fixture repository's constitution
// and its five decisions; the edge cases of a missing folder, a missing constitution, a decision
// without a title, one with a problem, and one `ura check` cannot read (review focus 7). The icons
// a row draws are checked in `decision-icons.test.ts`.
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { atRepo, click, fixtureRepo, git, renderPage } from "./helpers.tsx";

/** Commits every change of the repository, dated `date`. */
function commitOn(repo: string, message: string, date: string) {
  const dates = { GIT_AUTHOR_DATE: `${date}T12:00:00Z`, GIT_COMMITTER_DATE: `${date}T12:00:00Z` };
  Object.assign(process.env, dates);
  try {
    git(repo, "add", "--all");
    git(repo, "commit", "--quiet", "--no-verify", "--message", message);
  } finally {
    delete process.env.GIT_AUTHOR_DATE;
    delete process.env.GIT_COMMITTER_DATE;
  }
}

/** The page's own content, without the navigation. */
async function main() {
  return within(await screen.findByRole("main"));
}

/** The decisions' list. */
async function decisionList() {
  return within(await screen.findByRole("list", { name: "Decisions" }));
}

/** A row's link name: its title, then its subtitle and its date, if any. */
const titled = (title: string) => new RegExp(`^${title}( |$)`);

/** The titles the decisions' rows start with, among `known`, in the rows' order. */
async function titles(known: ReadonlyArray<string>) {
  const names: Array<string> = [];
  (await decisionList()).getAllByRole("link", {
    name: (name) => {
      names.push(name);
      return true;
    },
  });
  return names.map((name) => known.find((title) => titled(title).test(name)));
}

/** A decision's row, by its title. */
async function decisionRow(title: string) {
  const row = (await decisionList())
    .getAllByRole("listitem")
    .find((item) => within(item).queryByRole("link", { name: titled(title) }));
  if (!row) {
    throw new Error(`No decision row ${title}`);
  }
  return row;
}

/** The pane beside the list. */
async function pane() {
  return within(await screen.findByRole("region", { name: "Detail" }));
}

/** Whether a text field has the focus: opening an item never puts it in one (SC-005). */
function isFieldFocused() {
  const active = document.activeElement;
  return active?.matches("input, textarea, [contenteditable='true']") ?? false;
}

/** US8 1 */
test("shows the constitution's version and principles, then the decisions, latest first", async () => {
  const repo = fixtureRepo();
  const stack = join(repo, "specs/decisions/stack.md");
  writeFileSync(stack, `${readFileSync(stack, "utf8")}- The binding's types\n`);
  commitOn(repo, "docs: stack", "2027-01-05");
  await renderPage("/decisions", repo);

  const page = await main();
  expect(await page.findByRole("heading", { name: "Constitution and decisions" })).toBeTruthy();
  const constitution = within(page.getByRole("region", { name: "Constitution" }));
  expect(constitution.getByRole("heading", { name: "Constitution" })).toBeTruthy();
  expect(
    constitution.getByText("Version 1.3.1 · Ratified 2026-10-07 · Last amended 2026-10-14"),
  ).toBeTruthy();
  expect(constitution.getAllByRole("link").map((link) => link.getAttribute("aria-label"))).toEqual([
    "I. Humans stay in control",
    "II. Git and plain text first",
    "III. Asynchronous by default",
    "IV. Review effort matches impact",
    "V. Tools are optional",
    "VI. Code is checked and stays maintainable",
  ]);
  expect(page.getByRole("heading", { name: "Decisions · 5" })).toBeTruthy();
  // Stack changed last; the others, changed the same day, A to Z.
  const latest = ["Stack", "Agents", "Git", "TUI", "UI behaviour"];
  expect(await titles(latest)).toEqual(latest);
  expect(within(await decisionRow("Stack")).getByText("Jan 5")).toBeTruthy();
  expect(
    within(await decisionRow("Git")).getByText(/^Uraeda's Rust tools read git with gix/),
  ).toBeTruthy();
});

/** US8 2 */
test("A to Z sorts the decisions by title, and stays chosen after a reload", async () => {
  const repo = fixtureRepo();
  const stack = join(repo, "specs/decisions/stack.md");
  writeFileSync(stack, `${readFileSync(stack, "utf8")}- The binding's types\n`);
  commitOn(repo, "docs: stack", "2027-01-05");
  await renderPage("/decisions", repo);

  await click(await screen.findByRole("combobox", { name: "Sort decisions" }));
  await click(await screen.findByRole("option", { name: "A to Z" }));

  const sorted = ["Agents", "Git", "Stack", "TUI", "UI behaviour"];
  expect(await titles(sorted)).toEqual(sorted);
  expect(window.localStorage.getItem("uraeda:decisions:sort")).toBe("title");

  await renderPage("/decisions", repo, { reload: true });
  await waitFor(async () => expect(await titles(sorted)).toEqual(sorted));
});

/** US8 3 */
test("a decision opens to read in the pane, with its status, approver, and sections", async () => {
  await renderPage("/decisions");

  await click(within(await decisionRow("UI behaviour")).getByRole("link"));

  expect(window.location.pathname).toBe(atRepo("/decisions/ui-behaviour"));
  const detail = await pane();
  expect(detail.getByRole("heading", { level: 2, name: "UI behaviour" })).toBeTruthy();
  expect(detail.getByText("Active")).toBeTruthy();
  expect(detail.getByText("Approved by mrtolkien")).toBeTruthy();
  expect(detail.getByText(/^The web UI acts on things where they are/)).toBeTruthy();
  for (const section of ["Rules", "Why", "Alternatives considered", "Consequences", "Applies to"]) {
    expect(detail.getByRole("heading", { name: section })).toBeTruthy();
  }
  // Read-only: nothing to type in, and nothing focused in a field.
  expect(detail.queryAllByRole("textbox")).toEqual([]);
  expect(isFieldFocused()).toBe(false);
});

/** US8 4 */
test("a principle opens to read in the pane, with its rules, rationale, and version", async () => {
  await renderPage("/decisions");

  await click(await screen.findByRole("link", { name: "IV. Review effort matches impact" }));

  expect(window.location.pathname).toBe(atRepo("/decisions/constitution/iv"));
  const detail = await pane();
  expect(detail.getByRole("heading", { name: "Review effort matches impact" })).toBeTruthy();
  expect(
    detail.getByText("Every question asked to a human MUST come with a recommended answer."),
  ).toBeTruthy();
  expect(detail.getByText(/human attention is the scarcest resource/)).toBeTruthy();
  expect(
    detail.getByText("Version 1.3.1 · Ratified 2026-10-07 · Last amended 2026-10-14"),
  ).toBeTruthy();
  expect(isFieldFocused()).toBe(false);
});

/** US8 6 */
test("a spec's link to a decision opens it on the decisions page", async () => {
  const repo = fixtureRepo();
  const proposal = join(repo, "specs/2026-10-10-stack-decision/proposal.md");
  writeFileSync(
    proposal,
    `${readFileSync(proposal, "utf8")}\nSee [the git decision](../decisions/git.md).\n`,
  );
  commitOn(repo, "docs: link the git decision", "2026-10-16");
  await renderPage("/f/2026-10-10-stack-decision/proposal.md", repo);

  await click(await screen.findByRole("link", { name: "the git decision" }));

  // The link opens the decision as the feature's branch has it: without a branch, the decisions
  // page (R85).
  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/decisions/git")));
  expect((await pane()).getByRole("heading", { level: 2, name: "Git" })).toBeTruthy();
});

/** US8 7 */
test("a proposed decision's row says so; an active one's does not", async () => {
  await renderPage("/decisions");

  expect(within(await decisionRow("TUI")).getByText("Proposed")).toBeTruthy();
  expect(within(await decisionRow("Git")).queryByText("Active")).toBeNull();
});

test("says when there is no decision yet", async () => {
  const repo = fixtureRepo();
  rmSync(join(repo, "specs/decisions"), { force: true, recursive: true });
  await renderPage("/decisions", repo);

  expect(await screen.findByText("No decisions yet.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "I. Humans stay in control" })).toBeTruthy();
});

test("says when there is no constitution yet", async () => {
  const repo = fixtureRepo();
  rmSync(join(repo, "specs/CONSTITUTION.md"));
  await renderPage("/decisions", repo);

  expect(await screen.findByText("No constitution yet.")).toBeTruthy();
  expect(await decisionRow("Git")).toBeTruthy();
});

/** A decision, valid but for what each test changes. */
const DECISION =
  "---\nstatus: active\napproved-by: mrtolkien\nicon: git-branch\n---\n\n# Hooks\n\nCommits run the hooks. Always.\n\n## Rules\n\n- One.\n\n## Why\n\nSo.\n\n## Consequences\n\n- None.\n\n## Applies to\n\n- Commits\n";

/** Edge case: a decision without an H1 or a summary stands by its file name, without subtitle. */
test("a decision without a title shows by its file name, and no subtitle", async () => {
  const repo = fixtureRepo();
  writeFileSync(
    join(repo, "specs/decisions/untitled.md"),
    DECISION.replace("# Hooks\n\nCommits run the hooks. Always.\n\n", ""),
  );
  await renderPage("/decisions", repo);

  // Its row's whole name is its file name: no subtitle, no date, no status.
  expect(await (await decisionList()).findByRole("link", { name: "untitled" })).toBeTruthy();
  expect(screen.queryByText("Can't read this file")).toBeNull();
});

/** A readable decision with a problem keeps its summary, and its pane warns of the problem. */
test("a decision with a broken link keeps its summary, its pane naming the problem", async () => {
  const repo = fixtureRepo();
  writeFileSync(
    join(repo, "specs/decisions/hooks.md"),
    DECISION.replace("So.", "So [the hooks](missing.md) say."),
  );
  await renderPage("/decisions", repo);

  const hooks = await decisionRow("Hooks");
  expect(within(hooks).getByText("Commits run the hooks.")).toBeTruthy();
  expect(within(hooks).queryByText("Can't read this file")).toBeNull();

  await click(within(hooks).getByRole("link"));

  const { readLedger } = await import("uraeda-binding");
  const { problem } = (await readLedger(repo)).decisions.find((one) => one.name === "hooks")!;
  expect(problem).toBeTruthy();
  const detail = await pane();
  expect(await detail.findByText(problem!)).toBeTruthy();
  expect(detail.queryByText("Can't read this file")).toBeNull();
});

/** Review focus 7: listed by its file name, its pane showing the core's first problem. */
test("a decision ura check cannot read shows by its file name, with its problem", async () => {
  const repo = fixtureRepo();
  writeFileSync(
    join(repo, "specs/decisions/broken.md"),
    DECISION.replace("status: active", "status: [active"),
  );
  await renderPage("/decisions", repo);

  const broken = await decisionRow("broken");
  expect(within(broken).getByText("Can't read this file")).toBeTruthy();

  await click(within(broken).getByRole("link"));

  expect(window.location.pathname).toBe(atRepo("/decisions/broken"));
  // The core's first problem, as `ura check` finds it.
  const { readLedger } = await import("uraeda-binding");
  const { problem } = (await readLedger(repo)).decisions.find((one) => one.name === "broken")!;
  expect(problem).toBeTruthy();
  const detail = await pane();
  expect(detail.getByRole("heading", { level: 2, name: "broken" })).toBeTruthy();
  expect(detail.getByText("Can't read this file")).toBeTruthy();
  expect(detail.getByText(problem!)).toBeTruthy();
});
