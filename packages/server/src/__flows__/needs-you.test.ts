// What needs the human: the notifications decision's rules that an item is listed, across every
// repository, only when the server's statuses say it asks something of the human, and that a new
// ask is a new key, so the page notifies again. The page's own rules, its permission, its title,
// and the click, are the web flows'.
import { expect, test } from "vite-plus/test";
import { commitOnBranch } from "uraeda-binding/test-utils";
import { createApp } from "../app.ts";
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
