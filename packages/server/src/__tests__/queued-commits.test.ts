// A feature whose commits are still queued: its step is the one they give, wherever it is read,
// and what is sent to the feature waits for them to land.
import { expect, test, vi } from "vite-plus/test";
import { REFUSALS } from "../runner/sessions.ts";
import { heldHook } from "./held-hook.ts";
import { byId, mutate, testServer } from "./helpers.ts";

type Server = Awaited<ReturnType<typeof testServer>>;

const FOLDER = "2026-10-06-recurring-tasks";
const MESSAGE_FIELDS = ["id", "refusal", "step", "text"];

/** The server, its repository's queue, and a hook holding its commits. */
async function heldServer() {
  const server = await testServer();
  const host = server.hosts.get(server.name)!;
  return { hook: heldHook(server.repo), host, server };
}

/** The workflow message of the feature's approval, as the composer reads it. */
async function approvalMessage(server: Server) {
  const [message] = await byId(
    server.app,
    "WorkflowMessage",
    [`${FOLDER}:approval`],
    MESSAGE_FIELDS,
  );
  return message;
}

const approve = (server: Server) =>
  mutate(server.app, "review.approve", { file: "spec.md", folder: FOLDER }, ["id", "status"]);

/** The feature's step, as the workspace's record sends it. */
async function workspaceStep(server: Server, folder: string) {
  const [workspace] = await byId(server.app, "Workspace", ["workspace"], ["id", "features"]);
  return workspace.features.find((feature: { folder: string }) => feature.folder === folder)?.step
    .name;
}

test("an approval still landing moves the feature's step at once", async () => {
  const { hook, host, server } = await heldServer();
  expect(await workspaceStep(server, FOLDER)).toBe("human-gate");
  const update = vi.spyOn(host.live, "update");

  expect((await approve(server)).error).toBeUndefined();

  // Queued, not landed: the feature is sent again at once, at the step the approval gives.
  expect(update).toHaveBeenCalledWith("Feature", FOLDER, expect.anything());
  expect(await workspaceStep(server, FOLDER)).toBe("plan");
  const expected = await approvalMessage(server);
  expect(expected).toMatchObject({ refusal: null, step: "plan" });
  expect(expected.text).toContain("references/plan.md");
  update.mockClear();
  hook.release();
  await host.queue.idle();
  // The landing sends the feature and the message again, at the same step: no flicker back.
  expect(update).toHaveBeenCalledWith("WorkflowMessage", `${FOLDER}:approval`, expect.anything());
  expect(update).toHaveBeenCalledWith("Feature", FOLDER, expect.anything());
  expect(await workspaceStep(server, FOLDER)).toBe("plan");
  expect(await approvalMessage(server)).toEqual(expected);
});

test("a refused approval moves the feature's step back to the gate", async () => {
  const { hook, host, server } = await heldServer();
  hook.refusing(true);
  await approve(server);
  expect(await workspaceStep(server, FOLDER)).toBe("plan");

  hook.release();
  await host.queue.idle();

  expect(await workspaceStep(server, FOLDER)).toBe("human-gate");
  expect(await approvalMessage(server)).toMatchObject({ refusal: REFUSALS.human });
});

/** Sends the approval's workflow message to the feature, as the composer does. */
const send = (server: Server, message: Record<string, string>) =>
  mutate(
    server.app,
    "session.send",
    { folder: FOLDER, text: message.text, workflow: { step: message.step, trigger: "approval" } },
    ["id", "folder"],
  );

/** The writes of the repository's queue, as a client reads them. */
async function writes(server: Server) {
  const [queue] = await byId(server.app, "WriteQueue", ["write-queue"], ["id", "writes"]);
  return queue.writes;
}

test("a message sent while an approval lands waits for it, then starts the agent", async () => {
  const { hook, host, server } = await heldServer();
  server.adapter.script([]);
  await approve(server);
  const message = await approvalMessage(server);

  const sent = await send(server, message);

  expect(sent.error).toBeUndefined();
  expect(sent.data).toMatchObject({ folder: FOLDER });
  expect(server.sessions.cache.turns(sent.data.id)).toEqual([]);
  hook.release();
  await host.queue.idle();
  await vi.waitFor(() => expect(server.sessions.cache.turns(sent.data.id)).toHaveLength(1));
  const [turn] = server.sessions.cache.turns(sent.data.id);
  await server.sessions.settled(turn.id);
  expect(turn).toMatchObject({ kind: "workflow", step: "plan", trigger: "approval" });
  expect(server.adapter.sent).toEqual([expect.objectContaining({ text: message.text })]);
});

test("a message sent while an approval is refused is dropped, and kept for the composer", async () => {
  const { hook, host, server } = await heldServer();
  hook.refusing(true);
  await approve(server);
  const message = await approvalMessage(server);
  const sent = await send(server, message);

  hook.release();
  await host.queue.idle();

  await vi.waitFor(async () =>
    expect(await writes(server)).toMatchObject([{ queued: message.text, state: "refused" }]),
  );
  expect(server.adapter.sent).toEqual([]);
  // The session made for the message goes with it: nothing was started.
  expect(server.sessions.cache.session(sent.data.id)).toBeUndefined();
});

test("a kept message whose send is refused comes back for the composer, after the one sent", async () => {
  const { hook, host, server } = await heldServer();
  server.adapter.script([]);
  await approve(server);
  const message = await approvalMessage(server);
  const first = await send(server, message);
  const second = await mutate(server.app, "session.send", { folder: FOLDER, text: "And this" }, [
    "id",
  ]);
  expect(second.error).toBeUndefined();
  const sending = server.sessions.send.bind(server.sessions);
  vi.spyOn(server.sessions, "send")
    .mockImplementationOnce(sending)
    .mockRejectedValueOnce(new Error("refused: the agent is unavailable"));

  hook.release();
  await host.queue.idle();

  await vi.waitFor(async () =>
    expect(await writes(server)).toMatchObject([
      {
        failure: "unsent",
        folder: FOLDER,
        output: "the agent is unavailable",
        queued: "And this",
        state: "refused",
      },
    ]),
  );
  await vi.waitFor(() => expect(server.sessions.cache.turns(first.data.id)).toHaveLength(1));
  expect(server.adapter.sent).toEqual([expect.objectContaining({ text: message.text })]);
});

test("a message kept for a commit the server stopped in is never sent, and its session goes", async () => {
  const { hook, host, server } = await heldServer();
  await approve(server);
  const sent = await send(server, await approvalMessage(server));

  await server.sessions.closeAll();
  hook.release();
  await host.queue.idle();

  expect(server.sessions.cache.session(sent.data.id)).toBeUndefined();
  expect(server.adapter.sent).toEqual([]);
  expect(await writes(server)).toEqual([]);
});

/** Adds a proposal to the priorities, then commits them: the commit queued, the hook holding it. */
async function commitPriorities(server: Server, text: string) {
  const [read] = await byId(server.app, "Priorities", ["priorities"], ["id", "hash"]);
  await mutate(server.app, "proposals.add", { hash: read.hash, section: "next", text }, ["id"]);
  await mutate(server.app, "priorities.commit", {}, ["id"]);
}

test("a change made a feature commits in the queue, after the commits before it", async () => {
  const server = await testServer();
  server.adapter.script([]);
  const change = await mutate(server.app, "change.start", { slug: "login", text: "# Login\n" }, [
    "id",
    "folder",
  ]);
  const folder = change.data.folder as string;
  const host = server.hosts.get(server.name)!;
  await host.queue.idle();
  const hook = heldHook(server.repo);
  await commitPriorities(server, "Kanban board");

  server.adapter.script([]);
  const promoting = mutate(server.app, "feature.promote", { folder }, ["id", "folder", "kind"]);

  // The promotion waits behind the priorities' commit, which its hook holds.
  const waiting = await vi.waitFor(async () => {
    const [, promotion] = await writes(server);
    expect(promotion).toMatchObject({ folder, state: "waiting" });
    return promotion;
  });
  expect(waiting.label).toContain(folder);
  hook.release();
  await vi.waitFor(async () => expect(await writes(server)).toMatchObject([{ state: "running" }]));
  // Its commits, on the default branch and the change's, each run the hook.
  const releasing = setInterval(hook.release, 50);
  const promoted = await promoting;
  clearInterval(releasing);
  expect(promoted.error).toBeUndefined();
  expect(promoted.data).toMatchObject({ folder, kind: "feature" });
  expect(await writes(server)).toEqual([]);
});

test.each([
  ["lands", false],
  ["is refused", true],
])("a drop's sessions are archived once it lands, not if it %s", async (_name, refusing) => {
  const server = await testServer();
  server.adapter.script([]);
  const change = await mutate(server.app, "change.start", { slug: "login", text: "# Login\n" }, [
    "id",
    "folder",
  ]);
  const folder = change.data.folder as string;
  const host = server.hosts.get(server.name)!;
  await host.queue.idle();
  const { data: made } = await mutate(server.app, "session.new", { folder }, ["id"]);
  const hook = heldHook(server.repo);
  hook.refusing(refusing);

  const dropped = await mutate(server.app, "feature.drop", { folder }, ["id"]);

  expect(dropped.error).toBeUndefined();
  const archived = () => server.sessions.cache.session(made.id)?.archivedAt ?? null;
  expect(archived()).toBeNull();
  hook.release();
  await host.queue.idle();
  if (refusing) {
    // The refused drop's change comes back, with its sessions.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(archived()).toBeNull();
    const [feature] = await byId(server.app, "Feature", [folder], ["id", "sessions"]);
    expect(feature.sessions).toContain(made.id);
  } else {
    await vi.waitFor(() => expect(archived()).not.toBeNull());
  }
});
