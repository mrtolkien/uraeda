// What a proposal's pane guarantees that a look would not show: starting work is deliberate (rule
// 2 of "What makes a screen good"), and text typed is never lost by leaving.
import { type App, expect, open, test } from "nsh/test";

const page = () =>
  open("./__checks__/Proposal.tsx", {
    height: 900,
    host: { handlers: { go: null, starts: null } },
    network: "live",
    width: 1400,
  });

const starts = (app: App) =>
  (app.host.posts().findLast((post) => post.name === "starts")?.data ?? []) as Array<{
    action: string;
    slug?: string;
  }>;

const words = (app: App) => app.texts().join(" ");

/** The pane, with the proposal's file read: its text and its start. */
async function opened(app: App) {
  await app.waitUntil(() => app.shows("id:proposal-slug") && app.shows("id:proposal-text"), {
    timeout: 30_000,
  });
}

test("Enter in a proposal's slug starts nothing", async () => {
  const app = await page();
  await opened(app);
  // Enter on the page, then in the short name once typed in: neither starts.
  await app.keyboard.press("enter");
  await app.type("id:proposal-slug", "listener");
  await app.keyboard.press("enter");
  await app.wait(800);
  expect(starts(app)).toEqual([]);
  // The button starts it. (The headless runner gives the field's own keys, Enter and Ctrl+Enter,
  // to no editor: what it guards is that no key of the page starts on Enter.)
  await app.press("id:proposal-start");
  await app.waitUntil(() => starts(app).length > 0, { timeout: 10_000 });
  expect(starts(app)).toMatchObject([
    { action: "feature.start", proposal: "specs/proposals/git-listener.md" },
  ]);
  await app.waitUntil(() => words(app).includes("Not started: this is a check."), {
    timeout: 10_000,
  });
}, 90_000);

test("leaving an edited proposal asks first, and keeps the text", async () => {
  const app = await page();
  await opened(app);
  await app.type("id:proposal-text", "Typed and not saved.");
  await app.waitUntil(() => words(app).includes("Unsaved changes"), { timeout: 5_000 });
  await app.host.send("go", "/r/sample/inbox");
  await app.waitUntil(() => words(app).includes("Leave page?"), { timeout: 5_000 });
  await app.press("text:/^Stay$/");
  await app.waitUntil(() => !words(app).includes("Leave page?"), { timeout: 5_000 });
  expect(words(app)).toContain("Unsaved changes");
  // Left after all, the text is kept on the device, and comes back with the proposal.
  await app.host.send("go", "/r/sample/inbox");
  await app.waitUntil(() => words(app).includes("Leave page?"), { timeout: 5_000 });
  await app.press("text:/^Leave page$/");
  await app.waitUntil(() => !app.shows("id:proposal-text"), { timeout: 10_000 });
  await app.host.send("go", "/r/sample/priorities/git-listener");
  await opened(app);
  await app.waitUntil(() => words(app).includes("Typed and not saved."), { timeout: 5_000 });
  expect(words(app)).toContain("Unsaved changes");
}, 90_000);
