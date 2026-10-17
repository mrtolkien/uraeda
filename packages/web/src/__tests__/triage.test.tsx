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
  refreshUntil,
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

/** The option of a question, by its letter: its card's checkbox. */
function option(id: string, letter: string) {
  return within(question(id)).getByRole("checkbox", {
    name: new RegExp(String.raw`^Option ${letter}\b`),
  }) as HTMLInputElement;
}

/** The `**Answer:**` line of a question of the triage. */
function answerLine(repo: string, id: string) {
  const lines = read(repo, TRIAGE).split("\n");
  const heading = lines.findIndex((line) => line.startsWith(`## ${id}:`));
  return lines.slice(heading).find((line) => line.startsWith("**Answer:**"));
}

/** Answers every question of the triage page with A, each saved before the next. */
async function answerAll(repo: string) {
  await screen.findByRole("heading", { level: 1, name: "Inbox triage" });
  for (const id of ["Q1", "Q2", "Q3"]) {
    await click(option(id, "A"));
    await waitFor(() => expect(answerLine(repo, id)).toBe("**Answer:** A"));
  }
}

/** Submit, once the page drew the last answer saved. */
async function submit() {
  const button = screen.getByRole("button", { name: "Submit answers" }) as HTMLButtonElement;
  await waitFor(() => expect(button.disabled).toBe(false));
  await click(button);
}

/** US4 1 */
test("Organize with an agent starts a chat in the main checkout with the triage's message", async () => {
  const { agent, repo } = await renderPage("/inbox", fixtureRepo(), { agent: true });

  await click(await screen.findByRole("button", { name: "Organize with an agent" }));

  await waitFor(() => expect(agent.sent).toHaveLength(1));
  expect(agent.sent[0].text).toBe(
    "/uraeda Organize the inbox, specs/INBOX.md: propose a triage in specs/INBOX-TRIAGE.md, following references/inbox.md. Stop when the triage waits for my answers.",
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
  await answerAll(repo);
  // Notes typed and not saved: Submit saves them first, over the triage as the page wrote it.
  await type(screen.getByLabelText("Anything else"), "Start with the bug.");
  await submit();

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s").trim()).toBe("chore: answer the inbox triage"),
  );
  expect(read(repo, TRIAGE)).toContain("status: answered");
  expect(read(repo, TRIAGE)).toContain("Start with the bug.");
  // The sidebar's inbox count read the inbox before: its new state comes as a live update (R15).
  await refreshUntil(() =>
    expect(screen.getByText("Your triage answers are ready to apply")).toBeTruthy(),
  );
});

/** US4 3 */
test("an answered triage is applied in a new chat", async () => {
  const { agent } = await renderPage("/inbox", withAnswered(), { agent: true });

  expect(await screen.findByText("Your triage answers are ready to apply")).toBeTruthy();
  await click(screen.getByRole("button", { name: "Apply the answers" }));

  await waitFor(() => expect(agent.sent).toHaveLength(1));
  expect(agent.sent[0].text).toBe(
    "/uraeda Apply my answers in specs/INBOX-TRIAGE.md, following references/inbox.md.",
  );
});

/**
 * US4 2, two pages on the triage: notes saved over a triage another page answered since are
 * refused, so its answer is never submitted unseen.
 */
test("a triage answered on another page since is not submitted unseen", async () => {
  const repo = withTriage();
  await renderPage("/inbox/triage", repo, { agent: true });
  await answerAll(repo);
  // The other page changes Q2's answer.
  writeFileSync(
    join(repo, TRIAGE),
    read(repo, TRIAGE).replace(/(## Q2:[^]*?)\*\*Answer:\*\* A\n/, "$1**Answer:** B\n"),
  );

  await type(screen.getByLabelText("Anything else"), "Start with the bug.");
  await submit();

  expect(
    await screen.findByText(
      "Some answers were not saved: nothing was submitted. Check them, then submit again.",
    ),
  ).toBeTruthy();
  expect(git(repo, "log", "-1", "--format=%s").trim()).toBe("chore: propose an inbox triage");
  expect(answerLine(repo, "Q2")).toBe("**Answer:** B");
  expect(read(repo, TRIAGE)).not.toContain("Start with the bug.");
});

/** The spec's error handling: a hook's refusal keeps the answers, and Try again commits them. */
test("a hook's refusal of the triage's commit is tried again", async () => {
  const repo = withTriage();
  const hooks = join(repo, ".git/hooks");
  git(repo, "config", "core.hooksPath", hooks);
  writeFileSync(join(hooks, "pre-commit"), "#!/bin/sh\necho 'refused by the hook'\nexit 1\n", {
    mode: 0o755,
  });
  await renderPage("/inbox/triage", repo, { agent: true });
  await answerAll(repo);

  await submit();
  const refused = "The pre-commit hook refused the commit. Your answers are saved, not committed.";
  expect(await screen.findByText(refused)).toBeTruthy();
  // Read again, the triage is answered: the page shows it as a record, and keeps the refusal.
  await refreshUntil(() =>
    expect(screen.queryByRole("button", { name: "Submit answers" })).toBeNull(),
  );
  expect(screen.getByText(refused)).toBeTruthy();
  writeFileSync(join(hooks, "pre-commit"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  await click(screen.getByRole("button", { name: "Try again" }));

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s").trim()).toBe("chore: answer the inbox triage"),
  );
  expect(git(repo, "status", "--porcelain").trim()).toBe("");
});

/** The core takes no image for the triage, which is no feature's, change's, or draft's file. */
test("the triage's comments and notes offer no image", async () => {
  await renderPage("/inbox/triage", withTriage(), { agent: true });
  await screen.findByRole("heading", { level: 1, name: "Inbox triage" });

  expect(screen.queryByRole("button", { name: "Add image to the notes" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Add image to Q1's comment" })).toBeNull();
});

/** US4 1 and 3 without an agent on this machine: the messages to give one, to copy. */
test("without an agent, the inbox gives the triage's messages to copy", async () => {
  await renderPage("/inbox", fixtureRepo());

  await click(await screen.findByRole("button", { name: "Organize with an agent" }));

  expect(
    screen.getByText(
      "/uraeda Organize the inbox, specs/INBOX.md: propose a triage in specs/INBOX-TRIAGE.md, following references/inbox.md. Stop when the triage waits for my answers.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy the message" })).toBeTruthy();
});

test("without an agent, an answered triage gives its apply message to copy", async () => {
  await renderPage("/inbox", withAnswered());

  expect(await screen.findByText("Your triage answers are ready to apply")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Apply the answers" })).toBeNull();
  expect(
    screen.getByText(
      "/uraeda Apply my answers in specs/INBOX-TRIAGE.md, following references/inbox.md.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy the message" })).toBeTruthy();
});

/** The redesign's edge case: the triage takes the round's page, with its Context free and no groups. */
test("the triage's questions are cards, its Context free, and it shows no settled groups", async () => {
  await renderPage("/inbox/triage", withTriage(), { agent: true });
  await screen.findByRole("heading", { level: 1, name: "Inbox triage" });

  // The Context, a paragraph under no part's heading.
  expect(
    screen.getByText(/^The inbox holds 10 notes: this triage covers the 5 under UI\./),
  ).toBeTruthy();
  for (const part of ["Goal", "Today", "Scope", "Sources"]) {
    expect(screen.queryByRole("heading", { level: 3, name: part })).toBeNull();
  }
  // Each question a card: its title, its "Why it matters", and its options as cards to pick.
  for (const id of ["Q1", "Q2", "Q3"]) {
    const card = question(id);
    expect(card.tagName, id).toBe("SECTION");
    expect(within(card).getByRole("heading", { level: 2 }), id).toBeTruthy();
    expect(within(card).getByRole("note").textContent, id).toMatch(/^Why it matters/);
    expect(card.querySelectorAll(".astryx-selectable-card").length, id).toBe(2);
    expect(option(id, "A").getAttribute("aria-label"), id).toMatch(/^Option A \(recommended\): /);
  }
  // No settled points, so no "Settled without you", and the notes are "Anything else".
  expect(screen.queryByRole("heading", { name: "Settled without you" })).toBeNull();
  for (const group of ["Check these", "Behaviour", "Under the hood"]) {
    expect(screen.queryByRole("heading", { name: group })).toBeNull();
  }
  expect(screen.getByRole("textbox", { name: "Anything else" })).toBeTruthy();
});
