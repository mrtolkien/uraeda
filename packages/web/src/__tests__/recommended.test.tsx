// US4: the session's composer offers the one recommended message, inserted unsent, and anything
// typed can always be sent.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor, within } from "@testing-library/react";
import { addPlan, temporaryFolder } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import {
  atRepo,
  click,
  type Fake,
  fakeAgent,
  fixtureRepo,
  git,
  quiet,
  renderPage,
  today,
  type,
} from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";
const WEB_UI = "2026-10-11-web-ui";

/** The plan's message, which the CLI's feature recommends: its spec is approved, with no plan. */
const PLAN = [
  `/uraeda Continue the feature specs/${CLI}/ on branch ${CLI}: Write the plan, starting with skills/uraeda/references/plan.md.`,
  "Stop when the plan waits for my review, and earlier only if you need a decision from me.",
].join("\n");

/** The workflow's message once round 01 of the web UI is answered. */
const ANSWERED = [
  `/uraeda Continue the feature specs/${WEB_UI}/ on branch ${WEB_UI}: Write the spec from the answers, starting with skills/uraeda/references/spec.md.`,
  "Stop when the spec waits for my review, and earlier only if you need a decision from me.",
].join("\n");

const NOTHING = "No recommended message: the feature waits on you";

today("2026-10-12");

/** The session's composer, once it is drawn. */
function composer() {
  return screen.findByRole("textbox", { name: "Message Claude Code" });
}

/** The button inserting the plan's message, once the recommendation is read. */
function insertPlan() {
  return screen.findByRole("button", { name: "Insert: Continue, write the plan" });
}

/** US4.1 */
test("the composer inserts the step's message, unsent", async () => {
  const { agent } = await renderPage(`/f/${CLI}/session`, fixtureRepo(), { agent: true });

  await click(await insertPlan());

  await waitFor(async () => expect((await composer()).textContent).toBe(PLAN));
  // Every request the click made is answered: none sent the message.
  await quiet();
  expect(agent.sent).toHaveLength(0);
  expect(screen.getByRole("button", { name: "Start the agent" })).toBeTruthy();
  // Inserted: the button goes until the composer is emptied.
  expect(screen.queryByRole("button", { name: /^Insert: / })).toBeNull();
});

/** US4.2 */
test("a feature waiting on you recommends nothing, and a typed message still sends", async () => {
  const { agent } = await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: true });

  expect(await screen.findByText(NOTHING)).toBeTruthy();
  await type(await composer(), "Why this order?");
  await click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(agent.sent).toHaveLength(1));
  // A chat: the agent reads the chat's opening, not a step's message.
  expect(agent.sent[0].text).toContain("A human is chatting with you about the feature");
  expect(agent.sent[0].text).toContain("Why this order?");
});

/** Review focus 7 */
test("inserting keeps what was typed after the message", async () => {
  await renderPage(`/f/${CLI}/session`, fixtureRepo(), { agent: true });
  await type(await composer(), "Why A in Q6?");

  await click(await insertPlan());

  await waitFor(async () => expect((await composer()).textContent).toBe(`${PLAN}\nWhy A in Q6?`));
});

test("emptying the composer drops the inserted message: Send is back", async () => {
  await renderPage(`/f/${CLI}/session`, fixtureRepo(), { agent: true });
  await click(await insertPlan());
  await waitFor(async () => expect((await composer()).textContent).toBe(PLAN));

  await type(await composer(), "");

  expect(await insertPlan()).toBeTruthy();
  expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Start the agent" })).toBeNull();
});

/** US4 more 1 */
test("a message sent after the step moved shows it went as a chat", async () => {
  const { agent, repo } = await renderPage(`/f/${CLI}/session`, fixtureRepo(), { agent: true });
  await click(await insertPlan());
  await waitFor(async () => expect((await composer()).textContent).toBe(PLAN));

  // Another tab writes the plan, awaiting the human's review: the step moved on, which the server
  // reads as the message is sent.
  addPlan(repo, CLI, [["Do", 0, 1]], "awaiting-human");
  await click(screen.getByRole("button", { name: "Start the agent" }));

  expect(await screen.findByText("Sent as a chat: the feature now waits on you.")).toBeTruthy();
  await waitFor(() => expect(agent.sent).toHaveLength(1));
  expect(
    within(screen.getByRole("log", { name: "Conversation" })).queryByText("Run: Plan"),
  ).toBeNull();
});

/** US4 more 2 */
test("Commit and start the agent still fills the step's message", async () => {
  const repo = fixtureRepo();
  const worktree = join(repo, ".worktrees", WEB_UI);
  git(repo, "worktree", "add", "--quiet", worktree, WEB_UI);
  const round = join(worktree, "specs", WEB_UI, "clarifications-01.md");
  writeFileSync(
    round,
    readFileSync(round, "utf8").replaceAll(/^\*\*Answer:\*\*$/gm, "**Answer:** A"),
  );
  const { agent } = await renderPage(`/f/${WEB_UI}/clarifications-01.md`, repo, { agent: true });

  await click(await screen.findByRole("button", { name: "Commit and start the agent" }));

  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/f/${WEB_UI}/session`)));
  const box = await composer();
  await waitFor(() => expect(box.textContent).toBe(ANSWERED));
  // The hand-over's message holds the composer: no other message is offered beside it.
  expect(screen.queryByRole("button", { name: /^Insert: / })).toBeNull();
  expect(agent.sent).toHaveLength(0);
});

/**
 * Opens the CLI's session, whose plan follows its spec's approval, with a chat turn ended on its
 * open process, then inserts the plan's message.
 */
async function insertAfterChat(fake: Fake, settings?: { dir: string }) {
  fake.adapter.script([]);
  await renderPage(`/f/${CLI}/session`, fixtureRepo(), {
    agent: fake,
    ...(settings ? { settings } : {}),
  });
  await type(await composer(), "What is left?");
  await click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() =>
    expect(
      within(screen.getByRole("log", { name: "Conversation" })).getByText("What is left?"),
    ).toBeTruthy(),
  );
  await click(await insertPlan());
  await waitFor(async () => expect((await composer()).textContent).toBe(PLAN));
}

/** Presses Start the agent, and waits for the inserted message to reach the agent. */
async function start(fake: Fake) {
  fake.adapter.script([]);
  await click(screen.getByRole("button", { name: "Start the agent" }));
  await waitFor(() => expect(fake.adapter.sent).toHaveLength(2));
}

const freshSwitch = () =>
  screen.findByRole<HTMLInputElement>("switch", { name: "Build in a fresh session" });

/** The agents decision: the run after a spec's approval starts a fresh agent session. */
test("the message inserted after a spec's approval builds in a fresh session by default", async () => {
  const fake = await fakeAgent();
  await insertAfterChat(fake);
  await waitFor(async () => expect((await freshSwitch()).checked).toBe(true));

  await start(fake);

  // The chat's process is closed, and the run opens a new agent session.
  expect(fake.adapter.opens).toHaveLength(2);
  expect(fake.adapter.opens[1]?.resume).toBe(false);
  expect(fake.adapter.opens[1]?.nativeId).not.toBe(fake.adapter.opens[0]?.nativeId);
});

test("the inserted message's switch starts from the setting: off, the run continues the session", async () => {
  const dir = temporaryFolder("uraeda-config");
  writeFileSync(join(dir, "config.toml"), "[runs]\nbuild_in_fresh_session = false\n");
  const fake = await fakeAgent();
  await insertAfterChat(fake, { dir });
  await waitFor(async () => expect((await freshSwitch()).checked).toBe(false));

  await start(fake);

  expect(fake.adapter.opens).toHaveLength(1);
});
