// The feature page's "Next" and its one button: Continue hands the feature over to the session
// with the message unsent (feature-page US2.2, SC-002), before what was typed; and "Next" follows
// the feature's live state and the agent's presence.
import { act, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { navigate } from "../routes.tsx";
import {
  atRepo,
  click,
  type Fake,
  fakeAgent,
  fixtureRepo,
  refreshUntil,
  renderPage,
  today,
  type,
} from "./helpers.tsx";

// The fixture's feature whose spec is approved and whose plan the agent writes.
const CLI = "2026-10-12-cli-tuis";

today("2026-10-12");

const CONTINUE = { name: "Continue, write the plan" };

/** The session's composer text, once it is drawn. */
async function composerText() {
  return (await screen.findByRole("textbox", { name: "Message Claude Code" })).textContent;
}

/** The page's "Next", once drawn. */
async function next() {
  return within(await screen.findByRole("region", { name: "Next" }));
}

test("Continue opens the session with the message unsent, and Send reads Start the agent", async () => {
  const { agent } = await renderPage(`/f/${CLI}`, fixtureRepo(), { agent: true });

  await click(await screen.findByRole("button", CONTINUE));

  expect(await screen.findByRole("button", { name: "Start the agent" })).toBeTruthy();
  await waitFor(async () => expect(await composerText()).toContain("Write the plan"));
  expect(agent.sent).toHaveLength(0);
});

test("Continue puts the message before typed text", async () => {
  await renderPage(`/f/${CLI}/session`, fixtureRepo(), { agent: true });
  await type(await screen.findByRole("textbox", { name: "Message Claude Code" }), "my note");
  await act(async () => navigate(atRepo(`/f/${CLI}`)));

  await click(await screen.findByRole("button", CONTINUE));

  await waitFor(async () => expect(await composerText()).toContain("Write the plan"));
  const text = (await composerText()) ?? "";
  expect(text.indexOf("Write the plan")).toBeLessThan(text.indexOf("my note"));
  expect(text).toContain("my note");
});

test("Next follows the live update: a turn starts and the button turns into Open the session", async () => {
  const repo = fixtureRepo();
  const fake: Fake = await fakeAgent();
  await renderPage(`/f/${CLI}`, repo, { agent: fake });
  await screen.findByRole("button", CONTINUE);

  const session = await fake.sessions.featureSession(repo, CLI);
  await fake.sessions.send(repo, session.id, {
    text: "Continue the feature.",
    workflow: { trigger: "manual" },
  });

  await waitFor(() => expect(fake.adapter.sent).toHaveLength(1));
  fake.adapter.emit({ id: fake.adapter.sent[0].id, type: "accepted" });

  await refreshUntil(() =>
    expect(
      within(screen.getByRole("region", { name: "Next" })).getByRole("link", {
        name: "Open the session",
      }),
    ).toBeTruthy(),
  );
  expect(screen.queryByRole("button", CONTINUE)).toBeNull();
});

test("without the agent, Next says so and has no button", async () => {
  await renderPage(`/f/${CLI}`, fixtureRepo());

  const pane = await next();
  expect(await pane.findByText("Claude Code is not available on this machine")).toBeTruthy();
  expect(pane.queryByRole("button")).toBeNull();
  expect(pane.queryByRole("link")).toBeNull();
});
