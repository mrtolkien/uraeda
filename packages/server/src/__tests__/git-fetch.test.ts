// The fetcher: each repository fetched every 5 minutes in its write queue, outside the toast, its
// last failure kept for the Git page until a fetch succeeds.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { GIT_ID } from "../fate.ts";
import { FETCH_EVERY_MS } from "../git-fetch.ts";
import { binding, byId, fixtureRepo, git, mutate, testServer } from "./helpers.ts";

afterEach(() => vi.useRealTimers());

/** `repo` with a bare `origin`, fetched, and a clone of it that pushes. */
function withOrigin(repo: string) {
  const origin = temporaryFolder("uraeda-origin");
  git(origin, "clone", "--quiet", "--bare", repo, ".");
  git(repo, "remote", "add", "origin", origin);
  git(repo, "fetch", "--quiet", "origin");
  const other = temporaryFolder("uraeda-other");
  git(other, "clone", "--quiet", origin, ".");
  writeFileSync(join(other, "pulled.txt"), "pulled\n");
  git(other, "add", "pulled.txt");
  git(other, "-c", "user.name=O", "-c", "user.email=o@x", "commit", "--quiet", "-m", "Pulled");
  return { origin, push: () => git(other, "push", "--quiet", "origin", "main") };
}

// Break caught: enqueueing the fetch as a record's write, which `writes()` then holds.
test("the fetcher fetches every 5 minutes, outside the toast", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const repo = fixtureRepo();
  const { origin, push } = withOrigin(repo);
  // What the queue's record held while each fetch ran.
  const seen: Array<unknown> = [];
  const holder: { queue?: () => Array<unknown> } = {};
  const server = await testServer(repo, {
    binding: {
      ...binding,
      gitFetch: (at, onOutput) => {
        seen.push(...(holder.queue?.() ?? []));
        return binding.gitFetch(at, onOutput);
      },
    },
  });
  const { queue } = server.hosts.byPath(repo)!;
  holder.queue = () => queue.writes();
  /** Lets the 5 minutes pass, and the fetch they start land. */
  const fiveMinutes = async () => {
    vi.advanceTimersByTime(FETCH_EVERY_MS);
    await queue.idle();
  };
  const page = async () => (await byId(server.app, "GitPage", [GIT_ID], ["id", "fetchFailure"]))[0];
  await queue.idle();

  push();
  await fiveMinutes();
  const [summary] = await byId(server.app, "GitSummary", [GIT_ID], ["id", "behind"]);
  expect(summary.behind).toBe(1);
  expect((await page()).fetchFailure).toBeNull();

  // A failing fetch keeps its message for the page, and never shows in the queue nor blocks it.
  git(repo, "remote", "set-url", "origin", join(origin, "missing"));
  await fiveMinutes();
  expect((await page()).fetchFailure).toEqual(expect.any(String));
  writeFileSync(join(repo, "notes.txt"), "a note\n");
  const staged = await mutate(server.app, "git.stage", { folder: null, paths: ["notes.txt"] }, [
    "id",
  ]);
  expect(staged.error).toBeUndefined();
  expect(seen).toEqual([]);
  expect(queue.writes()).toEqual([]);

  git(repo, "remote", "set-url", "origin", origin);
  await fiveMinutes();
  expect((await page()).fetchFailure).toBeNull();
});

test("a quiet fetch that fails answers the page, and logs nothing", async () => {
  const repo = fixtureRepo();
  withOrigin(repo);
  git(repo, "remote", "set-url", "origin", join(repo, "missing"));
  const server = await testServer(repo);
  await server.hosts.byPath(repo)!.queue.idle();
  const logged = vi.spyOn(process.stderr, "write");

  const fetched = await mutate(server.app, "git.fetch", { quiet: true }, ["id", "fetchFailure"]);

  expect(fetched.error).toBeUndefined();
  expect(fetched.data.fetchFailure).toEqual(expect.any(String));
  expect(logged.mock.calls.flat().join("")).not.toContain("A binding call failed");
  logged.mockRestore();
});
