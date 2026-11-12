// The client store. `apply` and the lists run here, on the protocol's shared fixtures. The rest
// runs against the real server: `just app-test` starts a sandbox, and `harness/Harness.tsx`, an
// app opened with the network, connects to it, as the test says step by step.
import { type App, expect, open, test } from "nsh/test";
import { unpackFrame } from "uraeda/native";
import changes from "../../fixtures/protocol/changes.json";
import frames from "../../fixtures/protocol/frames.json";
import messages from "../../fixtures/protocol/messages.json";
import { apply } from "./apply";
import { Held } from "./held";
import type { JsonValue, Op } from "./protocol";

type Sent = { type: string; id?: number; [field: string]: unknown };
type Conn = {
  status: string;
  stale: boolean;
  refused: { update: string; words: string; reason: string } | null;
  sent: Sent[];
  got: Array<{ id: number | null; type: string; binary: boolean }>;
  open: number;
  opened: number;
  held: number | null;
};
type Seen = { values: JsonValue[]; texts: string[]; rows?: string[]; error: string | null };
type Facts = {
  conns: Record<string, Conn>;
  reads: Record<string, Seen>;
  calls: Record<string, { output?: unknown; code?: string; message?: string; ms: number }>;
};

const rows = changes as unknown as Array<{
  name: string;
  old: JsonValue;
  new: JsonValue;
  ops: Op[];
}>;

test("a change applies to the value held as the protocol's crate applies it", () => {
  for (const row of rows) {
    expect([row.name, apply(row.old, row.ops)]).toEqual([row.name, row.new]);
    const held = new Held();
    held.data(row.old, 1);
    expect([row.name, held.change(row.ops, 2), held.value()]).toEqual([row.name, true, row.new]);
  }
  // A change that does not fit leaves the value as it was, for the whole value to be read again.
  const held = new Held();
  const value = { items: [{ id: "m1", text: "Hi" }] };
  held.data(value, 1);
  const misfit: Op[] = [
    { op: "append", path: ["items", "m1", "text"], text: "!" },
    { op: "append", path: ["items", "m9", "text"], text: "?" },
  ];
  expect(held.change(misfit, 2)).toBe(false);
  expect(held.value()).toBe(value);
  expect(held.seq).toBe(1);
});

test("a list keeps the objects of the rows that did not change", () => {
  const held = new Held();
  held.data(
    {
      items: [
        { id: "a", text: "Hi" },
        { id: "b", text: "Wor" },
        { id: "c", text: "" },
      ],
    },
    1,
  );
  const log = held.list<{ id: string; text: string }>(["items"]);
  const reply = held.text(["items", "b", "text"]);
  const first = log.rows();
  const a = log.item("a");
  const c = log.item("c");

  // A piece of a reply: its item and its text change, and no row nor other item does.
  held.change([{ op: "append", path: ["items", "b", "text"], text: "ld" }], 2);
  expect(log.rows()).toBe(first);
  expect(log.item("b")?.text).toBe("World");
  expect(reply()).toBe("World");
  expect(log.item("a")).toBe(a);

  // An insert, a move, and a remove: a new array each time, every other row's object kept.
  held.change([{ before: "b", op: "insert", path: ["items"], value: { id: "n", text: "" } }], 3);
  const inserted = log.rows();
  expect(inserted).not.toBe(first);
  expect(inserted.map((row) => row.id)).toEqual(["a", "n", "b", "c"]);
  expect(inserted[0]).toBe(first[0]);
  expect(inserted[2]).toBe(first[1]);
  expect(inserted[3]).toBe(first[2]);
  held.change([{ before: "a", op: "move", path: ["items", "c"] }], 4);
  held.change([{ op: "remove", path: ["items", "n"] }], 5);
  const moved = log.rows();
  expect(moved.map((row) => row.id)).toEqual(["c", "a", "b"]);
  expect(moved[0]).toBe(first[2]);
  expect(moved[1]).toBe(first[0]);
  expect(log.item("c")).toBe(c);
  expect(log.item("n")).toBe(undefined);

  // The whole value again, as after a resume that came back whole: rows and items kept as equal.
  held.data({ items: [{ id: "c", text: "" }, a!, { id: "b", text: "World, again" }] }, 9);
  expect(log.rows()).toBe(moved);
  expect(reply()).toBe("World, again");
});

test("a binary frame reads as the protocol's crate reads it", () => {
  const read = unpackFrame(new Uint8Array(frames.frame));
  expect(JSON.parse(read.text ?? "null")).toEqual(frames.message);
});

test("a long first value arrives compressed and reads as it was; a short one stays text", async () => {
  const app = await harness();
  await step(app, { conn: "a", do: "connect" });
  await until(app, (f) => f.conns.a?.status === "live");
  // Every theme's colours, about 120 KB of JSON: the shell's largest first value.
  await step(app, {
    args: null,
    conn: "a",
    do: "read",
    key: "themes",
    name: "Themes",
    pick: ["folder"],
    rows: "themes",
  });
  await step(app, {
    conn: "a",
    do: "call",
    input: { on: false },
    key: "set",
    name: "settings.setVimMode",
  });
  await until(app, (f) => (f.reads.themes?.rows?.length ?? 0) > 0 && f.calls.set !== undefined);

  const { got, sent } = facts(app).conns.a!;
  const themes = sent.find((one) => one.type === "sub" && one.record === "Themes")!.id;
  const set = sent.find((one) => one.type === "call")!.id;
  expect(got.find((one) => one.id === themes && one.type === "data")?.binary).toBe(true);
  expect(got.find((one) => one.id === set && one.type === "result")?.binary).toBe(false);
  expect(got.find((one) => one.type === "welcome")?.binary).toBe(false);
  const read = facts(app).reads.themes!;
  expect(read.error).toBe(null);
  expect(typeof last(read.values)).toBe("string");
  expect(read.rows).toContain("catppuccin-mocha");
  expect(read.rows!.length).toBeGreaterThan(20);
});

/** Whether connection `a` stopped the subscription `id`. */
const stopped = (id: number) => (f: Facts) =>
  f.conns.a!.sent.some((one) => one.type === "unsub" && one.id === id);

test("a frame the app cannot read is asked for again once, then fails its record with words", async () => {
  const app = await harness();
  await step(app, { conn: "a", do: "connect" });
  await until(app, (f) => f.conns.a?.status === "live");
  await step(app, { conn: "a", do: "hold" });
  await step(app, { args: null, conn: "a", do: "read", key: "vim", name: "Settings", pick: VIM });
  await until(app, (f) => f.conns.a!.sent.some((one) => one.type === "sub"));
  const subs = () => facts(app).conns.a!.sent.filter((one) => one.type === "sub");
  // A frame that declares more than the 16 MiB the app inflates: it is refused before it is read.
  const bad = async (id: number) => {
    const head = `{"type":"data","id":${id},"seq":1,"size":999999999}\n`;
    const bytes = [...head].map((char) => char.charCodeAt(0)).concat([0x4b, 0x04, 0x00]);
    await step(app, { bytes, conn: "a", do: "inject" });
  };

  // The server stops sending it, and a fresh subscription reads it whole: a frame corrupted once
  // heals, and the record never shows an error.
  const first = subs()[0]!.id!;
  await bad(first);
  await until(app, (f) => stopped(first)(f) && subs().length === 2);
  await step(app, { conn: "a", do: "release" });
  await until(app, (f) => typeof last(f.reads.vim?.values) === "boolean");
  expect(facts(app).reads.vim!.error).toBe(null);

  // Read again, and unreadable twice in a row: the second fails the record with its words, and
  // nothing is left streaming.
  await step(app, { conn: "a", do: "hold" });
  await bad(subs()[1]!.id!);
  await until(app, () => subs().length === 3);
  const third = subs()[2]!.id!;
  await bad(third);
  await until(app, (f) => f.reads.vim?.error !== null && f.reads.vim?.error !== undefined);
  expect(facts(app).reads.vim!.error).toBe("unreadable");
  await until(app, stopped(third));
  expect(subs().length).toBe(3);
  const conn = facts(app).conns.a!;
  expect(conn.open).toBe(0);
  expect(conn.status).toBe("live");
});

test("a record's signal follows the server", async () => {
  const app = await harness();
  await step(app, { conn: "a", do: "connect" });
  await until(app, (f) => f.conns.a?.status === "live");
  await step(app, { args: null, conn: "a", do: "read", key: "vim", name: "Settings", pick: VIM });
  await until(app, (f) => typeof last(f.reads.vim?.values) === "boolean");
  const was = last(facts(app).reads.vim!.values) as boolean;

  await step(app, {
    conn: "a",
    do: "call",
    input: { on: !was },
    key: "set",
    name: "settings.setVimMode",
  });
  await until(app, (f) => last(f.reads.vim?.values) === !was && f.calls.set !== undefined);
  expect(facts(app).calls.set).toMatchObject({ output: null });

  // Nobody reads it: it is unsubscribed, and nothing is left open.
  await step(app, { do: "unread", key: "vim" });
  await until(app, (f) => f.conns.a!.sent.some((sent) => sent.type === "unsub"));
  const conn = facts(app).conns.a!;
  expect(conn.open).toBe(0);
  expect(openOnWire(conn)).toBe(0);

  // Each message has the shape of the contract's, which the server's tests read too.
  for (const type of ["hello", "sub", "call", "unsub"]) {
    const sent = conn.sent.find((one) => one.type === type)!;
    const shared = messages.client.find((one) => one.type === type)!;
    expect([type, Object.keys(sent).toSorted()]).toEqual([type, Object.keys(shared).toSorted()]);
  }
});

test("a reconnect resumes a reply without a gap", async () => {
  const app = await harness();
  await step(app, { conn: "a", do: "connect" });
  await until(app, (f) => f.conns.a?.status === "live");
  await step(app, {
    conn: "a",
    do: "call",
    input: { repo: "sample" },
    key: "chat",
    name: "session.newChat",
  });
  await until(app, (f) => f.calls.chat !== undefined);
  const session = (facts(app).calls.chat!.output as { session: string }).session;
  const send = { repo: "sample", session, text: "Say hello." };
  await step(app, { conn: "a", do: "call", input: send, key: "send", name: "session.send" });
  await until(app, (f) => f.calls.send !== undefined);
  const turn = (facts(app).calls.send!.output as { turn: string }).turn;
  const args = { page: 0, repo: "sample", turn };

  // The page of the transcript, then the reply in it, which grows by appends.
  await step(app, {
    args,
    conn: "a",
    do: "read",
    key: "log",
    name: "TurnLog",
    pick: ["items"],
    rows: "items",
  });
  await until(app, (f) => replyOf(last(f.reads.log?.values)) !== undefined);
  const reply = replyOf(last(facts(app).reads.log!.values))!;
  const path = ["items", reply.id, "text"];
  await step(app, { args, conn: "a", do: "read", key: "reply", name: "TurnLog", text: path });
  await until(app, (f) => (last(f.reads.reply?.texts) ?? "").length > 0);

  // The line drops while the reply streams: the app says so, then connects again by itself.
  await step(app, { conn: "a", do: "drop" });
  await until(app, (f) => f.conns.a!.stale && f.conns.a!.status !== "live");
  await until(app, (f) => f.conns.a!.status === "live", 5000);
  expect(facts(app).conns.a!.stale).toBe(false);
  await until(app, (f) => replyOf(last(f.reads.log?.values))?.streaming === false, 15_000);

  // It resumed under the epoch it was welcomed in, and got the changes it missed, never the page
  // whole again.
  const conn = facts(app).conns.a!;
  const resume = conn.sent.find((sent) => sent.type === "resume")!;
  const shared = messages.client.find((one) => one.type === "resume")!;
  expect(Object.keys(resume).toSorted()).toEqual(Object.keys(shared).toSorted());
  expect(resume).toMatchObject({ args, record: "TurnLog" });
  expect(typeof resume.epoch === "string" && resume.epoch !== "").toBe(true);
  expect(conn.got.filter((got) => got.id === resume.id).map((got) => got.type)).not.toContain(
    "data",
  );

  // What it holds is what a fresh read gives, and the text only grew on the way.
  const texts = facts(app).reads.reply!.texts;
  texts.forEach((text, index) => expect(text.startsWith(texts[index - 1] ?? "")).toBe(true));
  await step(app, { conn: "b", do: "connect" });
  await step(app, { args, conn: "b", do: "read", key: "fresh", name: "TurnLog", pick: ["items"] });
  await until(
    app,
    (f) => last(f.reads.fresh?.values) !== undefined && last(f.reads.fresh?.values) !== null,
  );
  expect(last(facts(app).reads.log!.values)).toEqual(last(facts(app).reads.fresh!.values));
  expect(last(texts)).toBe(replyOf(last(facts(app).reads.fresh!.values))!.text);

  await step(app, { do: "unread", key: "log" });
  await step(app, { do: "unread", key: "reply" });
  await until(app, (f) => f.conns.a!.open === 0);
  expect(openOnWire(facts(app).conns.a!)).toBe(0);
});

test("a server found at another address keeps the records' values, stale, until its own come", async () => {
  const app = await harness();
  await step(app, { conn: "a", do: "connect" });
  await until(app, (f) => f.conns.a?.status === "live");
  await step(app, { args: null, conn: "a", do: "read", key: "vim", name: "Settings", pick: VIM });
  await until(app, (f) => typeof last(f.reads.vim?.values) === "boolean");
  const seen = facts(app).reads.vim!.values.length;

  // This machine's server, started again, answers at another address: the line moves there.
  await step(app, { conn: "a", do: "move", to: `${app.texts()[0]}/` });
  await until(app, (f) => f.conns.a!.status === "live" && f.conns.a!.opened === 2, 5000);
  expect(facts(app).conns.a!.stale).toBe(false);
  // The value was never lost on the way: no read gave nothing.
  const values = facts(app).reads.vim!.values.slice(seen - 1);
  expect(values.every((value) => typeof value === "boolean")).toBe(true);
});

test("a change that arrives after its unsub is ignored, and no subscription is left", async () => {
  const app = await harness();
  await step(app, { conn: "a", do: "connect" });
  await step(app, { conn: "b", do: "connect" });
  await until(app, (f) => f.conns.a?.status === "live" && f.conns.b?.status === "live");
  await step(app, { args: null, conn: "a", do: "read", key: "vim", name: "Settings", pick: VIM });
  await until(app, (f) => typeof last(f.reads.vim?.values) === "boolean");
  const was = last(facts(app).reads.vim!.values) as boolean;

  // A change is on its way to `a` as it lets the record go.
  await step(app, { conn: "a", do: "hold" });
  await step(app, {
    conn: "b",
    do: "call",
    input: { on: !was },
    key: "set",
    name: "settings.setVimMode",
  });
  await until(app, (f) => (f.conns.a!.held ?? 0) > 0 && f.calls.set !== undefined);
  await step(app, { do: "unread", key: "vim" });
  await until(app, (f) => last(f.conns.a!.sent)?.type === "unsub");
  const sentBefore = facts(app).conns.a!.sent.length;
  await step(app, { conn: "a", do: "release" });
  await app.wait(100);

  const conn = facts(app).conns.a!;
  expect(conn.got.map((got) => got.type)).toContain("change");
  expect(conn.sent.length).toBe(sentBefore);
  expect(conn.open).toBe(0);
  expect(openOnWire(conn)).toBe(0);
  expect(conn.status).toBe("live");
});

test("a refused connection says which side to update", async () => {
  const app = await harness();
  // A client newer than the server, and one older: the real server refuses both.
  await step(app, { conn: "newer", do: "connect", protocol: 3 });
  await step(app, { conn: "older", do: "connect", protocol: 1 });
  await until(
    app,
    (f) => f.conns.newer?.status === "refused" && f.conns.older?.status === "refused",
  );
  const { newer, older } = facts(app).conns;
  expect(newer!.refused).toMatchObject({ reason: "server-too-old", update: "server" });
  expect(older!.refused).toMatchObject({ reason: "client-too-old", update: "app" });
  expect(newer!.refused!.words).toMatch(/^Update the server/);

  // Nothing tries again: past the first wait, each opened its line once.
  await app.wait(700);
  expect([facts(app).conns.newer!.opened, facts(app).conns.older!.opened]).toEqual([1, 1]);
});

test("a call made offline fails at once", async () => {
  const app = await harness();
  await step(app, { conn: "a", do: "connect" });
  await until(app, (f) => f.conns.a?.status === "live");

  // A call whose answer has not come when the line drops says it may have run.
  await step(app, { conn: "a", do: "hold" });
  await step(app, {
    conn: "a",
    do: "call",
    input: { on: true },
    key: "sent",
    name: "settings.setVimMode",
  });
  await step(app, { conn: "a", do: "drop" });
  await step(app, {
    conn: "a",
    do: "call",
    input: { on: true },
    key: "offline",
    name: "settings.setVimMode",
  });
  await until(app, (f) => f.calls.offline !== undefined && f.calls.sent !== undefined);
  const { offline, sent } = facts(app).calls;
  expect(offline).toMatchObject({ code: "offline" });
  expect(offline!.ms).toBeLessThan(50);
  expect(offline!.message).toMatch(/not connected/);
  expect(sent).toMatchObject({ code: "dropped" });
  expect(facts(app).conns.a!.stale).toBe(true);
});

const VIM = ["keyboard", "vimMode", "inForce"];

async function harness(): Promise<App> {
  const app = await open("./harness/Harness.tsx", {
    host: { handlers: { facts: null } },
    network: "live",
  });
  expect(app.texts()[0]).toMatch(/^http:\/\/127\.0\.0\.1:/);
  return app;
}

function step(app: App, it: Record<string, unknown>): Promise<void> {
  return app.host.send("step", it);
}

function facts(app: App): Facts {
  const posted = app.host.posts().filter((post) => post.name === "facts");
  return (posted.at(-1)?.data ?? { calls: {}, conns: {}, reads: {} }) as Facts;
}

function until(app: App, holds: (facts: Facts) => boolean, timeout = 10_000): Promise<void> {
  return app.waitUntil(() => holds(facts(app)), { timeout });
}

function last<T>(items: ReadonlyArray<T> | undefined): T | undefined {
  return items?.[items.length - 1];
}

/** The reply of a page's items: its text item. */
function replyOf(items: JsonValue | undefined) {
  if (!Array.isArray(items)) return undefined;
  return items.find((item) => (item as { kind?: string }).kind === "text") as
    | { id: string; text: string; streaming: boolean }
    | undefined;
}

/** The subscriptions the server holds open on the line, from what was sent and answered. */
function openOnWire(conn: Conn): number {
  const ids = new Set<number>();
  for (const sent of conn.sent) {
    // A new line: the server dropped every subscription of the one before.
    if (sent.type === "hello") ids.clear();
    if (sent.type === "sub" || sent.type === "resume") ids.add(sent.id!);
    if (sent.type === "unsub") ids.delete(sent.id!);
  }
  for (const got of conn.got) if (got.type === "error" && got.id !== null) ids.delete(got.id);
  return ids.size;
}
