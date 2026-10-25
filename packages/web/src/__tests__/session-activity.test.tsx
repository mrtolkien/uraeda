// Session US1 key 2 and 3, more 3 and 4, SC-002, the edge cases of a failed edit and nested
// sub-agents, and the plan's review focus 2 and 3: the session column's Activity draws the
// session's runs, each with its calls and thoughts, the latest 200 rows, sub-agents as folded
// groups, and the stretch the address names marked and scrolled to.
import { act, screen, waitFor, within } from "@testing-library/react";
import type { Item } from "uraeda-server/fate";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { redirect } from "../routes.tsx";
import { ACTIVITY_ROWS } from "../session/ActivityPanel.tsx";
import {
  addRun,
  atWidth,
  click,
  type Fake,
  fakeAgent,
  fixtureRepo,
  quiet,
  refreshUntil,
  renderPage,
} from "./helpers.tsx";

/** The tool kinds a call may have. */
type ToolKind = Extract<Item, { kind: "tool" }>["toolKind"];

beforeEach(() => {
  window.localStorage.clear();
  atWidth(1440);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A call of `toolKind` on `target`, lasting `durationMs`, completed unless `status` says. */
function call(
  toolKind: ToolKind,
  target: string,
  {
    durationMs = 1000,
    id = `call-${target}`,
    parent,
    status = "completed",
  }: Partial<{
    durationMs: number;
    id: string;
    parent: string;
    status: Extract<Item, { kind: "tool" }>["status"];
  }> = {},
): Item {
  return {
    durationMs,
    id,
    kind: "tool",
    name: toolKind === "read" ? "Read" : toolKind === "edit" ? "Edit" : "Tool",
    ...(parent === undefined ? {} : { parent }),
    status,
    target,
    toolKind,
  };
}

/**
 * A sub-agent's starting call, `id`, described by `description`, of the sub-agent `parent`, in
 * `status`.
 */
function subagent(
  id: string,
  description: string,
  parent?: string,
  status: Extract<Item, { kind: "tool" }>["status"] = "completed",
): Item {
  return {
    id,
    kind: "tool",
    name: "Task",
    ...(parent === undefined ? {} : { parent }),
    status,
    subagent: { description },
    toolKind: "other",
  };
}

const thought = (durationMs: number, text?: string): Item => ({
  durationMs,
  kind: "thought",
  ...(text === undefined ? {} : { text }),
});
const said = (text: string): Item => ({ kind: "text", streaming: false, text });
const asked = (text: string): Item => ({
  id: `message-${text}`,
  kind: "message",
  origin: "human",
  state: "read",
  text,
});

/** US1.1's run: a message, two thoughts around three reads, a search, a fetch, then the answer. */
const SCENARIO: ReadonlyArray<Item> = [
  asked("Why does completing a repeating task not create the next one?"),
  thought(8000),
  call("read", "src/tasks/complete.ts", { durationMs: 30_000 }),
  call("read", "src/tasks/repeat.ts", { durationMs: 20_000 }),
  call("read", "src/tasks/repeat.test.ts", { durationMs: 17_000 }),
  call("search", '"rrule next occurrence"', { durationMs: 25_000 }),
  call("fetch", "github.com/jkbrzt/rrule#usage", { durationMs: 15_000 }),
  thought(5000),
  said("The next occurrence is only created when the task has a repeat rule."),
];

/** `count` reads of files of run `run`. */
function reads(run: number, count: number): Array<Item> {
  return Array.from({ length: count }, (_, index) =>
    call("read", `src/run-${run}/file-${index}.ts`),
  );
}

/** A turn of `items` that lasted `ms` from 15:41 on, ended in `state`: its id. */
function timedRun(
  fake: Fake,
  session: string,
  items: ReadonlyArray<Item>,
  ms: number,
  state: "done" | "failed" = "done",
) {
  const start = new Date("2026-10-25T15:41:00").getTime();
  vi.setSystemTime(start);
  const turn = addRun(fake, session, items, "running");
  vi.setSystemTime(start + ms);
  fake.sessions.cache.endTurn(turn, { state });
  vi.useRealTimers();
  return turn;
}

/** A new chat, and the fake agent it runs on. */
async function newChat() {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  return { chat: chat.id, fake, repo };
}

/** The session's page, at `query`, with its Activity drawn: the Activity. */
async function openActivity(
  { chat, fake, repo }: { chat: string; fake: Fake; repo: string },
  query = "?tab=activity",
) {
  await renderPage(`/sessions/${chat}${query}`, repo, { agent: fake });
  await screen.findByRole("region", { name: "Activity" });
  await waitFor(() => expect(activity().getAllByRole("heading").length).toBeGreaterThan(0));
  return activity();
}

/** The Activity, the column's top part. */
function activity() {
  return within(screen.getByRole("region", { name: "Activity" }));
}

/** The rows of the Activity, its runs' list items. */
function rows() {
  return activity().getAllByRole("listitem");
}

/** Every element of the page, in order. */
const all = () => [...document.querySelectorAll("*")];

/**
 * Records where the page scrolls a box to: each element's top is its place in the document, so a
 * box's scroll by a distance names the element it brings to its top. Returns what names it.
 */
function watchScrolls() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    return new DOMRect(0, all().indexOf(this), 100, 1);
  });
  const scrolls: Array<{ box: Element; top: number }> = [];
  vi.spyOn(Element.prototype, "scrollBy").mockImplementation(function (
    this: Element,
    options?: ScrollToOptions | number,
  ) {
    scrolls.push({ box: this, top: typeof options === "number" ? 0 : (options?.top ?? 0) });
  });
  // The heading the scroll brought to the top: the element's own, or the first it holds.
  return Object.assign(
    () => {
      const top = scrolledTop(scrolls);
      return top?.matches("h1, h2, h3, h4, h5, h6")
        ? top.textContent
        : top?.querySelector("h1, h2, h3, h4, h5, h6")?.textContent;
    },
    {
      /** How many times the page scrolled a box. */
      count: () => scrolls.length,
      /** The row the last scroll brought to the top, its text. */
      row: () => scrolledTop(scrolls)?.closest("li")?.textContent,
    },
  );
}

/** The element the last of `scrolls` brought to its box's top. */
function scrolledTop(scrolls: ReadonlyArray<{ box: Element; top: number }>) {
  const last = scrolls.at(-1);
  return last && all()[all().indexOf(last.box) + last.top];
}

/**
 * Lays the page out as `watchScrolls` does, each element's top its place in the document, and
 * returns how far the page scrolled since, in px, all boxes and the window together.
 */
function watchShifts() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    return new DOMRect(0, all().indexOf(this), 100, 1);
  });
  let total = 0;
  const add = (options?: ScrollToOptions | number) => {
    total += typeof options === "number" ? 0 : (options?.top ?? 0);
  };
  vi.spyOn(Element.prototype, "scrollBy").mockImplementation(add);
  vi.spyOn(window, "scrollBy").mockImplementation(add);
  return () => total;
}

test("US1.2: the stretch's address scrolls to its run, and marks its rows", async () => {
  const chat = await newChat();
  const turn = timedRun(chat.fake, chat.chat, SCENARIO, 2 * 60_000);
  timedRun(chat.fake, chat.chat, [asked("And now?"), ...reads(2, 3), said("Done.")], 60_000);
  const scrolledTo = watchScrolls();

  await openActivity(chat, `?tab=activity&stretch=${turn}%3A1`);

  await waitFor(() => expect(scrolledTo()).toBe("Run 1 · 2 min"));
  const marked = activity().getAllByRole("listitem", { current: true });
  expect(marked).toHaveLength(7);
  expect(marked[0]!.textContent).toContain("Thought");
  expect(marked[0]!.textContent).toContain("8 s");
  expect(marked[1]!.textContent).toContain("src/tasks/complete.ts");
  expect(marked[1]!.textContent).toContain("read");
  // The next run's rows are not the stretch's.
  expect(activity().getByRole("heading", { name: "Run 2 · 1 min" })).toBeTruthy();
  expect(rows()).toHaveLength(10);
});

test("US1.3: the running call is the last row, marked live", async () => {
  const chat = await newChat();
  addRun(
    chat.fake,
    chat.chat,
    [
      asked("Undo a completion."),
      call("read", "src/tasks/complete.ts"),
      call("read", "src/tasks/undo.ts", { status: "in_progress" }),
    ],
    "running",
  );

  await openActivity(chat);

  expect(activity().getByRole("heading", { name: "Run 1 · live" })).toBeTruthy();
  const last = rows().at(-1)!;
  expect(last.textContent).toContain("src/tasks/undo.ts");
  expect(last.textContent).toContain("read");
  expect(within(last).getByLabelText("Live")).toBeTruthy();
  expect(within(rows()[0]!).queryByLabelText("Live")).toBeNull();
});

test("US1.3: a running sub-agent keeps its row's icon, and its own calls are not live", async () => {
  const chat = await newChat();
  addRun(
    chat.fake,
    chat.chat,
    [
      asked("Find the callers."),
      subagent("agent-1", "Find every caller", undefined, "in_progress"),
      call("read", "src/tasks/list.ts", { id: "s-1", parent: "agent-1", status: "in_progress" }),
    ],
    "running",
  );

  await openActivity(chat);

  const [group] = rows();
  expect(group!.textContent).toContain("Find every caller");
  expect(within(group!).queryByLabelText("Live")).toBeNull();
  await click(within(group!).getByRole("button", { name: /Find every caller/ }));
  await activity().findByText("src/tasks/list.ts");
  expect(activity().queryByLabelText("Live")).toBeNull();
});

test("US1.3, live: a new call of the running turn draws as its last row", async () => {
  const chat = await newChat();
  const turn = addRun(
    chat.fake,
    chat.chat,
    [asked("Undo a completion."), call("read", "src/tasks/complete.ts")],
    "running",
  );
  await openActivity(chat);
  expect(rows()).toHaveLength(1);

  chat.fake.sessions.cache.appendItem(
    turn,
    call("read", "src/tasks/undo.ts", { status: "in_progress" }),
  );

  await refreshUntil(() => expect(rows()).toHaveLength(2));
  const last = rows().at(-1)!;
  expect(last.textContent).toContain("src/tasks/undo.ts");
  expect(within(last).getByLabelText("Live")).toBeTruthy();
});

test("live: a running turn growing past its first page of 100 items draws on", async () => {
  const chat = await newChat();
  // The message and 98 reads: 99 items, the first page all but full.
  const turn = addRun(chat.fake, chat.chat, [asked("Read them all"), ...reads(1, 98)], "running");
  await openActivity(chat);
  expect(rows()).toHaveLength(98);

  for (const item of reads(2, 5)) {
    chat.fake.sessions.cache.appendItem(turn, item);
  }

  await refreshUntil(() => expect(rows()).toHaveLength(103));
  expect(rows().at(-1)!.textContent).toContain("src/run-2/file-4.ts");
  expect(rows()[0]!.textContent).toContain("src/run-1/file-0.ts");
});

test("US1 more 3: a thought with text unfolds it; one without has no fold", async () => {
  const chat = await newChat();
  addRun(chat.fake, chat.chat, [
    asked("Think."),
    thought(3000, "The rule lives in **repeat.ts**."),
    call("read", "src/tasks/repeat.ts", { durationMs: 1000 }),
    thought(4000),
    said("Thought."),
  ]);

  await openActivity(chat);

  // One fold: the thought with text. Its text is not mounted until it unfolds.
  const fold = activity().getByRole("button", { name: "Thought" });
  expect(activity().getAllByText("Thought")).toHaveLength(2);
  expect(activity().queryByText(/The rule lives in/)).toBeNull();
  await click(fold);
  expect(await activity().findByText(/The rule lives in/)).toBeTruthy();
});

test("US1 more 4: a failed run reads Run 2 · failed", async () => {
  const chat = await newChat();
  timedRun(chat.fake, chat.chat, [asked("First"), ...reads(1, 2), said("One.")], 60_000);
  timedRun(chat.fake, chat.chat, [asked("Second"), ...reads(2, 2)], 30_000, "failed");

  await openActivity(chat);

  expect(activity().getByRole("heading", { name: "Run 1 · 1 min" })).toBeTruthy();
  expect(activity().getByRole("heading", { name: "Run 2 · failed" })).toBeTruthy();
});

test("edge: a failed edit shows failed", async () => {
  const chat = await newChat();
  addRun(chat.fake, chat.chat, [
    asked("Edit it."),
    call("edit", "src/tasks/undo.ts", { status: "failed" }),
    call("edit", "src/tasks/complete.ts"),
    said("One of them."),
  ]);

  await openActivity(chat);

  const [failed, done] = rows();
  expect(failed!.textContent).toContain("src/tasks/undo.ts");
  expect(failed!.textContent).toContain("failed");
  expect(done!.textContent).toContain("edit");
  expect(done!.textContent).not.toContain("failed");
});

test("SC-002: a session of 5,000 calls mounts at most 200 rows; Show earlier runs adds 200", async () => {
  const chat = await newChat();
  for (let run = 1; run <= 5; run++) {
    addRun(chat.fake, chat.chat, [asked(`Run ${run}`), ...reads(run, 1000), said(`Done ${run}`)]);
  }

  await openActivity(chat);

  expect(rows()).toHaveLength(ACTIVITY_ROWS);
  // The latest rows: the last run's last 200 reads.
  expect(rows().at(-1)!.textContent).toContain("src/run-5/file-999.ts");
  expect(activity().queryByText("src/run-5/file-799.ts")).toBeNull();
  await click(activity().getByRole("button", { name: "Show earlier runs" }));
  await waitFor(() => expect(rows()).toHaveLength(2 * ACTIVITY_ROWS));
  expect(activity().getByText("src/run-5/file-600.ts")).toBeTruthy();
});

test("Show earlier runs keeps the reader's place when its rows join the same run", async () => {
  const chat = await newChat();
  addRun(chat.fake, chat.chat, [asked("Read them all"), ...reads(1, 1000), said("Done.")]);
  await openActivity(chat);
  const scrolledBy = watchShifts();
  const first = rows()[0]!;
  const before = all().indexOf(first);

  await click(activity().getByRole("button", { name: "Show earlier runs" }));

  await waitFor(() => expect(rows()).toHaveLength(2 * ACTIVITY_ROWS));
  // The row first drawn moved down by the rows drawn above it, and the scroll followed it.
  expect(all().indexOf(first)).toBeGreaterThan(before);
  await waitFor(() => expect(all().indexOf(first) - scrolledBy()).toBe(before));
});

test("SC-002: a turn of 5,000 sub-agent calls reads a few pages back, and offers earlier runs", async () => {
  const chat = await newChat();
  const own = Array.from({ length: 5000 }, (_, index) =>
    call("read", `src/agent/file-${index}.ts`, { id: `s-${index}`, parent: "agent-1" }),
  );
  addRun(chat.fake, chat.chat, [
    asked("Read everything."),
    subagent("agent-1", "Read every file"),
    ...own,
    said("Read."),
  ]);
  await renderPage(`/sessions/${chat.chat}?tab=activity`, chat.repo, { agent: chat.fake });
  await screen.findByRole("region", { name: "Activity" });

  // The sub-agent's row, on the turn's first page of 51, is not read: the budget stopped the walk,
  // and earlier runs are offered. The chat's own transcript reads pages too, so the rows tell.
  await activity().findByRole("button", { name: "Show earlier runs" });
  await quiet();
  expect(activity().queryAllByRole("listitem")).toHaveLength(0);
  await click(activity().getByRole("button", { name: "Show earlier runs" }));
  await quiet();
  expect(activity().queryAllByRole("listitem")).toHaveLength(0);
  expect(activity().getByRole("button", { name: "Show earlier runs" })).toBeTruthy();
});

test("Show earlier runs shows only while earlier rows exist", async () => {
  const chat = await newChat();
  addRun(chat.fake, chat.chat, [asked("Hello"), said("Hello.")]);
  // The 200 rows the bound draws, and no call before them.
  addRun(chat.fake, chat.chat, [asked("Read them"), ...reads(2, ACTIVITY_ROWS), said("Read.")]);

  await openActivity(chat);
  await quiet();

  expect(rows()).toHaveLength(ACTIVITY_ROWS);
  expect(activity().queryByRole("button", { name: "Show earlier runs" })).toBeNull();
});

test("review focus 2: a stretch older than the 200 rows draws back to its run", async () => {
  const chat = await newChat();
  const turn = timedRun(chat.fake, chat.chat, SCENARIO, 2 * 60_000);
  addRun(chat.fake, chat.chat, [asked("Read them all"), ...reads(2, 300), said("Done.")]);

  // Without a stretch, the bound leaves the first run out.
  await openActivity(chat);
  expect(rows()).toHaveLength(ACTIVITY_ROWS);
  expect(activity().queryByRole("heading", { name: "Run 1 · 2 min" })).toBeNull();

  // A recap line of the first run, followed on the page.
  const scrolledTo = watchScrolls();
  act(() => redirect(`${window.location.pathname}?tab=activity&stretch=${turn}%3A1`));

  await waitFor(() => expect(scrolledTo()).toBe("Run 1 · 2 min"));
  expect(activity().getAllByRole("listitem", { current: true })).toHaveLength(7);
  expect(activity().getByRole("heading", { name: "Run 2 · 0 s" })).toBeTruthy();
});

test("SC-002, review focus 2: a stretch in run 1 of 5,000 calls mounts at most 200 rows, from its run", async () => {
  const chat = await newChat();
  const turns = [1, 2, 3, 4, 5].map((run) =>
    addRun(chat.fake, chat.chat, [asked(`Run ${run}`), ...reads(run, 1000), said(`Done ${run}`)]),
  );

  await openActivity(chat, `?tab=activity&stretch=${turns[0]}%3A1`);

  await waitFor(() =>
    expect(activity().queryAllByRole("listitem", { current: true })).not.toEqual([]),
  );
  expect(rows().length).toBeLessThanOrEqual(ACTIVITY_ROWS);
  expect(rows()[0]!.textContent).toContain("src/run-1/file-0.ts");
  expect(activity().getByRole("heading", { name: /^Run 1 · / })).toBeTruthy();
  expect(activity().queryByRole("button", { name: "Show earlier runs" })).toBeNull();

  // Show later runs adds the next 200 rows below.
  await click(activity().getByRole("button", { name: "Show later runs" }));
  await waitFor(() => expect(activity().getByText("src/run-1/file-399.ts")).toBeTruthy());
  expect(rows().length).toBeLessThanOrEqual(2 * ACTIVITY_ROWS);
  expect(rows()[0]!.textContent).toContain("src/run-1/file-0.ts");

  // Leaving the stretch's address draws the latest rows again.
  act(() => redirect(`${window.location.pathname}?tab=activity`));
  await waitFor(() => expect(rows().at(-1)!.textContent).toContain("src/run-5/file-999.ts"));
  expect(rows()).toHaveLength(ACTIVITY_ROWS);
  expect(activity().queryByRole("button", { name: "Show later runs" })).toBeNull();
});

test("US1.2: a later stretch of a long run scrolls to its first row, and again at each arrival", async () => {
  const chat = await newChat();
  // The first stretch's 150 reads fill the first page and half the second; the next starts at 152.
  const items = [asked("Read"), ...reads(1, 150), said("Half."), ...reads(2, 100), said("Done.")];
  const turn = addRun(chat.fake, chat.chat, items);
  const scrolledTo = watchScrolls();
  const address = `?tab=activity&stretch=${turn}%3A152`;

  await openActivity(chat, address);

  await waitFor(() => expect(scrolledTo.row()).toContain("src/run-2/file-0.ts"));
  const marked = activity().getAllByRole("listitem", { current: true });
  expect(marked).toHaveLength(100);
  expect(marked[0]!.textContent).toContain("src/run-2/file-0.ts");

  // The reader scrolls away; the same recap line, followed again, scrolls back to the stretch.
  const scrolls = scrolledTo.count();
  act(() => redirect(`${window.location.pathname}${address}`));
  await waitFor(() => expect(scrolledTo.count()).toBeGreaterThan(scrolls));
  expect(scrolledTo.row()).toContain("src/run-2/file-0.ts");
});

test("review focus 2: a stretch over two pages marks its rows on both", async () => {
  const chat = await newChat();
  // The message and 99 reads fill the first page; the stretch goes on with 51 on the second.
  const items = [asked("Read them all"), ...reads(1, 150), said("Done.")];
  const turn = addRun(chat.fake, chat.chat, items);

  await openActivity(chat, `?tab=activity&stretch=${turn}%3A1`);

  await waitFor(() =>
    expect(activity().getAllByRole("listitem", { current: true })).toHaveLength(150),
  );
});

test("review focus 1: a stretch around a page of a sub-agent's calls alone marks both its parts", async () => {
  const chat = await newChat();
  // 231 items: the message, 50 reads, and 49 of the sub-agent's calls fill the first page, its
  // calls alone the second, and the last 30 reads and the answer start the third.
  const own = Array.from({ length: 149 }, (_, index) =>
    call("read", `src/agent/file-${index}.ts`, { id: `s-${index}`, parent: "agent-1" }),
  );
  const items = [asked("Read them all"), ...reads(1, 50), ...own, ...reads(2, 30), said("Done.")];
  const turn = addRun(chat.fake, chat.chat, items);
  expect(chat.fake.sessions.cache.itemCount(turn)).toBe(231);

  await openActivity(chat, `?tab=activity&stretch=${turn}%3A1`);

  await waitFor(() =>
    expect(activity().getAllByRole("listitem", { current: true })).toHaveLength(80),
  );
});

test("review focus 3, edge: a sub-agent's calls are its group's rows, folded and not mounted", async () => {
  const chat = await newChat();
  addRun(chat.fake, chat.chat, [
    asked("Find the callers."),
    subagent("agent-1", "Find every caller of complete()"),
    said("A sub-agent looks for them."),
    // The sub-agent's calls arrive after the main agent's text.
    call("search", '"complete("', { id: "s-1", parent: "agent-1" }),
    call("read", "src/tasks/list.ts", { id: "s-2", parent: "agent-1" }),
    thought(2000),
    call("read", "src/tasks/complete.ts"),
    said("Found them."),
  ]);

  await openActivity(chat);

  // The main agent's rows: the sub-agent, then its own thought and read.
  expect(rows()).toHaveLength(3);
  const group = rows()[0]!;
  expect(group.textContent).toContain("Find every caller of complete()");
  expect(group.textContent).toContain("sub-agent · 2 calls");
  expect(activity().queryByText("src/tasks/list.ts")).toBeNull();
  await click(within(group).getByRole("button", { name: /Find every caller/ }));
  const opened = within(group);
  expect(await opened.findByText("src/tasks/list.ts")).toBeTruthy();
  expect(opened.getByText('"complete("')).toBeTruthy();
  expect(rows()).toHaveLength(5);
});

test("review focus 3: an open sub-agent of 2,000 calls mounts its latest 200; Show earlier calls adds 200", async () => {
  const chat = await newChat();
  const own = Array.from({ length: 2000 }, (_, index) =>
    call("read", `src/agent/file-${index}.ts`, { id: `s-${index}`, parent: "agent-1" }),
  );
  addRun(chat.fake, chat.chat, [
    asked("Read everything."),
    subagent("agent-1", "Read every file"),
    ...own,
    said("Read."),
  ]);
  await renderPage(`/sessions/${chat.chat}?tab=activity`, chat.repo, { agent: chat.fake });
  await screen.findByRole("region", { name: "Activity" });
  await quiet();
  // The walk's budget stops short of the sub-agent's start: earlier runs draw it.
  while (activity().queryByRole("button", { name: /Read every file/ }) === null) {
    await click(activity().getByRole("button", { name: "Show earlier runs" }));
    await quiet();
  }

  await click(activity().getByRole("button", { name: /Read every file/ }));

  await waitFor(() => expect(activity().getByText("src/agent/file-1999.ts")).toBeTruthy());
  expect(rows().length).toBeLessThanOrEqual(1 + ACTIVITY_ROWS);
  expect(activity().queryByText("src/agent/file-1799.ts")).toBeNull();
  await click(activity().getByRole("button", { name: "Show earlier calls" }));
  await waitFor(() => expect(activity().getByText("src/agent/file-1600.ts")).toBeTruthy());
  expect(rows().length).toBeLessThanOrEqual(1 + 2 * ACTIVITY_ROWS);
});

test("edge: a sub-agent's own sub-agent is a row of its parent's group", async () => {
  const chat = await newChat();
  addRun(chat.fake, chat.chat, [
    asked("Look."),
    subagent("agent-1", "Research rrule's undo"),
    subagent("agent-2", "Look deeper", "agent-1"),
    call("fetch", "github.com/jkbrzt/rrule/issues/412", { id: "f-1", parent: "agent-2" }),
    said("Looked."),
  ]);

  await openActivity(chat);

  expect(rows()).toHaveLength(1);
  expect(activity().queryByText("Look deeper")).toBeNull();
  await click(activity().getByRole("button", { name: /Research rrule's undo/ }));
  const nested = await activity().findByText("Look deeper");
  expect(nested.closest("li")!.textContent).toContain("sub-agent · 1 call");
  expect(activity().queryByText("github.com/jkbrzt/rrule/issues/412")).toBeNull();
});

test("no call yet: a session with no call says so", async () => {
  const chat = await newChat();
  addRun(chat.fake, chat.chat, [asked("Hello"), said("Hello.")]);

  await renderPage(`/sessions/${chat.chat}`, chat.repo, { agent: chat.fake });

  const panel = await screen.findByRole("region", { name: "Activity" });
  expect(await within(panel).findByText("No call yet.")).toBeTruthy();
});
