import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { fixtureRepo, git, renderPage } from "./helpers.tsx";

/** US1.5 */
test("lists a feature's files in workflow order, then what is not there yet", async () => {
  await renderPage("/f/2026-10-11-web-ui");

  await screen.findByText("proposal.md");
  const rows = [...document.querySelectorAll(".page .row .mono")].map((e) => e.textContent);
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
  const location = screen.getAllByText(/^clarifications-01\.md:\d+$/)[0];
  expect(location.parentElement?.textContent).toMatch(/Answer/);
});

test("names a feature's branch and worktree", async () => {
  await renderPage("/f/2026-10-12-cli-tuis");

  expect(await screen.findByText("2026-10-12-cli-tuis", { selector: ".mono" })).toBeTruthy();
});
