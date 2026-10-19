// Flow: the constitution and decisions page, and the decisions check. A principle or a decision
// opens in the pane at an address that reload keeps (ui-layout); the sort is the human's and is
// kept; a check the agent proposes is answered into its own file and committed alone; without an
// agent the messages are given to copy. The tests run in order on one repository.
import { copyFileSync, cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { fixture } from "uraeda-binding/test-utils";
import { APPLY_DECISIONS_CHECK, RUN_DECISIONS_CHECK } from "uraeda-server/round-messages";
import { expect, test } from "vite-plus/test";
import { click, fixtureRepo, git, lastCommit, read, refreshUntil, startApp } from "./harness.tsx";

const CHECK = "specs/DECISIONS-CHECK.md";

/** The fixture repository where the stack decision changed last, a day after the others. */
function repository() {
  const repo = fixtureRepo();
  const stack = join(repo, "specs/decisions/stack.md");
  writeFileSync(stack, `${readFileSync(stack, "utf8")}- The binding's types\n`);
  git(repo, "add", "--all");
  const date = "2027-01-05T12:00:00Z";
  Object.assign(process.env, { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
  try {
    git(repo, "commit", "--quiet", "--no-verify", "--message", "docs: stack");
  } finally {
    delete process.env.GIT_AUTHOR_DATE;
    delete process.env.GIT_COMMITTER_DATE;
  }
  return repo;
}

const app = startApp({ agent: true, repo: repository });

/** The decisions the list links to, in the list's order, by their address. */
function listed() {
  const prefix = app.path("/decisions/");
  return screen
    .getAllByRole("link")
    .map((link) => link.getAttribute("href") ?? "")
    .filter((href) => href.startsWith(prefix) && !href.includes("/constitution/"))
    .map((href) => href.slice(prefix.length));
}

/** The link of the page to an address. */
function linkTo(path: string) {
  const link = screen.getAllByRole("link").find((l) => l.getAttribute("href") === app.path(path));
  if (!link) {
    throw new Error(`no link to ${path}`);
  }
  return link;
}

/** A control's disabled state, as Astryx sets it. */
const disabled = (element: HTMLElement) =>
  (element.getAttribute("aria-disabled") ?? element.getAttribute("disabled")) !== null;

test("a decision and a principle open in the pane at an address a reload keeps", async () => {
  await app.open("/decisions");
  await screen.findAllByRole("link");

  await click(linkTo("/decisions/git"));
  expect(window.location.pathname).toBe(app.path("/decisions/git"));
  // The pane beside the list reads the decision: its own title, from the file.
  const pane = await screen.findByRole("region", { name: /detail/i });
  expect(within(pane).getAllByText(/git/i).length).toBeGreaterThan(0);

  await app.open("/decisions/git", { reload: true });
  expect(window.location.pathname).toBe(app.path("/decisions/git"));
  expect(
    within(await screen.findByRole("region", { name: /detail/i })).getAllByText(/git/i),
  ).toBeTruthy();
  // The list stays beside it: the decisions link on.
  expect(listed()).toContain("stack");

  cleanup();
  await app.open("/decisions");
  await screen.findAllByRole("link");
  const principle = screen
    .getAllByRole("link")
    .find((l) => l.getAttribute("href")?.startsWith(app.path("/decisions/constitution/")))!;
  await click(principle);
  expect(window.location.pathname).toMatch(/\/decisions\/constitution\//);
  expect(await screen.findByRole("region", { name: /detail/i })).toBeTruthy();
});

test("the decisions list the last changed first, and the sort the human picks is kept", async () => {
  await app.open("/decisions");
  await screen.findAllByRole("link");
  // The stack decision changed last.
  expect(listed()[0]).toBe("stack");

  await click(screen.getByRole("combobox"));
  await click(await screen.findByRole("option", { name: "A to Z" }));
  const sorted = [...listed()].sort();
  await waitFor(() => expect(listed()).toEqual(sorted));

  await app.open("/decisions", { reload: true });
  await screen.findAllByRole("link");
  await waitFor(() => expect(listed()).toEqual(sorted));
});

test("without an agent, the messages of the check are given to copy", async () => {
  app.agent.installed = false;
  await app.sessions.check();
  await app.open("/decisions");

  await click(await screen.findByRole("button", { name: "Check decisions" }));

  expect(await screen.findByText(RUN_DECISIONS_CHECK)).toBeTruthy();
  expect(app.agent.sent).toHaveLength(0);
  app.agent.installed = true;
  await app.sessions.check();
});

test("Check decisions starts a chat with the check's message", async () => {
  await app.open("/decisions");

  await click(await screen.findByRole("button", { name: "Check decisions" }));

  await waitFor(() => expect(app.agent.sent).toHaveLength(1));
  expect(app.agent.sent[0].text).toBe(RUN_DECISIONS_CHECK);
  await waitFor(() => expect(window.location.pathname).toContain(app.path("/chats/")));
});

/** The agent proposes a check: its answers file, and a candidate for the active decision. */
function propose() {
  const candidate = readFileSync(fixture("decisions-check/q1-a/ui-components.md"), "utf8")
    .replace("status: proposed", "status: active")
    .replace("approved-by:", "approved-by: mrtolkien");
  writeFileSync(join(app.repo, "specs/decisions/ui-components.md"), candidate);
  copyFileSync(fixture("DECISIONS-CHECK.md"), join(app.repo, CHECK));
  cpSync(fixture("decisions-check"), join(app.repo, "specs/decisions-check"), { recursive: true });
  git(app.repo, "add", "--all");
  git(app.repo, "commit", "--quiet", "--no-verify", "--message", "chore: propose a check");
}

/** The `**Answer:**` line of a question of the check. */
function answerLine(id: string) {
  const lines = read(app.repo, CHECK).split("\n");
  const heading = lines.findIndex((line) => line.startsWith(`## ${id}:`));
  return lines.slice(heading).find((line) => line.startsWith("**Answer:**"));
}

test("a waiting check cannot be asked twice, and its banner opens the page that answers it", async () => {
  propose();
  app.agent.sent.length = 0;
  await app.open("/decisions");
  const asking = await screen.findByRole("button", { name: "Check decisions" });
  await refreshUntil(() => expect(disabled(asking)).toBe(true));

  await click(asking);
  expect(app.agent.sent).toHaveLength(0);
  const banner = screen
    .getAllByRole("link")
    .find((l) => l.getAttribute("href") === app.path("/decisions/check"))!;
  await click(banner);

  expect(window.location.pathname).toBe(app.path("/decisions/check"));
  // Each option carries its candidate decision, as a spec shows a changed decision.
  expect((await screen.findAllByRole("checkbox")).length).toBeGreaterThan(0);
  expect(document.getElementById("q1-a-ui-components")).toBeTruthy();
});

test("the answers go to the check's own file, and Submit commits that file alone", async () => {
  await app.open("/decisions/check");
  await screen.findAllByRole("checkbox");
  const first = within(document.getElementById("Q1") as HTMLElement).getAllByRole("checkbox")[0];

  await click(first);
  await waitFor(() => expect(answerLine("Q1")).toBe("**Answer:** A"));
  // A file the page must not commit with the answers.
  writeFileSync(join(app.repo, "stray.txt"), "left alone\n");
  const submit = screen.getByRole("button", { name: "Submit answers" }) as HTMLButtonElement;
  await waitFor(() => expect(submit.disabled).toBe(false));
  await click(submit);

  await waitFor(() => expect(lastCommit(app.repo)).toBe("chore: answer the decisions check"));
  expect(git(app.repo, "show", "--name-only", "--format=", "HEAD").trim()).toBe(CHECK);
  await waitFor(() => expect(window.location.pathname).toBe(app.path("/decisions")));
});

test("an answered check offers to apply its answers in a chat", async () => {
  app.agent.sent.length = 0;
  await app.open("/decisions");

  await click(await screen.findByRole("button", { name: "Apply the answers" }));

  await waitFor(() => expect(app.agent.sent).toHaveLength(1));
  expect(app.agent.sent[0].text).toBe(APPLY_DECISIONS_CHECK);
});
