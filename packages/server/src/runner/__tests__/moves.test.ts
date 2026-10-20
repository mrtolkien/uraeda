import { afterEach, expect, test, vi } from "vite-plus/test";
import type { AgentEvent } from "../events.ts";
import { editedFiles, movedOpening } from "../moves.ts";
import { TERMINATE_AFTER_MS } from "../sessions.ts";
import { flush, testSessions } from "./helpers.ts";

/** The core's binding, as one object: the server takes it whole. */
const binding = await import("uraeda-binding");

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";

afterEach(() => {
  vi.useRealTimers();
});

/** A tool call that ends, as `isError` says. */
function tool(id: string, name: string, target: string, isError = false): Array<AgentEvent> {
  const kind = name === "Read" ? "read" : name === "Bash" ? "execute" : "edit";
  return [
    { id, input: {}, kind, name, target, type: "toolStart" },
    { id, isError, output: "", type: "toolEnd" },
  ];
}

/** Review focus 1: the folder a session moves to is read by its next turn, even with a process open. */
test("after the move, the next turn runs in the worktree", async () => {
  const { adapter, cache, changes, repo, sessions } = await testSessions();
  const chat = await sessions.newChat(repo);
  adapter.script([]);
  await sessions.settled((await sessions.send(repo, chat.id, { text: "Hello" })).turn);
  expect(adapter.opens[0]?.cwd).toBe(repo);

  // The closed process lingers: the session stays in memory, with the folder it had.
  adapter.ignoreClose = true;

  await sessions.attach(repo, chat.id, AGENT);

  expect(cache.session(chat.id)?.folder).toBe(AGENT);
  expect(adapter.closes).toBe(1);
  expect(sessions.held(chat.id)).toBe(true);
  adapter.script([]);
  const sent = sessions.send(repo, chat.id, { text: "Go on" });
  await flush();
  vi.advanceTimersByTime(TERMINATE_AFTER_MS);
  const { turn } = await sent;
  await sessions.settled(turn);
  expect(adapter.opens).toHaveLength(2);
  expect(adapter.opens[1]).toMatchObject({
    cwd: await binding.workDir(repo, AGENT),
    nativeId: chat.nativeId,
    resume: true,
  });
  expect(changes).toContainEqual({ folder: AGENT, repo: chat.repo, session: chat.id, turn });
});

/** US2 more 2: a session moves only between turns. */
test("a working session does not move", async () => {
  const { cache, repo, sessions } = await testSessions();
  const chat = await sessions.newChat(repo);
  await sessions.send(repo, chat.id, { text: "Hello" });

  await expect(sessions.attach(repo, chat.id, AGENT)).rejects.toThrow(
    "refused: The agent is working",
  );
  expect(cache.session(chat.id)?.folder).toBeNull();
});

/** US2.2: the opening tells the agent what to carry over, and what to merge by hand. */
test("the opening names the files the session edited", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const chat = await sessions.newChat(repo);
  adapter.script([
    ...tool("edit-1", "Edit", "src/auth/guard.ts"),
    ...tool("read-1", "Read", "README.md"),
  ]);
  await sessions.settled((await sessions.send(repo, chat.id, { text: "Fix it" })).turn);

  const edited = editedFiles(cache, chat.id);
  const opening = movedOpening({
    branch: "change/2026-10-20-login-redirect",
    edited,
    folder: "2026-10-20-login-redirect",
    worktree: "/repo/.worktrees/2026-10-20-login-redirect",
  });

  expect(edited).toEqual(["src/auth/guard.ts"]);
  expect(opening).toBe(
    "This session is now the change specs/changes/2026-10-20-login-redirect/, on branch " +
      "change/2026-10-20-login-redirect, in its worktree /repo/.worktrees/2026-10-20-login-redirect: " +
      "work there from now on, not in the main checkout. You edited these files in the main " +
      "checkout: src/auth/guard.ts. Carry each over to the worktree, then restore it in the main " +
      "checkout, unless it changed there since your edit: then leave it there, and merge your edit " +
      "into the worktree's copy by hand.",
  );
});

test("the opening tells to merge by hand", () => {
  const opening = movedOpening({
    branch: "change/2026-10-20-login-redirect",
    edited: ["src/auth/guard.ts"],
    folder: "2026-10-20-login-redirect",
    worktree: "/repo/.worktrees/2026-10-20-login-redirect",
  });

  expect(opening).toContain("merge your edit into the worktree's copy by hand");
});

test("a session that edited nothing is told only where it works", () => {
  expect(
    movedOpening({
      branch: "change/2026-10-20-login-redirect",
      edited: [],
      folder: "2026-10-20-login-redirect",
      worktree: "/repo/.worktrees/2026-10-20-login-redirect",
    }),
  ).toBe(
    "This session is now the change specs/changes/2026-10-20-login-redirect/, on branch " +
      "change/2026-10-20-login-redirect, in its worktree /repo/.worktrees/2026-10-20-login-redirect: " +
      "work there from now on, not in the main checkout.",
  );
});

/** SC-003: no file the human edited is named, so none is moved or reverted. */
test("only the session's files are named", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const chat = await sessions.newChat(repo);
  const other = await sessions.newChat(repo);
  adapter.script([
    ...tool("edit-1", "Edit", "src/auth/guard.ts"),
    ...tool("write-1", "Write", "src/auth/redirect.ts"),
    ...tool("edit-2", "MultiEdit", "src/auth/guard.ts"),
    ...tool("edit-3", "Edit", "src/failed.ts", true),
    ...tool("edit-4", "Edit", "/etc/hosts"),
    ...tool("bash-1", "Bash", "sed -i s/a/b/ README.md"),
  ]);
  await sessions.settled((await sessions.send(repo, chat.id, { text: "Fix it" })).turn);
  adapter.script([...tool("edit-5", "Edit", "src/other.ts")]);
  await sessions.settled((await sessions.send(repo, other.id, { text: "And this" })).turn);

  expect(editedFiles(cache, chat.id)).toEqual(["src/auth/guard.ts", "src/auth/redirect.ts"]);
});
