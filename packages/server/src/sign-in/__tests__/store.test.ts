import { chmodSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, onTestFinished, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { SIGN_IN_FILE, SignInStore } from "../store.ts";
import { hash } from "../tokens.ts";

/** A data folder, and a clock the test moves, starting on 2026-10-01T10:00Z. */
function folder() {
  const dataDir = temporaryFolder("uraeda-data");
  const clock = { now: Date.parse("2026-10-01T10:00:00Z") };
  return { clock, dataDir, now: () => clock.now, path: join(dataDir, SIGN_IN_FILE) };
}

/** The sign-in file, as written. */
const read = (path: string) =>
  JSON.parse(readFileSync(path, "utf8")) as {
    key: string;
    sessions: Array<{ created: string; id: string; secret: string; used: string }>;
    version: number;
  };

/** A session's ID, from its cookie. */
const idOf = (cookie: string) => cookie.split(".")[0];

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** US1.1 */
test("makes the key at the first start, and stores only its hash", () => {
  const { dataDir, path } = folder();

  const { key } = SignInStore.open(dataDir);

  expect(key).toMatch(/^ura_[A-Za-z0-9_-]{43}$/);
  const written = readFileSync(path, "utf8");
  expect(written).not.toContain(key!.slice(4));
  expect(read(path)).toEqual({ key: hash(key!), sessions: [], version: 1 });
  expect(statSync(path).mode & 0o777).toBe(0o600);
  expect(SignInStore.open(dataDir).key).toBeUndefined();
});

/** Review focus 2: a password manager or a paste may add spaces or a newline. */
test("accepts the key, trimmed, and refuses another", () => {
  const { dataDir } = folder();
  const { key, store } = SignInStore.open(dataDir);

  expect(store.checkKey(` ${key}\n`)).toBe(true);
  expect(store.checkKey("ura_wrong")).toBe(false);
  expect(SignInStore.open(dataDir).store.checkKey(key!)).toBe(true);
});

/** US1.5, SC-004 */
test("keeps a session across a reopen", () => {
  const { dataDir, now } = folder();
  const cookie = SignInStore.open(dataDir, now).store.createSession();

  for (let start = 0; start < 3; start++) {
    expect(SignInStore.open(dataDir, now).store.findSession(cookie)).toEqual({
      id: idOf(cookie),
      refreshed: false,
    });
  }
});

/** US1.6 */
test("ends a session 30 days after its last use", () => {
  const { clock, dataDir, now, path } = folder();
  const { store } = SignInStore.open(dataDir, now);
  const [used, boundary, unused] = [1, 2, 3].map(() => store.createSession());

  clock.now = Date.parse("2026-10-30T10:00:00Z");
  expect(store.findSession(used)).toEqual({ id: idOf(used), refreshed: true });
  expect(read(path).sessions.find(({ id }) => id === idOf(used))?.used).toBe(
    "2026-10-30T10:00:00.000Z",
  );

  // Exactly 30 days after its last use: not over yet.
  clock.now = Date.parse("2026-10-31T10:00:00Z");
  expect(store.findSession(boundary)).toEqual({ id: idOf(boundary), refreshed: true });

  clock.now = Date.parse("2026-10-31T10:01:00Z");
  expect(store.findSession(unused)).toBeUndefined();
  expect(read(path).sessions.map(({ id }) => id)).toEqual([idOf(used), idOf(boundary)]);
  expect(store.findSession(used)).toEqual({ id: idOf(used), refreshed: true });
});

test("records a use at most once a day", () => {
  const { clock, dataDir, now, path } = folder();
  const { store } = SignInStore.open(dataDir, now);
  const cookie = store.createSession();
  // Every write replaces the file: a new inode is a new write.
  const written = () => statSync(path).ino;
  const created = written();

  clock.now += HOUR;
  expect(store.findSession(cookie)?.refreshed).toBe(false);
  expect(written()).toBe(created);

  clock.now += DAY;
  expect(store.findSession(cookie)?.refreshed).toBe(true);
  const refreshed = written();
  expect(refreshed).not.toBe(created);

  clock.now += HOUR;
  expect(store.findSession(cookie)?.refreshed).toBe(false);
  expect(written()).toBe(refreshed);
});

test("the sweep ends every session unused for 30 days", () => {
  const { clock, dataDir, now, path } = folder();
  const { store } = SignInStore.open(dataDir, now);
  const old = idOf(store.createSession());
  clock.now += DAY;
  const recent = idOf(store.createSession());
  const ended: Array<string> = [];
  store.onEnded((id) => ended.push(id));

  clock.now += 30 * DAY - HOUR;
  store.sweep();

  expect(ended).toEqual([old]);
  expect(store.signal(old).aborted).toBe(true);
  expect(read(path).sessions.map(({ id }) => id)).toEqual([recent]);
});

/** US3.1, US3.3, US3.4 */
test("ends one session, every session, and every session on a new key", () => {
  const { dataDir, path } = folder();
  const { key, store } = SignInStore.open(dataDir);
  const ended: Array<string> = [];
  store.onEnded((id) => ended.push(id));
  const open = () => {
    const ids = [store.createSession(), store.createSession()].map(idOf);
    return { ids, signals: ids.map((id) => store.signal(id)) };
  };

  const one = open();
  store.endSession(one.ids[0]);
  store.endSession(one.ids[0]);
  expect(ended).toEqual([one.ids[0]]);
  expect(one.signals.map((signal) => signal.aborted)).toEqual([true, false]);
  expect(read(path).sessions.map(({ id }) => id)).toEqual([one.ids[1]]);

  ended.length = 0;
  const all = open();
  store.endAll();
  expect(ended.toSorted()).toEqual([one.ids[1], ...all.ids].toSorted());
  expect([...one.signals, ...all.signals].every((signal) => signal.aborted)).toBe(true);
  expect(read(path).sessions).toEqual([]);

  ended.length = 0;
  const keyed = open();
  const newKey = store.replaceKey();
  expect(ended.toSorted()).toEqual(keyed.ids.toSorted());
  expect(keyed.signals.every((signal) => signal.aborted)).toBe(true);
  expect(read(path)).toEqual({ key: hash(newKey), sessions: [], version: 1 });
  expect(store.checkKey(key!)).toBe(false);
  expect(store.checkKey(newKey)).toBe(true);
});

/** Edge case: `sign-in.json` unreadable or invalid; review focus 7. */
test.each([
  ["not JSON", "{ version: 1"],
  ["written by a newer Uraeda", JSON.stringify({ key: "k", sessions: [], version: 2 })],
  ["without its key", JSON.stringify({ sessions: [], version: 1 })],
])("refuses a file it cannot read: %s", (_name, content) => {
  const { dataDir, path } = folder();
  writeFileSync(path, content, { mode: 0o600 });

  expect(() => SignInStore.open(dataDir)).toThrow(
    new RegExp(
      `^cannot read ${path}: .+\\. Fix it, or delete it to make a new access key and sign every device out\\.$`,
    ),
  );
  expect(readFileSync(path, "utf8")).toBe(content);
});

/** Edge case: the data folder not writable at the first start. */
test("refuses a data folder it cannot write", () => {
  const { dataDir, path } = folder();
  chmodSync(dataDir, 0o500);
  onTestFinished(() => chmodSync(dataDir, 0o700));

  expect(() => SignInStore.open(dataDir)).toThrow(new RegExp(`^cannot write ${path}: .+`));
});

/** SC-003 */
test("never writes a session token", () => {
  const { dataDir, now, path } = folder();
  const { store } = SignInStore.open(dataDir, now);

  const [id, secret] = store.createSession().split(".");

  expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
  expect(readFileSync(path, "utf8")).not.toContain(secret);
  expect(read(path).sessions).toEqual([
    {
      created: "2026-10-01T10:00:00.000Z",
      id,
      secret: hash(secret),
      used: "2026-10-01T10:00:00.000Z",
    },
  ]);
  expect(store.findSession(`${id}.${secret.slice(1)}x`)).toBeUndefined();
  expect(store.findSession(undefined)).toBeUndefined();
});
