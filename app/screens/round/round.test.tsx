// What a round guarantees that using it would not show: an answer typed is never lost, a restart
// included, and the submit sends each answer once, after every save, and itself once.
import { type App, expect, open, test } from "nsh/test";

const ROUND = "2026-10-17-round-mockup/clarifications-01.md";

/** The round opened at a question, as the device last left it there. */
const page = (at: string, hold: boolean, storage?: Record<string, string>) =>
  open("./__checks__/Round.tsx", {
    height: 900,
    host: { handlers: { calls: null, go: null }, params: { hold: hold ? "on" : "off" } },
    network: "live",
    storage: storage ?? { [`round.at:sample\n${ROUND}`]: JSON.stringify(at) },
    width: 1400,
  });

type Call = { action: string; comment?: string; letters?: string[]; question?: string };

const calls = (app: App) =>
  (app.host.posts().findLast((post) => post.name === "calls")?.data ?? []) as Call[];

const words = (app: App) => app.texts().join(" ");

test("an answer typed and not submitted is there after a restart", async () => {
  const before = await page("Q2", true);
  await before.waitUntil(() => before.shows("id:round-comment"), { timeout: 30_000 });
  await before.type("id:round-comment", "Store calendar days, not instants.");
  await before.waitUntil(() =>
    JSON.stringify(before.storage()).includes("Store calendar days, not instants."),
  );
  // Its save never reaches the server: what comes back is the device's.
  const after = await page("Q2", true, before.storage());
  await after.waitUntil(() => after.shows("id:round-comment"), { timeout: 30_000 });
  await after.waitUntil(() => words(after).includes("Store calendar days, not instants."), {
    timeout: 10_000,
  });
  expect(words(after)).toContain("How should the app store due dates?");
}, 90_000);

test("submitting sends every answer once", async () => {
  const app = await page("Q1.B", false);
  await app.waitUntil(() => words(app).includes("What does editing one occurrence change?"), {
    timeout: 30_000,
  });
  await app.keyboard.press("a");
  await app.waitUntil(() => words(app).includes("How should the app store due dates?"), {
    timeout: 10_000,
  });
  await app.keyboard.press("b");
  await app.waitUntil(() => words(app).includes("How does a repetition end?"), { timeout: 10_000 });
  // A comment typed and left at once, its pause not over: the submit must not send it twice.
  await app.type("id:round-comment", "Never, for now.");
  await app.press("id:round-next");
  await app.waitUntil(() => app.shows("id:round-submit"), { timeout: 10_000 });
  await app.waitUntil(() => words(app).includes("Every question has its answer"), {
    timeout: 20_000,
  });
  await app.press("id:round-submit");
  await app.waitUntil(() => calls(app).some((call) => call.action === "answers.submit"), {
    timeout: 20_000,
  });
  await app.waitUntil(() => words(app).includes("this is a check."), { timeout: 10_000 });
  const sent = calls(app);
  const saves = sent.filter((call) => call.action === "answer.save");
  expect(saves.map((call) => [call.question, call.letters, call.comment])).toEqual([
    ["Q1.B", ["A"], ""],
    ["Q2", ["B"], ""],
    ["Q3", [], "Never, for now."],
  ]);
  expect(sent.filter((call) => call.action === "answers.submit")).toHaveLength(1);
  expect(sent.at(-1)?.action).toBe("answers.submit");
}, 120_000);
