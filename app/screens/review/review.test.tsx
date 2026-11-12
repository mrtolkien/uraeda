// What a review guarantees that using it would not show: a comment removed by mistake is never
// lost, as `u` puts it back from anywhere, through the real server. On the sample's spec of
// Recurring reminders, waiting for its review, which no other test reviews; each run's comment
// is its own.
import { expect, open, test } from "nsh/test";

const SPEC = "/r/sample/f/2026-10-17-recurring-reminders/spec.md";

test("a removed comment comes back with undo", async () => {
  const app = await open("../shell/__checks__/Places.tsx", {
    height: 800,
    host: { handlers: { places: null, problem: null, shown: null } },
    network: "live",
    width: 1400,
  });
  await app.waitUntil(() => app.shows("id:frame"), { timeout: 30_000 });
  await app.host.send("go", SPEC);
  await app.waitFor("id:review-verdict", { timeout: 30_000 });
  const words = `Keep the reminders quiet at night ${Date.now()}`;
  const says = () => app.texts().join(" ").includes(words);

  // A comment on the part at the cursor, saved in the review.
  await app.keyboard.press("i");
  await app.waitFor("id:review-comment", { timeout: 10_000 });
  await app.type("id:review-comment", words);
  await app.press("id:file-reader >> label:Save the comment");
  await app.waitFor("id:file-reader >> label:Remove", { timeout: 15_000 });
  expect(says()).toBe(true);

  // Removed, it goes, and the toast says what went.
  await app.press("id:file-reader >> label:Remove");
  await app.waitUntil(() => !says(), { timeout: 15_000 });
  await app.waitUntil(() => app.texts().join(" ").includes("Removed your comment on"), {
    timeout: 15_000,
  });

  // `u`, from another page, puts it back in the review.
  await app.host.send("go", "/r/sample/inbox");
  await app.waitFor("text:We need a home icon", { timeout: 20_000 });
  await app.keyboard.press("Escape");
  await app.keyboard.press("u");
  await app.waitUntil(() => app.texts().join(" ").includes("Undone"), { timeout: 15_000 });
  await app.host.send("go", SPEC);
  await app.waitUntil(says, { timeout: 20_000 });
}, 120_000);

test("a and r in the verdict ask first, naming what they commit", async () => {
  const app = await open("../shell/__checks__/Places.tsx", {
    height: 800,
    host: { handlers: { places: null, problem: null, shown: null } },
    network: "live",
    width: 1400,
  });
  await app.waitUntil(() => app.shows("id:frame"), { timeout: 30_000 });
  await app.host.send("go", "/r/realistic/f/2026-10-19-leader-key/spec.md");
  await app.waitFor("id:review-verdict", { timeout: 30_000 });
  const words = () => app.texts().join(" ");
  // `n` goes to the verdict, `a` asks: the approval names the decision it accepts.
  await app.keyboard.press("n");
  await app.keyboard.press("a");
  await app.waitUntil(() => words().includes("Approve the spec of"), { timeout: 10_000 });
  expect(words()).toContain("it changes Keyboard");
  await app.keyboard.press("Escape");
  await app.waitUntil(() => !words().includes("Approve the spec of"), { timeout: 10_000 });
  // Without a comment, `r` asks nothing: it says what to add.
  await app.keyboard.press("r");
  await app.waitUntil(() => words().includes("Add a comment first"), { timeout: 10_000 });
  expect(words()).toContain("Waits for your review");
}, 120_000);
