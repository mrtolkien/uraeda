// US4 1–3 of the inbox, and its edge case "a triage while one exists": "Organize with an agent"
// starts a chat in the main checkout, the banners lead to the triage and to applying it, and the
// triage is answered at /inbox/triage in the round's view, written in `specs/INBOX-TRIAGE.md`.
import { copyFileSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import {
  atRepo,
  click,
  fixture,
  fixtureRepo,
  git,
  read,
  renderPage,
  today,
  type,
} from "./helpers.tsx";

const TRIAGE = "specs/INBOX-TRIAGE.md";

today("2026-10-15");

/** A copy of the fixture repository with the agent's triage committed, as it proposes it. */
function withTriage() {
  const repo = fixtureRepo();
  copyFileSync(fixture("INBOX-TRIAGE.md"), join(repo, TRIAGE));
  git(repo, "add", TRIAGE);
  git(repo, "commit", "--quiet", "-m", "chore: propose an inbox triage");
  return repo;
}

/** A copy of the fixture repository with the triage answered and committed. */
function withAnswered() {
  const repo = withTriage();
  const answered = readFileSync(join(repo, TRIAGE), "utf8")
    .replace("status: awaiting-human", "status: answered")
    .replaceAll("**Answer:**\n", "**Answer:** A\n");
  writeFileSync(join(repo, TRIAGE), answered);
  git(repo, "commit", "--quiet", "-am", "chore: answer the inbox triage");
  return repo;
}

function question(id: string) {
  return document.getElementById(id) as HTMLElement;
}

/** The option of a question, by the letter it shows. */
function option(id: string, letter: string) {
  return within(question(id))
    .getAllByRole("button")
    .find(
      (b) => b.hasAttribute("aria-pressed") && within(b).queryByText(letter, { exact: true }),
    ) as HTMLElement;
}

/** The `**Answer:**` line of a question of the triage. */
function answerLine(repo: string, id: string) {
  const lines = read(repo, TRIAGE).split("\n");
  const heading = lines.findIndex((line) => line.startsWith(`## ${id}:`));
  return lines.slice(heading).find((line) => line.startsWith("**Answer:**"));
}

/** US4 1 */
test("Organize with an agent starts a chat in the main checkout with the triage's message", async () => {
  const { agent, repo } = await renderPage("/inbox", fixtureRepo(), { agent: true });

  await click(await screen.findByRole("button", { name: "Organize with an agent" }));

  await waitFor(() => expect(agent.sent).toHaveLength(1));
  expect(agent.sent[0].text).toBe(
    "/uraeda:uraeda Organize the inbox, specs/INBOX.md: propose a triage in specs/INBOX-TRIAGE.md, following references/inbox.md. Stop when the triage waits for my answers.",
  );
  expect(realpathSync(agent.opens[0].cwd)).toBe(realpathSync(repo));
  await waitFor(() =>
    expect(window.location.pathname).toMatch(new RegExp(`^${atRepo("/chats/")}`)),
  );
});

/** US4 2, and the edge case "a triage while one exists" */
test("a triage waiting is linked from the inbox, and answered in the round's view", async () => {
  const repo = withTriage();
  await renderPage("/inbox", repo, { agent: true });

  expect(await screen.findByText("An inbox triage waits for your answers")).toBeTruthy();
  const organize = screen.getByRole("button", { name: "Organize with an agent" });
  expect(organize.getAttribute("aria-disabled") ?? organize.getAttribute("disabled")).not.toBe(
    null,
  );
  await click(screen.getByRole("link", { name: "Answer it" }));

  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/inbox/triage")));
  expect(await screen.findByRole("heading", { level: 1, name: "Inbox triage" })).toBeTruthy();
  // The triage is no feature's: nothing to ask its agent about.
  expect(screen.queryByRole("button", { name: "Ask the agent" })).toBeNull();
  await click(option("Q1", "A"));

  await waitFor(() => expect(answerLine(repo, "Q1")).toBe("**Answer:** A"));
});

/** US4 2: the triage's answers and notes, submitted over the triage the page read and wrote. */
test("the triage's answers are submitted in one commit, and the inbox offers to apply them", async () => {
  const repo = withTriage();
  await renderPage("/inbox/triage", repo, { agent: true });
  await screen.findByRole("heading", { level: 1, name: "Inbox triage" });

  for (const id of ["Q1", "Q2", "Q3"]) {
    await click(option(id, "A"));
    await waitFor(() => expect(answerLine(repo, id)).toBe("**Answer:** A"));
  }
  // Notes typed and not saved: Submit saves them first, over the triage as the page wrote it.
  await type(screen.getByLabelText("Notes"), "Start with the bug.");
  // Enabled once the page drew the last answer saved.
  const submit = screen.getByRole("button", { name: "Submit answers" }) as HTMLButtonElement;
  await waitFor(() => expect(submit.disabled).toBe(false));
  await click(submit);

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s").trim()).toBe("chore: answer the inbox triage"),
  );
  expect(read(repo, TRIAGE)).toContain("status: answered");
  expect(read(repo, TRIAGE)).toContain("Start with the bug.");
  expect(await screen.findByText("Your triage answers are ready to apply")).toBeTruthy();
});

/** US4 3 */
test("an answered triage is applied in a new chat", async () => {
  const { agent } = await renderPage("/inbox", withAnswered(), { agent: true });

  expect(await screen.findByText("Your triage answers are ready to apply")).toBeTruthy();
  await click(screen.getByRole("button", { name: "Apply the answers" }));

  await waitFor(() => expect(agent.sent).toHaveLength(1));
  expect(agent.sent[0].text).toBe(
    "/uraeda:uraeda Apply my answers in specs/INBOX-TRIAGE.md, following references/inbox.md.",
  );
});
