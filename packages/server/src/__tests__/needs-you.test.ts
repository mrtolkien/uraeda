import { expect, test, vi } from "vite-plus/test";
import { commitOnBranch } from "uraeda-binding/test-utils";
import { createApp } from "../app.ts";
import { live as globalLive } from "../fate.ts";
import { needsYouReason, NEEDS_YOU_ID } from "../fate/needs-you.ts";
import { publish } from "../live.ts";
import type { AgentEvent } from "../runner/events.ts";
import {
  appSettings,
  byIdAt,
  type Data,
  fateAt,
  fixtureRepo,
  port,
  testHosts,
  testPreviews,
} from "./helpers.ts";

const binding = await import("uraeda-binding");

/** Waits on the human, at its questions, in the fixture repository. */
const HUMAN = "2026-10-11-web-ui";

/** Two fixture repositories served by one app, read from its global endpoint. */
async function twoRepositories({ installed = false } = {}) {
  const repos = [fixtureRepo(), fixtureRepo()];
  const opened = await testHosts(repos, { installed });
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
  const rows = async () =>
    (await byIdAt(app, null, "NeedsYouList", [NEEDS_YOU_ID], ["rows"]))[0]!.rows as Array<
      Record<string, string>
    >;
  return { ...opened, app, repos, rows };
}

/** US6.5 */
test("what needs the human is listed across repositories, with its message and address", async () => {
  const { names, rows } = await twoRepositories();

  const listed = (await rows()).filter((row) => row.folder === HUMAN);

  expect(listed).toHaveLength(2);
  expect(listed.map((row) => row.repository).sort()).toEqual([...names].sort());
  expect(listed[0]).toMatchObject({
    label: "web-ui",
    message: "Questions to answer",
    reason: "step",
  });
  const row = listed.find((each) => each.repository === names[0])!;
  expect(row.href).toBe(`/r/${names[0]}/f/${HUMAN}/clarifications-01.md`);
  expect((await rows()).some((each) => each.folder === "2026-10-12-cli-tuis")).toBe(false);
});

test("answering the questions removes the row", async () => {
  const { repos, rows } = await twoRepositories();
  const before = (await rows()).filter((row) => row.folder === HUMAN).length;

  commitOnBranch(repos[0]!, HUMAN, {
    [`specs/${HUMAN}/clarifications-01.md`]: null,
  });

  expect((await rows()).filter((row) => row.folder === HUMAN)).toHaveLength(before - 1);
});

test.each<[string, Parameters<typeof needsYouReason>[0], string | undefined]>([
  [
    "a refused action first",
    { status: "needs-you", statusReason: "blocked", step: "spec" },
    "blocked",
  ],
  ["a failed run", { status: "attention", statusReason: "failed", step: "plan" }, "attention"],
  ["a halted run", { status: "attention", statusReason: "halted", step: "plan" }, "attention"],
  ["a step waiting", { status: "needs-you", statusReason: "step", step: "human-gate" }, "step"],
  [
    "a ready pull request",
    { status: "needs-you", statusReason: "step", step: "pull-request" },
    "pull-request",
  ],
  ["a working run", { status: "working", statusReason: null, step: "spec" }, undefined],
  ["an idle feature", { status: "idle", statusReason: null, step: "plan" }, undefined],
])("the reason: %s", (_, input, reason) => {
  expect(needsYouReason(input)).toBe(reason);
});

test("a repository's change is heard on the global bus", () => {
  const update = vi.spyOn(globalLive, "update");
  const bus = { update: vi.fn() } as unknown as Parameters<typeof publish>[1]["live"];

  publish(
    {
      branchDecisions: [],
      decisions: false,
      features: [HUMAN],
      files: [],
      inbox: false,
      priorities: false,
      workspace: false,
    },
    { live: bus, path: "/repo" },
  );

  expect(update).toHaveBeenCalledWith("NeedsYouList", NEEDS_YOU_ID, expect.anything());
  update.mockRestore();
});

/** A finished reply, or one that was refused `command`. */
const result = (command?: string): AgentEvent => ({
  denials: command === undefined ? [] : [{ input: { command }, tool: "Bash" }],
  errors: [],
  interrupted: false,
  ok: true,
  type: "result",
});

/** Two repositories, and a chat in the first, which the helpers send to and block. */
async function twoRepositoriesWithChats() {
  const opened = await twoRepositories({ installed: true });
  await opened.sessions.check();
  const [name] = opened.names;
  const call = async (operation: Record<string, unknown>) => {
    const [result] = await fateAt(opened.app, name!, [{ kind: "mutation", ...operation }]);
    expect(result!.error).toBeUndefined();
    return result!.data as Record<string, Data>;
  };
  const chat = await call({ input: {}, name: "session.newChat", select: ["id", "turns"] });
  /** Sends a message, and waits for its turn: the agent's turn is scripted by `events`. */
  const send = async (events: Array<AgentEvent>, text: string) => {
    opened.adapter.script(events);
    const sent = await call({
      input: { session: chat.id, text },
      name: "session.send",
      select: ["id", "turns"],
    });
    await opened.sessions.settled(Number(sent.turns.at(-1)));
    return sent;
  };
  const blockChat = (command: string, text = "Push it") => send([result(command)], text);
  const allow = async () => {
    const [page] = await byIdAt(opened.app, name!, "Session", [chat.id], ["turns"]);
    const turn = page!.turns.at(-1);
    const [log] = await byIdAt(opened.app, name!, "TurnLog", [`${turn}:0`], ["items"]);
    const denial = log!.items.find((item: { kind: string }) => item.kind === "denial");
    opened.adapter.script([]);
    const allowed = await call({
      input: { seq: denial.seq, session: chat.id, turn },
      name: "session.allow",
      select: ["id", "turns"],
    });
    await opened.sessions.settled(Number(allowed.turns.at(-1)));
  };
  const archive = (archived: boolean) =>
    call({ input: { archived, session: chat.id }, name: "session.archive", select: ["id"] });
  const listed = async () => (await opened.rows()).filter((row) => row.id.includes("/chats/"));
  return { ...opened, allow, archive, blockChat, chat, listed, name: name!, send };
}

/** US5 */
test("a blocked chat is listed, with its title and address, and a finished reply is not", async () => {
  const { blockChat, chat, listed, name, send } = await twoRepositoriesWithChats();
  await send([result()], "Push it");
  expect(await listed()).toHaveLength(0);

  await blockChat("git push origin HEAD", "Push it again");

  expect(await listed()).toHaveLength(1);
  expect((await listed())[0]).toMatchObject({
    href: `/r/${name}/chats/${chat.id}`,
    id: `${name}/chats/${chat.id}`,
    label: "Push it",
    message: "The agent was refused an action",
    reason: "blocked",
    repository: name,
  });
});

test("a chat whose reply finished is not listed", async () => {
  const { listed, send } = await twoRepositoriesWithChats();

  await send([result()], "Say hello");

  expect(await listed()).toEqual([]);
});

test("allowing the action removes the row, and a second block of the chat has another key", async () => {
  const { allow, blockChat, listed } = await twoRepositoriesWithChats();
  await blockChat("git push origin HEAD");
  const first = (await listed())[0]!;

  await allow();
  expect(await listed()).toEqual([]);
  await blockChat("git push origin main", "Push main");

  const again = await listed();
  expect(again).toHaveLength(1);
  expect(again[0]!.key).not.toBe(first.key);
});

test("an archived blocked chat is not listed", async () => {
  const { archive, blockChat, listed } = await twoRepositoriesWithChats();
  await blockChat("git push origin HEAD");

  await archive(true);

  expect(await listed()).toEqual([]);
});

test("a chat turn that ends blocked is heard on the global bus", async () => {
  const { blockChat } = await twoRepositoriesWithChats();
  const update = vi.spyOn(globalLive, "update");

  await blockChat("git push origin HEAD");

  expect(update).toHaveBeenCalledWith("NeedsYouList", NEEDS_YOU_ID, expect.anything());
  update.mockRestore();
});
