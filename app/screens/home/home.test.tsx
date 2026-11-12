// Home of a repository not set up, on the sandbox `just app-test` starts: `bare`, a git repository
// with no `specs/` folder, says so at the head of Needs you, with the way out, instead of reading
// as a project set up with nothing to do. A reason of Needs you this client does not know reads as
// a generic card: a crash there would empty Home.
import { expect, open, test } from "nsh/test";

test("a repository with no specs folder says it is not set up, and how to set it up", async () => {
  const app = await open("../shell/__checks__/Places.tsx", {
    height: 800,
    host: { handlers: { places: null, problem: null, shown: null } },
    network: "live",
    width: 1400,
  });
  await app.waitUntil(() => app.shows("id:frame"), { timeout: 30_000 });
  await app.host.send("go", "/r/bare/");
  await app.waitFor("id:home-set-up", { timeout: 20_000 });
  const said = app.texts().join(" ");
  expect(said).toContain("Not set up for Uraeda yet");
  expect(said).toContain("ura init");
  // A repository set up says nothing of it.
  await app.host.send("go", "/r/sample/");
  await app.waitFor("text:Needs you", { timeout: 20_000 });
  await app.waitUntil(() => !app.shows("id:home-set-up"), { timeout: 10_000 });
}, 90_000);

test("a reason this client does not know reads as a generic card, never a crash", async () => {
  const { needsCard } = await import("./core");
  const row = {
    continued: false,
    href: "/r/sample/",
    id: "later",
    label: "A reason from a newer server",
    message: "Look at it",
    reason: "from-a-newer-server",
    repository: "sample",
  } as unknown as Parameters<typeof needsCard>[0];
  const card = needsCard(row, "sample");
  expect(card.icon).toBe("circle-dot");
  expect(card.state).toEqual({ label: "Waits on you", tone: "needs" });
});
