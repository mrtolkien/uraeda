// Session US1: a turn's calls and thoughts cut into stretches, and every word a recap line, the
// live line, and an activity row say of them.
import { expect, test } from "vite-plus/test";
import {
  type ActivityItem,
  doingText,
  joinStretches,
  liveText,
  recapText,
  rowWord,
  type Slot,
  slotsOf,
  type Stretch,
  stretchKey,
} from "../session/stretches.ts";
import { runsOf } from "../session/activityRuns.ts";
import type { TranscriptItem } from "../TranscriptMessages.tsx";

type ToolItem = Extract<TranscriptItem, { kind: "tool" }>;

let seq = 0;

/** A completed call of `toolKind` on `target`, lasting `durationMs`. */
function call(
  toolKind: ToolItem["toolKind"],
  name: string,
  target: string | undefined,
  durationMs: number,
  extra: Partial<ToolItem> = {},
): ToolItem {
  seq += 1;
  return {
    durationMs,
    id: `call-${seq}`,
    kind: "tool",
    name,
    seq,
    status: "completed",
    target,
    toolKind,
    ...extra,
  };
}

const read = (target: string, ms: number) => call("read", "Read", target, ms);
const edit = (target: string, ms: number) => call("edit", "Edit", target, ms);
const search = (target: string, ms: number) => call("search", "Grep", target, ms);
const fetch = (target: string, ms: number) => call("fetch", "WebFetch", target, ms);
const run = (target: string, ms: number) => call("execute", "Bash", target, ms);

/** A thought of the main agent, lasting `durationMs`. */
function thought(durationMs: number): ActivityItem {
  seq += 1;
  return { durationMs, kind: "thought", seq };
}

/** A text of the agent. */
function text(): TranscriptItem {
  seq += 1;
  return { kind: "text", seq, streaming: false, text: "Done." };
}

const kindOf = (slot: Slot) => slot.kind;

/** The page's stretches, without its other items. */
const stretchesOf = (slots: Array<Slot>): Array<Stretch> =>
  slots.flatMap((slot) => (slot.kind === "stretch" ? [slot.stretch] : []));

test("US1.1: a run of reads, a search, a fetch, and two thoughts", () => {
  expect(
    recapText([
      thought(8000),
      read("src/tasks/complete.ts", 30_000),
      read("src/tasks/repeat.ts", 20_000),
      read("src/tasks/repeat.test.ts", 17_000),
      search('"rrule next occurrence"', 25_000),
      fetch("github.com/jkbrzt/rrule#usage", 15_000),
      thought(5000),
    ]),
  ).toBe("2 min · read 3 files · searched once · fetched 1 page · thought twice");
});

test("a file read twice counts once", () => {
  expect(recapText([read("a.ts", 1000), read("a.ts", 1000), read("b.ts", 1000)])).toBe(
    "3 s · read 2 files",
  );
});

test("edits count files, commands count calls", () => {
  expect(
    recapText([
      edit("a.ts", 20_000),
      edit("b.ts", 20_000),
      edit("a.ts", 10_000),
      run("pnpm test", 10_000),
    ]),
  ).toBe("1 min · edited 2 files · ran 1 command");
});

test("every kind's count, in the table's order whatever came first", () => {
  expect(
    recapText([
      thought(1000),
      thought(1000),
      thought(1000),
      call("other", "TodoWrite", undefined, 1000),
      call("other", "Task", "Find the tests", 1000, { subagent: { description: "Find tests" } }),
      run("pnpm test", 1000),
      run("pnpm lint", 1000),
      fetch("example.com", 1000),
      search("a", 1000),
      search("b", 1000),
      search("c", 1000),
      call("move", "Move", "a.ts", 1000),
      call("delete", "Delete", "b.ts", 1000),
      edit("c.ts", 1000),
      read("d.ts", 1000),
    ]),
  ).toBe(
    "15 s · read 1 file · edited 1 file · deleted 1 file · moved 1 file · searched 3 times · " +
      "fetched 1 page · ran 2 commands · ran 1 sub-agent · used 1 other tool · thought 3 times",
  );
});

test("deletes and moves count distinct files", () => {
  expect(
    recapText([
      call("delete", "Delete", "a.ts", 1000),
      call("delete", "Delete", "a.ts", 1000),
      call("delete", "Delete", "b.ts", 1000),
      call("move", "Move", "c.ts", 1000),
      call("move", "Move", "c.ts", 1000),
    ]),
  ).toBe("5 s · deleted 2 files · moved 1 file");
});

test("the plurals of sub-agents, pages, other tools, and searches", () => {
  const agent = (description: string) =>
    call("other", "Task", description, 1000, { subagent: { description } });

  expect(
    recapText([
      agent("Find the tests"),
      agent("Read the docs"),
      fetch("example.com", 1000),
      fetch("example.org", 1000),
      call("other", "TodoWrite", undefined, 1000),
      call("other", "Skill", undefined, 1000),
      search("a", 1000),
      search("b", 1000),
    ]),
  ).toBe("8 s · searched twice · fetched 2 pages · ran 2 sub-agents · used 2 other tools");
});

test("edge: a single call reads the call", () => {
  expect(recapText([read("src/tasks/undo.ts", 4000)])).toBe("4 s · read src/tasks/undo.ts");
  expect(recapText([run("pnpm test", 4000)])).toBe("4 s · ran pnpm test");
  expect(recapText([thought(3000), edit("src/a.ts", 4000)])).toBe(
    "7 s · edited src/a.ts · thought once",
  );
  expect(recapText([thought(3000)])).toBe("3 s · thought once");
});

test("edge: a single call with no target reads the call, not a count", () => {
  expect(recapText([call("read", "Read", undefined, 4000)])).toBe("4 s · read a file");
  expect(recapText([call("execute", "Bash", undefined, 4000)])).toBe("4 s · ran a command");
  expect(recapText([call("search", "Grep", undefined, 4000)])).toBe("4 s · searched once");
});

test("edge: a single sub-agent or other tool reads the call (ruling R17)", () => {
  expect(
    recapText([
      call("other", "Task", "Find the tests", 4000, {
        subagent: { description: "Find the tests" },
      }),
    ]),
  ).toBe("4 s · ran a sub-agent");
  expect(recapText([call("other", "TodoWrite", undefined, 4000)])).toBe("4 s · used TodoWrite");
});

test("edge: a session cached before thoughts counts none", () => {
  const recap = recapText([read("a.ts", 2000), search("x", 3000)]);

  expect(recap).toBe("5 s · read 1 file · searched once");
  expect(recap).not.toContain("thought");
});

test("a stretch ends at a text, a message, a system line, or a denial", () => {
  const items: Array<TranscriptItem> = [
    read("a.ts", 1000),
    text(),
    read("b.ts", 1000),
    { id: "m", kind: "message", origin: "human", seq: 100, state: "read", text: "Go on" },
    thought(1000),
    { kind: "system", seq: 101, text: "Retrying" },
    read("c.ts", 1000),
    { allowed: false, kind: "denial", seq: 102, tool: "Bash" },
    read("d.ts", 1000),
    read("e.ts", 1000),
  ];

  const slots = slotsOf("7", items);

  expect(slots.map(kindOf)).toEqual([
    "stretch",
    "item",
    "stretch",
    "item",
    "stretch",
    "item",
    "stretch",
    "item",
    "stretch",
  ]);
  const last = slots.at(-1);
  expect(last?.kind === "stretch" && last.stretch.items.length).toBe(2);
  expect(last?.kind === "stretch" && last.stretch.key).toBe(stretchKey("7", items[8]!.seq));
});

test("review focus 3: a sub-agent's calls leave the stretches as they are", () => {
  const starts = call("other", "Task", "Find the tests", 30_000, {
    id: "agent-1",
    status: "in_progress",
    subagent: { description: "Find the tests" },
  });
  const items: Array<TranscriptItem> = [
    starts,
    text(),
    call("read", "Read", "a.ts", 9000, { parent: "agent-1" }),
    { durationMs: 0, kind: "thought", parent: "agent-1", seq: 200 },
    call("search", "Grep", "b", 9000, { parent: "agent-1" }),
    text(),
  ];

  const slots = slotsOf("7", items);

  expect(slots.map(kindOf)).toEqual(["stretch", "item", "item"]);
  const first = slots[0];
  expect(first?.kind === "stretch" && first.stretch.items).toEqual([starts]);
  expect(first?.kind === "stretch" && first.stretch.key).toBe(`7:${starts.seq}`);
});

test("review focus 3: a sub-agent's calls inside a stretch do not part it", () => {
  const items: Array<TranscriptItem> = [
    read("a.ts", 1000),
    call("read", "Read", "z.ts", 9000, { parent: "agent-1" }),
    read("b.ts", 1000),
  ];

  const slots = slotsOf("7", items);

  expect(slots.map(kindOf)).toEqual(["stretch"]);
  expect(slots[0]?.kind === "stretch" && recapText(slots[0].stretch.items)).toBe(
    "2 s · read 2 files",
  );
});

test("review focus 1: a page's first stretch continues the page before, its last runs on", () => {
  const items: Array<TranscriptItem> = [
    read("a.ts", 1000),
    text(),
    read("b.ts", 1000),
    text(),
    read("c.ts", 1000),
  ];

  const [first, middle, last] = stretchesOf(slotsOf("7", items));

  expect([first?.continued, first?.open]).toEqual([true, false]);
  expect([middle?.continued, middle?.open]).toEqual([false, false]);
  expect([last?.continued, last?.open]).toEqual([false, true]);
});

test("review focus 1: a page of calls alone continues, and runs on", () => {
  const [only] = stretchesOf(slotsOf("7", [read("a.ts", 1000), thought(1000)]));

  expect([only?.continued, only?.open]).toEqual([true, true]);
});

test("review focus 1: a page after text neither continues nor runs on", () => {
  const [only] = stretchesOf(slotsOf("7", [text(), read("a.ts", 1000), text()]));

  expect([only?.continued, only?.open]).toEqual([false, false]);
});

test("review focus 1: a sub-agent's calls at a page's ends leave the stretch continued and open", () => {
  const items: Array<TranscriptItem> = [
    call("read", "Read", "z.ts", 9000, { parent: "agent-1" }),
    { durationMs: 0, kind: "thought", parent: "agent-1", seq: 300 },
    read("a.ts", 1000),
    call("search", "Grep", "y", 9000, { parent: "agent-1" }),
  ];

  const [only] = stretchesOf(slotsOf("7", items));

  expect([only?.continued, only?.open]).toEqual([true, true]);
});

test("review focus 1: a stretch over two pages joins under the first page's key", () => {
  const before = slotsOf("7", [text(), read("a.ts", 1000), read("b.ts", 1000)]);
  const after = slotsOf("7", [read("a.ts", 1000), search("x", 2000), text()]);
  const earlier = stretchesOf(before).at(-1)!;
  const later = stretchesOf(after)[0]!;

  const joined = joinStretches(earlier, later);

  expect(joined.key).toBe(earlier.key);
  expect(joined.key).not.toBe(later.key);
  expect(recapText(joined.items)).toBe("5 s · read 2 files · searched once");
  expect([joined.continued, joined.open]).toEqual([false, false]);
});

test("US1.3: the live line", () => {
  expect(liveText(12_000, doingText({ target: "src/tasks/undo.ts", toolKind: "read" }), 0)).toBe(
    "12 s · reading src/tasks/undo.ts",
  );
  expect(liveText(12_000, "reading src/tasks/undo.ts", 2)).toBe(
    "12 s · reading src/tasks/undo.ts · 2 sub-agents running",
  );
  expect(liveText(65_000, "thinking", 1)).toBe("1 min 5 s · thinking · 1 sub-agent running");
});

test("what a running call does, of every kind", () => {
  expect(doingText({ target: "a.ts", toolKind: "edit" })).toBe("editing a.ts");
  expect(doingText({ target: "a.ts", toolKind: "delete" })).toBe("deleting a.ts");
  expect(doingText({ target: "a.ts", toolKind: "move" })).toBe("moving a.ts");
  expect(doingText({ target: "rrule", toolKind: "search" })).toBe("searching rrule");
  expect(doingText({ target: "example.com", toolKind: "fetch" })).toBe("fetching example.com");
  expect(doingText({ target: "pnpm test", toolKind: "execute" })).toBe("running pnpm test");
  expect(doingText({ target: null, toolKind: "read" })).toBe("reading a file");
  expect(doingText({ name: "TodoWrite", toolKind: "other" })).toBe("using TodoWrite");
  expect(
    doingText({
      name: "Task",
      subagent: { description: "Find" },
      target: "Find",
      toolKind: "other",
    }),
  ).toBe("running a sub-agent");
});

test("rows' words: read, edit, search, fetch, run; failed and unfinished", () => {
  expect(rowWord(read("a.ts", 1000), true)).toBe("read");
  expect(rowWord(edit("a.ts", 1000), true)).toBe("edit");
  expect(rowWord(call("delete", "Delete", "a.ts", 1000), true)).toBe("delete");
  expect(rowWord(call("move", "Move", "a.ts", 1000), true)).toBe("move");
  expect(rowWord(search("x", 1000), true)).toBe("search");
  expect(rowWord(fetch("example.com", 1000), true)).toBe("fetch");
  expect(rowWord(run("pnpm test", 1000), true)).toBe("run");
  expect(
    rowWord(call("other", "Task", "Find", 1000, { subagent: { description: "Find" } }), true),
  ).toBe("sub-agent");
  expect(rowWord(call("other", "TodoWrite", undefined, 1000), true)).toBe("TodoWrite");
  expect(rowWord(call("read", "Read", "a.ts", 1000, { status: "failed" }), true)).toBe("failed");
  expect(rowWord(call("read", "Read", "a.ts", 1000, { status: "cancelled" }), false)).toBe(
    "failed",
  );
  expect(rowWord(call("read", "Read", "a.ts", 1000, { status: "in_progress" }), true)).toBe(
    "not finished",
  );
  expect(rowWord(call("read", "Read", "a.ts", 1000, { status: "in_progress" }), false)).toBe(
    "read",
  );
});

test("review focus 1: a page of a sub-agent's calls alone leaves the stretch open across it", () => {
  const first = [text(), read("a.ts", 1000)];
  const between = Array.from({ length: 3 }, () =>
    call("read", "Read", "z.ts", 9000, { parent: "agent-1" }),
  );
  const last = [read("b.ts", 1000), text()];

  const [run] = runsOf([first, between, last].map((items, page) => ({ items, page, turn: "7" })));

  const keys = [first[1]!, last[0]!].map((item) => run?.stretches.get(item.seq));
  expect(keys[0]).toBe(stretchKey("7", first[1]!.seq));
  expect(keys[1]).toBe(keys[0]);
});
