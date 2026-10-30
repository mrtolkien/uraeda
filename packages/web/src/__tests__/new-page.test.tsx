// The New page's start of a change, held: a start that answers late clears only the text it sent,
// not what the human typed after. The slug is asked in a dialog once the text is sent, and is not
// kept on the page. The lines of the priorities it was filled from leave them.
import { act, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { navigate } from "../routes.tsx";
import {
  atRepo,
  click,
  fakeAgent,
  fixtureRepo,
  quiet,
  read,
  renderPage,
  serverFetch,
  today,
  type,
} from "./helpers.tsx";

today("2026-10-16");

/** New change, its `change.start` requests held in `held` until released. */
async function renderHeld() {
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
  await renderPage("/new?kind=change", repo, { agent: fake, fetch });
  return held;
}

test("a start that answers late clears only the text it sent", async () => {
  const held = await renderHeld();
  await type(
    await screen.findByRole("textbox", { name: "Message Claude Code" }),
    "Centre the x in failure circles",
  );
  // Sending the text asks its slug, the one the core proposes for it.
  await click(screen.getByRole("button", { name: "Start the change" }));
  const dialog = await screen.findByRole("dialog", { name: "Name the change" });
  await waitFor(() =>
    expect((within(dialog).getByRole("textbox", { name: "Slug" }) as HTMLInputElement).value).toBe(
      "centre-x",
    ),
  );
  await click(within(dialog).getByRole("button", { name: "Start the change" }));
  await waitFor(() => expect(held).toHaveLength(1));
  await act(async () => navigate(atRepo("/priorities")));
  await screen.findByRole("heading", { level: 1, name: "Priorities" });
  await act(async () => navigate(atRepo("/new?kind=change")));

  // A newer text, typed while the first change starts.
  const box = await screen.findByRole("textbox", { name: "Message Claude Code" });
  await type(box, "Widen the sidebar");
  await act(async () => held.shift()!());
  await quiet();

  expect(`${window.location.pathname}${window.location.search}`).toBe(atRepo("/new?kind=change"));
  expect(screen.getByRole("textbox", { name: "Message Claude Code" }).textContent).toBe(
    "Widen the sidebar",
  );
});

/** New change, filled from the cards of the priorities' lines with these texts, in order. */
async function filledFrom(repo: string, texts: ReadonlyArray<string>) {
  const fake = await fakeAgent({ installed: false });
  await renderPage("/new?kind=change", repo, {
    agent: fake,
    fetch: serverFetch(repo, fake.sessions),
  });
  for (const text of texts) {
    await click(await screen.findByRole("button", { name: new RegExp(`^${text}`) }));
  }
  await quiet();
}

/** Starts the change in the composer, under the slug the core proposes. */
async function start() {
  await click(await screen.findByRole("button", { name: "Start the change" }));
  const dialog = await screen.findByRole("dialog", { name: "Name the change" });
  await waitFor(() =>
    expect(
      (within(dialog).getByRole("textbox", { name: "Slug" }) as HTMLInputElement).value,
    ).not.toBe(""),
  );
  await click(within(dialog).getByRole("button", { name: "Start the change" }));
  await quiet();
}

/** The start replaces only a line of Now: a line of Next it starts from is taken out as before. */
test("a change started from a line of Next takes it out of the priorities", async () => {
  const repo = fixtureRepo();
  await filledFrom(repo, ["Claude Code runner"]);
  expect(screen.getByRole("textbox", { name: "Message Claude Code" }).textContent).toContain(
    "Claude Code runner (triggered manually)",
  );

  await start();

  await waitFor(() =>
    expect(read(repo)).not.toContain("\n- Claude Code runner (triggered manually)\n"),
  );
  expect(read(repo)).toContain("Git listener process");
});
