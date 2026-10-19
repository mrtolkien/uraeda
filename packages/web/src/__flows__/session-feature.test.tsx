// Flow: what surrounds a session's messages. Blocked actions are allowed in one turn; the agent's
// hand-over sends the workflow's message and builds in a fresh session after an approval; turns are
// announced to a screen reader; a long chat draws its recent part with a way to read the earlier
// ones; the progress column shows the plan and the branch's changes and folds; a chat archives.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { addPlan, commitOnBranch, ELEVEN } from "uraeda-binding/test-utils";
import { beforeEach, expect, test } from "vite-plus/test";
import { atWidth, click, DESKTOP, fixtureRepo, PHONE, refreshUntil, startApp } from "./harness.tsx";
import { addTurn, composer, composerText, log, resetAgent, send } from "./session-helpers.tsx";

const WEB_UI = "2026-10-11-web-ui";
const CLI = "2026-10-12-cli-tuis";
const PLAN_REVIEW = "2026-10-13-plan-review";

/** The repository where the plan review is at its implementation, with a file changed on its branch. */
function repository() {
  const repo = fixtureRepo();
  addPlan(repo, PLAN_REVIEW, ELEVEN);
  commitOnBranch(repo, PLAN_REVIEW, { "crates/core/src/watch.rs": "one\ntwo\n" });
  return repo;
}

const app = startApp({ agent: true, repo: repository });

beforeEach(() => resetAgent(app));

/** Two blocked actions, each a rule of its own. */
const TWO = [
  { input: { command: "git push origin HEAD" }, tool: "Bash" },
  { input: { file_path: "src/cli.ts" }, tool: "Edit" },
];

/** A run of a feature's session that ends with its actions blocked. */
async function blockedRun(folder: string, denials: typeof TWO) {
  app.agent.script([{ denials, errors: [], interrupted: false, ok: true, type: "result" }]);
  const session = await app.sessions.featureSession(app.repo, folder);
  const { turn } = await app.sessions.send(app.repo, session.id, {
    text: "Continue the feature.",
    workflow: { trigger: "manual" },
  });
  await app.sessions.settled(turn);
  return session.id;
}

test("blocked actions are allowed together in one turn, with the rules as the agent blocked them", async () => {
  await blockedRun(WEB_UI, TWO);
  await app.open(`/f/${WEB_UI}/session`);

  await click(await screen.findByRole("button", { name: /^Allow all/ }));

  await waitFor(() => expect(app.agent.sent).toHaveLength(2));
  expect(app.agent.opens.at(-1)?.allowed).toEqual([
    "Bash(git push origin HEAD)",
    "Edit(src/cli.ts)",
  ]);
});

test("one blocked action is allowed on its own, and a normal message ends the group allowance", async () => {
  const chat = await app.sessions.newChat(app.repo);
  const { cache } = app.sessions;
  const turn = addTurn(app, chat.id);
  for (const denial of TWO) {
    cache.appendItem(turn, {
      allowed: false,
      kind: "denial",
      rule: denial.tool === "Bash" ? "Bash(git push origin HEAD)" : "Edit(src/cli.ts)",
      tool: denial.tool,
    });
  }
  cache.endTurn(turn, { state: "done" });
  await app.open(`/chats/${chat.id}`);
  await screen.findByRole("button", { name: /^Allow all/ });

  app.agent.script([{ text: "Fine.", type: "text" }]);
  await send("Never mind");

  await waitFor(() => expect(screen.queryByRole("button", { name: /^Allow all/ })).toBeNull());
  // Each blocked action keeps its own button.
  expect(log().getAllByRole("button", { name: "Allow and retry" }).length).toBeGreaterThan(1);
});

test("Allow all is disabled while the session works", async () => {
  const chat = await app.sessions.newChat(app.repo);
  const turn = addTurn(app, chat.id);
  for (const tool of ["Bash(git push)", "Edit(src/a.ts)"]) {
    app.sessions.cache.appendItem(turn, {
      allowed: false,
      kind: "denial",
      rule: tool,
      tool: tool.split("(")[0],
    });
  }
  await app.open(`/chats/${chat.id}`);

  const all = await screen.findByRole("button", { name: /^Allow all/ });

  expect(all.hasAttribute("disabled")).toBe(true);
  app.sessions.cache.endTurn(turn, { state: "done" });
});

test("Start the agent hands over: the workflow's message alone is sent, then the draft's images stay", async () => {
  atWidth(PHONE);
  await app.open(`/f/${CLI}/session?continue=manual`);
  await waitFor(async () => expect((await composer()).textContent).not.toBe(""));
  const message = composerText();

  await click(screen.getByRole("button", { name: "Start the agent" }));

  await waitFor(() => expect(app.agent.sent).toHaveLength(1));
  expect(app.agent.sent[0].text).toContain(message!.split("\n")[0]);
  expect(app.agent.sent[0].images ?? []).toHaveLength(0);
  // The hand-over's mark leaves the address once the message is sent.
  await waitFor(() => expect(window.location.search).toBe(""));
});

test("after a spec's approval the hand-over builds in a fresh session, unless the switch is turned off", async () => {
  atWidth(PHONE);
  const session = await app.sessions.featureSession(app.repo, CLI);
  app.agent.script([]);
  const { turn } = await app.sessions.send(app.repo, session.id, { text: "What is left?" });
  await app.sessions.settled(turn);
  app.agent.sent.length = 0;
  app.agent.opens.length = 0;
  await app.open(`/f/${CLI}/session?continue=approval`);
  const fresh = await screen.findByRole<HTMLInputElement>("switch");
  expect(fresh.checked).toBe(true);
  await waitFor(async () => expect((await composer()).textContent).not.toBe(""));

  app.agent.script([]);
  await click(screen.getByRole("button", { name: "Start the agent" }));

  await waitFor(() => expect(app.agent.sent).toHaveLength(1));
  // The run opens a new agent session, not the chat's.
  expect(app.agent.opens.at(-1)?.resume).toBe(false);
  // The run ends before the next test starts its own.
  await waitFor(() =>
    expect(app.sessions.cache.turns(session.id).every((t) => t.endedAt !== null)).toBe(true),
  );
});

test("with the fresh-session switch off, the run continues the session", async () => {
  atWidth(PHONE);
  app.agent.opens.length = 0;
  await app.open(`/f/${CLI}/session?continue=approval`);
  await click(await screen.findByRole("switch"));
  await waitFor(async () => expect((await composer()).textContent).not.toBe(""));

  app.agent.script([]);
  await click(screen.getByRole("button", { name: "Start the agent" }));

  // The message goes to the session's own process: no new agent session opens.
  await waitFor(() => expect(app.agent.sent).toHaveLength(1));
  expect(app.agent.opens).toHaveLength(0);
});

test("a hand-over at a later step offers no fresh-session switch", async () => {
  await app.open(`/f/${PLAN_REVIEW}/session?continue=manual`);
  await waitFor(async () => expect((await composer()).textContent).not.toBe(""));

  expect(screen.queryByRole("switch")).toBeNull();
});

/** The page's live region for turns and tasks. */
function region() {
  return screen.getAllByRole("status").find((node) => node.hasAttribute("aria-atomic"))!;
}

test("a turn starting and failing is announced in a live region, and the transcript announces nothing", async () => {
  await app.open(`/f/${WEB_UI}/session`);
  await composer();
  const session = await app.sessions.featureSession(app.repo, WEB_UI);
  expect(region().textContent).toBe("");

  const turn = addTurn(app, session.id, "workflow");
  await refreshUntil(() => expect(region().textContent).not.toBe(""));
  const started = region().textContent;
  app.sessions.cache.endTurn(turn, { reason: "No output for 30 minutes.", state: "failed" });
  await refreshUntil(() => expect(region().textContent).not.toBe(started));

  // What streams into the transcript is not read out.
  expect(screen.getByRole("log").getAttribute("aria-live")).toBe("off");
});

/** Writes `count` messages into a session in turns of fifteen, the agent's with a tool call. */
function seedMessages(session: string, count: number) {
  const { cache } = app.sessions;
  const turns: Array<number> = [];
  for (let index = 1; index <= count; index += 1) {
    if (index % 15 === 1) {
      turns.push(addTurn(app, session));
    }
    const turn = turns.at(-1)!;
    const number = Math.ceil(index / 2);
    if (index % 2 === 1) {
      cache.appendItem(turn, {
        id: `message-${number}`,
        kind: "message",
        origin: "human",
        state: "read",
        text: `Question ${number}`,
      });
    } else {
      cache.appendItem(turn, { kind: "text", streaming: false, text: `Reply ${number}` });
    }
  }
  for (const turn of turns) {
    cache.endTurn(turn, { state: "done" });
  }
  return turns;
}

const MESSAGE = /^(Question|Reply) \d+$/;

/** The messages the transcript draws now. */
function drawn() {
  return log().queryAllByText(MESSAGE);
}

test("a long chat draws its recent part, a button reads earlier messages, and a link into history draws from it", async () => {
  const chat = await app.sessions.newChat(app.repo);
  const turns = seedMessages(chat.id, 120);
  await app.open(`/chats/${chat.id}`);
  await within(await screen.findByRole("log")).findByText("Reply 60");
  const recent = drawn().length;

  // The start of the chat is not drawn, and a button reads earlier messages.
  expect(log().queryByText("Question 1")).toBeNull();
  expect(recent).toBeLessThan(120);
  // The button is the transcript's first control: it sits at the top, above the messages.
  await click(log().getAllByRole("button")[0]);
  await waitFor(() => expect(drawn().length).toBeGreaterThan(recent));
  // The messages drawn before stay: what is read is kept.
  expect(log().getByText("Reply 60")).toBeTruthy();

  // An address into an early turn draws from that turn to the end.
  cleanup();
  await app.open(`/chats/${chat.id}#turn-${turns[1]}`);
  await within(await screen.findByRole("log")).findByText("Reply 60");
  expect(log().getByText("Reply 8")).toBeTruthy();
});

test("a chat archives from the composer's footer and reads as archived; a feature's session has no archive", async () => {
  const chat = await app.sessions.newChat(app.repo);
  const turn = addTurn(app, chat.id);
  app.sessions.cache.appendItem(turn, { kind: "text", streaming: false, text: "Done." });
  app.sessions.cache.endTurn(turn, { state: "done" });
  await app.open(`/chats/${chat.id}`);

  await click(await screen.findByRole("button", { name: "Archive" }));

  expect(await screen.findByRole("button", { name: "Unarchive" })).toBeTruthy();
  await app.open(`/f/${WEB_UI}/session`);
  await composer();
  expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
});

test("the progress column lists the plan's tasks with the current one, and the branch's changed files", async () => {
  atWidth(DESKTOP);
  await app.open(`/f/${PLAN_REVIEW}/session`);

  const column = within(await screen.findByRole("complementary"));
  const tasks = await column.findAllByRole("listitem", { name: /./ });
  expect(tasks.some((task) => task.getAttribute("aria-label")?.startsWith("Current: "))).toBe(true);
  expect(tasks.some((task) => task.getAttribute("aria-label")?.startsWith("Done: "))).toBe(true);
  // The branch's changes outside the feature's folder, read after the column.
  expect(await column.findByText(/crates\/core\/src\/watch\.rs/)).toBeTruthy();
});

test("the progress column folds, and stays folded after a reload; a chat has no column", async () => {
  atWidth(DESKTOP);
  await app.open(`/f/${PLAN_REVIEW}/session`);
  await screen.findByRole("complementary");

  await click(screen.getByRole("button", { name: /progress/i }));
  expect(screen.queryByRole("list", { name: /tasks/i })).toBeNull();
  await app.open(`/f/${PLAN_REVIEW}/session`, { reload: true });
  await composer();
  expect(screen.queryByRole("list", { name: /tasks/i })).toBeNull();

  const chat = await app.sessions.newChat(app.repo);
  await app.open(`/chats/${chat.id}`);
  await composer();
  expect(screen.queryByRole("list", { name: /tasks/i })).toBeNull();
});

/** The phone's progress line: the button under the header that opens and closes it. */
function progressLine() {
  return waitFor(() => {
    const line = screen
      .getAllByRole("button")
      .find((b) => b.getAttribute("aria-expanded") === "false" && b.textContent?.includes("·"));
    expect(line).toBeTruthy();
    return line!;
  });
}

test("on a phone the progress line opens the column's content in place", async () => {
  atWidth(PHONE);
  await app.open(`/f/${PLAN_REVIEW}/session`);
  await composer();

  await click(await progressLine());

  expect(await screen.findByRole("list", { name: /tasks/i })).toBeTruthy();
});

test("a merged feature has no branch left: its composer is disabled", async () => {
  await app.open("/f/2026-10-10-cli-core/session");

  expect((await composer()).getAttribute("aria-disabled")).toBe("true");
});

test("without the agent on the machine the composer is disabled", async () => {
  app.agent.installed = false;
  await app.sessions.check();
  await app.open(`/f/${WEB_UI}/session`);

  expect((await composer()).getAttribute("aria-disabled")).toBe("true");
  app.agent.installed = true;
  await app.sessions.check();
});
