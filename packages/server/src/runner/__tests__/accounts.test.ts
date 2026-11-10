import { afterEach, expect, test, vi } from "vite-plus/test";
import { fixtureRepo } from "uraeda-binding/test-utils";
import type { Account } from "../adapter.ts";
import { PICK_WAIT_MS } from "../account-pick.ts";
import { CONTINUES_OFF, type ContinueSettings } from "../continuer.ts";
import type { Limit } from "../events.ts";
import { FakeAccounts } from "../fake.ts";
import type { Sessions } from "../sessions.ts";
import { flush, limitTurn, restart, testSessions } from "./helpers.ts";

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";
const HOUR = 3_600_000;
const NOON = Date.UTC(2026, 10, 10, 12);
const at = (hours: number) => new Date(NOON + hours * HOUR).toISOString();
const folder = (name: string) => `/home/u/.claude-${name}`;

const account = (
  name: string,
  five: number,
  more: Partial<Account> & { week?: number } = {},
): Account => ({
  askedAt: 1,
  id: folder(name),
  name,
  state: "ready",
  windows: [
    { id: "five_hour", label: "5h", resetsAt: at(2), used: five },
    { id: "seven_day", label: "Week", resetsAt: at(72), used: more.week ?? 0.3 },
  ],
  ...more,
});

/** Three accounts: `default` at 0.42 of its five hours, `b` at 0, `c` at 0.88. */
function fakeAccounts() {
  const accounts = new FakeAccounts();
  accounts.accounts = [account("default", 0.42), account("b", 0), account("c", 0.88)];
  return accounts;
}

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
