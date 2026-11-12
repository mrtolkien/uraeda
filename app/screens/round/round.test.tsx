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

test("Shift and a letter adds it to the answer, and stays on the question", async () => {
  const app = await page("Q2", true);
  await app.waitUntil(() => words(app).includes("How should the app store due dates?"), {
    timeout: 30_000,
  });
  // Q2 may hold B already, from the test that submits: A is added beside it.
  await app.keyboard.press("shift+a");
  await app.waitUntil(() => calls(app).some((call) => call.action === "answer.save"), {
    timeout: 10_000,
  });
  await app.wait(300);
  // A is added, and the question stays: a letter alone would have gone on to Q3.
  expect(words(app)).toContain("How should the app store due dates?");
  expect(calls(app).at(-1)).toMatchObject({ question: "Q2" });
  expect(calls(app).at(-1)?.letters).toContain("A");
}, 90_000);

test("c at the end asks first, naming what it commits, and commits nothing by itself", async () => {
  const app = await page("Q1.B", true);
  await app.waitUntil(() => words(app).includes("What does editing one occurrence change?"), {
    timeout: 30_000,
  });
  await app.keyboard.press("a");
  await app.wait(300);
  await app.keyboard.press("a");
  await app.wait(300);
  await app.type("id:round-comment", "Never, for now.");
  await app.keyboard.press("escape");
  await app.keyboard.press("n");
  await app.waitUntil(() => words(app).includes("Every question has its answer"), {
    timeout: 10_000,
  });
  await app.keyboard.press("c");
  await app.waitUntil(() => words(app).includes("Commit 4 answers?"), { timeout: 10_000 });
  expect(words(app)).toContain("on the feature's branch");
  await app.keyboard.press("escape");
  await app.wait(500);
  expect(calls(app).some((call) => call.action === "answers.submit")).toBe(false);
}, 90_000);

test("b answers B and goes on, and is not also Back", async () => {
  const app = await page("Q2", true);
  await app.waitUntil(() => words(app).includes("How should the app store due dates?"), {
    timeout: 30_000,
  });
  // A page before the round, for Back to return to.
  await app.host.send("go", "/r/sample/inbox");
  await app.wait(1000);
  await app.host.send("go", `/r/sample/f/${ROUND}`);
  await app.waitUntil(() => words(app).includes("How should the app store due dates?"), {
    timeout: 10_000,
  });
  await app.keyboard.press("b");
  await app.waitUntil(() => words(app).includes("How does a repetition end?"), { timeout: 10_000 });
  await app.wait(1000);
  expect(words(app)).toContain("How does a repetition end?");
  expect(calls(app).at(-1)).toMatchObject({ letters: ["B"], question: "Q2" });
}, 90_000);

test("J reaches a point to check, and Enter comments on it", async () => {
  const app = await page("start", true);
  await app.waitUntil(() => words(app).includes("Check these"), { timeout: 30_000 });
  await app.wait(500);
  await app.keyboard.press("shift+j");
  await app.waitUntil(() => words(app).includes("⏎"), { timeout: 10_000 });
  await app.keyboard.press("Enter");
  await app.waitFor("id:settled-comment", { timeout: 10_000 });
  await app.type("id:settled-comment", "Say why four.");
  await app.press("label:Save the comment");
  await app.waitUntil(() => calls(app).some((call) => call.action === "settled.comment"), {
    timeout: 10_000,
  });
}, 90_000);
