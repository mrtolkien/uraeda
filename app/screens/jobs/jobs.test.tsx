// What the Jobs place guarantees that a look at a picture would not show (rule 6 of "What makes a
// screen good", sent back on this very form): a choice refused by the server goes back and says
// why under its own field, and changes made while a save is under way are sent in order, each on
// what the one before wrote.
import { expect, open, test } from "nsh/test";

test("a field refused by the server goes back, and says why under itself", async () => {
  const app = await open("./__checks__/App.tsx", {
    height: 900,
    network: "live",
    platform: "linux",
    width: 1400,
  });
  const shows = () => app.texts().join(" ");
  // A job of its own, made through the new job's page.
  const name = `Refusal check ${Date.now()}`;
  await app.waitFor("id:job-name", { timeout: 30_000 });
  await app.type("id:job-name", name);
  await app.type("id:job-prompt", "Say hello.");
  // Add turns on once the fields hold what was typed: under load, a moment after the last key.
  await app.waitUntil(() => app.enabled("id:job-add"), { timeout: 10_000 });
  await app.press("id:job-add");
  await app.waitUntil(
    () => shows().includes("Next run") || shows().includes("Scheduled jobs are off"),
    {
      timeout: 15_000,
    },
  );
  // Its one repository unticked: the box moves at once, the server refuses, it comes back.
  await app.press("label:Runs in sample");
  await app.waitUntil(() => shows().includes("A job runs in one repository at least."), {
    timeout: 15_000,
  });
  expect(shows()).toContain("Runs in sample.");
});

test("changes made during a save are sent in order", async () => {
  const app = await open("./__checks__/queue.tsx", { clock: {}, height: 600, width: 900 });
  await app.press("label:Report only");
  // Made while the first save is under way: shown at once, sent once it is answered.
  await app.press("label:At 9:30");
  expect(app.texts()).toContain("Shown: 09:30 report");
  expect(app.texts()).toContain("sent 1: daily 03:00 report over 03:00");
  expect(app.texts()).not.toContain("sent 2: daily 09:30 report over 03:00");
  await app.wait(2100);
  expect(app.texts()).toContain("sent 2: daily 09:30 report over 03:00");
  await app.wait(5100);
  expect(app.texts().filter((line) => line.startsWith("sent"))).toEqual([
    "sent 1: daily 03:00 report over 03:00",
    "sent 2: daily 09:30 report over 03:00",
  ]);
  expect(app.texts()).toContain("Shown: 09:30 report");
});

test("a new job's form opens typing into its name", async () => {
  const app = await open("./__checks__/App.tsx", {
    height: 900,
    network: "live",
    platform: "linux",
    width: 1400,
  });
  await app.waitFor("id:job-name", { timeout: 30_000 });
  // Typed at once, as a person does after `a`: into the name, never as the page's keys.
  await app.keyboard.press("shift+q");
  await app.keyboard.press("x");
  await app.keyboard.press("z");
  await app.waitUntil(() => app.texts().includes("Qxz"), { timeout: 5_000 });
});
