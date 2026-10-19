// Flow: the inbox triage. "Organize with an agent" starts a chat in the main checkout; a triage the
// agent proposed is answered at /inbox/triage in the round's view, written in the repository, and
// submitted in one commit; answers are applied in a new chat; without an agent, the messages are
// given to copy. The tests follow one triage from proposal to answers, on one repository.
import { copyFileSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { fixture } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { click, git, lastCommit, quiet, read, refreshUntil, startApp, type } from "./harness.tsx";

const TRIAGE = "specs/INBOX-TRIAGE.md";
const ANSWER_COMMIT = "chore: answer the inbox triage";

const app = startApp({ agent: true });

/** The agent proposes a triage, committed as an agent would. */
function propose() {
  copyFileSync(fixture("INBOX-TRIAGE.md"), join(app.repo, TRIAGE));
  git(app.repo, "add", TRIAGE);
  git(app.repo, "commit", "--quiet", "--no-verify", "--message", "chore: propose an inbox triage");
}

/** A question's card, by its id. */
const question = (id: string) => document.getElementById(id) as HTMLElement;

/** The option of a question by its letter: its card's checkbox. */
const option = (id: string, letter: string) =>
  within(question(id)).getByRole("checkbox", {
    name: new RegExp(String.raw`^Option ${letter}\b`),
  }) as HTMLInputElement;

/** The `**Answer:**` line of a question of the triage file. */
function answerLine(id: string) {
  const lines = read(app.repo, TRIAGE).split("\n");
  const heading = lines.findIndex((line) => line.startsWith(`## ${id}:`));
  return lines.slice(heading).find((line) => line.startsWith("**Answer:**"));
}

/** Answers every question with A, each saved before the next. */
async function answerAll() {
  await screen.findAllByRole("checkbox");
  for (const id of ["Q1", "Q2", "Q3"]) {
    if (!option(id, "A").checked) {
      await click(option(id, "A"));
    }
    await waitFor(() => expect(answerLine(id)).toBe("**Answer:** A"));
  }
}

/** Presses Submit once the page drew the last answer saved. */
async function submit() {
  const button = screen.getByRole("button", { name: "Submit answers" }) as HTMLButtonElement;
  await waitFor(() => expect(button.disabled).toBe(false));
  await click(button);
}

/** The notes field, the last of the page's text fields. */
const notes = () => within(screen.getByRole("main")).getAllByRole("textbox").at(-1)!;

/** Whether a control is disabled, by either attribute. */
const disabled = (element: HTMLElement) =>
  (element.getAttribute("aria-disabled") ?? element.getAttribute("disabled")) !== null;

test("Organize with an agent starts a chat in the main checkout with the triage message", async () => {
  await app.open("/inbox");

  await click(await screen.findByRole("button", { name: "Organize with an agent" }));

  await waitFor(() => expect(app.agent.sent).toHaveLength(1));
  expect(app.agent.sent[0].text).toContain("INBOX-TRIAGE.md");
  expect(realpathSync(app.agent.opens[0].cwd)).toBe(realpathSync(app.repo));
  await waitFor(() => expect(window.location.pathname).toContain(app.path("/chats/")));
});

test("a triage waiting is linked from the inbox, which offers no second one, and is answered by tapping", async () => {
  propose();
  await app.open("/inbox");

  // The sidebar's links draw before the inbox's data: the triage's link is waited for.
  const link = await waitFor(() => {
    const found = screen
      .getAllByRole("link")
      .find((l) => l.getAttribute("href") === app.path("/inbox/triage"));
    expect(found, "the inbox links the triage").toBeTruthy();
    return found!;
  });
  expect(disabled(screen.getByRole("button", { name: "Organize with an agent" }))).toBe(true);
  await click(link);

  expect(window.location.pathname).toBe(app.path("/inbox/triage"));
  await screen.findAllByRole("checkbox");
  // The triage is no feature's: nothing to ask its agent about, and no image for the core to keep.
  expect(screen.queryByRole("button", { name: /ask the agent/i })).toBeNull();
  expect(screen.queryByRole("button", { name: /add image/i })).toBeNull();
  await click(option("Q1", "A"));
  await waitFor(() => expect(answerLine("Q1")).toBe("**Answer:** A"));
});

test("the answers and the notes are submitted in one commit, and the inbox offers to apply them", async () => {
  await app.open("/inbox/triage");
  await answerAll();
  // Notes typed and not saved: Submit saves them first, over the triage as the page wrote it.
  await type(notes(), "Start with the bug.");

  await submit();

  await waitFor(() => expect(lastCommit(app.repo)).toBe(ANSWER_COMMIT));
  expect(read(app.repo, TRIAGE)).toContain("status: answered");
  expect(read(app.repo, TRIAGE)).toContain("Start with the bug.");
  expect(git(app.repo, "status", "--porcelain")).toBe("");
});

test("an answered triage is applied in a new chat, and without an agent its message is given to copy", async () => {
  app.agent.sent.length = 0;
  await app.open("/inbox");
  await click(await screen.findByRole("button", { name: "Apply the answers" }));
  await waitFor(() => expect(app.agent.sent).toHaveLength(1));
  expect(app.agent.sent[0].text).toContain("INBOX-TRIAGE.md");
  // The page opens the new chat once the server answered: a page left before then would still
  // navigate away from the next one it opens.
  await waitFor(() => expect(window.location.pathname).toMatch(/\/chats\/[^/]+$/));

  cleanup();
  app.agent.installed = false;
  await app.sessions.check();
  await app.open("/inbox");
  await screen.findByRole("button", { name: /copy/i });
  expect(screen.queryByRole("button", { name: "Apply the answers" })).toBeNull();

  // The same without a triage: the message to start one is given to copy.
  cleanup();
  git(app.repo, "rm", "--quiet", TRIAGE);
  git(app.repo, "commit", "--quiet", "--no-verify", "--message", "chore: drop the triage");
  await app.open("/inbox");
  await click(await screen.findByRole("button", { name: "Organize with an agent" }));
  expect(await screen.findByRole("button", { name: /copy/i })).toBeTruthy();
  app.agent.installed = true;
  await app.sessions.check();
});

test("a triage answered on another page since is not submitted unseen", async () => {
  propose();
  await app.open("/inbox/triage");
  await answerAll();
  // The other page changes Q2's answer.
  writeFileSync(
    join(app.repo, TRIAGE),
    read(app.repo, TRIAGE).replace(/(## Q2:[^]*?)\*\*Answer:\*\* A\n/, "$1**Answer:** B\n"),
  );
  const before = lastCommit(app.repo);

  await type(notes(), "Start with the bug.");
  await submit();

  await quiet();
  expect(lastCommit(app.repo)).toBe(before);
  expect(answerLine("Q2")).toBe("**Answer:** B");
  expect(read(app.repo, TRIAGE)).not.toContain("Start with the bug.");
});

test("a hook's refusal keeps the answers, and Try again commits them", async () => {
  git(app.repo, "checkout", "--", TRIAGE);
  const hooks = join(app.repo, ".git/hooks");
  git(app.repo, "config", "core.hooksPath", hooks);
  writeFileSync(join(hooks, "pre-commit"), "#!/bin/sh\necho 'refused by the hook'\nexit 1\n", {
    mode: 0o755,
  });
  cleanup();
  await app.open("/inbox/triage");
  await screen.findAllByRole("checkbox");
  await answerAll();
  const before = lastCommit(app.repo);

  await submit();

  await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
  expect(lastCommit(app.repo)).toBe(before);
  // The answers stay written; read again, the triage shows as answered and keeps the refusal.
  await refreshUntil(() =>
    expect(screen.queryByRole("button", { name: "Submit answers" })).toBeNull(),
  );
  expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  writeFileSync(join(hooks, "pre-commit"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });

  await click(screen.getByRole("button", { name: /try again/i }));

  await waitFor(() => expect(lastCommit(app.repo)).toBe(ANSWER_COMMIT));
  expect(git(app.repo, "status", "--porcelain").trim()).toBe("");
  expect(readFileSync(join(app.repo, TRIAGE), "utf8")).toContain("status: answered");
});
