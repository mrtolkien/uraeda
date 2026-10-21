// The actions by the session's composer: "Allow all (N)" beside Send (US3), from the server's
// record, not the page's own count, and the session's "…" beside it (merge chats US2): making it a
// change, or its change a feature, renaming, archiving, and dropping its change or feature.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { addChange } from "uraeda-binding/test-utils";
import {
  atWidth,
  click,
  type Fake,
  fakeAgent,
  fixtureRepo,
  git,
  refreshUntil,
  renderPage,
  serverFetch,
  today,
  type,
} from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";
const CHANGE = "2026-10-20-login-redirect";

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

/** The session's "…" beside Send, opened: its actions' names. */
async function actions() {
  await click(await screen.findByRole("button", { name: "Session actions" }));
  await screen.findByRole("menu");
  return screen.getAllByRole("menuitem").map((item) => item.textContent);
}

/** The change `login-redirect`, with a session. */
async function seedChange(fake: Fake, repo: string) {
  addChange(repo, CHANGE, { "proposal.md": "# Login redirects twice\n" });
  await fake.sessions.featureSession(repo, CHANGE);
}

/** Merge chats US2.3, US4 */
test("a session's … holds Make it a change, Rename, Archive", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const id = await seedChat(fake, repo);
  await renderPage(`/sessions/${id}`, repo, { agent: fake });

  expect(await actions()).toEqual(["Make it a change", "Rename", "Archive"]);
});

test("Archive in a session's … archives it, and Unarchive brings it back", async () => {
  atWidth(402);
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const id = await seedChat(fake, repo);
  // Pressed while the session works.
  fake.adapter.script([]);
  await fake.sessions.send(repo, id, { text: "And the closed ones?" });
  await renderPage(`/sessions/${id}`, repo, { agent: fake });

  await actions();
  await click(screen.getByRole("menuitem", { name: "Archive" }));

  await waitFor(() => expect(fake.sessions.cache.session(id)?.archivedAt).not.toBeNull());
  // The page hears of it by its live update, which can come after the server's write.
  await actions();
  await waitFor(() =>
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toContain("Unarchive"),
  );
});

test("Rename in a session's … renames it, and every session's title renames in place", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await blockedRun(fake, repo, TWO);
  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });
  const heading = await screen.findByRole("heading", { level: 1 });
  expect(within(heading).getByRole("button")).toBeTruthy();

  await actions();
  await click(screen.getByRole("menuitem", { name: "Rename" }));
  await type(await screen.findByRole("textbox", { name: "Title" }), "CLI and TUIs");
  await click(screen.getByRole("button", { name: "Save" }));

  await refreshUntil(() =>
    expect(
      within(screen.getByRole("heading", { level: 1 })).getByText("CLI and TUIs"),
    ).toBeTruthy(),
  );
});

/** Merge chats US2 more 3 */
test("a change's … holds Make it a feature, Rename, Drop the change…", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedChange(fake, repo);
  await renderPage(`/f/${CHANGE}/session`, repo, { agent: fake });

  expect(await actions()).toEqual(["Make it a feature", "Rename", "Drop the change…"]);
});

test("a feature's … holds Rename and Drop the feature…", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await blockedRun(fake, repo, TWO);
  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });

  expect(await actions()).toEqual(["Rename", "Drop the feature…"]);
});

/** "Drop the change…", picked in the session's "…": its confirmation. */
async function askDrop() {
  await actions();
  await click(screen.getByRole("menuitem", { name: "Drop the change…" }));
  return within(await screen.findByRole("dialog", { name: "Drop the change login-redirect?" }));
}

/** Merge chats US2.4 */
test("Drop the change… asks first", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedChange(fake, repo);
  const server = serverFetch(repo, fake.sessions);
  let drops = 0;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (typeof init?.body === "string" && init.body.includes("feature.drop")) {
      drops++;
    }
    return server(input, init);
  };
  await renderPage(`/f/${CHANGE}/session`, repo, { agent: fake, fetch });
  const dialog = await askDrop();
  expect(
    dialog.getByText(
      `Its entry leaves Now, its worktree is removed, and its sessions are archived. Its branch stays, so nothing is lost: git branch -D change/${CHANGE} deletes it.`,
    ),
  ).toBeTruthy();
  expect(dialog.getByRole("button", { name: "Drop the change" })).toBeTruthy();
  await click(dialog.getByRole("button", { name: "Keep the change" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(drops).toBe(0);

  await click((await askDrop()).getByRole("button", { name: "Drop the change" }));

  await waitFor(() => expect(drops).toBe(1));
  await waitFor(() =>
    expect(git(repo, "branch", "--list", `change/${CHANGE}`).trim()).toBe(`change/${CHANGE}`),
  );
});

/** Merge chats edge: a dropped change's worktree with uncommitted changes. */
test("a drop over uncommitted work says what stayed, and offers no second drop", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedChange(fake, repo);
  git(repo, "worktree", "add", "--quiet", `.worktrees/${CHANGE}`, `change/${CHANGE}`);
  writeFileSync(join(repo, ".worktrees", CHANGE, "notes.txt"), "Half done.\n");
  await renderPage(`/f/${CHANGE}/session`, repo, { agent: fake });

  await click((await askDrop()).getByRole("button", { name: "Drop the change" }));

  expect(
    await screen.findByText(
      `Its worktree has uncommitted changes: it stays at .worktrees/${CHANGE}`,
    ),
  ).toBeTruthy();
  expect(
    screen.getByText(`Dropped the change login-redirect: its branch change/${CHANGE} stays.`),
  ).toBeTruthy();
  expect(existsSync(join(repo, ".worktrees", CHANGE, "notes.txt"))).toBe(true);
  // Read again, as once its feature lists the archived session no more: the session stays shown.
  await refreshUntil(() =>
    expect(
      screen.getByText(`Its worktree has uncommitted changes: it stays at .worktrees/${CHANGE}`),
    ).toBeTruthy(),
  );
  const after = await actions();
  expect(after).not.toContain("Drop the change…");
  expect(after).toContain("Rename");
});

/** Merge chats R2: a drop beside the human's own edits to the priorities commits nothing. */
test("a drop that could not commit the priorities says so", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedChange(fake, repo);
  const file = join(repo, "specs/PRIORITIES.md");
  const text = readFileSync(file, "utf8");
  writeFileSync(
    file,
    text.replace("## Next", `- [Login redirect](/specs/changes/${CHANGE}/proposal.md)\n\n## Next`),
  );
  git(repo, "commit", "--quiet", "--no-verify", "--all", "--message", "chore: login redirect");
  writeFileSync(file, `${readFileSync(file, "utf8")}\n- A thought of mine\n`);
  await renderPage(`/f/${CHANGE}/session`, repo, { agent: fake });

  await click((await askDrop()).getByRole("button", { name: "Drop the change" }));

  expect(
    await screen.findByText(
      "The priorities were not committed: if Now listed it, its entry’s removal waits in specs/PRIORITIES.md.",
    ),
  ).toBeTruthy();
  expect(readFileSync(file, "utf8")).not.toContain(CHANGE);
  expect(git(repo, "status", "--porcelain", "specs/PRIORITIES.md")).toBe(
    " M specs/PRIORITIES.md\n",
  );
});

/** Accessibility: Rename's dialog gives the focus back to the "…" it was opened from. */
test("Rename's dialog, closed, gives the focus back to the …", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const id = await seedChat(fake, repo);
  await renderPage(`/sessions/${id}`, repo, { agent: fake });

  await actions();
  await click(screen.getByRole("menuitem", { name: "Rename" }));
  await screen.findByRole("textbox", { name: "Title" });
  await click(screen.getByRole("button", { name: "Cancel" }));

  await waitFor(() => expect(screen.queryByRole("textbox", { name: "Title" })).toBeNull());
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Session actions" })),
  );
});
