// The edge case "No agent on this machine": "Start the change" starts the change, and its page
// opens with the workflow's message in its composer, unsent, as a feature's hand-over does.
import { screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { atRepo, click, fakeAgent, fixtureRepo, renderPage, today, type } from "./helpers.tsx";

today("2026-10-16");

const FOLDER = "2026-10-16-centre-x";

test("without the agent, the change's page opens with its message unsent", async () => {
  const fake = await fakeAgent({ installed: false });
  await renderPage("/changes/new", fixtureRepo(), { agent: fake });

  const box = await screen.findByRole("textbox", { name: "Message Claude Code" });
  await type(box, "Centre the x in failure circles\n\nIn failures the x sits low in its circle.");
  const slug = screen.getByRole("textbox", { name: "Slug" }) as HTMLInputElement;
  await waitFor(() => expect(slug.value).toBe("centre-x"));
  await click(screen.getByRole("button", { name: "Start the change" }));

  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/f/${FOLDER}/session`)));
  expect(window.location.search).toBe("?continue=start");
  // The session's composer, holding the workflow's message, unsent.
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Message Claude Code" }).textContent).toMatch(
      new RegExp(`^/uraeda:uraeda Continue the change specs/changes/${FOLDER}/`),
    ),
  );
  expect(screen.getByRole("button", { name: "Start the agent" })).toBeTruthy();
  expect(fake.adapter.sent).toHaveLength(0);
});
