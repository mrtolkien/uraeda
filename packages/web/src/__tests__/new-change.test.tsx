// The edge case "No agent on this machine": "Start the change" starts the change, and its page
// opens with the workflow's message in its composer, unsent, as a feature's hand-over does. A start
// that answers once the human left the page opens nothing.
import { act, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { navigate } from "../routes.tsx";
import {
  atRepo,
  click,
  fakeAgent,
  fixtureRepo,
  quiet,
  renderPage,
  serverFetch,
  today,
  type,
} from "./helpers.tsx";

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

test("a start that answers after the human left opens nothing, and shows progress until then", async () => {
  const fake = await fakeAgent({ installed: false });
  const repo = fixtureRepo();
  const server = serverFetch(repo, fake.sessions);
  const held: Array<() => void> = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (typeof init?.body === "string" && init.body.includes("change.start")) {
      await new Promise<void>((resolve) => held.push(resolve));
    }
    return server(input, init);
  };
  await renderPage("/changes/new", repo, { agent: fake, fetch });
  const box = await screen.findByRole("textbox", { name: "Message Claude Code" });
  await type(box, "Centre the x in failure circles");
  const slug = screen.getByRole("textbox", { name: "Slug" }) as HTMLInputElement;
  await waitFor(() => expect(slug.value).toBe("centre-x"));
  const start = screen.getByRole("button", { name: "Start the change" });

  await click(start);
  await waitFor(() => expect(held).toHaveLength(1));
  // Busy, its name kept, while the change starts.
  expect(start.getAttribute("aria-busy")).toBe("true");
  await act(async () => navigate(atRepo("/priorities")));
  await act(async () => held.shift()!());
  await quiet();

  expect(window.location.pathname).toBe(atRepo("/priorities"));
  expect(window.location.search).toBe("");
});
