// "Set up with the agent" fills a new session's composer with the setup's message, though the New
// page is open already. A draft there stays, after the message, as a recommended message is
// inserted: Send sends the setup, and nothing typed is lost.
import { act, screen, waitFor } from "@testing-library/react";
import { SET_UP_PROJECT } from "uraeda-server/round-messages";
import { expect, test } from "vite-plus/test";
import { navigate } from "../routes.tsx";
import {
  atRepo,
  fakeAgent,
  fixtureRepo,
  renderPage,
  serverFetch,
  today,
  type,
} from "./helpers.tsx";

today("2026-10-16");

test("the setup's message comes before a draft already in the composer", async () => {
  const fake = await fakeAgent();
  const repo = fixtureRepo();
  await renderPage("/new?kind=session", repo, {
    agent: fake,
    fetch: serverFetch(repo, fake.sessions),
  });
  await type(await screen.findByRole("textbox", { name: "Message Claude Code" }), "Old draft");

  await act(async () => navigate(atRepo("/new?kind=session"), { insert: "setup" }));

  const box = await screen.findByRole("textbox", { name: "Message Claude Code" });
  await waitFor(() => expect(box.textContent).toBe(`${SET_UP_PROJECT}\nOld draft`));
});
