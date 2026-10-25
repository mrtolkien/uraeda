// US4.1 and US4.6: a change's session keeps the crumbs back to its page, and tells about its agent
// in the change's words. Its column is the session's, `session-column.test.tsx`'s.
import { cleanup, screen, within } from "@testing-library/react";
import { addChange } from "uraeda-binding/test-utils";
import { beforeEach, expect, test } from "vite-plus/test";
import { atRepo, atWidth, fakeAgent, fixtureRepo, renderPage } from "./helpers.tsx";

const FOLDER = "2026-10-16-header-logo";

beforeEach(() => atWidth(1440));

// US4.1 and US4.6, then US3 of the feature page redesign: a change opens the same page as a
// feature, and its session keeps the crumbs back to it, as a feature's does.
test("a change's session has crumbs back to its page, as a feature's does", async () => {
  const repo = fixtureRepo();
  addChange(repo, FOLDER, { "proposal.md": "# A home logo\n" });

  await renderPage(`/f/${FOLDER}/session`, repo, { agent: true });

  const crumbs = within(await screen.findByRole("navigation", { name: "Breadcrumbs" }));
  expect(await crumbs.findByText("Session")).toBeTruthy();
  expect(crumbs.getByRole("link", { name: "A home logo" }).getAttribute("href")).toBe(
    atRepo(`/f/${FOLDER}`),
  );

  cleanup();
  await renderPage("/f/2026-10-12-cli-tuis/session", repo, { agent: true });

  const feature = within(await screen.findByRole("navigation", { name: "Breadcrumbs" }));
  expect(await feature.findByText("Session")).toBeTruthy();
});

// US4.1: a change's page says "change", not "feature", when its agent stopped while the step still
// waits on it.
test("a change's agent stopped before a gate is told about in the change's words", async () => {
  const repo = fixtureRepo();
  addChange(repo, FOLDER, { "proposal.md": "# A home logo\n" });
  const fake = await fakeAgent();
  fake.adapter.script([{ text: "Investigated.", type: "text" }]);
  const session = await fake.sessions.featureSession(repo, FOLDER);
  const { turn } = await fake.sessions.send(repo, session.id, {
    text: "Continue the change.",
    workflow: { trigger: "manual" },
  });
  await fake.sessions.settled(turn);

  await renderPage(`/f/${FOLDER}/session`, repo, { agent: fake });

  expect(await screen.findByText("The agent stopped before a human gate.")).toBeTruthy();
  expect(
    screen.getByText(
      "The change still waits on the agent. Read its last message, then tell it how to go on.",
    ),
  ).toBeTruthy();
});
