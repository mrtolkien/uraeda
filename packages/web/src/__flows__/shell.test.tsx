// Flow: the shell, the sidebar and its cards (decisions problems, ui-behaviour, ui-layout). A card
// shows the item's step and status next to it, only a problem puts it under what needs the human, a
// note stays on its page; search, chats, and a card's settings work from the sidebar; the status is
// read from the card's accessible name when the sidebar is folded; the theme is kept by the browser.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import {
  addChange,
  addPlan,
  commitOnBranch,
  ELEVEN,
  fixture,
  fixtureRepo,
} from "uraeda-binding/test-utils";
import { atWidth, click, PHONE, read, refreshUntil, startApp, type } from "./harness.tsx";

const CLI = "2026-10-12-cli-tuis";
const WEB_UI = "2026-10-11-web-ui";
const RECURRING = "2026-10-06-recurring-tasks";
const PLAN_REVIEW = "2026-10-13-plan-review";
const FLAKY = "2026-10-15-flaky-tests";

/**
 * The fixture repository where the web UI waits for answers, the recurring tasks' spec cannot be
 * read (a problem), the plan review's plan has a format slip (a note), and a change waits too.
 */
function repository() {
  const repo = fixtureRepo();
  const spec = `specs/${RECURRING}/spec.md`;
  const text = readFileSync(fixture(`repo/branches/${RECURRING}/${spec}`), "utf8");
  commitOnBranch(repo, RECURRING, {
    [spec]: text.replace("status: awaiting-human", "status: aproved"),
  });
  addPlan(repo, PLAN_REVIEW, ELEVEN);
  addChange(repo, FLAKY, {
    "clarifications-01.md": readFileSync(
      fixture(`repo/branches/${WEB_UI}/specs/${WEB_UI}/clarifications-01.md`),
      "utf8",
    ),
    "proposal.md": "# Flaky tests\n\nThe session tests fail one run in ten.\n",
  });
  return repo;
}

/** Whether the app is drawn in its dark theme. */
const dark = () => document.querySelector('[data-theme="dark"]') !== null;

const app = startApp({ agent: true, repo: repository });

/** The side navigation, as drawn on a wide screen. */
const nav = () => within(screen.getByRole("navigation", { name: /Side/ }));

/** The navigation's link to a feature, by its slug, or a chat, by its title. */
const row = (name: string) => nav().getByRole("link", { name: new RegExp(`^${name}, `) });
const findRow = (name: string) => waitFor(() => row(name));

/** The status a card shows: the mark's name. */
const statusOf = (link: HTMLElement) => within(link).getByRole("img").getAttribute("aria-label");

/** The group of the navigation a card is in. */
const groupOf = (link: HTMLElement) => link.closest("[role=group]");

/** Opens the page, once its navigation shows the features. */
async function open(path = "/") {
  await app.open(path);
  await findRow("web-ui");
}

test("Home goes home", async () => {
  await app.open("/priorities");
  await screen.findAllByRole("link");

  await click(nav().getByRole("link", { name: "Home" }));

  expect(window.location.pathname).toBe(app.path("/"));
});

test("a feature waiting for the human's answers is a card that says it needs them, apart from agents' work", async () => {
  await open();

  const web = row("web-ui");
  expect(statusOf(web)).toBe("Needs you");
  // Needs you holds what waits on the human, as a problem or a change does; the agent's is apart.
  expect(groupOf(row("flaky-tests"))).toBe(groupOf(web));
  expect(groupOf(row("recurring-tasks"))).toBe(groupOf(web));
  expect(groupOf(row("cli-tuis"))).not.toBe(groupOf(web));
  expect(nav().getAllByRole("link", { name: /^web-ui, / })).toHaveLength(1);
});

test("only a problem is a card to fix: a format note keeps the card with its agent", async () => {
  await open();

  // The spec that cannot be read blocks its workflow, so it is the human's; a plan's format slip is
  // a note, shown on the item's own page, and its feature stays where its step puts it.
  expect(groupOf(row("recurring-tasks"))).toBe(groupOf(row("web-ui")));
  expect(groupOf(row("plan-review"))).not.toBe(groupOf(row("web-ui")));
  expect(row("recurring-tasks").getAttribute("aria-label")).not.toBe(
    row("plan-review").getAttribute("aria-label"),
  );
  await click(row("plan-review"));
  expect(window.location.pathname).toBe(app.path(`/f/${PLAN_REVIEW}`));
  expect(nav().getByRole("link", { current: "page" })).toBe(row("plan-review"));
});

test("a feature's card is selected on its page, its file, and its session", async () => {
  for (const path of [`/f/${CLI}`, `/f/${CLI}/spec.md`, `/f/${CLI}/session`]) {
    await app.open(path);
    await findRow("cli-tuis");
    expect(nav().getByRole("link", { current: "page" })).toBe(row("cli-tuis"));
  }
});

test("every card has its settings button, reachable without a pointer", async () => {
  await open();

  for (const slug of ["recurring-tasks", "web-ui", "plan-review", "cli-tuis", "flaky-tests"]) {
    expect(nav().getByRole("button", { name: new RegExp(slug) })).toBeTruthy();
  }
});

test("search filters the cards by title and by slug, and says when nothing matches", async () => {
  await open();
  const search = await screen.findByRole("searchbox");

  await type(search, "CLI TUI");
  await refreshUntil(() =>
    expect(nav().queryAllByRole("link", { name: /^web-ui, / })).toHaveLength(0),
  );
  expect(row("cli-tuis")).toBeTruthy();

  await type(search, "web-u");
  await refreshUntil(() =>
    expect(nav().queryAllByRole("link", { name: /^cli-tuis, / })).toHaveLength(0),
  );
  expect(row("web-ui")).toBeTruthy();

  await type(search, "zzzz");
  await refreshUntil(() =>
    expect(nav().queryAllByRole("link", { name: /^(web-ui|cli-tuis), / })).toHaveLength(0),
  );
});

test("a working turn shows Working, then Needs attention once it ends at a gate waiting on the agent", async () => {
  await app.open("/");
  await findRow("cli-tuis");
  const session = await app.sessions.featureSession(app.repo, CLI);
  await app.sessions.send(app.repo, session.id, { text: "Plan it." });

  await refreshUntil(() => expect(statusOf(row("cli-tuis"))).toBe("Working"));
  const sent = app.agent.sent.at(-1)!;
  app.agent.emit({ id: sent.id, type: "accepted" });
  app.agent.emit({ text: "Planned.", type: "text" });
  app.agent.emit({ denials: [], errors: [], interrupted: false, ok: true, type: "result" });

  await refreshUntil(() => expect(statusOf(row("cli-tuis"))).toBe("Needs attention"));
  // Needs you sorts before what needs the human's attention.
  const group = groupOf(row("cli-tuis"))!;
  const statuses = within(group as HTMLElement)
    .getAllByRole("link")
    .map((link) => statusOf(link));
  expect(statuses.lastIndexOf("Needs you")).toBeLessThan(statuses.indexOf("Needs attention"));
});

test("a running sub-agent shows in its feature's card, then leaves", async () => {
  await app.open("/");
  await findRow("cli-tuis");
  const session = await app.sessions.featureSession(app.repo, CLI);
  await app.sessions.send(app.repo, session.id, { text: "Plan more." });
  const sent = app.agent.sent.at(-1)!;
  app.agent.emit({ id: sent.id, type: "accepted" });
  app.agent.emit({
    id: "task-1",
    input: {},
    kind: "other",
    name: "Task",
    subagent: { description: "Map the runner code" },
    type: "toolStart",
  });

  await refreshUntil(() => expect(nav().getByText("Map the runner code")).toBeTruthy());
  app.agent.emit({ id: "task-1", isError: false, output: "Mapped.", type: "toolEnd" });

  await refreshUntil(() => expect(nav().queryByText("Map the runner code")).toBeNull());
  expect(row("cli-tuis")).toBeTruthy();
  app.agent.emit({ denials: [], errors: [], interrupted: false, ok: true, type: "result" });
});

test("a card at the implementation shows its task, which moves with the plan and goes with it", async () => {
  await open();
  const task = () => row("cli-tuis").getAttribute("aria-label") ?? "";
  expect(task()).not.toMatch(/\d+ of \d+/);

  addPlan(app.repo, CLI, ELEVEN);
  await refreshUntil(() => expect(task()).toMatch(/\d+ of \d+/));
  const seventh = task();
  await click(row("cli-tuis"));
  expect(window.location.pathname).toBe(app.path(`/f/${CLI}`));

  // An agent checked boxes: the task moves on the card.
  addPlan(
    app.repo,
    CLI,
    ELEVEN.map(([title], index) => [title, index < 7 ? 5 : 0, 5]),
  );
  await refreshUntil(() => expect(task()).not.toBe(seventh));
  expect(task()).toMatch(/\d+ of \d+/);

  // Every box checked: the feature leaves its implementation, and the card loses its task.
  addPlan(
    app.repo,
    CLI,
    ELEVEN.map(([title]) => [title, 5, 5]),
  );
  await refreshUntil(() => expect(task()).not.toMatch(/\d+ of \d+/));
});

/** A chat started with its first message, its reply written, and its turn ended. */
async function seedChat(text: string) {
  const chat = await app.sessions.newChat(app.repo);
  app.agent.script([{ text: "Done.", type: "text" }]);
  const { turn } = await app.sessions.send(app.repo, chat.id, { text });
  await app.sessions.settled(turn);
  return chat.id;
}

test("New chat opens an empty chat, and its first message lists it among the chats, working", async () => {
  await open();

  await click(nav().getByRole("link", { name: /New chat/ }));

  expect(window.location.pathname).toBe(app.path("/chats/new"));
  await type(await screen.findByRole("textbox", { name: /Message/ }), "List the open draft files");
  await click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() =>
    expect(window.location.pathname).toMatch(new RegExp(`^${app.path("/chats/")}(?!new)`)),
  );
  expect(app.agent.sent.at(-1)!.text).toBe("List the open draft files");
  await refreshUntil(() => expect(statusOf(row("List the open draft files"))).toBe("Working"));
});

test("renaming a chat in its header renames it in the sidebar", async () => {
  const id = await seedChat("Why is CI slow?");
  await app.open(`/chats/${id}`);
  const main = within(await screen.findByRole("main"));

  await click(await main.findByRole("button", { name: "Why is CI slow?" }));
  // The title's field is the form field; the composer is an editable text beside it.
  const field = main.getAllByRole("textbox").find((box) => box.tagName === "INPUT")!;
  await type(field, "Slow CI");
  await act(async () => {
    fireEvent.keyDown(field, { key: "Enter" });
  });

  await refreshUntil(() => expect(row("Slow CI")).toBeTruthy());
  expect(nav().queryAllByRole("link", { name: /^Why is CI slow\?, / })).toHaveLength(0);
});

test("an archived chat moves out of the chats, and a message brings it back", async () => {
  const id = await seedChat("Is the cache stale?");
  await app.open(`/chats/${id}`);
  await findRow(String.raw`Is the cache stale\?`);
  const chatGroup = groupOf(row(String.raw`Is the cache stale\?`));

  await click(await screen.findByRole("button", { name: "Archive" }));

  await refreshUntil(() =>
    expect(nav().queryAllByRole("link", { name: /^Is the cache stale\?, / })).toHaveLength(0),
  );
  // The archived chats are folded: opened, the chat is among them, apart from the chats.
  await click(nav().getByRole("button", { name: "Archived" }));
  const archived = row(String.raw`Is the cache stale\?`);
  expect(groupOf(archived)).not.toBe(chatGroup);

  app.agent.script([{ text: "No.", type: "text" }]);
  await type(await screen.findByRole("textbox", { name: /Message/ }), "And the closed ones?");
  await click(screen.getByRole("button", { name: "Send" }));
  await refreshUntil(() => expect(nav().queryByRole("button", { name: "Archived" })).toBeNull());
  expect(row(String.raw`Is the cache stale\?`)).toBeTruthy();
});

test("＋ adds a line to Later with an Undo, which removes the line again", async () => {
  await app.open("/");
  await click(await screen.findByRole("button", { name: "Add to the priorities" }));
  await type(await screen.findByLabelText("Priority"), "Show the agent's last commit");
  await click(screen.getByRole("radio", { name: "Later" }));
  await click(screen.getByRole("button", { name: "Add" }));
  const undo = await screen.findByRole("button", { name: "Undo" });

  expect(read(app.repo)).toContain("Show the agent's last commit");
  await click(undo);

  await waitFor(() => expect(read(app.repo)).not.toContain("Show the agent's last commit"));
});

test("＋'s Undo refuses once the line it added was changed, and changes nothing", async () => {
  await app.open("/");
  await click(await screen.findByRole("button", { name: "Add to the priorities" }));
  await type(await screen.findByLabelText("Priority"), "Show the agent's last commit");
  await click(screen.getByRole("radio", { name: "Later" }));
  await click(screen.getByRole("button", { name: "Add" }));
  const undo = await screen.findByRole("button", { name: "Undo" });
  const edited = read(app.repo).replace("Show the agent's last commit", "Show the last commit");
  writeFileSync(join(app.repo, "specs/PRIORITIES.md"), edited);

  await click(undo);

  // Nothing is removed: the human's line stays, as it was edited, and the toast says why.
  await act(async () => new Promise((resolve) => setTimeout(resolve, 200)));
  expect(read(app.repo)).toBe(edited);
});

/** Opens a card's settings, and returns the name field. */
async function openSettings(name: string) {
  await click(await screen.findByRole("button", { name: new RegExp(name) }));
  return screen.findByRole("textbox");
}

test("a name and a colour rename the card and leave the feature's address; an empty name shows the slug again", async () => {
  await open();

  await type(await openSettings("cli-tuis"), "Sidebar");
  await click(screen.getByRole("radio", { name: "Purple" }));
  await click(screen.getByRole("button", { name: "Save" }));
  await refreshUntil(() => expect(row("Sidebar")).toBeTruthy());
  await click(row("Sidebar"));
  expect(window.location.pathname).toBe(app.path(`/f/${CLI}`));

  await type(await openSettings("Sidebar"), "");
  await click(screen.getByRole("button", { name: "Save" }));
  await refreshUntil(() => expect(row("cli-tuis")).toBeTruthy());
});

test("Save waits for a change, which the dialog says is unsaved", async () => {
  await open();
  const field = await openSettings("cli-tuis");
  const save = screen.getByRole("button", { name: "Save" });
  expect(save.hasAttribute("disabled") || save.getAttribute("aria-disabled") === "true").toBe(true);
  const before = document.body.textContent;

  await type(field, "Something else");

  expect(document.body.textContent).not.toBe(before);
  expect(save.hasAttribute("disabled")).toBe(false);
  expect(save.getAttribute("aria-disabled")).not.toBe("true");
});

test("on the phone a card's settings open from the drawer, without a pointer", async () => {
  atWidth(PHONE);
  await app.open("/");
  await click(await screen.findByRole("button", { name: "Open navigation" }));

  await click(await screen.findByRole("button", { name: /cli-tuis/ }));

  expect(await screen.findByRole("textbox")).toBeTruthy();
});

test("the sidebar folded keeps each card's status in its name, drawn only for what needs the human", async () => {
  await open();
  const before = row("web-ui").getAttribute("aria-label");

  await click(nav().getByRole("button", { name: "Collapse sidebar" }));

  await waitFor(() => expect(nav().getByRole("button", { name: "Expand sidebar" })).toBeTruthy());
  expect(row("web-ui").getAttribute("aria-label")).toBe(before);
  // An item that needs nothing of the human draws no mark when folded.
  expect(within(row("plan-review")).queryByRole("img")).toBeNull();
});

test("the theme is chosen in Appearance and kept by this browser alone; the system's leaves nothing stored", async () => {
  const { unmount } = await app.open("/settings/appearance");
  const group = await screen.findByRole("radiogroup");

  fireEvent.click(within(group).getByRole("radio", { name: "Dark" }));
  expect(dark()).toBe(true);
  expect(window.localStorage.getItem("uraeda.theme")).toBe("dark");

  // A reload of this browser keeps it; another browser, with nothing stored, follows its system.
  unmount();
  const reloaded = await app.open("/settings/appearance");
  expect(dark()).toBe(true);
  reloaded.unmount();
  window.localStorage.clear();
  await app.open("/settings/appearance");
  expect(dark()).toBe(false);

  window.localStorage.setItem("uraeda.theme", "dark");
  cleanup();
  await app.open("/settings/appearance");
  const system = within(await screen.findByRole("radiogroup")).getByRole("radio", {
    name: "System",
  });
  await act(async () => {
    fireEvent.click(system);
  });
  expect(window.localStorage.getItem("uraeda.theme")).toBeNull();
});
