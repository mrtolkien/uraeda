// The plan's progress, at the session column's foot, links the current task by its number, which a
// wave's tasks done out of order set apart from its place (R14).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { commitOnBranch } from "uraeda-binding/test-utils";
import { fakeAgent, fixture, fixtureRepo, renderPage, today } from "./helpers.tsx";

today("2026-10-13");

const FOLDER = "2026-10-13-plan-review";
const PLAN = `specs/${FOLDER}/plan.md`;

// Break: the task found at the place `done`, task 5, rather than by its number.
test("the plan's progress links the current task by its number, not its place", async () => {
  const repo = fixtureRepo();
  const plan = readFileSync(join(fixture("repo"), "branches", FOLDER, PLAN), "utf8")
    .replace("status: awaiting-human", "status: approved")
    // Task 4 open, task 5 done: 4 tasks done, and the current one, task 4, is the 4th.
    .replace(
      /(## Task 4:[\s\S]*?)(## Task 5:)/,
      (_, task4: string, next: string) => task4.replaceAll("- [x]", "- [ ]") + next,
    )
    .replace(/(## Task 5:[\s\S]*)/, (task5: string) => task5.replaceAll("- [ ]", "- [x]"));
  commitOnBranch(repo, FOLDER, { [PLAN]: plan });

  await renderPage(`/f/${FOLDER}/session`, repo, { agent: await fakeAgent() });

  const link = await screen.findByRole("link", { name: /^Implementation · 4 of 5 tasks done/ });
  expect(link.textContent).toContain("The custom repeat screen");
  await waitFor(() => expect(link.getAttribute("href")).toMatch(/#.*custom-repeat-screen$/));
});
