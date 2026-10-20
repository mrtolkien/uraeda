// A feature's sessions on its page (US5 of merge chats): the latest first, each with its status and
// its running sub-agents, "New session" opening a new one on its own page, and Stop for a working one.
import { screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { atRepo, click, type Fake, fakeAgent, fixtureRepo, renderPage, today } from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";

today("2026-10-12");

/** The page's sessions card, once drawn. */
async function sessionsCard() {
  await screen.findByRole("heading", { level: 2, name: "Sessions" });
  return within(screen.getByRole("region", { name: "Sessions" }));
}

/** A first session of the feature, its plan run done; then a second one, whose agent works. */
async function twoSessions(fake: Fake, repo: string) {
  const first = await fake.sessions.featureSession(repo, CLI);
  fake.adapter.script([{ text: "Planned.", type: "text" }]);
  const { turn } = await fake.sessions.send(repo, first.id, {
    text: "Plan the feature.",
    workflow: { trigger: "manual" },
  });
  await fake.sessions.settled(turn);
  const second = await fake.sessions.newSession(repo, CLI);
  await fake.sessions.send(repo, second.id, { text: "Build it." });
  await waitFor(() => expect(fake.adapter.sent).toHaveLength(2));
  fake.adapter.emit({ id: fake.adapter.sent[1].id, type: "accepted" });
  fake.adapter.emit({
    id: "task-1",
    input: {},
    kind: "other",
    name: "Task",
    subagent: { description: "Write the card's tests" },
    type: "toolStart",
  });
  return { first, second };
}

/** US5 more 2 */
test("a feature's page lists its sessions, latest first, with their sub-agents", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const { first } = await twoSessions(fake, repo);

  await renderPage(`/f/${CLI}`, repo, { agent: fake });

  const card = await sessionsCard();
  await waitFor(() => expect(card.getByText("Write the card's tests")).toBeTruthy());
  // The earlier session draws once its first turn is read, for its title.
  const links = await waitFor(() => {
    const found = card.getAllByRole("link");
    expect(found).toHaveLength(2);
    return found;
  });
  expect(links.map((link) => link.getAttribute("href"))).toEqual([
    atRepo(`/f/${CLI}/session`),
    atRepo(`/sessions/${first.id}`),
  ]);
  // Titled by their first run's step, or "Session" for a first message without a workflow.
  expect(card.getByRole("link", { name: /^Working Session Oct \d+, \d\d:\d\d$/ })).toBe(links[0]);
  expect(card.getByRole("link", { name: / Plan Oct \d+, / })).toBe(links[1]);
  // The sub-agent is listed under its session, before the earlier one.
  const subagent = card.getByText("Write the card's tests");
  expect(
    links[0].compareDocumentPosition(subagent) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    subagent.compareDocumentPosition(links[1]) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

/** US5.1 */
test("New session opens a session of the feature", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const first = await fake.sessions.featureSession(repo, CLI);
  await renderPage(`/f/${CLI}`, repo, { agent: fake });
  const card = await sessionsCard();
  expect(card.getAllByRole("link")).toHaveLength(1);

  await click(card.getByRole("button", { name: "New session" }));

  await waitFor(() => expect(window.location.pathname).toMatch(/\/sessions\/[^/]+$/));
  const id = decodeURIComponent(window.location.pathname.split("/").at(-1)!);
  expect(id).not.toBe(first.id);
  expect(fake.sessions.cache.session(id)?.folder).toBe(CLI);
  expect(fake.sessions.cache.turns(id)).toHaveLength(0);

  await renderPage(`/f/${CLI}`, repo, { agent: fake });
  const after = await sessionsCard();
  await waitFor(() =>
    expect(after.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      atRepo(`/f/${CLI}/session`),
      atRepo(`/sessions/${first.id}`),
    ]),
  );
});

test("Stop stops the working session", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await twoSessions(fake, repo);
  const { agent } = await renderPage(`/f/${CLI}`, repo, { agent: fake });
  const card = await sessionsCard();

  await click(await card.findByRole("button", { name: "Stop" }));

  await waitFor(() => expect(agent.interrupts).toBe(1));
  expect(card.getAllByRole("button", { name: "Stop" })).toHaveLength(1);
});
