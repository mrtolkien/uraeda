// US4.2 and US4.3's edges: a change's column counts its round's questions in plural words, and a
// record without a pull request leaves the step's title without a link (the spec's error
// handling). A feature's column keeps its words.
import { screen, within } from "@testing-library/react";
import { addChange, commitOnBranch } from "uraeda-binding/test-utils";
import { beforeEach, expect, test } from "vite-plus/test";
import { atWidth, fixtureRepo, renderPage } from "./helpers.tsx";

const FOLDER = "2026-10-16-header-logo";

beforeEach(() => atWidth(1440));

/** A question, with its heading's level and ID, and its answer. */
function question(heading: string, title: string, answer = "") {
  return `${heading}: ${title}\n\n- **A (recommended). Yes.**\n  - [pro] simple.\n- **B. No.**\n  - [con] harder.\n\n**Answer:**${answer ? ` ${answer}` : ""}\n`;
}

/**
 * A round, waiting on the human unless answered, with a question for each title, and a follow-up
 * of Q1's option B when given.
 */
function round(
  titles: Array<string>,
  {
    answer = "",
    followUp = "",
    number = "01",
  }: { answer?: string; followUp?: string; number?: string } = {},
) {
  const questions = titles
    .map((title, index) => question(`## Q${index + 1}`, title, answer))
    .concat(followUp ? [question("### Q1.B", followUp)] : [])
    .join("\n");
  const status = answer ? "answered" : "awaiting-human";
  return `---\nstatus: ${status}\n---\n\n# Clarifications, round ${number}: A home logo\n\n> [!IMPORTANT]\n>\n> ${titles.length} questions.\n\n## Context\n\nThe [proposal](proposal.md).\n\n${questions}`;
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
  // The round waits on the human: the agent is not said to work.
  expect(aside.queryByText("The agent is working.")).toBeNull();
});

test("a second round is the one linked, once the first is answered", async () => {
  const repo = fixtureRepo();
  addChange(repo, FOLDER, {
    "clarifications-01.md": round(["Does the logo replace the name?"], { answer: "A" }),
    "clarifications-02.md": round(["Is it a link?", "Does it shrink?", "Is it dark?"], {
      number: "02",
    }),
    "proposal.md": "# A home logo\n",
  });

  await renderPage(`/f/${FOLDER}`, repo, { agent: true });

  const aside = await column();
  expect(await aside.findByText("3 questions")).toBeTruthy();
  const link = aside.getByRole("link", { name: "Questions, round 02" });
  expect(link.getAttribute("href")).toMatch(new RegExp(`/f/${FOLDER}/clarifications-02\\.md$`));
  expect(aside.queryByRole("link", { name: "Questions, round 01" })).toBeNull();
});

test("a follow-up not asked yet is not counted", async () => {
  const repo = fixtureRepo();
  addChange(repo, FOLDER, {
    "clarifications-01.md": round(["Does the logo replace the name?"], {
      followUp: "How wide is the logo?",
    }),
    "proposal.md": "# A home logo\n",
  });

  await renderPage(`/f/${FOLDER}`, repo, { agent: true });

  const aside = await column();
  expect(await aside.findByText("1 question")).toBeTruthy();
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
