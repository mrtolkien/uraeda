// Session US1 and US4, SC-001, SC-004, and the plan's review focus 1 and 5: the chat folds each
// stretch of the agent's calls and thoughts into one recap line, which opens the session's
// Activity at that stretch, and a running turn ends with its live recap line.
import { act, screen, waitFor, within } from "@testing-library/react";
import { addSpecFeature, SPEC_FEATURE } from "uraeda-binding/test-utils";
import type { Item } from "uraeda-server/fate";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { navigate } from "../routes.tsx";
import {
  atRepo,
  atWidth,
  click,
  type Fake,
  fakeAgent,
  fixtureRepo,
  renderPage,
} from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";

/** The answer that ends the scenario's stretch. */
const ANSWER = "The next occurrence is only created when the task has a repeat rule.";

/** US1.1's recap line. */
const RECAP = "2 min · read 3 files · searched once · fetched 1 page · thought twice";

beforeEach(() => {
  window.localStorage.clear();
  atWidth(1440);
});

afterEach(() => {
  vi.useRealTimers();
});

/** A new turn of a session, running until the test ends it. */
function addTurn(fake: Fake, session: string, kind: "chat" | "workflow" = "chat") {
  return fake.sessions.cache.addTurn({
    allowed: null,
    kind,
    sessionId: session,
    state: "running",
    step: kind === "workflow" ? "spec" : null,
    trigger: kind === "workflow" ? "manual" : null,
  });
}

/** A completed call of `toolKind` on `target`, lasting `durationMs`. */
function call(toolKind: string, name: string, target: string, durationMs: number): Item {
  return {
    durationMs,
    id: `call-${target}`,
    kind: "tool",
    name,
    status: "completed",
    target,
    toolKind: toolKind as Extract<Item, { kind: "tool" }>["toolKind"],
  };
}

const thought = (durationMs: number): Item => ({ durationMs, kind: "thought" });
const said = (text: string): Item => ({ kind: "text", streaming: false, text });
const asked = (text: string): Item => ({
  id: `message-${text}`,
  kind: "message",
  origin: "human",
  state: "read",
  text,
});

/** `count` reads of a second each, of files of run `run` from the `from`th. */
function calls(run: number, from: number, count: number): Array<Item> {
  return Array.from({ length: count }, (_, index) =>
    call("read", "Read", `src/run-${run}/file-${from + index}.ts`, 1000),
  );
}

/** Appends `items` to the turn, in order. */
function seedStretch(fake: Fake, turn: number, items: ReadonlyArray<Item>) {
  for (const item of items) {
    fake.sessions.cache.appendItem(turn, item);
  }
}

/** US1.1's run: a message, two thoughts around three reads, a search, and a fetch, then the answer. */
const SCENARIO: ReadonlyArray<Item> = [
  asked("Why does completing a repeating task not create the next one?"),
  thought(8000),
  call("read", "Read", "src/tasks/complete.ts", 30_000),
  call("read", "Read", "src/tasks/repeat.ts", 20_000),
  call("read", "Read", "src/tasks/repeat.test.ts", 17_000),
  call("search", "Grep", '"rrule next occurrence"', 25_000),
  call("fetch", "WebFetch", "github.com/jkbrzt/rrule#usage", 15_000),
  thought(5000),
  said(ANSWER),
];

/** A chat of one ended turn of `items`, opened on its page at its answer. */
async function openChat(items: ReadonlyArray<Item>, last: string) {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  const turn = addTurn(fake, chat.id);
  seedStretch(fake, turn, items);
  fake.sessions.cache.endTurn(turn, { state: "done" });
  await renderPage(`/sessions/${chat.id}`, repo, { agent: fake });
  const log = await screen.findByRole("log", { name: "Conversation" });
  await within(log).findByText(last);
  return { chat, fake, log: within(log), repo, turn };
}

/** The recap lines a log draws: the links to a stretch of its Activity. */
function recapsIn(log: ReturnType<typeof within>) {
  return log
    .queryAllByRole("link")
    .filter((link: HTMLElement) => link.getAttribute("href")?.includes("tab=activity"));
}

/** The element that shows `text` whole, its time drawn apart from its words. */
const whole = (text: string) => (_: string, element: Element | null) =>
  element?.textContent === text &&
  ![...element.children].some((child) => child.textContent === text);

/** Whether `a` comes before `b` in the page. */
const precedes = (a: Node, b: Node) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

test("US1.1: one recap line for a stretch, above the answer, and no call in the chat", async () => {
  const { log } = await openChat(SCENARIO, ANSWER);

  const recap = await log.findByRole("link", { name: RECAP });
  expect(precedes(recap, log.getByText(ANSWER))).toBe(true);
  expect(log.queryByText("src/tasks/complete.ts")).toBeNull();
  expect(log.queryByText(/rrule next occurrence/)).toBeNull();
  expect(recapsIn(log)).toHaveLength(1);
});

test("US1.2, SC-004: the recap line opens the Activity at its stretch", async () => {
  const { log, turn } = await openChat(SCENARIO, ANSWER);

  const recap = await log.findByRole("link", { name: RECAP });
  // The message is the turn's item 0, so the stretch starts at item 1.
  expect(recap.getAttribute("href")).toBe(
    `${window.location.pathname}?tab=activity&stretch=${turn}%3A1`,
  );
});

test("SC-001: 3 runs of 30 calls draw 3 to 6 recap lines, and no row per call", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  const runs: Array<ReadonlyArray<Item>> = [
    [asked("Run 1"), ...calls(1, 0, 30), said("Answer 1")],
    [asked("Run 2"), ...calls(2, 0, 15), said("Halfway 2"), ...calls(2, 15, 15), said("Answer 2")],
    [asked("Run 3"), ...calls(3, 0, 30), said("Answer 3")],
  ];
  for (const items of runs) {
    const turn = addTurn(fake, chat.id);
    seedStretch(fake, turn, items);
    fake.sessions.cache.endTurn(turn, { state: "done" });
  }
  await renderPage(`/sessions/${chat.id}`, repo, { agent: fake });
  const log = within(await screen.findByRole("log", { name: "Conversation" }));
  await log.findByText("Answer 3");

  await waitFor(() => expect(recapsIn(log)).toHaveLength(4));
  expect(log.queryByText(/^src\/run-/)).toBeNull();
  expect(log.getAllByRole("link", { name: "15 s · read 15 files" })).toHaveLength(2);
});

test("US1.3: a running turn reading a file for 12 s ends with its live recap line", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const session = await fake.sessions.featureSession(repo, CLI);
  const start = new Date("2026-10-25T10:00:00Z");
  vi.setSystemTime(start);
  const { turn } = await fake.sessions.send(repo, session.id, {
    text: "Continue the feature.",
    workflow: { trigger: "manual" },
  });
  await waitFor(() => expect(fake.adapter.sent).toHaveLength(1));
  fake.adapter.emit({ id: fake.adapter.sent[0].id, type: "accepted" });
  fake.adapter.emit({
    id: "toolu_1",
    input: { file_path: "src/tasks/undo.ts" },
    kind: "read",
    name: "Read",
    target: "src/tasks/undo.ts",
    type: "toolStart",
  });
  await waitFor(() => expect(fake.sessions.cache.itemCount(turn)).toBe(2));
  vi.setSystemTime(start.getTime() + 12_000);

  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });

  const log = within(await screen.findByRole("log", { name: "Conversation" }));
  const live = await log.findByText(whole("12 s · reading src/tasks/undo.ts"));
  // The live line opens the open stretch, the read, named by what the agent does.
  const link = live.closest("a")!;
  expect(link.getAttribute("href")).toBe(
    `${atRepo(`/f/${CLI}/session`)}?tab=activity&stretch=${turn}%3A1`,
  );
  expect(within(link).getByRole("img", { name: "Working" })).toBeTruthy();
  // The call has no row, and no recap line of its own while it runs.
  expect(recapsIn(log)).toEqual([link]);
});

test("US1.3: the live line counts the sub-agents the main agent runs", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const session = await fake.sessions.featureSession(repo, CLI);
  const start = new Date("2026-10-25T10:00:00Z");
  vi.setSystemTime(start);
  const { turn } = await fake.sessions.send(repo, session.id, {
    text: "Continue the feature.",
    workflow: { trigger: "manual" },
  });
  await waitFor(() => expect(fake.adapter.sent).toHaveLength(1));
  fake.adapter.emit({ id: fake.adapter.sent[0].id, type: "accepted" });
  for (const id of ["agent-1", "agent-2"]) {
    fake.adapter.emit({
      id,
      input: { description: `Explore ${id}` },
      kind: "other",
      name: "Task",
      subagent: { description: `Explore ${id}` },
      type: "toolStart",
    });
  }
  // A sub-agent of a sub-agent is not the main agent's.
  fake.adapter.emit({
    id: "agent-3",
    input: { description: "Look deeper" },
    kind: "other",
    name: "Task",
    parent: "agent-1",
    subagent: { description: "Look deeper" },
    type: "toolStart",
  });
  await waitFor(() => expect(fake.sessions.cache.itemCount(turn)).toBe(4));
  vi.setSystemTime(start.getTime() + 3000);

  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });

  const log = within(await screen.findByRole("log", { name: "Conversation" }));
  expect(
    await log.findByText(whole("3 s · running a sub-agent · 2 sub-agents running")),
  ).toBeTruthy();
});

test("review focus 1: a stretch of 250 calls over three pages draws one line, after its last call", async () => {
  const reads = Array.from({ length: 250 }, (_, index) =>
    call("read", "Read", `src/file-${index}.ts`, 1000),
  );
  // 252 items: the message and the first 99 reads on the first page, 100 on the second, and the
  // last 51 and the answer on the third.
  const { fake, log, turn } = await openChat(
    [asked("Read them all"), ...reads, said("Done.")],
    "Done.",
  );
  expect(fake.sessions.cache.itemCount(turn)).toBe(252);

  const recap = await log.findByRole("link", { name: "4 min 10 s · read 250 files" });
  expect(recapsIn(log)).toEqual([recap]);
  expect(precedes(recap, log.getByText("Done."))).toBe(true);
  expect(precedes(log.getByText("Read them all"), recap)).toBe(true);
  // One stretch, under the key of its first call, on the first page.
  expect(recap.getAttribute("href")).toContain(`stretch=${turn}%3A1`);
});

test("review focus 1: a stretch that ends its page draws its line on the page after", async () => {
  // 101 items: the message and 99 reads fill the first page, and the answer starts the second.
  const { log } = await openChat(
    [asked("Read them all"), ...calls(1, 0, 99), said("Done.")],
    "Done.",
  );

  const recap = await log.findByRole("link", { name: "1 min 39 s · read 99 files" });
  expect(recapsIn(log)).toEqual([recap]);
  expect(precedes(recap, log.getByText("Done."))).toBe(true);
});

test("review focus 1: a running turn draws the stretch that ended its page before", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  const turn = addTurn(fake, chat.id);
  seedStretch(fake, turn, [asked("Read them all"), ...calls(1, 0, 99), said("Halfway.")]);
  await renderPage(`/sessions/${chat.id}`, repo, { agent: fake });
  const log = within(await screen.findByRole("log", { name: "Conversation" }));
  await log.findByText("Halfway.");

  const recap = await log.findByRole("link", { name: "1 min 39 s · read 99 files" });
  expect(log.getAllByRole("link", { name: "1 min 39 s · read 99 files" })).toEqual([recap]);
  expect(precedes(recap, log.getByText("Halfway."))).toBe(true);
});

test("review focus 1: a stretch before the tail's cut draws once, with the earlier messages", async () => {
  // The first page ends with the stretch; the second holds the tail's 20 messages, from its first.
  const exchange = Array.from({ length: 10 }, (_, index) => [
    asked(`Question ${index}`),
    said(`Answer ${index}`),
  ]).flat();
  const { log } = await openChat(
    [asked("Read them all"), ...calls(1, 0, 99), ...exchange],
    "Answer 9",
  );
  const name = "1 min 39 s · read 99 files";
  expect(log.queryByText("Read them all")).toBeNull();
  expect(log.queryByRole("link", { name })).toBeNull();

  await click(await log.findByRole("button", { name: "Show earlier messages" }));

  const recap = await log.findByRole("link", { name });
  expect(log.getAllByRole("link", { name })).toEqual([recap]);
  expect(precedes(log.getByText("Read them all"), recap)).toBe(true);
  expect(precedes(recap, log.getByText("Question 0"))).toBe(true);
});

test("review focus 5: Back after a recap line leaves the page, as after a tab switch", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  const turn = addTurn(fake, chat.id);
  seedStretch(fake, turn, SCENARIO);
  fake.sessions.cache.endTurn(turn, { state: "done" });
  await renderPage("/", repo, { agent: fake });
  await act(async () => navigate(atRepo(`/sessions/${chat.id}`)));
  const log = within(await screen.findByRole("log", { name: "Conversation" }));

  await click(await log.findByRole("link", { name: RECAP }));
  await waitFor(() => expect(window.location.search).toBe(`?tab=activity&stretch=${turn}%3A1`));
  expect(window.location.pathname).toBe(atRepo(`/sessions/${chat.id}`));
  await act(async () => window.history.back());

  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/")));
});

/** A feature's spec page whose session ran US1.1's stretch, with its Session tab open. */
async function openSessionTab() {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  const fake = await fakeAgent();
  const session = await fake.sessions.featureSession(repo, SPEC_FEATURE);
  const turn = addTurn(fake, session.id, "workflow");
  seedStretch(fake, turn, SCENARIO);
  fake.sessions.cache.endTurn(turn, { state: "done" });
  await renderPage(`/f/${SPEC_FEATURE}/spec.md`, repo, { agent: fake });
  const tabs = await screen.findByRole("tablist", { name: "The spec's column" });
  await click(within(tabs).getByRole("tab", { name: "Session" }));
  const panel = within(screen.getByRole("tabpanel", { name: "Session" }));
  await panel.findByText(ANSWER);
  return { panel, turn };
}

test("US4.1: the Session tab of a document draws recap lines, and no column of its own", async () => {
  const { panel } = await openSessionTab();

  expect(await panel.findByRole("link", { name: RECAP })).toBeTruthy();
  expect(panel.queryByText("src/tasks/complete.ts")).toBeNull();
  expect(panel.queryByRole("tablist")).toBeNull();
});

test("US4.2: a recap line in the Session tab opens the session's page at the stretch", async () => {
  const { panel, turn } = await openSessionTab();
  const spec = window.location.pathname;

  await click(await panel.findByRole("link", { name: RECAP }));

  const page = atRepo(`/f/${SPEC_FEATURE}/session`);
  await waitFor(() => expect(window.location.pathname).toBe(page));
  expect(window.location.search).toBe(`?tab=activity&stretch=${turn}%3A1`);
  // A page of its own, in a new entry: Back returns to the spec.
  await act(async () => window.history.back());
  await waitFor(() => expect(window.location.pathname).toBe(spec));
});
