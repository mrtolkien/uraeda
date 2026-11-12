// The frame's own parts against the real server, on the sandbox `just app-test` starts: the undo
// stack, and the write queue's refused writes. Each test makes its own data: a note of its own,
// a commit of its own in `broken`, whose pre-commit hook refuses every commit.
import { type App, expect, open, test } from "nsh/test";

const shows = (app: App) => app.texts().join(" ");

/** The app, its frame drawn, through the shell's check page, which opens an address on `go`. */
async function frame() {
  const app = await open("./__checks__/Places.tsx", {
    height: 800,
    host: { handlers: { places: null, problem: null, shown: null } },
    network: "live",
    width: 1400,
  });
  await app.waitUntil(() => app.shows("id:frame"), { timeout: 30_000 });
  return app;
}

/** Adds a note of its own to `repo`'s inbox, and waits until the list shows it. */
async function addNote(app: App, repo: string, words: string) {
  await app.host.send("go", `/r/${repo}/inbox`);
  await app.waitFor("id:inbox-new-note", { timeout: 20_000 });
  await app.type("id:inbox-new-note", words);
  await app.keyboard.press("Enter");
  // The field empties once the server wrote it, and says so.
  await app.waitFor(`text:Added “${words}”.`, { timeout: 15_000 });
}

test("undo puts back what the action changed", async () => {
  const app = await frame();
  // Its text is its own slug, so its address is known: `/inbox/<slug>`.
  const note = `undo-me-${Date.now()}`;
  await addNote(app, "sample", note);

  // Deleted from its own pane: it never asks, and the toast says what was done.
  await app.host.send("go", `/r/sample/inbox/${note}`);
  await app.waitFor("label:Delete", { timeout: 15_000 });
  await app.press("label:Delete");
  await app.waitFor("id:undo-toast", { timeout: 15_000 });
  await app.host.send("go", "/r/sample/inbox");
  await app.waitFor("text:We need a home icon", { timeout: 15_000 });
  await app.waitUntil(() => !app.texts().includes(note), { timeout: 15_000 });

  // `u`, outside a text field, on another page, undoes it: the note is in the inbox again.
  await app.keyboard.press("Escape");
  await app.keyboard.press("u");
  await app.waitUntil(() => shows(app).includes("Undone"), { timeout: 15_000 });
  await app.host.send("go", "/r/sample/inbox");
  await app.waitUntil(() => app.texts().includes(note), { timeout: 15_000 });
}, 90_000);

test("a refused commit stays shown until it is retried or dismissed", async () => {
  const app = await frame();
  const note = `Refused ${Date.now()}`;
  await addNote(app, "broken", note);

  // Committed from the Git page: the hook refuses it.
  await app.host.send("go", "/r/broken/git");
  await app.waitFor("label:Stage specs/INBOX.md", { timeout: 20_000 });
  await app.press("label:Stage specs/INBOX.md");
  await app.waitFor("label:Unstage specs/INBOX.md", { timeout: 15_000 });
  await app.type("id:git-message", "docs: a note the hook refuses");
  await app.press("text:Commit 1 file to main");

  // The Git page says it under its commit; on any other page, a card says what was refused,
  // with the hook's own output. The commit's message is kept, and the page asks before it is left.
  await app.waitUntil(() => shows(app).includes("refuses every commit"), { timeout: 20_000 });
  await app.host.send("go", "/r/sample/inbox");
  await app.press("text:Leave page");
  await app.waitFor("text:We need a home icon", { timeout: 20_000 });
  await app.waitFor("id:write-refused", { timeout: 15_000 });
  expect(shows(app)).toContain("refuses every commit");
  // It stays, page after page, until it is handled.
  await app.host.send("go", "/r/sample/priorities");
  await app.waitFor("text:Git listener process", { timeout: 20_000 });
  expect(app.shows("id:write-refused")).toBe(true);

  // Dismissed, it goes, from the queue as from the frame.
  await app.press("id:write-refused >> label:Dismiss");
  await app.waitUntil(() => !app.shows("id:write-refused"), { timeout: 15_000 });
}, 90_000);

test("b goes back to the page before", async () => {
  const app = await frame();
  await app.host.send("go", "/r/sample/");
  await app.waitFor("text:Due dates", { timeout: 20_000 });
  // A place opened by its go key, then Back by `b`: Home again, the inbox's list gone.
  await app.keyboard.press("g");
  await app.keyboard.press("i");
  await app.waitFor("text:New category", { timeout: 15_000 });
  await app.keyboard.press("b");
  await app.waitUntil(() => !app.shows("text:New category"), { timeout: 15_000 });
  expect(app.shows("text:Due dates")).toBe(true);
}, 90_000);

test("Back from the settings returns to the page before them, not to their last category", async () => {
  const app = await frame();
  await app.host.send("go", "/r/sample/inbox");
  await app.waitFor("text:New category", { timeout: 20_000 });
  await app.keyboard.press("g");
  await app.keyboard.press(",");
  await app.waitFor("text:Appearance", { timeout: 15_000 });
  // Two categories, one after the other, from the index.
  await app.press("text:Fonts");
  await app.waitFor("text:Interface", { timeout: 15_000 });
  await app.press("text:Keyboard");
  await app.waitFor("text:Single-key shortcuts", { timeout: 15_000 });
  await app.keyboard.press("b");
  await app.waitFor("text:New category", { timeout: 15_000 });
  expect(app.shows("text:Interface")).toBe(false);
}, 90_000);
