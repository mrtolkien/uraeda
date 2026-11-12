// What a slip of one key must never do: spend agents' time, start a run, or push to a remote. On
// the sandbox `just app-test` starts, each such key opens its action's own confirmation, which
// says what it will do, and does nothing; Escape leaves everything as it was; the same key again,
// or Enter, does it. The actions are refused by the check's page, never sent (`Places.tsx`).
import { type App, expect, open, test } from "nsh/test";

const called = (app: App) =>
  app.host
    .posts()
    .filter((post) => post.name === "called")
    .map((post) => String(post.data));

const shows = (app: App, words: string) => app.texts().join(" ").includes(words);

/** A key that spends or pushes: where it works, what it calls, and what its question says. */
const KEYS: ReadonlyArray<{
  action: string;
  address: string;
  again: "enter" | "key";
  key: string;
  says: string;
  words: string;
}> = [
  {
    action: "jobs.runNow",
    address: "/r/sample/jobs",
    again: "key",
    key: "r",
    says: "now?",
    words: "Weekly report",
  },
  {
    action: "jobs.runNow",
    address: "/r/sample/jobs/Dependencies",
    again: "enter",
    key: "r",
    says: "Run “Dependencies” now?",
    words: "Upgrade the dependencies",
  },
  {
    action: "git.push",
    address: "/r/sample/git",
    again: "key",
    key: "shift+p",
    says: "to origin",
    words: "README.md",
  },
];

test("a key that spends an agent's time or pushes asks first", async () => {
  const app = await open("./__checks__/Places.tsx", {
    height: 800,
    host: { handlers: { called: null, places: null, problem: null, shown: null } },
    network: "live",
    width: 1400,
  });
  await app.waitFor("id:frame", { timeout: 30_000 });
  await KEYS.reduce<Promise<void>>(
    (done, one) =>
      done.then(async () => {
        const before = called(app).length;
        await app.host.send("go", one.address);
        await app.waitUntil(() => shows(app, one.words), { timeout: 20_000 });
        // The key alone asks, in the action's own words, and does nothing.
        await app.keyboard.press(one.key);
        await app
          .waitUntil(() => app.shows("id:confirm") || called(app).length > before, {
            timeout: 10_000,
          })
          .catch(() => undefined);
        expect([one.address, app.shows("id:confirm"), called(app).slice(before)]).toEqual([
          one.address,
          true,
          [],
        ]);
        expect([one.address, shows(app, one.says)]).toEqual([one.address, true]);
        // Escape leaves everything as it was.
        await app.keyboard.press("escape");
        await app.waitFor("id:confirm", { state: "gone", timeout: 10_000 });
        expect(called(app).slice(before)).toEqual([]);
        // The same key again, or Enter, does it.
        await app.keyboard.press(one.key);
        await app.waitFor("id:confirm", { timeout: 10_000 });
        await app.keyboard.press(one.again === "key" ? one.key : "enter");
        await app.waitUntil(() => called(app).length > before, { timeout: 10_000 });
        expect(called(app).slice(before)).toEqual([one.action]);
        await app.waitFor("id:confirm", { state: "gone", timeout: 10_000 });
      }),
    Promise.resolve(),
  );
}, 120_000);
