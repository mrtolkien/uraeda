// What a proposal's pane guarantees that a look would not show: starting work is deliberate (rule
// 2 of "What makes a screen good"), text typed is never lost by leaving, and a file changed on disk
// while it is edited, by an agent or a pull, is never overwritten silently by the save that follows.
import { type App, expect, open, test } from "nsh/test";

const page = () =>
  open("./__checks__/Proposal.tsx", {
    height: 900,
    host: { handlers: { disk: null, go: null, starts: null, written: null } },
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
  await app.waitUntil(() => app.shows("id:proposal-start") && app.shows("id:proposal-text"), {
    timeout: 30_000,
  });
}

test("a proposal starts only from its start dialog", async () => {
  const app = await page();
  await opened(app);
  // Enter on the page starts nothing; Start asks the short name and the run map first.
  await app.keyboard.press("enter");
  await app.press("id:proposal-start");
  await app.waitUntil(() => app.shows("id:start-slug") && app.shows("id:start-map"), {
    timeout: 10_000,
  });
  await app.wait(800);
  expect(starts(app)).toEqual([]);
  // The dialog's Start starts it, with the file's own short name. (The headless runner gives the
  // field's own keys, Enter and Ctrl+Enter, to no editor: what it guards is that no key of the
  // page starts on Enter.)
  await app.press("id:start-confirm");
  await app.waitUntil(() => starts(app).length > 0, { timeout: 10_000 });
  expect(starts(app)).toMatchObject([
    { action: "feature.start", proposal: "specs/proposals/git-listener.md", slug: "git-listener" },
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

const disk = (app: App) =>
  String(app.host.posts().findLast((post) => post.name === "disk")?.data ?? "");

/** Changes the file on disk through another action, as an agent's write. */
async function writeOnDisk(app: App, text: string) {
  const before = app.host.posts().filter((post) => post.name === "written").length;
  await app.host.send("write", text);
  await app.waitUntil(
    () => app.host.posts().filter((post) => post.name === "written").length > before,
    { timeout: 15_000 },
  );
  await app.waitUntil(() => disk(app) === text, { timeout: 15_000 });
}

test("a proposal changed on disk while it is edited is not overwritten silently", async () => {
  const app = await page();
  await opened(app);
  await app.waitUntil(() => disk(app) !== "", { timeout: 15_000 });
  const first = disk(app);
  try {
    // Typed, then the file changes underneath, as an agent's write.
    await app.type("id:proposal-text", "Mine. ");
    await app.waitUntil(() => words(app).includes("Unsaved changes"), { timeout: 5_000 });
    await writeOnDisk(app, `${first}\nAn agent wrote this.\n`);
    // Saving refuses, in place, with the text kept, and the disk keeps the agent's line.
    await app.press("text:/^Save$/");
    await app.waitUntil(() => words(app).includes("Not saved") || disk(app).includes("Mine."), {
      timeout: 15_000,
    });
    expect([disk(app).includes("An agent wrote this."), disk(app).includes("Mine.")]).toEqual([
      true,
      false,
    ]);
    expect(app.shows("id:buffer-changed")).toBe(true);
    // Saving over it is deliberate: asked, then done.
    await app.press("text:Save yours over it");
    await app.press("text:Save over it");
    await app.waitUntil(() => disk(app).includes("Mine."), { timeout: 15_000 });
    await app.waitUntil(() => !app.shows("id:buffer-changed"), { timeout: 15_000 });
  } finally {
    // The sample's proposal as it was, for the tests after this one.
    await writeOnDisk(app, first);
  }
}, 90_000);
