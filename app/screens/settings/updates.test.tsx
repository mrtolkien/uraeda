// The app's own updates (`../shell/updates.tsx`), over an updater the check's page plays: a new
// release is offered by a toast as the app starts, and by the settings' Updates; it installs with
// its progress, and the app restarts on it; a copy that cannot replace itself sends the human to
// the release's page; a failure says why, and leaves the button to try again.
import { type App, expect, open, test } from "nsh/test";

const page = (scenario: string) =>
  open("./__checks__/updates.tsx", { height: 700, host: { params: { scenario } }, width: 1200 });

const shows = (app: App) => app.texts().join(" ");
const says = (app: App, words: string) =>
  app.waitUntil(() => shows(app).includes(words), { timeout: 5_000 });

test("a new release found at start installs, with its progress, and the app restarts on it", async () => {
  const app = await page("newer");
  await says(app, "Uraeda 1.5.0 is out");
  // The toast, and the settings' row, both offer it; the row names the version that runs.
  expect(app.shows("id:update-toast")).toBe(true);
  expect(shows(app)).toContain("Uraeda 1.4.0");
  await app.press("id:toast-install");
  await says(app, "50%");
  expect(app.shows("id:update-progress")).toBe(true);
  await app.press("text:Finish download");
  await says(app, "Restarted");
  expect(shows(app)).toContain("Installing Uraeda 1.5.0");
});

test("Not now quiets the toast of that version, and the settings still offer it", async () => {
  const app = await page("newer");
  await says(app, "Uraeda 1.5.0 is out");
  await app.press("label:Not now");
  await app.waitUntil(() => !app.shows("id:update-toast"), { timeout: 5_000 });
  expect(app.shows("id:install-update")).toBe(true);
});

test("a copy that cannot replace itself offers the release's page", async () => {
  const app = await page("elsewhere");
  await says(app, "cannot replace itself");
  expect(shows(app)).toContain("Get it");
  expect(shows(app)).not.toContain("Install and restart");
});

test("a failed download says why, and leaves the button to try again", async () => {
  const app = await page("broken");
  await says(app, "Uraeda 1.5.0 is out");
  await app.press("id:toast-install");
  await says(app, "the archive's SHA-256 does not match");
  expect(shows(app)).toContain("this app is as it was");
  expect(app.shows("id:install-update")).toBe(true);
});

test("the latest version says so, and Check now looks again", async () => {
  const app = await page("latest");
  await says(app, "This is the latest version");
  expect(app.shows("id:update-toast")).toBe(false);
  expect(app.shows("id:check-updates")).toBe(true);
});

test("an app without a version of its own says how it updates instead", async () => {
  const app = await page("development");
  await says(app, "development run");
  expect(app.shows("id:check-updates")).toBe(false);
  expect(app.shows("id:update-toast")).toBe(false);
});
