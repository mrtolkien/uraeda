// A buffer against the real server: `just app-test` starts a sandbox, and `__checks__/Buffer.tsx`
// opens the app on a note of its own in `realistic`, whose Git page no test reads. What the test
// guards is what using the page would not show until it was too late: a file changed on disk while
// it is edited, by an agent or a pull, is never overwritten silently by the save that follows.
// While nothing is typed, the editor follows the disk.
import { type App, expect, open, test } from "nsh/test";

const shows = (app: App) => app.texts().join(" ");
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
}

test("a file changed on disk while it is edited is not overwritten silently", async () => {
  const app = await open("./__checks__/Buffer.tsx", {
    height: 800,
    host: { handlers: { disk: null, written: null } },
    network: "live",
    platform: "linux",
    width: 1400,
  });
  await app.waitUntil(() => shows(app).includes("The first text."), { timeout: 30_000 });

  // Nothing typed: the editor follows the disk.
  await writeOnDisk(app, "# Check\n\nThe disk moved.\n");
  await app.waitUntil(() => shows(app).includes("The disk moved."), { timeout: 15_000 });

  // Typed, then the file changes underneath: the editor says so, and keeps the text typed.
  await app.type("id:buffer-text", "Mine. ");
  await app.waitFor("id:buffer-unsaved", { timeout: 15_000 });
  await writeOnDisk(app, "# Check\n\nAn agent wrote this.\n");
  await app.waitFor("id:buffer-changed", { timeout: 15_000 });
  expect(shows(app)).toContain("Mine.");

  // Saving refuses, in place, and the disk keeps the agent's text.
  await app.keyboard.press("ctrl+Enter");
  await app.waitUntil(() => shows(app).includes("Not saved"), { timeout: 15_000 });
  expect(shows(app)).toContain("Mine.");
  expect(disk(app)).toContain("An agent wrote this.");

  // Saving over it is deliberate: asked, then done.
  await app.press("text:/^Save yours over it/");
  await app.press("text:Save over it");
  await app.waitUntil(() => disk(app).includes("Mine."), { timeout: 15_000 });
  await app.waitUntil(() => !app.shows("id:buffer-changed"), { timeout: 15_000 });
}, 90_000);
