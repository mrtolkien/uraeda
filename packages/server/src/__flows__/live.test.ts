// Live updates: a page subscribed to a record hears of a change made through git, a file, or an
// agent, from its own repository only, as the repositories decision's per repository bus says.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { commitOnBranch } from "uraeda-binding/test-utils";
import { createApp } from "../app.ts";
import { connect, subscribe } from "../__tests__/live-stream.ts";
import {
  appSettings,
  binding,
  fixtureRepo,
  mutate,
  port,
  testHosts,
  testPreviews,
  testServer,
} from "../__tests__/helpers.ts";

const AGENT = "2026-10-12-cli-tuis";
const PROPOSAL = `specs/${AGENT}/proposal.md`;
const proposal = (title: string) => `# ${title}\n\n## What\n\nIt.\n`;

/** Repositories served by one app, which a page reads through each one's endpoint. */
async function served(repos: Array<string>) {
  const opened = await testHosts(repos, { installed: false });
  const app = createApp({
    allowOrigins: [],
    binding,
    dataDir: opened.dataDir,
    hosts: opened.hosts,
    port,
    previews: testPreviews(),
    sessions: opened.sessions,
    settings: (await appSettings()).settings,
  });
  return { app, names: opened.names };
}

/** A page's connection to a repository's live endpoint, subscribed to its feature. */
async function watching(app: Parameters<typeof connect>[0], name: string, id: string) {
  const stream = await connect(app, name, id);
  expect(await stream.arrival("connected", 10_000)).toBeDefined();
  await subscribe(app, name, id, { entityId: AGENT, select: ["id", "title"], type: "Feature" });
  // The subscription is first sent the record as it is.
  expect(await stream.arrival('"kind":"next"', 10_000)).toBeDefined();
  return stream;
}

test("a commit on a feature's branch reaches a page subscribed to the feature", async () => {
  const repo = fixtureRepo();
  const { app, names } = await served([repo]);
  const stream = await watching(app, names[0]!, "c1");
  const before = stream.mark();

  commitOnBranch(repo, AGENT, { [PROPOSAL]: proposal("A title from the commit") });

  expect(await stream.arrival("A title from the commit", 10_000, before)).toBeDefined();
  await stream.close();
});

test("a change in one repository is not sent to a page of another", async () => {
  const repos = [fixtureRepo(), fixtureRepo()];
  const { app, names } = await served(repos);
  const first = await watching(app, names[0]!, "c1");
  const second = await watching(app, names[1]!, "c2");
  const [firstBefore, secondBefore] = [first.mark(), second.mark()];

  // The second repository changes first, then the first: the first's page hears only its own.
  commitOnBranch(repos[1]!, AGENT, { [PROPOSAL]: proposal("Written in the second") });
  expect(await second.arrival("Written in the second", 10_000, secondBefore)).toBeDefined();
  commitOnBranch(repos[0]!, AGENT, { [PROPOSAL]: proposal("Written in the first") });
  expect(await first.arrival("Written in the first", 10_000, firstBefore)).toBeDefined();

  expect(await first.arrival("Written in the second", 0, firstBefore)).toBeUndefined();
  expect(await second.arrival("Written in the first", 0, secondBefore)).toBeUndefined();
  await Promise.all([first.close(), second.close()]);
});

test("a hand edit of a workflow file in the checkout reaches a page subscribed to it", async () => {
  const { app, name, repo } = await testServer();
  const stream = await connect(app, name, "c1");
  expect(await stream.arrival("connected", 10_000)).toBeDefined();
  await subscribe(app, name, "c1", { entityId: "inbox", select: ["id", "hash"], type: "Inbox" });
  expect(await stream.arrival('"kind":"next"', 10_000)).toBeDefined();
  const before = stream.mark();

  writeFileSync(
    join(repo, "specs/INBOX.md"),
    "# Inbox\n\n## Ideas\n\n- A note typed in an editor\n",
  );

  expect(await stream.arrival('"hash"', 10_000, before)).toBeDefined();
  await stream.close();
});

test("an agent's turn that ends reaches a page subscribed to the sessions' list", async () => {
  const { adapter, app, name, sessions } = await testServer();
  const stream = await connect(app, name, "c1");
  expect(await stream.arrival("connected", 10_000)).toBeDefined();
  await subscribe(app, name, "c1", {
    entityId: "all",
    select: ["id", "rows"],
    type: "SessionList",
  });
  const sent = await mutate(app, "session.send", { folder: AGENT, text: "Plan it" }, [
    "id",
    "turns",
  ]);
  const turn = Number((sent.data as { turns: Array<string> }).turns[0]);
  expect(await stream.arrival('"kind":"next"', 10_000)).toBeDefined();
  const before = stream.mark();

  adapter.emit({ denials: [], errors: [], interrupted: false, ok: true, type: "result" });
  await sessions.settled(turn);

  // The turn ended on a plan with no gate reached: the row now asks for attention.
  expect(await stream.arrival("attention", 10_000, before)).toBeDefined();
  await stream.close();
});
