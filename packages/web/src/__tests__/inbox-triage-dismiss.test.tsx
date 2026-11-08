// The triage's banner dismisses it: the file is deleted in a commit of its own, and "Organize with
// AI" comes back to ask for a new one. A triage holding answers saved but not submitted asks first,
// as those are lost for good; one committed as it is goes at once, as git keeps it.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { atWidth, click, fakeAgent, fixture, fixtureRepo, git, renderPage } from "./helpers.tsx";

const TRIAGE = "specs/INBOX-TRIAGE.md";

beforeEach(() => {
  atWidth(1440);
  forgetUnsaved();
});

/** A repository whose main checkout holds the fixture's triage, committed. */
function triageRepo() {
  const repo = fixtureRepo();
  copyFileSync(fixture("INBOX-TRIAGE.md"), join(repo, TRIAGE));
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "chore: propose an inbox triage");
  return repo;
}

const subject = (repo: string) => git(repo, "log", "-1", "--format=%s").trim();

/** The inbox page over `repo`, with an agent, once the triage's banner shows its Dismiss. */
async function inboxWithTriage(repo: string) {
  await renderPage("/inbox", repo, { agent: await fakeAgent() });
  await screen.findByText("An inbox triage waits for your answers");
  return screen.findByRole("button", { name: "Dismiss" });
}

// Break: Dismiss that asks first, leaves the file, or commits more than the triage.
test("Dismiss deletes a committed triage at once, and Organize with AI comes back", async () => {
  const repo = triageRepo();
  // A note added since, not committed: the dismissal's commit leaves it out.
  const inbox = `${readFileSync(join(repo, "specs/INBOX.md"), "utf8")}\n- A new note\n`;
  writeFileSync(join(repo, "specs/INBOX.md"), inbox);

  await click(await inboxWithTriage(repo));

  expect(screen.queryByRole("dialog")).toBeNull();
  await screen.findByRole("button", { name: "Organize with AI" });
  expect(screen.queryByText("An inbox triage waits for your answers")).toBeNull();
  expect(existsSync(join(repo, TRIAGE))).toBe(false);
  await waitFor(() => expect(subject(repo)).toBe("chore: dismiss the inbox triage"));
  expect(git(repo, "show", "--name-only", "--format=", "HEAD").trim()).toBe(TRIAGE);
  expect(readFileSync(join(repo, "specs/INBOX.md"), "utf8")).toBe(inbox);
});

// Break: unsubmitted answers deleted without a question.
test("a triage with answers not submitted asks before Dismiss deletes them", async () => {
  const repo = triageRepo();
  const answered = readFileSync(join(repo, TRIAGE), "utf8").replace(
    "**Answer:**\n",
    "**Answer:** A\n",
  );
  writeFileSync(join(repo, TRIAGE), answered);
  const dismiss = await inboxWithTriage(repo);

  await click(dismiss);
  const dialog = await screen.findByRole("dialog", { name: "Dismiss the inbox triage?" });
  await click(within(dialog).getByRole("button", { name: /^Keep it/ }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(readFileSync(join(repo, TRIAGE), "utf8")).toBe(answered);

  await click(screen.getByRole("button", { name: "Dismiss" }));
  const again = await screen.findByRole("dialog", { name: "Dismiss the inbox triage?" });
  await click(within(again).getByRole("button", { name: /^Dismiss/ }));

  await screen.findByRole("button", { name: "Organize with AI" });
  expect(existsSync(join(repo, TRIAGE))).toBe(false);
  await waitFor(() => expect(subject(repo)).toBe("chore: dismiss the inbox triage"));
});
