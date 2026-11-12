// A session's conversation against the sandbox (`just app-test` starts one), whose fake agent
// streams a long reply over a minute to a message holding "slowly": no test waits for its end.
// Each test talks in a chat of its own, as a reply still streams from the one before.
import { type App, expect, open, test } from "nsh/test";

/** The app, at a chat of the sandbox's `sample`, opened from the sessions' list. */
async function chat(title: string): Promise<App> {
  const app = await open("../../App.tsx", { height: 800, network: "live", width: 1400 });
  await app.waitFor("text:Sessions", { timeout: 30_000 });
  await app.press("text:Sessions >> nth=0");
  await app.waitFor(`text:${title}`, { timeout: 20_000 });
  // The last of its titles: the sidebar may list it too.
  await app.press(`text:${title} >> nth=${app.count(`text:${title}`) - 1}`);
  await app.waitFor("id:composer", { timeout: 20_000 });
  await app.waitFor("id:session-title", { timeout: 20_000 });
  return app;
}

/** The composer's field, by the name it gives the sandbox's agent. */
const FIELD = "label:Message Fake agent";

/**
 * Types `text` in the composer, once the field holds it: Enter right after the last key may come
 * before the field's change does, and send what it held before.
 */
async function typed(app: App, text: string) {
  const before = app.value(FIELD) ?? "";
  await app.type("id:composer", text);
  await app.waitUntil(() => app.value(FIELD) === `${before}${text}`);
}

/** Sends `text` as the human does: typed in the composer, then Enter. */
async function send(app: App, text: string) {
  await typed(app, text);
  await app.keyboard.press("enter");
}

/** Whether a text on screen holds `words`. */
const shows = (app: App, words: string) => app.texts().some((text) => text.includes(words));

/**
 * Whether the conversation is at its end: the list cannot scroll further down. Scrolling by a
 * point is how the driver tells, and moves the reader by that point when it is not.
 */
const atEnd = (app: App) =>
  app.scroll("id:transcript", 1).then(
    () => false,
    (error: unknown) => /cannot scroll by 1: it is at (\d+) of \1\b/.test(String(error)),
  );

/** Waits until the slow reply has grown past `words`. */
const grown = (app: App, words: string) =>
  app.waitUntil(() => shows(app, words), { timeout: 40_000 });

test("a streaming reply stays in view", async () => {
  const app = await chat("What does the README say?");
  await send(app, "Tell me slowly");
  await grown(app, "Part 1");
  // The reply grows past the window's height, and the conversation follows it: the list is at its
  // end, and the way back to the latest never shows, as nothing was left behind.
  await ["Part 2", "Part 3", "Part 4"].reduce<Promise<void>>(
    (done, part) =>
      done.then(async () => {
        await grown(app, part);
        expect([part, await atEnd(app), app.shows("id:jump-to-latest")]).toEqual([
          part,
          true,
          false,
        ]);
      }),
    Promise.resolve(),
  );
}, 90_000);

test("a reader who scrolled up is not moved", async () => {
  const app = await chat("Show me the round's prototypes");
  await send(app, "Show it slowly");
  await grown(app, "Part 3");
  await app.scroll("id:transcript", -500);
  await app.waitFor("id:jump-to-latest");
  // Where the reader is: the human's message, above the reply.
  await app.waitUntil(() => shows(app, "Show it slowly"));
  await grown(app, "Part 5").catch(() => undefined);
  await app.wait(3_000);
  // The reply went on growing, and the reader stayed where they were.
  expect(shows(app, "Show it slowly")).toBe(true);
  expect(app.shows("id:jump-to-latest")).toBe(true);
  // The way back follows the end again.
  await app.press("id:jump-to-latest");
  await app.waitFor("id:jump-to-latest", { state: "gone", timeout: 10_000 });
}, 120_000);

test("a message typed during a reply is sent once", async () => {
  const app = await chat("Compare our personas with the book's");
  await send(app, "Compare them slowly");
  await grown(app, "Part 1");
  // During the reply: typed, then Enter twice, as a hurried hand does.
  await typed(app, "And the second persona?");
  await app.keyboard.press("enter");
  await app.keyboard.press("enter");
  await app.waitUntil(() => shows(app, "And the second persona?"), { timeout: 20_000 });
  await app.wait(2_000);
  // Once in the conversation, and not back in the composer with a refusal.
  expect(app.count("text:And the second persona?")).toBe(1);
}, 90_000);

/** The draft the device keeps for the new session of the feature in `folder`: what its field holds. */
const draftOf = (app: App, folder: string) => {
  const kept = app.storage()[`unsaved:sample:session:${folder}#new`];
  return kept === undefined ? "" : (JSON.parse(kept) as { text: string }).text;
};

test("a message refused comes back beside the one begun meanwhile", async () => {
  // A feature that is not there: the server refuses its first message.
  const folder = "2026-01-01-never-started";
  const app = await open("../shell/__checks__/Places.tsx", {
    height: 800,
    host: { handlers: { places: null, problem: null, shown: null } },
    network: "live",
    width: 1400,
  });
  await app.waitFor("id:frame", { timeout: 30_000 });
  await app.host.send("go", `/r/sample/f/${folder}/session?new`);
  await app.waitFor("id:composer", { timeout: 20_000 });
  // A slow line: the server's answer waits until the second message is begun.
  await app.host.send("hold", null);
  await app.type("id:composer", "The first message");
  await app.waitUntil(() => draftOf(app, folder) === "The first message");
  await app.keyboard.press("enter");
  // The field is free at once: the first is on its way, and the second is begun.
  await app.waitUntil(() => draftOf(app, folder) === "");
  await app.type("id:composer", "X");
  await app.waitUntil(() => draftOf(app, folder) !== "");
  const begun = draftOf(app, folder);
  await app.host.send("release", null);
  // Neither is lost: once refused, the first is back, before the one begun since.
  await app
    .waitUntil(() => draftOf(app, folder).startsWith("The first message\n\n"), { timeout: 15_000 })
    .catch(() => undefined);
  expect([begun, draftOf(app, folder)]).toEqual(["X", "The first message\n\nX"]);
}, 60_000);
