// The write queue: a commit answers once its files are written, and the commits land behind it,
// one after another, in order, published in the repository's `WriteQueue` record.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { WriteQueue } from "../writes/queue.ts";
import { byId, fixtureRepo, git, mutate, testApp } from "./helpers.ts";

const FOLDER = "2026-10-06-recurring-tasks";
const APPROVING = {
  href: `/features/${FOLDER}/spec.md`,
  label: "Approving the spec of Recurring tasks",
};

/**
 * A pre-commit hook in `repo` that waits until released, and refuses the commits made while
 * `refusing`, printing "lint: 1 problem".
 */
function heldHook(repo: string) {
  const folder = temporaryFolder("uraeda-hook");
  const gate = join(folder, "gate");
  const refuse = join(folder, "refuse");
  const hook = join(repo, ".git/hooks/pre-commit");
  mkdirSync(dirname(hook), { recursive: true });
  writeFileSync(
    hook,
    `#!/bin/sh\nwhile [ ! -e "${gate}" ]; do sleep 0.02; done\n` +
      `if [ -e "${refuse}" ]; then echo "lint: 1 problem"; exit 1; fi\n`,
    { mode: 0o755 },
  );
  return {
    refusing: (on: boolean) => (on ? writeFileSync(refuse, "") : rmSync(refuse)),
    release: () => writeFileSync(gate, ""),
  };
}

/** The writes of the repository's queue, as a client reads them. */
async function writes(app: Awaited<ReturnType<typeof testApp>>["app"]) {
  const [queue] = await byId(app, "WriteQueue", ["write-queue"], ["id", "writes"]);
  return queue.writes;
}

test("a commit answers with its written files, then lands in the queue", async () => {
  const repo = fixtureRepo();
  const hook = heldHook(repo);
  const { app, hosts, name } = await testApp(repo);

  const approved = await mutate(
    app,
    "review.approve",
    { file: "spec.md", folder: FOLDER, write: APPROVING },
    ["id", "status"],
  );

  expect(approved.error).toBeUndefined();
  expect(approved.data.status).toBe("approved");
  expect(await writes(app)).toMatchObject([
    { ...APPROVING, file: "spec.md", folder: FOLDER, state: "running" },
  ]);
  hook.release();
  await hosts.get(name)!.queue.idle();
  expect(await writes(app)).toEqual([]);
  expect(git(repo, "log", "-1", "--format=%s", FOLDER)).toMatch(/approve/);
  expect(git(repo, "show", `${FOLDER}:specs/${FOLDER}/spec.md`)).toMatch(/status: approved/);
});

/** A landing the test settles: `landed` resolves it, `refused` rejects it as a hook would. */
function heldLanding() {
  const { promise, reject, resolve } = Promise.withResolvers<void>();
  return { land: promise, landed: () => resolve(), refused: () => reject(new Error("hook: no")) };
}

/**
 * A queue over a core whose landings the test settles, and its calls in order: each committing
 * call's write, each landing's start and end. A write of `id` defers the commit `id`.
 */
function heldQueue(ids: Array<string>) {
  const calls: Array<string> = [];
  const landings = new Map(ids.map((id) => [id, heldLanding()]));
  const deferred: Array<string> = [];
  const queue = new WriteQueue(
    {
      land: async (id) => {
        calls.push(`land ${id}`);
        await landings.get(id)!.land;
        calls.push(`landed ${id}`);
      },
      takeDeferred: () =>
        deferred
          .splice(0)
          .map((id) => ({ id, paths: [`specs/${id}.md`], subject: `commit ${id}` })),
    },
    () => {},
  );
  const write = (keys: Array<string>, id: string) =>
    queue.commit(keys, undefined, async () => {
      calls.push(`write ${id}`);
      deferred.push(id);
    });
  const states = () => queue.writes().map(({ label, state }) => `${label} ${state}`);
  return { calls, landings, queue, states, write };
}

/** Lets the queue's settled promises and the calls they start run. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

/** Adds a proposal to the priorities, then commits them, named `label`. */
async function addAndCommit(app: Awaited<ReturnType<typeof testApp>>["app"], text: string) {
  const [read] = await byId(app, "Priorities", ["priorities"], ["id", "hash"]);
  await mutate(app, "proposals.add", { hash: read.hash, section: "next", text }, ["id"]);
  const write = { href: "/priorities", label: `Committing ${text}` };
  await mutate(app, "priorities.commit", { write }, ["id"]);
}

test("writes land in order, and a refused one does not stop the next", async () => {
  const repo = fixtureRepo();
  const hook = heldHook(repo);
  hook.release();
  const { app, hosts, name } = await testApp(repo);
  const queue = hosts.get(name)!.queue;

  hook.refusing(true);
  await addAndCommit(app, "First");
  await queue.idle();
  hook.refusing(false);
  await addAndCommit(app, "Second");
  await addAndCommit(app, "Third");
  await queue.idle();

  const refused = await writes(app);
  expect(refused).toMatchObject([{ label: "Committing First", state: "refused" }]);
  expect(refused[0].output).toMatch(/lint: 1 problem/);
  // Another tab, reading the record, gets the same.
  expect(await writes(app)).toEqual(refused);
  // The refused commit's proposal stays written, and goes with the next commit; the third commit
  // amends the second, as a run of the lists' edits does: it landed after it.
  expect(git(repo, "log", "-1", "--format=%s%n%b").trim().split("\n")).toEqual([
    expect.stringMatching(/First.*and 2 more$/),
    expect.stringMatching(/First/),
    expect.stringMatching(/Second/),
    expect.stringMatching(/Third/),
  ]);
  await mutate(app, "writes.dismiss", { id: refused[0].id }, ["id"]);
  expect(await writes(app)).toEqual([]);

  // Row: queued commits land one at a time, in order; a write waits for its keys' commits.
  const held = heldQueue(["1", "2", "3"]);
  await held.write(["a"], "1");
  await held.write(["b"], "2");
  const third = held.write(["a"], "3");
  await settle();
  expect(held.calls).toEqual(["write 1", "land 1", "write 2"]);
  expect(held.states()).toEqual(["commit 1 running", "commit 2 waiting"]);
  held.landings.get("1")!.refused();
  await settle();
  expect(held.calls.slice(3)).toEqual(["land 2", "write 3"]);
  held.landings.get("2")!.landed();
  held.landings.get("3")!.landed();
  await third;
  await held.queue.idle();
  expect(held.calls.slice(5)).toEqual(["landed 2", "land 3", "landed 3"]);
  expect(held.states()).toEqual(["commit 1 refused"]);
});
