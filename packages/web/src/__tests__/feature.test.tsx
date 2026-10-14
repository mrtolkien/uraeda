import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { atRepo, addMockup, fixtureRepo, git, record, renderPage } from "./helpers.tsx";

/** US1.5 */
test("lists a feature's files in workflow order, then what is not there yet", async () => {
  await renderPage("/f/2026-10-11-web-ui");

  const files = await screen.findByRole("list", { name: "Files" });
  const rows = within(files)
    .getAllByRole("listitem")
    .map((item) => /^[\w.-]+\.md/.exec(item.textContent ?? "")?.[0]);
  expect(rows).toEqual([
    "proposal.md",
    "discovery-01.md",
    "clarifications-01.md",
    "spec.md",
    "plan.md",
  ]);
  const notYet = screen.getAllByText("not yet");
  expect(notYet).toHaveLength(2);
  expect(screen.getByText("Answer questions")).toBeTruthy();
});

/** US1.6 */
test("shows the problems ura check finds", async () => {
  const repo = fixtureRepo();
  git(repo, "switch", "--quiet", "2026-10-11-web-ui");
  const round = join(repo, "specs/2026-10-11-web-ui/clarifications-01.md");
  const lines = readFileSync(round, "utf8").split("\n");
  const answer = lines.lastIndexOf("**Answer:**");
  writeFileSync(round, [...lines.slice(0, answer), ...lines.slice(answer + 1)].join("\n"));

  await renderPage("/f/2026-10-11-web-ui", repo);

  expect(await screen.findByText("Problems")).toBeTruthy();
  const problems = screen.getByRole("list", { name: "Problems" });
  const problem = within(problems)
    .getAllByRole("listitem")
    .find((item) => /^clarifications-01\.md:\d+/.test(item.textContent ?? ""));
  expect(problem?.textContent).toMatch(/Answer/);
});

test("names a feature's branch and worktree", async () => {
  await renderPage("/f/2026-10-12-cli-tuis");

  expect(await screen.findByText("2026-10-12-cli-tuis")).toBeTruthy();
});

/** US2.6 */
test("a merged feature shows its record and what is left", async () => {
  const repo = fixtureRepo();
  git(repo, "switch", "--quiet", "--create", "2026-10-09-dark-mode", "main");
  mkdirSync(join(repo, "specs/done"), { recursive: true });
  writeFileSync(join(repo, "specs/done/2026-10-09-dark-mode.md"), record("Dark mode"));
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "finish(dark-mode): dark mode");
  git(repo, "switch", "--quiet", "main");
  git(repo, "merge", "--quiet", "--no-ff", "--no-edit", "2026-10-09-dark-mode");
  git(
    repo,
    "worktree",
    "add",
    "--quiet",
    ".worktrees/2026-10-09-dark-mode",
    "2026-10-09-dark-mode",
  );

  await renderPage("/f/2026-10-09-dark-mode", repo);

  expect(await screen.findByRole("heading", { level: 1, name: "Dark mode" })).toBeTruthy();
  expect(screen.getByText("Merged into the default branch")).toBeTruthy();
  expect(screen.getByText("Worktree and branch left")).toBeTruthy();
  expect(screen.getByText(".worktrees/2026-10-09-dark-mode")).toBeTruthy();
  expect(screen.getByText("2026-10-09-dark-mode.md")).toBeTruthy();
  expect(screen.getByText("record")).toBeTruthy();
  expect(screen.queryByText("not yet")).toBeNull();
});

/** Review comment C1 */
test("the feature page lists its mockups (C1)", async () => {
  const repo = fixtureRepo();
  addMockup(repo, "2026-10-06-recurring-tasks", "repeat.html");

  await renderPage("/f/2026-10-06-recurring-tasks", repo);

  const link = await screen.findByRole("link", { name: /repeat\.html/ });
  expect(link.getAttribute("href")).toBe(
    atRepo("/f/2026-10-06-recurring-tasks/mockups/repeat.html"),
  );
});

test("a file page shows breadcrumbs", async () => {
  await renderPage("/f/2026-10-06-recurring-tasks/proposal.md");

  const crumbs = await screen.findByRole("navigation", { name: "Breadcrumbs" });
  expect(within(crumbs).getByRole("link", { name: "Home" })).toBeTruthy();
  expect(within(crumbs).getByRole("link", { name: "Recurring tasks" })).toBeTruthy();
  expect(within(crumbs).getByText("proposal.md")).toBeTruthy();
});
