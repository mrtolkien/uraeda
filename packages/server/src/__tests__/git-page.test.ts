// The Git page's server side: its writes refused while an agent works in their checkout, and each
// landed in the repository's write queue with git's output.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { GIT_ID } from "../fate.ts";
import type { RepoContext } from "../fate/context.ts";
import { gitMutations } from "../fate/git-mutations.ts";
import type { QueuedWrite } from "../writes/queue.ts";
import { heldHook } from "./held-hook.ts";
import {
  addChange,
  binding,
  byId,
  type Data,
  fixtureRepo,
  git,
  mutate,
  queueWhen,
  testServer,
} from "./helpers.ts";

type Server = Awaited<ReturnType<typeof testServer>>;

const CHAT_WORKS = {
  code: "BAD_REQUEST",
  message: "refused: An agent works in this checkout: wait for its turn to end.",
};

const FEATURE_WORKS = {
  code: "BAD_REQUEST",
  message: "refused: An agent is working on this feature. Stop it first, or wait for it.",
};

/** Sends a message to a session, a chat's or a folder's, which the fake agent keeps running. */
async function send(server: Server, to: { folder: string } | { session: string }) {
  const sent = await mutate(server.app, "session.send", { ...to, text: "Look at it" }, [
    "id",
    "turns",
  ]);
  expect(sent.error).toBeUndefined();
  return sent.data as Record<string, Data>;
}

/** Stops the session's running turn, and waits for it to end. */
async function stop(server: Server, session: Record<string, Data>) {
  server.sessions.stop(server.repo, session.id as string);
  await server.sessions.settled(Number((session.turns as Array<Data>).at(-1)));
}

/** The index and the working tree's state, as `git status` reads them. */
const status = (repo: string) => git(repo, "status", "--porcelain", "--untracked-files=all");

// Break caught: guarding the main checkout with `busy`, which a feature's agent also makes true.
test("the page refuses its writes while a chat works in the checkout", async () => {
  const server = await testServer();
  writeFileSync(join(server.repo, "notes.txt"), "a note\n");
  const chat = (await mutate(server.app, "session.newChat", {}, ["id"])).data as Data;
  const session = await send(server, { session: chat.id });

  const [page] = await byId(server.app, "GitPage", [GIT_ID], ["id", "agentWorking"]);
  expect(page.agentWorking).toBe(true);
  const before = status(server.repo);
  for (const [name, input] of [
    ["git.pull", {}],
    ["git.stage", { folder: null, paths: ["notes.txt"] }],
    ["git.commit", { folder: null, message: "Notes" }],
  ] as const) {
    expect((await mutate(server.app, name, input, ["id"])).error).toEqual(CHAT_WORKS);
  }
  expect(status(server.repo)).toBe(before);

  await stop(server, session);
  const staged = await mutate(server.app, "git.stage", { folder: null, paths: ["notes.txt"] }, [
    "id",
    "agentWorking",
  ]);
  expect(staged.error).toBeUndefined();
  expect(staged.data.agentWorking).toBe(false);
  expect(status(server.repo)).toContain("A  notes.txt");

  // A feature's agent refuses its group's writes, and not the main checkout's.
  const folder = "2026-10-16-centred-x";
  addChange(server.repo, folder, { "proposal.md": "# Centre\n" });
  const feature = await send(server, { folder });
  const refused = await mutate(server.app, "git.stage", { folder, paths: ["x.md"] }, ["id"]);
  expect(refused.error).toEqual(FEATURE_WORKS);
  const unstaged = await mutate(server.app, "git.unstage", { folder: null, paths: ["notes.txt"] }, [
    "id",
  ]);
  expect(unstaged.error).toBeUndefined();
  expect(status(server.repo)).toContain("?? notes.txt");
  await stop(server, feature);
});

/** `repo` with a bare `origin` holding one commit its `main` lacks. */
function oneCommitBehind(repo: string) {
  const origin = temporaryFolder("uraeda-origin");
  git(origin, "clone", "--quiet", "--bare", repo, ".");
  git(repo, "remote", "add", "origin", origin);
  git(repo, "fetch", "--quiet", "origin");
  const other = temporaryFolder("uraeda-other");
  git(other, "clone", "--quiet", origin, ".");
  writeFileSync(join(other, "pulled.txt"), "pulled\n");
  git(other, "add", "pulled.txt");
  git(other, "-c", "user.name=O", "-c", "user.email=o@x", "commit", "--quiet", "-m", "Pulled");
  git(other, "push", "--quiet", "origin", "main");
}

const PULLING = { href: "/git", label: "Pulling" };
const COMMITTING = { href: "/git", label: "Committing" };

test("a pull lands in the queue with its output", async () => {
  const repo = fixtureRepo();
  oneCommitBehind(repo);
  // What the queue's record held as each line of git's output came.
  const seen: Array<Array<QueuedWrite>> = [];
  const holder: { server?: Server } = {};
  const server = await testServer(repo, {
    binding: {
      ...binding,
      gitPull: (at, onOutput) =>
        binding.gitPull(at, (line) => {
          onOutput(line);
          seen.push(holder.server!.hosts.byPath(repo)!.queue.writes());
        }),
    },
  });
  holder.server = server;

  const pulled = await mutate(server.app, "git.pull", { write: PULLING }, ["id", "behind"]);

  expect(pulled.error).toBeUndefined();
  expect(pulled.data.behind).toBe(0);
  expect(seen.length).toBeGreaterThan(0);
  expect(seen.at(-1)).toMatchObject([{ ...PULLING, output: expect.any(String), state: "running" }]);
  expect(git(repo, "log", "-1", "--format=%s")).toBe("Pulled\n");
  const [summary] = await byId(server.app, "GitSummary", [GIT_ID], ["id", "behind"]);
  expect(summary.behind).toBe(0);

  // A commit a hook refuses stays in the queue, with the hook's output.
  const hook = heldHook(repo);
  writeFileSync(join(repo, "notes.txt"), "a note\n");
  expect(
    (await mutate(server.app, "git.stage", { folder: null, paths: ["notes.txt"] }, ["id"])).error,
  ).toBeUndefined();
  hook.refusing(true);
  hook.release();
  const committed = await mutate(
    server.app,
    "git.commit",
    { folder: null, message: "Notes", write: COMMITTING },
    ["id"],
  );
  expect(committed.error?.message).toMatch(/^hook: /);
  const [queue] = await byId(server.app, "WriteQueue", ["write-queue"], ["id", "writes"]);
  expect(queue.writes).toMatchObject([
    { ...COMMITTING, failure: "hook", output: expect.stringContaining("lint: 1 problem") },
  ]);
  expect(git(repo, "log", "-1", "--format=%s")).toBe("Pulled\n");
});

/** The server, its repository's queue, and a held commit of the main checkout, landing. */
async function heldCommit(using = binding) {
  const server = await testServer(fixtureRepo(), { binding: using });
  const host = server.hosts.byPath(server.repo)!;
  const { queue } = host;
  const hook = heldHook(server.repo);
  writeFileSync(join(server.repo, "held.txt"), "held\n");
  expect(
    (await mutate(server.app, "git.stage", { folder: null, paths: ["held.txt"] }, ["id"])).error,
  ).toBeUndefined();
  const committing = mutate(server.app, "git.commit", { folder: null, message: "Held" }, ["id"]);
  await queueWhen(host, (writes) => writes.length === 1 && writes[0].state === "running");
  return { committing, hook, host, queue, server };
}

// Break caught: the guard run only as the write is queued, not again as it lands.
test("a write queued before a chat's turn started is refused as it lands", async () => {
  const { committing, hook, host, queue, server } = await heldCommit();
  writeFileSync(join(server.repo, "notes.txt"), "a note\n");
  const staging = mutate(server.app, "git.stage", { folder: null, paths: ["notes.txt"] }, ["id"]);
  await queueWhen(host, (writes) => writes.length === 2);

  const chat = (await mutate(server.app, "session.newChat", {}, ["id"])).data as Data;
  const session = await send(server, { session: chat.id });
  hook.release();

  expect((await committing).error).toBeUndefined();
  expect((await staging).error).toEqual(CHAT_WORKS);
  expect(status(server.repo)).toContain("?? notes.txt");
  expect(queue.writes()).toMatchObject([
    { output: CHAT_WORKS.message.slice("refused: ".length), state: "refused" },
  ]);
  await stop(server, session);
});

// Break caught: the main checkout's writes keyed `git` alone, which no list's commit waits for.
test("a list's commit waits for the main checkout's git write", async () => {
  const committed: Array<string> = [];
  const { committing, hook, queue, server } = await heldCommit({
    ...binding,
    commitPriorities: (repo) => {
      committed.push("priorities");
      return binding.commitPriorities(repo);
    },
  });

  const priorities = mutate(server.app, "priorities.commit", {}, ["id"]);
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(committed).toEqual([]);

  hook.release();
  await committing;
  await priorities;
  await queue.idle();
  expect(committed).toEqual(["priorities"]);
});

// Review I2. Break caught: the guard awaited before the write is queued, so a commit whose guard
// answers first lands before the staging asked for before it, and commits nothing.
test("the page's writes are queued in the order they came", async () => {
  const server = await testServer();
  writeFileSync(join(server.repo, "notes.txt"), "a note\n");
  const root = await server.sessions.mainRoot(server.repo);
  // The first guard's read of the main checkout answers late, as an uncached read does.
  const late = Promise.withResolvers<string>();
  let reads = 0;
  const sessions = {
    chatWorking: (repo: string) => server.sessions.chatWorking(repo),
    mainRoot: () => (++reads === 1 ? late.promise : Promise.resolve(root)),
    working: (repo: string) => server.sessions.working(repo),
  };
  const ctx = { ...server, binding, sessions } as unknown as RepoContext;

  const staging = gitMutations["git.stage"].resolve({
    ctx,
    input: { folder: null, paths: ["notes.txt"] },
    select: ["id"],
  });
  const committing = gitMutations["git.commit"].resolve({
    ctx,
    input: { folder: null, message: "Notes" },
    select: ["id"],
  });
  // Every guard that could answer has: only the first read is still out.
  await new Promise((resolve) => setImmediate(resolve));
  late.resolve(root);

  const settled = await Promise.allSettled([staging, committing]);
  expect(settled.map(({ status }) => status)).toEqual(["fulfilled", "fulfilled"]);
  expect(git(server.repo, "show", "--name-only", "--format=%s", "HEAD")).toBe(
    "Notes\n\nnotes.txt\n",
  );
});

// Review minor. Break caught: the queue's arrivals chained on the refused step, so the write after
// it is refused with the same answer, never queued.
test("a write its guard refuses lets the next one queue", async () => {
  const server = await testServer();
  writeFileSync(join(server.repo, "notes.txt"), "a note\n");
  // Only the first guard finds a chat's agent at work.
  let checks = 0;
  const sessions = {
    chatWorking: (repo: string) => ++checks === 1 || server.sessions.chatWorking(repo),
    mainRoot: (repo: string) => server.sessions.mainRoot(repo),
    working: (repo: string) => server.sessions.working(repo),
  };
  const ctx = { ...server, binding, sessions } as unknown as RepoContext;
  const stage = () =>
    gitMutations["git.stage"].resolve({
      ctx,
      input: { folder: null, paths: ["notes.txt"] },
      select: ["id"],
    });

  const settled = await Promise.allSettled([stage(), stage()]);

  expect(settled.map(({ status }) => status)).toEqual(["rejected", "fulfilled"]);
  expect(git(server.repo, "diff", "--cached", "--name-only")).toBe("notes.txt\n");
});
