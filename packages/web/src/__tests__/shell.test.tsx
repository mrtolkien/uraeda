// US6: Home goes home, and ＋, now the sidebar's next to Priorities (the inbox's spec), has its
// result confirmed by a toast with Undo. Below them, the chat's US3 and US4: the sessions in the sidebar.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { addPlan, ELEVEN } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import {
  atRepo,
  click,
  type Fake,
  fakeAgent,
  fixtureRepo,
  read,
  refreshUntil,
  renderPage,
  type,
} from "./helpers.tsx";

test("Home goes home (US6 4)", async () => {
  await renderPage("/priorities");
  await click(
    within(await screen.findByRole("navigation", { name: "Side navigation" })).getByRole("link", {
      name: "Home",
    }),
  );
  expect(window.location.pathname).toBe(atRepo("/"));
});

/**
 * Adds a line to Later through ＋, and returns its toast's Undo. The toast shows once the line is
 * written, and hides by itself after 5 seconds: a test takes its Undo at once, not after a wait.
 */
async function addToLater(text: string) {
  await click(await screen.findByRole("button", { name: "Add to the priorities" }));
  await type(await screen.findByLabelText("Priority"), text);
  await click(screen.getByRole("radio", { name: "Later" }));
  await click(screen.getByRole("button", { name: "Add" }));
  return screen.findByRole("button", { name: "Undo" });
}

test("＋ adds to Later with a toast and Undo, and the bar does not change (US6 5)", async () => {
  const { repo } = await renderPage("/");
  // The navigation, from the repository menu to ＋.
  let bar = (await screen.findAllByRole("button", { name: /^Uraeda \S/ }))[0]!;
  while (!within(bar).queryByRole("button", { name: "Add to the priorities" })) {
    bar = bar.parentElement!;
  }
  const before = bar.textContent;

  const undo = await addToLater("Show the agent's last commit");

  // The toast, not its announcement to screen readers, which repeats its text a moment later.
  expect(
    screen.getByText("Added to Later, not committed", { ignore: "script, style, [aria-live]" }),
  ).toBeTruthy();
  expect(read(repo)).toContain("  - with a cache\n- Show the agent's last commit\n");
  // The toast alone says where the line went: no count of changes or Commit shows in the
  // navigation.
  expect(bar.textContent).toBe(before);
  await click(undo);
  await waitFor(() => expect(read(repo)).not.toContain("Show the agent's last commit"));
});

test("＋'s Undo removes the line it added, wherever it is now (US6 5)", async () => {
  const { repo } = await renderPage("/");
  const undo = await addToLater("Show the agent's last commit");
  // Another line lands above it: the added line's place now holds another line.
  writeFileSync(
    join(repo, "specs/PRIORITIES.md"),
    read(repo).replace("## Later\n\n", "## Later\n\n- Added elsewhere\n"),
  );
  await click(undo);
  // Waits for the undo's whole text: a read during the write sees an empty file.
  await waitFor(() => {
    const text = read(repo);
    expect(text).not.toContain("Show the agent's last commit");
    expect(text).toContain(
      "- Added elsewhere\n- Nix + Docker based execution environments\n  - with a cache\n",
    );
  });
});

test("＋'s Undo refuses once the line it added is gone", async () => {
  const { repo } = await renderPage("/");
  const undo = await addToLater("Show the agent's last commit");
  const edited = read(repo).replace("Show the agent's last commit", "Show the last commit");
  expect(edited).not.toBe(read(repo));
  writeFileSync(join(repo, "specs/PRIORITIES.md"), edited);
  await click(undo);
  expect(
    await screen.findByText(
      'Could not undo: "Show the agent\'s last commit" is no longer in PRIORITIES.md.',
    ),
  ).toBeTruthy();
  expect(read(repo)).toBe(edited);
});

const CLI = "2026-10-12-cli-tuis";

/** The side navigation, as drawn on a wide screen. */
function nav() {
  return within(screen.getByRole("navigation", { name: "Side navigation" }));
}

/** The navigation's link to a feature, by its slug, or a chat, by its title. */
function row(name: string) {
  return nav().getByRole("link", { name: new RegExp(`^${name}, `) });
}

/** Waits for the navigation's link to a feature or a chat. */
function findRow(name: string) {
  return waitFor(() => row(name));
}

/** The status a navigation row shows. */
function statusOf(link: HTMLElement) {
  return within(link).getByRole("img").getAttribute("aria-label");
}

/** A chat started with its first message, its reply written, and its turn ended. */
async function seedChat(fake: Fake, repo: string, text: string, reply = "Done.") {
  const chat = await fake.sessions.newChat(repo);
  fake.adapter.script([{ text: reply, type: "text" }]);
  const { turn } = await fake.sessions.send(repo, chat.id, { text });
  await fake.sessions.settled(turn);
  return chat.id;
}

/** Writes an ended turn of a feature's session in the cache, blocked by `auto` mode or not. */
async function endedTurn(
  fake: Fake,
  repo: string,
  folder: string,
  state: "done" | "failed",
  blocked = false,
) {
  const session = await fake.sessions.featureSession(repo, folder);
  const { cache } = fake.sessions;
  const id = cache.addTurn({
    allowed: null,
    kind: "workflow",
    sessionId: session.id,
    state: "running",
    step: "plan",
    trigger: "manual",
  });
  if (blocked) {
    cache.appendItem(id, {
      allowed: false,
      kind: "denial",
      rule: "Bash(git push origin HEAD)",
      target: "git push origin HEAD",
      tool: "Bash",
    });
  }
  cache.endTurn(id, { state });
}

test("US3.1: a feature waiting on you shows Needs you", async () => {
  await renderPage("/");

  await screen.findByRole("searchbox", { name: "Search sessions" });
  expect(statusOf(row("web-ui"))).toBe("Needs you");
});

test("US3.2: a working turn shows Working, then New reply", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const session = await fake.sessions.featureSession(repo, CLI);
  await fake.sessions.send(repo, session.id, { text: "Plan it." });
  await renderPage("/", repo, { agent: fake });

  await waitFor(() => expect(statusOf(row("cli-tuis"))).toBe("Working"));
  fake.adapter.emit({ id: fake.adapter.sent[0].id, type: "accepted" });
  fake.adapter.emit({ text: "Planned.", type: "text" });
  fake.adapter.emit({ denials: [], errors: [], interrupted: false, ok: true, type: "result" });

  await refreshUntil(() => expect(statusOf(row("cli-tuis"))).toBe("New reply"));
});

test("US3.4: a running sub-agent shows in its feature's card, then leaves", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const session = await fake.sessions.featureSession(repo, CLI);
  await fake.sessions.send(repo, session.id, { text: "Plan it." });
  fake.adapter.emit({ id: fake.adapter.sent[0].id, type: "accepted" });
  fake.adapter.emit({
    id: "task-1",
    input: {},
    kind: "other",
    name: "Task",
    subagent: { description: "Map the runner code" },
    type: "toolStart",
  });
  await renderPage("/", repo, { agent: fake });

  await waitFor(() => expect(nav().getByText("Map the runner code")).toBeTruthy());
  expect(statusOf(row("cli-tuis"))).toBe("Working");
  fake.adapter.emit({ id: "task-1", isError: false, output: "Mapped.", type: "toolEnd" });

  await refreshUntil(() => expect(nav().queryByText("Map the runner code")).toBeNull());
  expect(row("cli-tuis")).toBeTruthy();
});

test("US3.5: search filters features and chats by message text, 200 ms after typing", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedChat(fake, repo, "How does the cache work?", "The cache uses WAL mode.");
  await seedChat(fake, repo, "Why is CI slow?");
  await renderPage("/", repo, { agent: fake });
  const search = await screen.findByRole("searchbox", { name: "Search sessions" });

  await type(search, "wal");

  // Not at once: the search waits for typing to stop.
  expect(row("cli-tuis")).toBeTruthy();
  await waitFor(() => expect(nav().queryByRole("link", { name: /^cli-tuis/ })).toBeNull());
  expect(row(String.raw`How does the cache work\?`)).toBeTruthy();
  expect(nav().queryByRole("link", { name: /Why is CI slow/ })).toBeNull();
  expect(nav().queryByRole("link", { name: /Web UI for the workflow files/ })).toBeNull();

  await type(search, "zzz");

  expect(await nav().findByText("No session matches “zzz”.")).toBeTruthy();
  expect(nav().queryByRole("link", { name: /How does the cache work/ })).toBeNull();
});

test("US3.6: Needs you sorts what needs the human before what needs their attention", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  // cli-tuis waits on the agent, and its run failed; web-ui waits on the human's answers.
  await endedTurn(fake, repo, CLI, "failed");
  await renderPage("/", repo, { agent: fake });
  await screen.findByRole("navigation", { name: "Side navigation" });

  const group = within(await nav().findByRole("group", { name: "Needs you" }));
  const links = () => group.getAllByRole("link");
  await waitFor(() =>
    expect(
      links()
        .map((link) => statusOf(link))
        .at(-1),
    ).toBe("Needs attention"),
  );
  const statuses = links().map((link) => statusOf(link));
  expect(statuses.slice(0, -1).every((status) => status === "Needs you")).toBe(true);
  expect(links().at(-1)!.getAttribute("aria-label")).toMatch(/^cli-tuis, /);
  expect(links().some((link) => /^web-ui, /.test(link.getAttribute("aria-label") ?? ""))).toBe(
    true,
  );
});

test("US4.1: New chat opens an empty chat, and its first message lists it in Chats", async () => {
  const fake = await fakeAgent();
  await renderPage("/", fixtureRepo(), { agent: fake });
  await screen.findByRole("navigation", { name: "Side navigation" });

  await click(await nav().findByRole("link", { name: "New chat" }));

  expect(window.location.pathname).toBe(atRepo("/chats/new"));
  const box = await screen.findByRole("textbox", { name: "Message Claude Code" });
  await type(box, "List the open draft files");
  await click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() =>
    expect(window.location.pathname).toMatch(new RegExp(`^${atRepo("/chats/")}(?!new)`)),
  );
  expect(fake.adapter.sent[0].text).toBe("List the open draft files");
  await refreshUntil(() => {
    const chats = within(nav().getByRole("group", { name: "Chats" }));
    const link = chats.getByRole("link", { name: /^List the open draft files, / });
    expect(statusOf(link)).toBe("Working");
  });
});

test("US4.2: renaming a chat in its header renames it in the sidebar", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const id = await seedChat(fake, repo, "List the open draft files");
  await renderPage(`/chats/${id}`, repo, { agent: fake });
  const main = within(await screen.findByRole("main"));

  await click(await main.findByRole("button", { name: "List the open draft files" }));
  const field = main.getByRole("textbox", { name: "Title" });
  await type(field, "Drafts");
  await act(async () => {
    fireEvent.keyDown(field, { key: "Enter" });
  });

  expect(await main.findByRole("button", { name: "Drafts" })).toBeTruthy();
  await refreshUntil(() => expect(row("Drafts")).toBeTruthy());
});

test("US4.3: an archived chat moves under Archived, and a message brings it back", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const id = await seedChat(fake, repo, "List the open draft files");
  await renderPage(`/chats/${id}`, repo, { agent: fake });
  const chats = () => within(nav().getByRole("group", { name: "Chats" }));
  await waitFor(() => expect(row("List the open draft files")).toBeTruthy());

  await click(await screen.findByRole("button", { name: "Archive" }));

  expect(await screen.findByRole("button", { name: "Unarchive" })).toBeTruthy();
  await refreshUntil(() =>
    expect(chats().queryByRole("link", { name: /List the open draft files/ })).toBeNull(),
  );
  await click(chats().getByRole("button", { name: "Archived" }));
  const archived = within(nav().getByRole("group", { name: "Archived" }));
  expect(archived.getByRole("link", { name: /List the open draft files/ })).toBeTruthy();

  fake.adapter.script([{ text: "Two drafts.", type: "text" }]);
  await type(
    await screen.findByRole("textbox", { name: "Message Claude Code" }),
    "And the closed ones?",
  );
  await click(screen.getByRole("button", { name: "Send" }));

  // The archived group, open, is inside the Chats section: the chat is back once it is gone.
  await refreshUntil(() => expect(nav().queryByRole("button", { name: "Archived" })).toBeNull());
  expect(chats().getByRole("link", { name: /^List the open draft files, / })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy();
});

test("US2.1: a feature's card reads its slug, and its title and step for screen readers", async () => {
  await renderPage("/", fixtureRepo(), { agent: await fakeAgent() });

  const cli = await findRow("cli-tuis");
  expect(cli.textContent).toContain("cli-tuis");
  expect(cli.textContent).not.toContain("CLI TUIs");
  expect(cli.getAttribute("aria-label")).toBe("cli-tuis, CLI TUIs, Plan, Idle");
});

test("US2.2, US2.3: a feature at its implementation shows its task on its card, which opens it", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  await renderPage("/", repo, { agent: await fakeAgent() });

  const card = await waitFor(() => {
    const link = row("cli-tuis");
    expect(link.getAttribute("aria-label")).toContain("Task 7 of 11, Session column");
    return link;
  });
  expect(nav().getByText("7/11 · Session column")).toBeTruthy();
  await click(card);

  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/f/${CLI}`)));
  expect(nav().getByRole("link", { current: "page" })).toBe(row("cli-tuis"));
});

test("US2.4: an agent's checked boxes move the task, its dot staying Idle", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  await renderPage("/", repo, { agent: await fakeAgent() });
  await waitFor(() => expect(nav().getByText("7/11 · Session column")).toBeTruthy());

  addPlan(
    repo,
    CLI,
    ELEVEN.map(([title], index) => [title, index < 7 ? 5 : 0, 5]),
  );

  await refreshUntil(() => expect(nav().getByText("8/11 · Jump to the latest")).toBeTruthy());
  expect(statusOf(row("cli-tuis"))).toBe("Idle");
});

test("US2.5: a feature at its plan shows no task", async () => {
  await renderPage("/", fixtureRepo(), { agent: await fakeAgent() });

  await findRow("cli-tuis");
  expect(nav().queryByText(/^\d+\/\d+ · /)).toBeNull();
});

test("US2.6: the task comes before a running sub-agent, in the card", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  const fake = await fakeAgent();
  const session = await fake.sessions.featureSession(repo, CLI);
  await fake.sessions.send(repo, session.id, { text: "Implement it." });
  fake.adapter.emit({ id: fake.adapter.sent[0].id, type: "accepted" });
  fake.adapter.emit({
    id: "task-1",
    input: {},
    kind: "other",
    name: "Task",
    subagent: { description: "Explore the tests" },
    type: "toolStart",
  });
  await renderPage("/", repo, { agent: fake });

  const subagent = await waitFor(() => nav().getByText("Explore the tests"));
  const task = nav().getByText("7/11 · Session column");
  expect(task.compareDocumentPosition(subagent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(
    row("cli-tuis").compareDocumentPosition(task) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test("US2.7: search finds a feature by its title", async () => {
  await renderPage("/", fixtureRepo(), { agent: await fakeAgent() });

  await type(await screen.findByRole("searchbox", { name: "Search sessions" }), "CLI TUI");

  await refreshUntil(() => expect(nav().queryByRole("link", { name: /^web-ui, / })).toBeNull());
  expect(row("cli-tuis")).toBeTruthy();
});

test("search finds a feature by its slug", async () => {
  await renderPage("/", fixtureRepo(), { agent: await fakeAgent() });

  await type(await screen.findByRole("searchbox", { name: "Search sessions" }), "cli-tui");

  await refreshUntil(() => expect(nav().queryByRole("link", { name: /^web-ui, / })).toBeNull());
  expect(row("cli-tuis")).toBeTruthy();
});

test("a feature leaving its implementation loses its task", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  await renderPage("/", repo, { agent: await fakeAgent() });
  await waitFor(() => expect(nav().getByText("7/11 · Session column")).toBeTruthy());

  addPlan(
    repo,
    CLI,
    ELEVEN.map(([title]) => [title, 5, 5]),
  );

  await refreshUntil(() => expect(nav().queryByText(/^\d+\/\d+ · /)).toBeNull());
  expect(row("cli-tuis")).toBeTruthy();
});

test("the folded sidebar hides the cards' tasks and status marks", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  await renderPage("/", repo, { agent: await fakeAgent() });
  await waitFor(() => expect(nav().getByText("7/11 · Session column")).toBeTruthy());

  await click(nav().getByRole("button", { name: "Collapse sidebar" }));

  await waitFor(() => expect(nav().getByRole("button", { name: "Expand sidebar" })).toBeTruthy());
  expect(nav().queryByText("7/11 · Session column")).toBeNull();
  // The status is read in the card's name, and drawn only as a warning while it needs the human.
  expect(row("cli-tuis").getAttribute("aria-label")).toContain(", Idle");
  expect(within(row("cli-tuis")).queryByRole("img")).toBeNull();
});

test.each([
  ["page", `/f/${CLI}`],
  ["file", `/f/${CLI}/spec.md`],
  ["session", `/f/${CLI}/session`],
])("on a feature's %s, its card is selected", async (_, path) => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  await renderPage(path, repo, { agent: await fakeAgent() });
  await findRow("cli-tuis");

  expect(nav().getByRole("link", { current: "page" })).toBe(row("cli-tuis"));
});
