import { afterEach, expect, test, vi } from "vite-plus/test";
import { fixtureRepo } from "uraeda-binding/test-utils";
import { PICK_WAIT_MS } from "../account-pick.ts";
import { CONTINUES_OFF, type ContinueSettings } from "../continuer.ts";
import type { Limit } from "../events.ts";
import { FakeAccounts } from "../fake.ts";
import type { Sessions } from "../sessions.ts";
import {
  account,
  fakeAccounts,
  flush,
  folder,
  limitTurn,
  restart,
  testSessions,
} from "./helpers.ts";

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Sends a message to the session, and waits for its turn's end. */
async function send(sessions: Sessions, repo: string, session: string, text: string) {
  const { turn } = await sessions.send(repo, session, { text });
  await sessions.settled(turn);
  return turn;
}

test("a session picks its account at its first turn, and keeps it", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  adapter.script([]);
  const none = await sessions.newChat(repo); // no account listed
  await send(sessions, repo, none.id, "hello");
  expect(adapter.opens.at(-1)?.account).toBeUndefined();
  expect(cache.session(none.id)?.account).toBeNull();

  adapter.accounts = fakeAccounts();
  adapter.script([]);
  const chat = await sessions.newChat(repo);
  await send(sessions, repo, chat.id, "hello");
  expect(adapter.opens.at(-1)?.account).toBe(folder("b"));
  expect(cache.session(chat.id)?.account).toBe(folder("b"));

  // `c` left the list, and `b` is now the most used: the sessions keep what they started on.
  adapter.accounts.accounts = [account("default", 0.42), account("b", 0.95)];
  const again = await restart(sessions);
  adapter.script([]);
  await send(again, repo, chat.id, "more");
  expect(adapter.opens.at(-1)?.account).toBe(folder("b"));
  // The restart looked for its transcript in that account.
  expect(adapter.hasSessionAccounts.at(-1)).toBe(folder("b"));
  adapter.script([]);
  await send(again, repo, none.id, "more");
  expect(adapter.opens.at(-1)?.account).toBeUndefined(); // it ran on the server's own login
  expect(cache.session(none.id)?.account).toBeNull();

  // The runtime lists none any more: a session with an account still opens on its folder.
  adapter.accounts.accounts = [];
  const empty = await restart(again);
  adapter.script([]);
  await send(empty, repo, chat.id, "once more");
  expect(adapter.opens.at(-1)?.account).toBe(folder("b"));

  // No listed account is signed in: the first turn fails with why, and stores no account.
  adapter.accounts.accounts = [account("b", 0, { state: "signed-out" })];
  const refused = await empty.newChat(repo);
  await expect(empty.send(repo, refused.id, { text: "hello" })).rejects.toThrow(
    "refused: No Claude Code account is signed in: sign one in, or empty Accounts in Settings, Extensions",
  );
  expect(cache.session(refused.id)?.account).toBeNull();
  const opens = adapter.opens.length;

  // The session is released, and picks once an account is signed in.
  adapter.accounts.accounts = [account("b", 0)];
  adapter.script([]);
  await send(empty, repo, refused.id, "hello again");
  expect(adapter.opens).toHaveLength(opens + 1);
  expect(cache.session(refused.id)?.account).toBe(folder("b"));
});

test("a session picks again until a turn of it starts, and keeps the account of the turn that did", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  adapter.accounts = fakeAccounts();
  const chat = await sessions.newChat(repo);
  // The process fails to open after the pick: no turn started, yet the account is stored.
  vi.spyOn(adapter, "open").mockImplementationOnce(() => {
    throw new Error("no process");
  });
  await expect(sessions.send(repo, chat.id, { text: "hello" })).rejects.toThrow("no process");
  expect(cache.session(chat.id)?.account).toBe(folder("b"));

  // The usage changed since: the first turn that starts picks on it.
  adapter.accounts.accounts = [account("default", 0.42), account("b", 0.95), account("c", 0.1)];
  adapter.script([]);
  await send(sessions, repo, chat.id, "hello again");
  expect(adapter.opens.at(-1)?.account).toBe(folder("c"));
  expect(cache.session(chat.id)?.account).toBe(folder("c"));

  // From that turn on it keeps its account.
  adapter.accounts.accounts = [account("default", 0), account("b", 0), account("c", 0.9)];
  adapter.script([]);
  await send(sessions, repo, chat.id, "more");
  expect(adapter.opens.at(-1)?.account).toBe(folder("c"));
});

const ON: ContinueSettings = { ...CONTINUES_OFF, afterLimit: true };
const RESET = "2026-11-03T23:40:00.000Z";
const LIMIT: Limit = {
  kind: "session",
  resetsAt: RESET,
  text: "You've hit your session limit · resets 11:40pm (UTC)",
};
const LIMIT_MESSAGE = "The usage limit has reset. Continue where you left off.";

test("a run a limit refused continues on its own account", async () => {
  const { adapter, cache, repo, sessions } = await testSessions(fixtureRepo(), {
    runs: () => ON,
  });
  let now = Date.parse("2026-11-03T14:01:00Z");
  vi.spyOn(Date, "now").mockImplementation(() => now);
  adapter.accounts = fakeAccounts();
  const session = await sessions.featureSession(repo, AGENT);
  // `b` refuses at its limit until its reset, while `c` has room.
  limitTurn(adapter, LIMIT);
  const { turn } = await sessions.send(repo, session.id, { text: "Go on with the plan" });
  await sessions.settled(turn);
  expect(cache.session(session.id)?.account).toBe(folder("b"));
  adapter.accounts.accounts = [account("b", 1), account("c", 0)];

  adapter.script([]);
  const to = Date.parse("2026-11-04T00:00:00Z");
  const step = to - now;
  now = to;
  vi.advanceTimersByTime(step);
  await vi.waitFor(
    () => expect(adapter.sent.some((message) => message.text === LIMIT_MESSAGE)).toBe(true),
    { interval: 5, timeout: 5000 },
  );
  expect(adapter.opens.at(-1)?.account).toBe(folder("b"));
  expect(cache.session(session.id)?.account).toBe(folder("b"));
  expect(adapter.accounts.asks).toBe(1); // the continue never picked again
});

test("a pick waits 10 seconds for an ask, then goes on", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  adapter.accounts = fakeAccounts();
  adapter.accounts.hangs = true;
  adapter.script([]);
  const chat = await sessions.newChat(repo);
  // The send waits for the process to open, which waits for the pick.
  const sending = sessions.send(repo, chat.id, { text: "hello" });

  await vi.advanceTimersByTimeAsync(PICK_WAIT_MS - 100);
  await flush();
  expect(adapter.opens).toHaveLength(0);
  expect(cache.session(chat.id)?.account).toBeNull();

  await vi.advanceTimersByTimeAsync(100);
  await sessions.settled((await sending).turn);
  // On what is known: the usage as the accounts held it.
  expect(adapter.opens).toHaveLength(1);
  expect(adapter.opens[0]?.account).toBe(folder("b"));
  expect(cache.session(chat.id)?.account).toBe(folder("b"));
});

test("a pick on an ask that hangs ranks an account never read last, and two sessions share the ask", async () => {
  const { adapter, repo, sessions } = await testSessions();
  adapter.accounts = new FakeAccounts();
  adapter.accounts.accounts = [
    account("default", 0, { askedAt: null, known: false, windows: [] }),
    account("b", 0.9),
  ];
  adapter.accounts.hangs = true;
  adapter.script([]);
  adapter.script([]);
  const first = await sessions.newChat(repo);
  const second = await sessions.newChat(repo);
  const sendingFirst = sessions.send(repo, first.id, { text: "hello" });
  const sendingSecond = sessions.send(repo, second.id, { text: "hello" });
  await flush();
  expect(adapter.opens).toHaveLength(0);

  await vi.advanceTimersByTimeAsync(PICK_WAIT_MS);
  await sessions.settled((await sendingFirst).turn);
  await sessions.settled((await sendingSecond).turn);
  // Nothing was marked read while the ask hung: `b` is the only account whose usage is known.
  expect(adapter.opens.map((open) => open.account)).toEqual([folder("b"), folder("b")]);
  expect(adapter.accounts.asks).toBe(1);
  expect(adapter.accounts.list().map((one) => one.askedAt)).toEqual([null, 1]);
  expect(adapter.accounts.list().map((one) => one.known)).toEqual([false, true]);
});

test("an ask that answers marks the accounts read, and is not repeated within the age", async () => {
  vi.spyOn(Date, "now").mockReturnValue(5000);
  const accounts = new FakeAccounts();
  accounts.accounts = [account("default", 0, { askedAt: null, known: false, windows: [] })];
  const original = accounts.accounts[0];
  await accounts.refresh(60_000);
  await accounts.refresh(60_000);
  expect(accounts.asks).toBe(1);
  expect(accounts.list()[0]?.askedAt).toBe(5000);
  expect(accounts.list()[0]?.known).toBe(true);
  expect(original?.askedAt).toBeNull(); // the test's own account is not changed in place
});

/** The announces of the agent's record: the usage, the accounts, the runtimes. */
const announces = (changes: Array<object>) => changes.filter((change) => "agent" in change).length;

test("a pick's own ask announces what it changed, as a page's does", async () => {
  const { adapter, changes, repo, sessions } = await testSessions();
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  adapter.accounts = fakeAccounts();
  const accounts = adapter.accounts;
  sessions.refreshAccounts(); // a page read it two minutes ago: nothing asked since
  await flush();
  await vi.advanceTimersByTimeAsync(120_000);
  // The pick asks again: b is now at 90%, and the answer is announced with no page asking.
  vi.spyOn(accounts, "refresh").mockImplementationOnce(async () => {
    accounts.accounts = [account("default", 0.42), account("b", 0.9), account("c", 0.88)];
  });
  const problems = vi.fn();
  sessions.runtimes.onAccounts(problems);
  const chat = await sessions.newChat(repo);
  adapter.script([]);
  const before = announces(changes);
  await sessions.settled((await sessions.send(repo, chat.id, { text: "hello" })).turn);
  expect(adapter.opens.at(-1)?.account).toBe(folder("default"));
  expect(announces(changes)).toBeGreaterThan(before);
  expect(problems).toHaveBeenCalledTimes(1);
});

test("an announce of an account's usage asks no runtime's version", async () => {
  const { adapter, changes, sessions } = await testSessions();
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  adapter.accounts = fakeAccounts();
  const version = vi.spyOn(adapter, "version");
  const accounts = adapter.accounts;
  vi.spyOn(accounts, "refresh").mockImplementationOnce(async () => {
    accounts.accounts = [account("default", 0.9), account("b", 0), account("c", 0.88)];
  });
  const before = announces(changes);
  sessions.refreshAccounts();
  await flush();
  expect(announces(changes)).toBe(before + 1);
  expect(version).not.toHaveBeenCalled();
});

test("a refresh that never settles stops blocking its runtime after 10 seconds, and is asked again", async () => {
  const { adapter, changes, sessions } = await testSessions();
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  adapter.accounts = fakeAccounts();
  adapter.accounts.hangs = true;
  sessions.refreshAccounts();
  await flush();
  expect(adapter.accounts.asks).toBe(1);
  // Still asked: a page's read does not ask a second time.
  sessions.refreshAccounts();
  expect(adapter.accounts.asks).toBe(1);

  await vi.advanceTimersByTimeAsync(PICK_WAIT_MS + 1);
  // The extension recovers, and the usage changed: the next read asks, and announces it.
  const accounts = adapter.accounts;
  accounts.hangs = false;
  vi.spyOn(accounts, "refresh").mockImplementationOnce(async () => {
    accounts.accounts = [account("default", 0.9), account("b", 0), account("c", 0.88)];
  });
  const before = announces(changes);
  sessions.refreshAccounts();
  await flush();
  expect(announces(changes)).toBeGreaterThan(before);
  expect(accounts.list()[0]?.windows[0]?.used).toBe(0.9);
});
