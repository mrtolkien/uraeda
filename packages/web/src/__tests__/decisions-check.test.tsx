// US3 of the decisions pass: "Check decisions" on the decisions page starts a chat, a waiting check
// disables it and its banner leads to the check's page, where each option shows its candidate as
// the spec page shows a changed decision, and the answers are written in
// `specs/DECISIONS-CHECK.md`.
import { copyFileSync, cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { APPLY_DECISIONS_CHECK, RUN_DECISIONS_CHECK } from "uraeda-server/round-messages";
import {
  atRepo,
  click,
  fixture,
  fixtureRepo,
  git,
  read,
  refreshUntil,
  renderPage,
  today,
} from "./helpers.tsx";

const CHECK = "specs/DECISIONS-CHECK.md";

today("2026-10-19");

/**
 * A copy of the fixture repository with the agent's check and its candidates committed, and the
 * active `ui-components` the candidate edits: the candidate without its first rule, so the card
 * shows a changed decision with an added rule.
 */
function withCheck() {
  const repo = fixtureRepo();
  const active = readFileSync(fixture("decisions-check/q1-a/ui-components.md"), "utf8")
    .replace("status: proposed", "status: active")
    .replace("approved-by:", "approved-by: mrtolkien")
    .replace(/- A kind of information MUST[^]*?Checked\n {2}by review\.\n/, "");
  writeFileSync(join(repo, "specs/decisions/ui-components.md"), active);
  copyFileSync(fixture("DECISIONS-CHECK.md"), join(repo, CHECK));
  cpSync(fixture("decisions-check"), join(repo, "specs/decisions-check"), { recursive: true });
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "-m", "chore: propose a decisions check");
  return repo;
}

/** A copy of the fixture repository with the check answered and committed. */
function withAnswered() {
  const repo = withCheck();
  const answered = readFileSync(join(repo, CHECK), "utf8")
    .replace("status: awaiting-human", "status: answered")
    .replaceAll("**Answer:**\n", "**Answer:** A\n");
  writeFileSync(join(repo, CHECK), answered);
  git(repo, "commit", "--quiet", "-am", "chore: answer the decisions check");
  return repo;
}

function question(id: string) {
  return document.getElementById(id) as HTMLElement;
}

/** The option of a question, by its letter: its card's checkbox. */
function option(id: string, letter: string) {
  return within(question(id)).getByRole("checkbox", {
    name: new RegExp(String.raw`^Option ${letter}\b`),
  }) as HTMLInputElement;
}

/** The `**Answer:**` line of a question of the check. */
function answerLine(repo: string, id: string) {
  const lines = read(repo, CHECK).split("\n");
  const heading = lines.findIndex((line) => line.startsWith(`## ${id}:`));
  return lines.slice(heading).find((line) => line.startsWith("**Answer:**"));
}

/** A control's disabled state, as Astryx sets it. */
function disabled(element: HTMLElement) {
  return (element.getAttribute("aria-disabled") ?? element.getAttribute("disabled")) !== null;
}

/** US3 4's first half: the button starts a chat with the check's message. */
test("Check decisions starts a chat with the check's message", async () => {
  const { agent } = await renderPage("/decisions", fixtureRepo(), { agent: true });

  await click(await screen.findByRole("button", { name: "Check decisions" }));

  await waitFor(() => expect(agent.sent).toHaveLength(1));
  expect(agent.sent[0].text).toBe(RUN_DECISIONS_CHECK);
  await waitFor(() =>
    expect(window.location.pathname).toMatch(new RegExp(`^${atRepo("/chats/")}`)),
  );
});

/** US3 4, and the edge case "a second check requested while one waits" */
test("a waiting check disables the button and the banner opens its page", async () => {
  const { agent } = await renderPage("/decisions", withCheck(), { agent: true });

  expect(await screen.findByText("A decisions check waits for your answers")).toBeTruthy();
  const button = screen.getByRole("button", { name: "Check decisions" });
  expect(disabled(button)).toBe(true);
  await click(button);
  expect(agent.sent).toHaveLength(0);
  await click(screen.getByRole("link", { name: "Answer it" }));

  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/decisions/check")));
  expect(await screen.findByRole("heading", { level: 1, name: "Decisions check" })).toBeTruthy();
});

test("the check's page says so when no check waits", async () => {
  await renderPage("/decisions/check", fixtureRepo(), { agent: true });

  expect(await screen.findByText("No decisions check waits.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Open the decisions" })).toBeTruthy();
});

/** US3 1: option A's candidate, drawn as the spec page draws a changed decision. */
test("an option shows its candidate as the spec page shows a changed decision", async () => {
  await renderPage("/decisions/check", withCheck(), { agent: true });
  await screen.findByRole("heading", { level: 1, name: "Decisions check" });

  const card = document.getElementById("q1-a-ui-components") as HTMLElement;
  expect(within(question("Q1")).getByRole("heading", { name: "UI components" })).toBeTruthy();
  expect(within(card).getByText("Changed")).toBeTruthy();
  // Under option A's card, inside the question; the added rule carries its own pill.
  expect(question("Q1").contains(card)).toBe(true);
  expect(within(card).getByText("New")).toBeTruthy();
  // Its rules, as the core compared them with the active decision, as the spec page draws them.
  expect(within(card).getAllByRole("img", { name: "Must" }).length).toBeGreaterThan(0);
  // Option B has no candidate folder: no card under it.
  expect(document.getElementById("q1-b-ui-components")).toBeNull();
  expect(within(question("Q1")).getAllByText("Changed")).toHaveLength(1);
});

/** An option can leave more than one decision: each candidate has its own card. */
test("an option with two candidates shows both", async () => {
  const repo = withCheck();
  copyFileSync(
    join(repo, "specs/decisions-check/q1-a/ui-components.md"),
    join(repo, "specs/decisions-check/q1-a/ui-coherence.md"),
  );
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "-m", "chore: add a second candidate");
  await renderPage("/decisions/check", repo, { agent: true });
  await screen.findByRole("heading", { level: 1, name: "Decisions check" });

  expect(document.getElementById("q1-a-ui-components")).toBeTruthy();
  expect(document.getElementById("q1-a-ui-coherence")).toBeTruthy();
});

/** The check's answers go to its own file, never the triage's. */
test("answering the check writes specs/DECISIONS-CHECK.md and Submit commits it alone", async () => {
  const repo = withCheck();
  await renderPage("/decisions/check", repo, { agent: true });
  await screen.findByRole("heading", { level: 1, name: "Decisions check" });
  await click(option("Q1", "A"));
  await waitFor(() => expect(answerLine(repo, "Q1")).toBe("**Answer:** A"));
  const submit = screen.getByRole("button", { name: "Submit answers" }) as HTMLButtonElement;
  await waitFor(() => expect(submit.disabled).toBe(false));
  // A file the page must not commit with the answers.
  writeFileSync(join(repo, "stray.txt"), "left alone\n");
  await click(submit);

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s").trim()).toBe("chore: answer the decisions check"),
  );
  expect(git(repo, "show", "--name-only", "--format=", "HEAD").trim()).toBe(CHECK);
  expect(() => read(repo, "specs/INBOX-TRIAGE.md")).toThrow();
  // Back on the decisions page, which offers to apply the answers.
  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/decisions")));
  await refreshUntil(() =>
    expect(screen.getByText("Your decisions check answers are ready to apply")).toBeTruthy(),
  );
});

test("an answered check offers to apply its answers", async () => {
  const { agent } = await renderPage("/decisions", withAnswered(), { agent: true });

  expect(await screen.findByText("Your decisions check answers are ready to apply")).toBeTruthy();
  await click(screen.getByRole("button", { name: "Apply the answers" }));

  await waitFor(() => expect(agent.sent).toHaveLength(1));
  expect(agent.sent[0].text).toBe(APPLY_DECISIONS_CHECK);
});

test("without an agent, the decisions page gives the check's messages to copy", async () => {
  await renderPage("/decisions", fixtureRepo());

  await click(await screen.findByRole("button", { name: "Check decisions" }));

  expect(screen.getByText(RUN_DECISIONS_CHECK)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy the message" })).toBeTruthy();
});
