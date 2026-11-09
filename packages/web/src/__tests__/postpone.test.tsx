// The feature's "…" postpones it: its latest session gets the postpone message at once, made when it
// has none, and opens, as the agent writes the proposal the feature leaves behind.
import { screen, waitFor } from "@testing-library/react";
import { postponeMessage } from "uraeda-server/round-messages";
import { expect, test } from "vite-plus/test";
import { sessionIdPath } from "../routeTable.ts";
import { atRepo, click, fakeAgent, fixtureRepo, renderPage } from "./helpers.tsx";

/** A feature at its plan, on its branch. */
const FOLDER = "2026-10-12-cli-tuis";

const MESSAGE = postponeMessage({
  branch: FOLDER,
  kind: "feature",
  path: `specs/${FOLDER}`,
});

/** Picks "Postpone the feature" in the feature's "…". */
async function postpone() {
  await click(await screen.findByRole("button", { name: "Feature actions" }));
  await click(await screen.findByRole("menuitem", { name: "Postpone the feature" }));
}

test("Postpone sends its message to the feature's latest session, and opens it", async () => {
  const agent = await fakeAgent();
  const repo = fixtureRepo();
  const { cache } = agent.sessions;
  const root = await agent.sessions.mainRoot(repo);
  const latest = cache.createSession({
    agent: "fake",
    folder: FOLDER,
    nativeId: "n",
    repo: root,
    title: "Plan",
  });
  await renderPage(`/f/${FOLDER}`, repo, { agent });

  await postpone();

  await waitFor(() => expect(agent.adapter.sent).toHaveLength(1));
  // A chat's first message follows the session's opening.
  expect(agent.adapter.sent[0]!.text.endsWith(`\n${MESSAGE}`)).toBe(true);
  expect(cache.latestSession(root, FOLDER)?.id).toBe(latest.id);
  await waitFor(() => expect(window.location.pathname).toBe(atRepo(sessionIdPath(latest.id))));
});

test("Postpone makes the feature's first session when it has none", async () => {
  const agent = await fakeAgent();
  const repo = fixtureRepo();
  const root = await agent.sessions.mainRoot(repo);
  await renderPage(`/f/${FOLDER}`, repo, { agent });

  await postpone();

  await waitFor(() => expect(agent.adapter.sent).toHaveLength(1));
  // A chat's first message follows the session's opening.
  expect(agent.adapter.sent[0]!.text.endsWith(`\n${MESSAGE}`)).toBe(true);
  const made = agent.sessions.cache.latestSession(root, FOLDER);
  expect(made).toBeDefined();
  await waitFor(() => expect(window.location.pathname).toBe(atRepo(sessionIdPath(made!.id))));
});
