// The actions by the session's composer: "Allow all (N)" beside Send (US3), and Archive in its
// footer (US4), both from the server's record, not the page's own count.
import { screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import {
  atWidth,
  click,
  type Fake,
  fakeAgent,
  fixtureRepo,
  refreshUntil,
  renderPage,
  today,
  type,
} from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";

today("2026-10-12");

/** Two blocked actions, each a rule of its own. */
const TWO = [
  { input: { command: "git push origin HEAD" }, tool: "Bash" },
  { input: { file_path: "src/cli.ts" }, tool: "Edit" },
];

/** Runs a turn of the feature's session that ends with `denials` blocked. */
async function blockedRun(fake: Fake, repo: string, denials: typeof TWO) {
  fake.adapter.script([{ denials, errors: [], interrupted: false, ok: true, type: "result" }]);
  const session = await fake.sessions.featureSession(repo, CLI);
  const { turn } = await fake.sessions.send(repo, session.id, {
    text: "Continue the feature.",
    workflow: { trigger: "manual" },
  });
  await fake.sessions.settled(turn);
  return session.id;
}

/** The session's transcript, once drawn. */
async function log() {
  return within(await screen.findByRole("log", { name: "Conversation" }));
}

/** A chat with one answered message. */
async function seedChat(fake: Fake, repo: string) {
  const chat = await fake.sessions.newChat(repo);
  fake.adapter.script([{ text: "Done.", type: "text" }]);
  const { turn } = await fake.sessions.send(repo, chat.id, { text: "List the drafts" });
  await fake.sessions.settled(turn);
  return chat.id;
}

test("US3.1: Allow all (2) beside Send allows both blocked actions in one turn", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await blockedRun(fake, repo, TWO);
  const { agent } = await renderPage(`/f/${CLI}/session`, repo, { agent: fake });

  await click(await screen.findByRole("button", { name: "Allow all (2)" }));

  await waitFor(() => expect(agent.sent).toHaveLength(2));
  expect(agent.opens.at(-1)?.allowed).toEqual(["Bash(git push origin HEAD)", "Edit(src/cli.ts)"]);
  await refreshUntil(() =>
    expect(
      within(screen.getByRole("log", { name: "Conversation" })).getAllByText(
        "Allowed for the session's process.",
      ),
    ).toHaveLength(2),
  );
});

test("US3.2: Allow all is disabled while the session works", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  // The turn is still running when its result arrives with a background sub-agent: it holds the
  // blocked actions and the session works.
  const session = await fake.sessions.featureSession(repo, CLI);
  const { cache } = fake.sessions;
  const turn = cache.addTurn({
    allowed: null,
    kind: "chat",
    sessionId: session.id,
    state: "running",
    step: null,
    trigger: null,
  });
  for (const denial of TWO) {
    cache.appendItem(turn, {
      allowed: false,
      kind: "denial",
      rule: denial.tool === "Bash" ? "Bash(git push origin HEAD)" : "Edit(src/cli.ts)",
      tool: denial.tool,
    });
  }
  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });

  const all = await screen.findByRole("button", { name: "Allow all (2)" });

  expect(all.hasAttribute("disabled")).toBe(true);
});

test("US3 more 1: one blocked action has no Allow all, and its Allow and retry stands alone", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await blockedRun(fake, repo, TWO.slice(0, 1));
  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });

  expect(await (await log()).findByRole("button", { name: "Allow and retry" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Allow all/ })).toBeNull();
});

test("US3 more 2: after a normal message, Allow all is gone and the old banners keep their buttons", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await blockedRun(fake, repo, TWO);
  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });
  await screen.findByRole("button", { name: "Allow all (2)" });

  fake.adapter.script([{ text: "Fine.", type: "text" }]);
  await type(await screen.findByRole("textbox", { name: "Message Claude Code" }), "Never mind");
  await click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(screen.queryByRole("button", { name: /^Allow all/ })).toBeNull());
  expect((await log()).getAllByRole("button", { name: "Allow and retry" })).toHaveLength(2);
});

test("US4.1: Archive is in the composer's footer, not the header, and the title still renames", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const id = await seedChat(fake, repo);
  await renderPage(`/chats/${id}`, repo, { agent: fake });

  const archive = await screen.findByRole("button", { name: "Archive" });

  expect(archive.closest("h1")).toBeNull();
  // After the transcript, with the composer, not in the header's block.
  const field = screen.getByRole("textbox", { name: "Message Claude Code" });
  expect(field.compareDocumentPosition(archive) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const heading = screen.getByRole("heading", { level: 1 });
  expect(heading.parentElement?.contains(archive)).toBe(false);
  expect(within(heading).getByRole("button", { name: "List the drafts" })).toBeTruthy();
});

test("US4.2: an archived chat reads Unarchive in the footer", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const id = await seedChat(fake, repo);
  await renderPage(`/chats/${id}`, repo, { agent: fake });

  await click(await screen.findByRole("button", { name: "Archive" }));

  expect(await screen.findByRole("button", { name: "Unarchive" })).toBeTruthy();
});

test("US4 more 1: a feature's session has no Archive", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await blockedRun(fake, repo, TWO);
  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });
  await screen.findByRole("textbox", { name: "Message Claude Code" });

  expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
});

test("Edge: Archive pressed while the session works archives it", async () => {
  atWidth(402);
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const id = await seedChat(fake, repo);
  fake.adapter.script([]);
  await fake.sessions.send(repo, id, { text: "And the closed ones?" });
  await renderPage(`/chats/${id}`, repo, { agent: fake });

  await click(await screen.findByRole("button", { name: "Archive" }));

  expect(await screen.findByRole("button", { name: "Unarchive" })).toBeTruthy();
});
