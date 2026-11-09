// The feature's "…" postpones it: its latest session gets the postpone message at once, made when it
// has none, and opens, as the agent writes the proposal the feature leaves behind.
import { screen, waitFor } from "@testing-library/react";
import { postponeMessage } from "uraeda-server/round-messages";
import { expect, test } from "vite-plus/test";
import { sessionIdPath } from "../routeTable.ts";
import { atRepo, click, fakeAgent, fixtureRepo, git, renderPage } from "./helpers.tsx";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** A feature at its plan, on its branch. */
const FOLDER = "2026-10-12-cli-tuis";

const MESSAGE = postponeMessage({
  branch: FOLDER,
  kind: "feature",
  path: `specs/${FOLDER}`,
});

/** Picks "Postpone the feature", or the change, in its "…". */
async function postpone(kind: "change" | "feature" = "feature") {
  const name = kind === "change" ? "Change" : "Feature";
  await click(await screen.findByRole("button", { name: `${name} actions` }));
  await click(await screen.findByRole("menuitem", { name: `Postpone the ${kind}` }));
}

/** A change started in `repo`: its folder on the default branch, and its branch from there. */
function startedChange(repo: string, folder: string) {
  const at = join(repo, "specs", "changes", folder);
  mkdirSync(at, { recursive: true });
  writeFileSync(join(at, "proposal.md"), "# Centre the x\n\nThe close button sits off centre.\n");
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", `chore: start ${folder}`);
  git(repo, "branch", `change/${folder}`);
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

test("a change's Postpone names the change, its folder, and its branch", async () => {
  const agent = await fakeAgent();
  const repo = fixtureRepo();
  const folder = "2026-10-16-centred-x";
  startedChange(repo, folder);
  await renderPage(`/f/${folder}`, repo, { agent });

  await postpone("change");

  await waitFor(() => expect(agent.adapter.sent).toHaveLength(1));
  const message = postponeMessage({
    branch: `change/${folder}`,
    kind: "change",
    path: `specs/changes/${folder}`,
  });
  expect(agent.adapter.sent[0]!.text.endsWith(`\n${message}`)).toBe(true);
});

test("a refused Postpone says why under the title, and stays on the page", async () => {
  const agent = await fakeAgent({ installed: false });
  const repo = fixtureRepo();
  await renderPage(`/f/${FOLDER}`, repo, { agent });

  await postpone();

  // The title's error banner holds the refusal.
  expect((await screen.findByRole("alert")).textContent).toMatch(/not available/i);
  expect(agent.adapter.sent).toEqual([]);
  expect(window.location.pathname).toBe(atRepo(`/f/${FOLDER}`));
});
