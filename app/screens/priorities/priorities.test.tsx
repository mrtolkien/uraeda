// The priorities against the real server: `just app-test` starts a sandbox, and the checks' app
// draws the shell at `/r/sample/priorities` over it, the moves it sends seen by the test.
import { type App, expect, open, test } from "nsh/test";

type Move = { proposal: string; section: string; index: number; hash: string };

const page = (stale: boolean) =>
  open("./__checks__/Priorities.tsx", {
    height: 800,
    host: { handlers: { moves: null }, params: { stale } },
    network: "live",
    width: 1400,
  });

const moves = (app: App) =>
  (app.host.posts().findLast((post) => post.name === "moves")?.data ?? []) as Move[];

/** Whether `first` shows before `then` on the page. */
const before = (app: App, first: string, then: string) => {
  const texts = app.texts();
  const a = texts.findIndex((text) => text.includes(first));
  const b = texts.findIndex((text) => text.includes(then));
  return a !== -1 && b !== -1 && a < b;
};

/** Presses `keys` one after the other, each heard before the next. */
const press = (app: App, keys: ReadonlyArray<string>) =>
  keys.reduce<Promise<void>>(
    (done, key) => done.then(() => app.keyboard.press(key)),
    Promise.resolve(),
  );

test("a reorder is saved once, in the order shown", async () => {
  const app = await page(false);
  await app.waitUntil(() => before(app, "Nix + Docker", "Benchmarks"), { timeout: 30_000 });
  // Into Later, two columns right of Now; its first row lifted, carried two steps, dropped one
  // place down: the steps past its end go nowhere.
  await press(app, ["l", "l", "m", "j", "j", "j", "enter"]);
  await app.waitUntil(() => moves(app).length > 0, { timeout: 10_000 });
  // The order shows at once, and the server's own order comes back the same.
  expect(before(app, "Benchmarks", "Nix + Docker")).toBe(true);
  await app.waitUntil(() => app.texts().join(" ").includes("moved to 2 of 2"), { timeout: 10_000 });
  await app.wait(1500);
  expect(moves(app)).toMatchObject([{ index: 1, proposal: "later-1", section: "later" }]);
  expect(before(app, "Benchmarks", "Nix + Docker")).toBe(true);

  // Sent to the section before with `H`: once, at Next's end, as it shows.
  await press(app, ["shift+h"]);
  await app.waitUntil(() => moves(app).length > 1, { timeout: 10_000 });
  await app.wait(1500);
  expect(moves(app).slice(1)).toMatchObject([{ index: 2, proposal: "later-2", section: "next" }]);
  expect(before(app, "Git listener process", "Nix + Docker")).toBe(true);
  expect(before(app, "Nix + Docker", "Benchmarks")).toBe(true);
});

test("a refused reorder puts the rows back and says why under them", async () => {
  const app = await page(true);
  await app.waitUntil(() => before(app, "Claude Code runner", "Git listener process"), {
    timeout: 30_000,
  });
  await press(app, ["l", "m", "j", "enter"]);
  await app.waitUntil(() => app.texts().join(" ").includes("changed elsewhere"), {
    timeout: 10_000,
  });
  expect(moves(app)).toHaveLength(1);
  expect(before(app, "Claude Code runner", "Git listener process")).toBe(true);
});
