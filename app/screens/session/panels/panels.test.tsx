// A session's side panels against the sandbox (`just app-test` starts one), whose feature with an
// open pull request, "Keyboard shortcuts", has a build session that started two implementers and a
// reviewer.
import { type App, expect, open, test } from "nsh/test";

/** The app at the build session of the sandbox's feature, opened from its page's sessions. */
async function buildSession(): Promise<App> {
  const app = await open("../../../App.tsx", { height: 800, network: "live", width: 1400 });
  await app.waitFor("text:Keyboard shortcuts", { timeout: 30_000 });
  await app.press("text:Keyboard shortcuts >> nth=0");
  await app.waitFor("text:Last run: Build, done in 46 min", { timeout: 20_000 });
  await app.press("text:Last run: Build, done in 46 min");
  await app.waitFor("id:session-title", { timeout: 20_000 });
  return app;
}

test("the sub-agents read in the order they started", async () => {
  const app = await buildSession();
  // By the keys alone: into the side stack, to its list's first row, up to its tabs, along to the
  // Sub-agents, and down into them.
  const keys = ["l", "g", "g", "k", "l", "l", "l", "j"];
  await keys.reduce<Promise<void>>(
    (done, key) => done.then(() => app.keyboard.press(key)),
    Promise.resolve(),
  );
  await app.waitFor("id:subagents", { timeout: 20_000 });
  await app.waitUntil(() => app.count("id:subagent-card") === 3, { timeout: 20_000 });
  const titles = app
    .texts()
    .filter((text) => ["Task 6", "Review of wave 2", "Task 7"].includes(text));
  // The reviewer's title names what it reviews, never the commits it read.
  expect(titles).toEqual(["Task 6", "Review of wave 2", "Task 7"]);
  expect(app.texts().some((text) => text.includes("3c1f0a2"))).toBe(false);
}, 90_000);
