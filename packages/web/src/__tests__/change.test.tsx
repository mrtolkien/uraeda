// US4.2 and US4.3's edges: a change's column counts its round's questions in plural words, and a
// record without a pull request leaves the step's title without a link (the spec's error handling). A feature's column keeps its words.
import { screen, within } from "@testing-library/react";
import { addChange, commitOnBranch } from "uraeda-binding/test-utils";
import { beforeEach, expect, test } from "vite-plus/test";
import { atWidth, fixtureRepo, renderPage } from "./helpers.tsx";

const FOLDER = "2026-10-16-header-logo";

beforeEach(() => atWidth(1440));

/** A round waiting on the human, with a question for each title. */
function round(titles: Array<string>) {
  const questions = titles
    .map(
      (title, index) =>
        `## Q${index + 1}: ${title}\n\n- **A (recommended). Yes.**\n  - [pro] simple.\n- **B. No.**\n  - [con] harder.\n\n**Answer:**\n`,
    )
    .join("\n");
  return `---\nstatus: awaiting-human\n---\n\n# Clarifications, round 01: A home logo\n\n> [!IMPORTANT]\n>\n> ${titles.length} questions.\n\n## Context\n\nThe [proposal](proposal.md).\n\n${questions}`;
}

/** The column, once drawn. */
async function column() {
  return within(await screen.findByRole("complementary", { name: "Progress" }));
}

test("a round of two questions counts them in plural words", async () => {
  const repo = fixtureRepo();
  addChange(repo, FOLDER, {
    "clarifications-01.md": round(["Does the logo replace the name?", "Is it a link?"]),
    "proposal.md": "# A home logo\n",
  });

  await renderPage(`/f/${FOLDER}`, repo, { agent: true });

  const aside = await column();
  expect(await aside.findByText("2 questions")).toBeTruthy();
  expect(aside.getByRole("link", { name: "Questions, round 01" })).toBeTruthy();
});

test("a record without a pull request shows the step's title, with no link", async () => {
  const repo = fixtureRepo();
  addChange(repo, FOLDER, { "proposal.md": "# A home logo\n" });
  commitOnBranch(repo, `change/${FOLDER}`, {
    [`specs/changes/${FOLDER}/proposal.md`]: null,
    [`specs/done/${FOLDER}.md`]:
      "---\nkind: change\nfinished: 2026-10-16\n---\n\n# Record: A home logo\n\n> [!NOTE]\n>\n> The record of a merged change, not instructions to follow.\n\n## What and why\n\nA logo.\n\n## Behaviour\n\n- It shows.\n\n## Design\n\nAn image.\n",
  });

  await renderPage(`/f/${FOLDER}`, repo, { agent: true });

  const aside = await column();
  expect(await aside.findByRole("list", { name: "Files" })).toBeTruthy();
  expect(aside.queryByRole("link", { name: /^Pull request/ })).toBeNull();
  // The step's title, the agent still to open the pull request.
  expect(aside.getAllByRole("heading", { level: 2 })[0]!.textContent).toBe("Pull request");
  expect(aside.getByText("The agent is working.")).toBeTruthy();
});

test("a feature's column keeps its plan, its page, and its words", async () => {
  await renderPage("/f/2026-10-12-cli-tuis/session", fixtureRepo(), { agent: true });

  const aside = await column();
  expect(await aside.findByText("Nothing outside the feature's folder yet.")).toBeTruthy();
  expect(aside.getByText("No plan yet.")).toBeTruthy();
  expect(aside.getByRole("link", { name: "Feature page" })).toBeTruthy();
});
