// The start through the write queue (US4): it answers once planned, with the workflow's message,
// then the queue commits, makes the branch and its worktree, and sends the message sent meanwhile.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { expect, test, vi } from "vite-plus/test";
import { binding, byId, type Data, git, mutate, testServer } from "./helpers.ts";

type Server = Awaited<ReturnType<typeof testServer>>;

const PROPOSAL = "specs/proposals/git-listener.md";
/** A second proposal file, which the tests commit before the hook holds commits. */
const OTHER = "specs/proposals/kanban.md";
const SLUG = "performance-pass";
const PLAN_FIELDS = ["id", "folder", "title", "message"];

/**
 * A pre-commit hook in `repo` that prints "hook: checking", then waits until released, each
 * release letting one commit through, and refuses the commits made while `refusing`.
 */
function heldHook(repo: string) {
  const folder = temporaryFolder("uraeda-hook");
  const gate = join(folder, "gate");
  const refuse = join(folder, "refuse");
  const hook = join(repo, ".git/hooks/pre-commit");
  mkdirSync(dirname(hook), { recursive: true });
  writeFileSync(
    hook,
    `#!/bin/sh\necho "hook: checking"\n` +
      `while [ ! -e "${gate}" ]; do sleep 0.02; done\nrm -f "${gate}"\n` +
      `if [ -e "${refuse}" ]; then echo "lint: 1 problem"; exit 1; fi\n`,
    { mode: 0o755 },
  );
  return {
    refusing: () => writeFileSync(refuse, ""),
    release: () => writeFileSync(gate, ""),
  };
}

/** The server with a second proposal file committed, before a hook holds the commits. */
async function startServer() {
  const server = await testServer();
  writeFileSync(join(server.repo, OTHER), "# Kanban board\n\n## What\n\nA board.\n");
  git(server.repo, "add", OTHER);
  git(server.repo, "commit", "-q", "-m", "add the kanban proposal");
  return { hook: heldHook(server.repo), server };
}

/** The writes of the repository's queue, as a client reads them. */
async function writes(server: Server): Promise<Array<Record<string, Data>>> {
  const [queue] = await byId(server.app, "WriteQueue", ["write-queue"], ["id", "writes"]);
  return queue.writes;
}

/** The start's write in the queue, once `ready` holds for it. */
async function startWrite(server: Server, ready: (write: Record<string, Data>) => boolean) {
  let found: Record<string, Data> | undefined;
  await vi.waitFor(async () => {
    found = (await writes(server)).find((write) => write.steps !== undefined);
    expect(found !== undefined && ready(found)).toBe(true);
  });
  return found as Record<string, Data>;
}

/** Waits until every write queued landed or was refused. */
const idle = (server: Server) => server.hosts.get(server.name)!.queue.idle();

const start = (server: Server, proposal: string) =>
  mutate(server.app, "feature.start", { proposal, slug: SLUG }, PLAN_FIELDS);

/** Sends the plan's message to the starting folder, as the composer does. */
const send = (server: Server, folder: string, text: string) =>
  mutate(server.app, "session.send", { folder, text, workflow: { trigger: "start" } }, [
    "id",
    "folder",
  ]);

test("a start answers once planned, then runs its steps", async () => {
  const { hook, server } = await startServer();

  const planned = await start(server, PROPOSAL);

  expect(planned.error).toBeUndefined();
  const folder = planned.data.folder as string;
  expect(folder).toMatch(/^\d{4}-\d{2}-\d{2}-performance-pass$/);
  expect(planned.data).toMatchObject({ id: folder, title: "Git listener process" });
  expect(planned.data.message).toContain(`specs/${folder}/ on branch ${folder}`);
  const running = await startWrite(server, (write) => write.steps[0].output !== undefined);
  expect(running).toMatchObject({ folder, state: "running" });
  expect(running.steps).toMatchObject([
    { label: "Commit the proposal on main, running your hooks", state: "running" },
    { label: `Make the branch ${folder} and its worktree`, state: "waiting" },
    { label: "Start the agent with your message", state: "waiting" },
  ]);
  expect(running.steps[0].output).toBe("hook: checking");

  // Row: a second start of the same slug, of another proposal, is refused at once.
  const again = await start(server, OTHER);
  expect(again.error?.message).toBe(`refused: A feature named ${SLUG} exists already`);

  hook.release();
  await idle(server);
  expect(await writes(server)).toEqual([]);
  expect(git(server.repo, "branch", "--list", folder)).toContain(folder);
  const [feature] = await byId(server.app, "Feature", [folder], ["id", "title"]);
  expect(feature.title).toBe("Git listener process");
  // The message the plan answered is the workflow's, read now that the feature exists.
  const [workflow] = await byId(server.app, "WorkflowMessage", [`${folder}:start`], ["id", "text"]);
  expect(workflow.text).toBe(planned.data.message);
});

test("a start waiting behind another write holds its slug", async () => {
  const { hook, server } = await startServer();
  // A commit of the lists, held by its hook, ahead of the start.
  const [read] = await byId(server.app, "Priorities", ["priorities"], ["id", "hash"]);
  await mutate(server.app, "proposals.add", { hash: read.hash, section: "next", text: "X" }, [
    "id",
  ]);
  await mutate(server.app, "priorities.commit", {}, ["id"]);

  const planned = await start(server, PROPOSAL);
  const waiting = await startWrite(server, (write) => write.state === "waiting");
  const again = await start(server, OTHER);

  expect(planned.error).toBeUndefined();
  expect(waiting.steps.map((step: Record<string, Data>) => step.state)).toEqual([
    "waiting",
    "waiting",
    "waiting",
  ]);
  expect(again.error?.message).toBe(`refused: A feature named ${SLUG} exists already`);
  hook.release();
  // The start's commit runs once the lists' landed, held by the hook in its turn.
  await startWrite(server, (write) => write.steps[0].output !== undefined);
  hook.release();
  await idle(server);
  expect(git(server.repo, "branch", "--list", planned.data.folder)).toContain(planned.data.folder);
});

test("a typed change's start waiting in the queue holds its slug", async () => {
  const { hook, server } = await startServer();
  const [read] = await byId(server.app, "Priorities", ["priorities"], ["id", "hash"]);
  await mutate(server.app, "proposals.add", { hash: read.hash, section: "next", text: "X" }, [
    "id",
  ]);
  await mutate(server.app, "priorities.commit", {}, ["id"]);
  const change = mutate(server.app, "change.start", { slug: SLUG, text: "# Faster\n" }, ["id"]);
  await vi.waitFor(async () => expect(await writes(server)).toHaveLength(2));

  const again = await start(server, PROPOSAL);

  expect(again.error?.message).toBe(`refused: A feature named ${SLUG} exists already`);
  const releasing = setInterval(hook.release, 50);
  await change;
  await idle(server);
  clearInterval(releasing);
});

test("a message sent during a start waits, then starts the agent", async () => {
  const { hook, server } = await startServer();
  server.adapter.script([]);
  const planned = await start(server, PROPOSAL);
  const { folder, message } = planned.data as Record<string, string>;

  const sent = await send(server, folder, message);

  expect(sent.error).toBeUndefined();
  expect(sent.data).toMatchObject({ folder });
  expect(server.adapter.sent).toEqual([]);
  expect(await startWrite(server, (write) => write.queued !== undefined)).toMatchObject({
    queued: message,
  });
  hook.release();
  await idle(server);
  const turns = server.sessions.cache.turns(sent.data.id);
  expect(turns).toHaveLength(1);
  await server.sessions.settled(turns[0].id);
  expect(server.adapter.sent).toEqual([expect.objectContaining({ text: message })]);
  expect(turns[0]).toMatchObject({ kind: "workflow", step: "discovery", trigger: "start" });
});

test("a message sent during a refused start is dropped, and kept for the composer", async () => {
  const { hook, server } = await startServer();
  hook.refusing();
  const planned = await start(server, PROPOSAL);
  const { folder, message } = planned.data as Record<string, string>;
  const sent = await send(server, folder, message);

  hook.release();
  await idle(server);

  expect(server.adapter.sent).toEqual([]);
  const [refused] = await writes(server);
  expect(refused).toMatchObject({ folder, queued: message, state: "refused" });
  expect(refused.steps[0]).toMatchObject({ state: "refused" });
  expect(refused.steps[0].output).toMatch(/lint: 1 problem/);
  expect(existsSync(join(server.repo, PROPOSAL))).toBe(true);
  // The session made for the message goes with it: nothing was started.
  expect(server.sessions.cache.session(sent.data.id)).toBeUndefined();
});

test("a message sent as its start is refused leaves no session made for it", async () => {
  const { hook, server } = await startServer();
  hook.refusing();
  const planned = await start(server, PROPOSAL);
  const { folder, message } = planned.data as Record<string, string>;
  const root = await server.sessions.mainRoot(server.repo);
  // The start is refused while the message's session is made.
  const making = server.sessions.featureSession.bind(server.sessions);
  vi.spyOn(server.sessions, "featureSession").mockImplementationOnce(async (repo, of) => {
    const made = await making(repo, of);
    hook.release();
    await idle(server);
    return made;
  });

  await send(server, folder, message);

  expect(server.sessions.cache.folderSessions(root, folder)).toEqual([]);
});

test("a message sent during a start the server stopped in is never sent", async () => {
  const { hook, server } = await startServer();
  const planned = await start(server, PROPOSAL);
  const { folder, message } = planned.data as Record<string, string>;
  await send(server, folder, message);

  await server.sessions.closeAll();
  hook.release();
  await idle(server);

  // The feature is made without its agent: the message went nowhere, and goes nowhere later.
  expect(git(server.repo, "branch", "--list", folder)).toContain(folder);
  expect(server.adapter.sent).toEqual([]);
  const root = await server.sessions.mainRoot(server.repo);
  expect(server.sessions.cache.folderSessions(root, folder)).toEqual([]);
});

/**
 * The core's binding, whose `readWorkspace` waits, once a start of `slug` is planned, until the test
 * releases it: the start is planned, its write not queued yet.
 */
function heldBeforeQueued() {
  const gate = { folder: "", planned: Promise.withResolvers<void>(), ...Promise.withResolvers() };
  const using = {
    ...binding,
    planStart: async (...args: Parameters<typeof binding.planStart>) => {
      const planned = await binding.planStart(...args);
      gate.folder = planned.folder;
      gate.planned.resolve();
      return planned;
    },
    readWorkspace: async (repo: string) => {
      if (gate.folder !== "") {
        await gate.promise;
      }
      return binding.readWorkspace(repo);
    },
  } as typeof binding;
  return { gate, using };
}

test("a message sent before the start's write is queued is kept for the composer", async () => {
  const { gate, using } = heldBeforeQueued();
  const server = await testServer(undefined, { binding: using });
  const hook = heldHook(server.repo);
  hook.refusing();
  const planning = start(server, PROPOSAL);
  await gate.planned.promise;

  const sent = await send(server, gate.folder, "Go");
  gate.resolve(undefined);
  await planning;
  hook.release();
  await idle(server);

  expect(sent.error).toBeUndefined();
  expect(await writes(server)).toMatchObject([{ queued: "Go", state: "refused" }]);
});

/** A plan as the core made it before midnight, on 2 January 2020. */
const yesterday = (planned: Awaited<ReturnType<typeof binding.planStart>>) => ({
  ...planned,
  branch: `2020-01-02-${planned.slug}`,
  day: "2020-01-02",
  folder: `2020-01-02-${planned.slug}`,
});

test("a start planned before midnight makes the folder its plan answered with", async () => {
  const using = {
    ...binding,
    planStart: async (...args: Parameters<typeof binding.planStart>) =>
      yesterday(await binding.planStart(...args)),
  } as typeof binding;
  const server = await testServer(undefined, { binding: using });

  const planned = await start(server, PROPOSAL);
  await idle(server);

  expect(planned.data.folder).toBe(`2020-01-02-${SLUG}`);
  expect(git(server.repo, "branch", "--list", planned.data.folder)).toContain(planned.data.folder);
});

test("the lists' calls wait for a start's commit, not for its agent", async () => {
  const { hook, server } = await startServer();
  const planned = await start(server, PROPOSAL);
  await send(server, planned.data.folder, planned.data.message);
  // The start's last step, sending the message kept, waits until the test lets it go.
  const sending = Promise.withResolvers<void>();
  const sendNow = server.sessions.send.bind(server.sessions);
  server.sessions.send = async (...args) => {
    await sending.promise;
    return sendNow(...args);
  };
  hook.release();
  await startWrite(server, (write) => write.steps[2].state === "running");

  const [read] = await byId(server.app, "Priorities", ["priorities"], ["id", "hash"]);
  await mutate(server.app, "proposals.add", { hash: read.hash, section: "next", text: "X" }, [
    "id",
  ]);
  const committing = mutate(server.app, "priorities.commit", {}, ["id"]);
  const answered = await Promise.race([
    committing.then(() => "answered"),
    new Promise((resolve) => setTimeout(() => resolve("waiting"), 1000)),
  ]);

  expect(answered).toBe("answered");
  sending.resolve();
  hook.release();
  await committing;
  await idle(server);
  expect(await writes(server)).toEqual([]);
});

test("a typed feature answers once planned with its discovery's message, then lands in one commit", async () => {
  const { hook, server } = await startServer();
  const text = "Dark mode: follow the system theme";
  const typed = (slug: string) =>
    mutate(server.app, "feature.startText", { discovery: "low", slug, text }, PLAN_FIELDS);

  const planned = await typed("dark-mode");

  expect(planned.error).toBeUndefined();
  const folder = planned.data.folder as string;
  expect(folder).toMatch(/^\d{4}-\d{2}-\d{2}-dark-mode$/);
  expect(planned.data).toMatchObject({ id: folder, title: text });
  expect(planned.data.message).toContain(`specs/${folder}/ on branch ${folder}`);
  await startWrite(server, (write) => write.steps[0].output !== undefined);
  // Row: the same slug again is refused at once, while the first start still waits in the queue.
  const again = await typed("dark-mode");
  expect(again.error?.message).toBe("refused: A feature named dark-mode exists already");

  hook.release();
  await idle(server);
  expect(await writes(server)).toEqual([]);
  expect(git(server.repo, "log", "-1", "--format=%s", "main").trim()).toBe(
    `chore(dark-mode): start ${text}`,
  );
  expect(git(server.repo, "show", `main:specs/${folder}/proposal.md`)).toBe(
    `---\ndiscovery: low\n---\n\n# ${text}\n`,
  );
  // Row: the start dialog's research efforts are the core's.
  const [proposal] = await byId(server.app, "SlugProposal", [text], ["id", "discoveryLevels"]);
  expect(proposal.discoveryLevels).toEqual(["low", "medium", "high"]);
});
