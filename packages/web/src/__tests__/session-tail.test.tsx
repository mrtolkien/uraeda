// US1 and its edge cases: a session draws its latest 20 messages, "Show earlier messages" adds 20,
// the address's `#turn-<id>` and Back keep what they need drawn, and the tail counts messages, not
// tool calls (the plan's review focus 5 and 6).
import { act, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import {
  atRepo,
  click,
  type Fake,
  fakeAgent,
  fixtureRepo,
  refreshUntil,
  renderPage,
} from "./helpers.tsx";
import { navigate } from "../routes.tsx";

const CLI = "2026-10-12-cli-tuis";

/** The messages of a chat: the human's `Question n`, the agent's `Reply n`. */
const MESSAGE = /^(Question|Reply) \d+$/;

afterEach(() => {
  vi.restoreAllMocks();
});

/** A new turn of a session, running until `seedTurn` ends it. */
function addTurn(fake: Fake, session: string) {
  return fake.sessions.cache.addTurn({
    allowed: null,
    kind: "chat",
    sessionId: session,
    state: "running",
    step: null,
    trigger: null,
  });
}

/**
 * Writes `count` messages in a session, alternating the human's and the agent's, with a tool call
 * before each agent's reply, fifteen messages to a turn, so no cut falls on a turn's start: `Question 1`, `Reply 1`, `Question 2`... The
 * turns' ids come back in order.
 */
function seedMessages(fake: Fake, session: string, count: number) {
  const { cache } = fake.sessions;
  const turns: Array<number> = [];
  for (let index = 1; index <= count; index += 1) {
    if (index % 15 === 1) {
      turns.push(addTurn(fake, session));
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
      cache.appendItem(turn, {
        id: `tool-${number}`,
        kind: "tool",
        name: "Bash",
        status: "completed",
        target: `step ${number}`,
        toolKind: "execute",
      });
      cache.appendItem(turn, { kind: "text", streaming: false, text: `Reply ${number}` });
    }
  }
  for (const turn of turns) {
    cache.endTurn(turn, { state: "done" });
  }
  return turns;
}

/** Opens a chat of `count` messages, and waits for its last one. */
async function openChatWith(count: number) {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  const turns = seedMessages(fake, chat.id, count);
  await renderPage(`/chats/${chat.id}`, repo, { agent: fake });
  const log = await screen.findByRole("log", { name: "Conversation" });
  await within(log).findByText(
    count % 2 === 0 ? `Reply ${count / 2}` : `Question ${(count + 1) / 2}`,
  );
  return { chat, fake, log: within(log), repo, turns };
}

type Log = ReturnType<typeof within>;

/** The messages the transcript draws, in order. */
function messagesIn(log: Log) {
  return log.queryAllByText(MESSAGE);
}

const EARLIER = { name: "Show earlier messages" };

test("US1.1: a chat of 120 messages draws the latest 20, with the button at the top", async () => {
  const { log } = await openChatWith(120);

  expect(messagesIn(log)).toHaveLength(20);
  expect(messagesIn(log).at(-1)!.textContent).toBe("Reply 60");
  expect(messagesIn(log)[0]!.textContent).toBe("Question 51");
  expect(log.getAllByRole("button", EARLIER)).toHaveLength(1);
});

test("US1.2: the button adds the 20 messages before, and the one at the top stays", async () => {
  const { log } = await openChatWith(120);
  const top = messagesIn(log)[0]!;

  await click(log.getByRole("button", EARLIER));

  await waitFor(() => expect(messagesIn(log)).toHaveLength(40));
  expect(messagesIn(log)[0]!.textContent).toBe("Question 41");
  // The message was kept, not drawn again: its place on the screen is the one that is kept.
  expect(messagesIn(log)[20]).toBe(top);
  expect(log.getAllByRole("button", EARLIER)).toHaveLength(1);
});

test("US1.3: a chat of 15 messages draws all of them, with no button", async () => {
  const { log } = await openChatWith(15);

  expect(messagesIn(log)).toHaveLength(15);
  expect(log.queryByRole("button", EARLIER)).toBeNull();
});

test("SC-001: a chat of 500 messages draws as many as one of 20", async () => {
  const { log } = await openChatWith(500);
  const many = messagesIn(log).length;

  expect(many).toBe(20);
  expect(log.getAllByRole("button", EARLIER)).toHaveLength(1);
});

test("SC-001: a chat of 20 messages draws them all, with no button", async () => {
  const { log } = await openChatWith(20);

  expect(messagesIn(log)).toHaveLength(20);
  expect(log.queryByRole("button", EARLIER)).toBeNull();
});

test("US1 more 1: the link of a turn 90 messages back draws from it to the end, and scrolls to it", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  const turns = seedMessages(fake, chat.id, 120);
  const scrolled = vi.fn();
  Element.prototype.scrollIntoView = scrolled;

  // The third turn holds messages 31 to 45: 90 messages from there to the end.
  await renderPage(`/chats/${chat.id}#turn-${turns[2]}`, repo, { agent: fake });
  const log = within(await screen.findByRole("log", { name: "Conversation" }));
  await log.findByText("Reply 60");

  expect(messagesIn(log)).toHaveLength(90);
  expect(messagesIn(log)[0]!.textContent).toBe("Question 16");
  expect(log.getAllByRole("button", EARLIER)).toHaveLength(1);
  expect(scrolled.mock.contexts.map((element) => (element as Element).id)).toEqual([
    `turn-${turns[2]}`,
  ]);
});

test("US1 more 2: Back after two presses draws 60 messages again", async () => {
  const { log } = await openChatWith(240);

  await click(log.getByRole("button", EARLIER));
  await waitFor(() => expect(messagesIn(log)).toHaveLength(40));
  await click(log.getByRole("button", EARLIER));
  await waitFor(() => expect(messagesIn(log)).toHaveLength(60));
  await act(async () => navigate(atRepo("/")));
  await waitFor(() => expect(screen.queryByRole("log", { name: "Conversation" })).toBeNull());
  await act(async () => window.history.back());

  const again = within(await screen.findByRole("log", { name: "Conversation" }));
  await waitFor(() => expect(messagesIn(again)).toHaveLength(60));
});

test("US1 more 3: the reply growing at the end changes no count", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  seedMessages(fake, chat.id, 120);
  const { cache } = fake.sessions;
  const turn = addTurn(fake, chat.id);
  const seq = cache.appendItem(turn, { kind: "text", streaming: true, text: "Reply 61" });
  await renderPage(`/chats/${chat.id}`, repo, { agent: fake });
  const log = within(await screen.findByRole("log", { name: "Conversation" }));
  await log.findByText("Reply 61");
  expect(messagesIn(log)).toHaveLength(20);

  cache.updateItem(turn, seq, { kind: "text", streaming: true, text: "Reply 61 and more" });
  await refreshUntil(() => expect(log.getByText("Reply 61 and more")).toBeTruthy());

  expect(log.getAllByText(/^(Question|Reply) \d+/)).toHaveLength(20);
  expect(log.getAllByRole("button", EARLIER)).toHaveLength(1);
});

test("R8: a message arriving draws after the 20 shown, and moves none of them", async () => {
  const { chat, fake, log } = await openChatWith(120);
  const top = messagesIn(log)[0]!;

  const turn = addTurn(fake, chat.id);
  fake.sessions.cache.appendItem(turn, { kind: "text", streaming: false, text: "Reply 61" });
  await refreshUntil(() => expect(log.getByText("Reply 61")).toBeTruthy());

  expect(messagesIn(log)).toHaveLength(21);
  expect(messagesIn(log)[0]).toBe(top);
});

test("US1 more 4: a feature's session of 50 messages draws the latest 20", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const session = await fake.sessions.featureSession(repo, CLI);
  seedMessages(fake, session.id, 50);
  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });
  const log = within(await screen.findByRole("log", { name: "Conversation" }));
  await log.findByText("Reply 25");

  expect(messagesIn(log)).toHaveLength(20);
  expect(log.getAllByRole("button", EARLIER)).toHaveLength(1);
});

test("focus 5: a cut inside a turn's last page leaves a sub-agent's later tools a group of their own", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  const { cache } = fake.sessions;
  const turn = addTurn(fake, chat.id);
  const tool = (id: string, extra: object = {}) =>
    cache.appendItem(turn, {
      id,
      kind: "tool",
      name: "Read",
      status: "completed",
      target: id,
      toolKind: "read",
      ...extra,
    });
  // 250 items, three pages of 100: the messages are in the last, after the sub-agent that started
  // on the second, whose tools go on to the last.
  for (let index = 0; index < 205; index += 1) {
    tool(`early-${index}`);
  }
  tool("agent-1", { name: "Task", subagent: { description: "Explore the tests" } });
  for (let index = 1; index <= 30; index += 1) {
    cache.appendItem(turn, { kind: "text", streaming: false, text: `Reply ${index}` });
  }
  for (let index = 0; index < 14; index += 1) {
    tool(`child-${index}`, { parent: "agent-1" });
  }
  cache.endTurn(turn, { state: "done" });
  expect(cache.itemCount(turn)).toBe(250);

  await renderPage(`/chats/${chat.id}`, repo, { agent: fake });
  const log = within(await screen.findByRole("log", { name: "Conversation" }));
  await log.findByText("Reply 30");

  // The latest 20 of the 30 replies, and what lies after the first of them.
  expect(messagesIn(log)).toHaveLength(20);
  expect(log.getByText("Reply 11")).toBeTruthy();
  expect(log.queryByText("Reply 10")).toBeNull();
  // The 14 children, whose sub-agent was cut, all draw, without a label of the sub-agent.
  expect(log.queryByText("Explore the tests")).toBeNull();
  expect(log.getAllByRole("button", EARLIER)).toHaveLength(1);
  const children = new Set(log.getAllByText(/^child-\d+$/).map((element) => element.textContent));
  expect(children.size).toBe(14);
});

test("focus 6: a turn with no item yet at the end draws nothing, and the walk goes on", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  seedMessages(fake, chat.id, 30);
  addTurn(fake, chat.id);
  await renderPage(`/chats/${chat.id}`, repo, { agent: fake });
  const log = within(await screen.findByRole("log", { name: "Conversation" }));
  await log.findByText("Reply 15");

  expect(messagesIn(log)).toHaveLength(20);
  expect(messagesIn(log)[0]!.textContent).toBe("Question 6");
  expect(log.getAllByRole("button", EARLIER)).toHaveLength(1);
});

test("R8: Back after messages arrived draws the same messages, the arrivals too", async () => {
  const { chat, fake, log } = await openChatWith(120);
  const turn = addTurn(fake, chat.id);
  fake.sessions.cache.appendItem(turn, { kind: "text", streaming: false, text: "Reply 61" });
  await refreshUntil(() => expect(log.getByText("Reply 61")).toBeTruthy());
  expect(messagesIn(log)).toHaveLength(21);

  await act(async () => navigate(atRepo("/")));
  await waitFor(() => expect(screen.queryByRole("log", { name: "Conversation" })).toBeNull());
  await act(async () => window.history.back());

  const again = within(await screen.findByRole("log", { name: "Conversation" }));
  await waitFor(() => expect(messagesIn(again)).toHaveLength(21));
  expect(messagesIn(again)[0]!.textContent).toBe("Question 51");
  expect(messagesIn(again).at(-1)!.textContent).toBe("Reply 61");
});

/** Appends a message of the agent's, or a tool call, to a turn. */
function say(fake: Fake, turn: number, text: string) {
  fake.sessions.cache.appendItem(turn, { kind: "text", streaming: false, text });
}
function use(fake: Fake, turn: number, target: string) {
  fake.sessions.cache.appendItem(turn, {
    id: target,
    kind: "tool",
    name: "Bash",
    status: "completed",
    target,
    toolKind: "execute",
  });
}

test("edge: no button when the turns before the 20 messages hold only tool calls", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  const empty = addTurn(fake, chat.id);
  const tools = addTurn(fake, chat.id);
  use(fake, tools, "early step");
  const talk = addTurn(fake, chat.id);
  for (let index = 1; index <= 20; index += 1) {
    say(fake, talk, `Reply ${index}`);
  }
  for (const turn of [empty, tools, talk]) {
    fake.sessions.cache.endTurn(turn, { state: "done" });
  }
  await renderPage(`/chats/${chat.id}`, repo, { agent: fake });
  const log = within(await screen.findByRole("log", { name: "Conversation" }));
  await log.findByText("Reply 20");

  expect(messagesIn(log)).toHaveLength(20);
  expect(log.queryByRole("button", EARLIER)).toBeNull();
});

test("edge: the button shows, and a press draws, a message before turns of tool calls", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  const first = addTurn(fake, chat.id);
  say(fake, first, "Reply 0");
  const tools = addTurn(fake, chat.id);
  use(fake, tools, "early step");
  const talk = addTurn(fake, chat.id);
  for (let index = 1; index <= 20; index += 1) {
    say(fake, talk, `Reply ${index}`);
  }
  for (const turn of [first, tools, talk]) {
    fake.sessions.cache.endTurn(turn, { state: "done" });
  }
  await renderPage(`/chats/${chat.id}`, repo, { agent: fake });
  const log = within(await screen.findByRole("log", { name: "Conversation" }));
  await log.findByText("Reply 20");
  expect(messagesIn(log)).toHaveLength(20);

  await click(log.getByRole("button", EARLIER));

  await waitFor(() => expect(messagesIn(log)).toHaveLength(21));
  expect(log.queryByRole("button", EARLIER)).toBeNull();
});

test("edge: the kept start is dropped when its turn leaves the session", async () => {
  const { chat, fake, log, turns } = await openChatWith(60);
  // The window of 20 starts in the third turn: a turn the session loses.
  expect(messagesIn(log)[0]!.textContent).toBe("Question 21");
  const { db } = fake.sessions.cache;
  db.prepare("DELETE FROM items WHERE turn_id = ?").run(turns[2]!);
  db.prepare("DELETE FROM turns WHERE id = ?").run(turns[2]!);
  const turn = addTurn(fake, chat.id);
  say(fake, turn, "Reply 31");
  await refreshUntil(() => expect(log.getByText("Reply 31")).toBeTruthy());

  // Counting from the end again, not walking back to the session's first turn.
  expect(messagesIn(log).length).toBeLessThanOrEqual(21);
});
