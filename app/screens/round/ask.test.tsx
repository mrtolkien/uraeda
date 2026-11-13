// Asking the agent about a question of a round: the feature's session opens beside the round, the
// question quoted in its composer, and nothing is sent until the human sends it (rule 2). Using the
// app shows the session opening; not that the round stayed where it was, nor that nothing went.
import { type App, expect, open, test } from "nsh/test";

/** A round of the sample that waits, and that no other test answers. */
const ROUND = "/r/sample/f/2026-10-19-date-format/clarifications-01.md";

const posted = (app: App, name: string) =>
  app.host
    .posts()
    .filter((post) => post.name === name)
    .map((post) => post.data);

const words = (app: App) => app.texts().join(" ");

test("asking the agent keeps the question in view and sends nothing", async () => {
  const app = await open("../shell/__checks__/Places.tsx", {
    height: 800,
    host: { handlers: { places: null, problem: null, shown: null } },
    network: "live",
    width: 1400,
  });
  await app.waitUntil(() => app.shows("id:frame"), { timeout: 30_000 });
  await app.host.send("go", ROUND);
  await app.waitUntil(() => words(app).includes("Context and points to check"), {
    timeout: 20_000,
  });
  // Every question is answered: the round opens at its submit, and `p` goes to the last.
  await app.keyboard.press("p");
  await app.waitUntil(() => words(app).includes("Question 7 of 7"), { timeout: 10_000 });
  await app.keyboard.press("s");
  await app.waitUntil(() => words(app).includes("About Q7 of "), { timeout: 20_000 });
  // The round is still where it was, beside the session.
  expect(words(app)).toContain("Question 7 of 7");
  // Nothing went: a send drops the draft at once, and the quote waits in it, on the device.
  const drafts = Object.entries(app.storage() as Record<string, string>)
    .filter(([key]) => key.startsWith("unsaved:sample:session:"))
    .map(([, value]) => (JSON.parse(value) as { text: string }).text);
  expect(drafts).toEqual([
    "About Q7 of specs/changes/2026-10-19-date-format/clarifications-01.md:\n> What happens when a task without a due date is set to repeat?\n\n",
  ]);
  expect(posted(app, "problem")).toEqual([]);
}, 90_000);
