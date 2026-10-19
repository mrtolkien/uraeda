// What needs the human: the notifications decision's rules that an item is listed, across every
// repository, only when the server's statuses say it asks something of the human, and that a new
// ask is a new key, so the page notifies again. The page's own rules, its permission, its title,
// and the click, are the web flows'.
import { expect, test } from "vite-plus/test";
import { commitOnBranch } from "uraeda-binding/test-utils";
import { createApp } from "../app.ts";
import { needsYouReason } from "../fate/needs-you.ts";
import { sessionStatus } from "../runner/status.ts";
import {
  appSettings,
  binding,
  byIdAt,
  fixtureRepo,
  mutate,
  port,
  testHosts,
  testPreviews,
  testServer,
} from "../__tests__/helpers.ts";

/** Waits on the human, at its questions. */
const HUMAN = "2026-10-11-web-ui";
/** Waits on an agent, at its plan. */
const AGENT = "2026-10-12-cli-tuis";

type Row = {
  folder?: string;
  href: string;
  id: string;
  key: string;
  reason: string;
  repository: string;
};

/** A turn that ends refused the command. */
const refusal = (command: string) => ({
  denials: [{ input: { command }, tool: "Bash" }],
  errors: [],
  interrupted: false,
  ok: true as const,
  type: "result" as const,
});

/** The list of what needs the human, on the global endpoint of the app. */
async function rowsOf(app: Parameters<typeof byIdAt>[0]): Promise<Array<Row>> {
  const [list] = await byIdAt(app, null, "NeedsYouList", ["all"], ["rows"]);
  return list!.rows as Array<Row>;
}

test("a feature at a gate that waits on the human is listed, in each repository, with its address", async () => {
  const repos = [fixtureRepo(), fixtureRepo()];
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

  const rows = await rowsOf(app);

  const listed = rows.filter((row) => row.folder === HUMAN);
  expect(listed.map((row) => row.repository).sort()).toEqual([...opened.names].sort());
  for (const row of listed) {
    // Its address is under its own repository, where the human answers it.
    expect(row.href.startsWith(`/r/${row.repository}/`)).toBe(true);
    expect(row.href).toContain(HUMAN);
  }
  // A feature waiting on an agent asks nothing of the human.
  expect(rows.some((row) => row.folder === AGENT)).toBe(false);

  // The questions answered, the row of that repository leaves, and the other's stays.
  commitOnBranch(repos[0]!, HUMAN, { [`specs/${HUMAN}/clarifications-01.md`]: null });
  const after = (await rowsOf(app)).filter((row) => row.folder === HUMAN);
  expect(after.map((row) => row.repository)).toEqual([opened.names[1]]);
});

test("a chat whose agent was refused an action is listed, a finished reply is not", async () => {
  const server = await testServer();
  const chat = (await mutate(server.app, "session.newChat", {}, ["id"])).data as { id: string };
  const reply = (await mutate(server.app, "session.newChat", {}, ["id"])).data as { id: string };
  server.adapter.script([
    {
      denials: [{ input: { command: "git push origin HEAD" }, tool: "Bash" }],
      errors: [],
      interrupted: false,
      ok: true,
      type: "result",
    },
  ]);
  server.adapter.script([{ text: "All done.", type: "text" }]);
  const blocked = await mutate(server.app, "session.send", { session: chat.id, text: "Push it" }, [
    "id",
    "turns",
  ]);
  await server.sessions.settled(Number((blocked.data as { turns: Array<string> }).turns[0]));
  const done = await mutate(server.app, "session.send", { session: reply.id, text: "Say hi" }, [
    "id",
    "turns",
  ]);
  await server.sessions.settled(Number((done.data as { turns: Array<string> }).turns[0]));

  const rows = (await rowsOf(server.app)).filter((row) => row.id.includes("/chats/"));

  expect(rows.map((row) => [row.reason, row.id])).toEqual([
    ["blocked", `${server.name}/chats/${chat.id}`],
  ]);
  expect(rows[0]!.href).toContain(chat.id);

  // Archived, a chat is put away: it asks nothing more.
  await mutate(server.app, "session.archive", { archived: true, session: chat.id }, ["id"]);
  expect((await rowsOf(server.app)).filter((row) => row.id.includes("/chats/"))).toEqual([]);
});

test("a second ask of the same chat has another key, so it notifies again", async () => {
  const server = await testServer();
  const chat = (await mutate(server.app, "session.newChat", {}, ["id"])).data as { id: string };
  const ask = async (command: string) => {
    server.adapter.script([refusal(command)]);
    const sent = await mutate(server.app, "session.send", { session: chat.id, text: command }, [
      "id",
      "turns",
    ]);
    await server.sessions.settled(Number((sent.data as { turns: Array<string> }).turns.at(-1)));
    return (await rowsOf(server.app)).find((row) => row.id.includes(chat.id))!.key;
  };

  const first = await ask("git push origin HEAD");
  const second = await ask("git push origin main");

  expect(second).not.toBe(first);
});

type Status = Parameters<typeof sessionStatus>[0];

const NONE: Status = { blocked: false, queued: false, seenAt: null, waitsOnHuman: false };
const turn = (state: "done" | "failed" | "stopped" | "running", kind: "chat" | "workflow") => ({
  endedAt: state === "running" ? null : "2026-10-13T10:00",
  kind,
  state,
});

// The statuses every sidebar row and notification is read from: one table, as it is pure logic.
test.each<[string, Partial<Status>, string, string | undefined]>([
  [
    "a running turn, whatever else holds",
    { blocked: true, latest: turn("running", "chat"), waitsOnHuman: true },
    "working",
    undefined,
  ],
  ["a queued turn", { queued: true }, "working", undefined],
  ["an action refused", { blocked: true, latest: turn("done", "chat") }, "needs-you", "blocked"],
  [
    "a step that waits on the human",
    { latest: turn("done", "workflow"), waitsOnHuman: true },
    "needs-you",
    "step",
  ],
  ["a turn that failed", { latest: turn("failed", "workflow") }, "attention", "failed"],
  ["a turn the human stopped", { latest: turn("stopped", "chat") }, "attention", "stopped"],
  [
    "a run that ended while the step waits on the agent",
    { latest: turn("done", "workflow"), waitsOnAgent: true },
    "attention",
    "halted",
  ],
  [
    "a run that ended past the last task with no pull request state",
    {
      latest: turn("done", "workflow"),
      seenAt: "2026-10-13T11:00",
      stepName: "pull-request-unknown",
      waitsOnAgent: true,
    },
    "idle",
    undefined,
  ],
  ["a chat reply the human has not seen", { latest: turn("done", "chat") }, "unread", undefined],
  [
    "a chat reply seen since",
    { latest: turn("done", "chat"), seenAt: "2026-10-13T11:00" },
    "idle",
    undefined,
  ],
  ["no turn at all", {}, "idle", undefined],
])("the status of %s", (_, input, status, reason) => {
  const got = sessionStatus({ ...NONE, ...input });

  expect([got.status, got.reason]).toEqual([status, reason]);
});

// Only what asks something of the human is listed, as the same statuses say it.
test.each<[string, Partial<Status>, boolean]>([
  ["an action refused", { blocked: true, latest: turn("done", "chat") }, true],
  [
    "a step that waits on the human",
    { latest: turn("done", "workflow"), waitsOnHuman: true },
    true,
  ],
  ["a turn that failed", { latest: turn("failed", "workflow") }, true],
  ["a running turn", { latest: turn("running", "workflow") }, false],
  ["a chat reply the human has not seen", { latest: turn("done", "chat") }, false],
  ["an idle session", {}, false],
])("%s is listed by the notifier: %s", (_, input, listed) => {
  const { reason, status } = sessionStatus({ ...NONE, ...input });

  const asked = needsYouReason({ status, statusReason: reason ?? null, step: "plan" });

  expect(asked !== undefined).toBe(listed);
});
