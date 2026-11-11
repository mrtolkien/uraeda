// Writes `old.sqlite`, beside this file: a `runner.sqlite` as the Node server's own store writes
// one, which `ura import-sessions` is tested on (`crates/server/tests/runner_store.rs`).
//
//   nix develop -c node fixtures/runner/write-old.ts
//
// It drives `SessionCache`, the store of `packages/server/src/runner/`, and writes no row by hand:
// what the file holds is what that code writes, at its latest schema. It works in a temporary
// folder, and never opens a real data folder. The clock and the IDs are fixed, so a second run
// writes the same sessions: the test asserts their IDs, their times, and their texts.
//
// What it holds, so that the import is tested on each:
// - a feature's session with a model, an effort, a step, and an account; a sub-session of it; a
//   chat without a folder, archived and seen; a session another server's process holds;
// - turns of each kind (workflow, chat, allow) and each state (done, failed, stopped, queued,
//   running), with tokens, a dismissal, a catch-up's commit, a continue that waits, one past the
//   cap, and a run the server's stop cut;
// - items of each kind: messages of the human and the workflow, pending, read, and taken back,
//   with an opening, with images, and without a time; texts, whole and cut mid-stream; tool calls
//   completed, failed, and left in progress, a sub-agent's and its own calls; thoughts with and
//   without a text; system lines; blocked actions, one waiting to be allowed, one allowed, one no
//   rule can allow;
// - the scheduled jobs' runs: started with its offer refused, skipped for an open change, failed
//   to start, and run by hand;
// - text outside ASCII.
import crypto from "node:crypto";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// A fixed clock: 2026-11-01 at 09:00 UTC, one second later at each reading.
const SystemDate = Date;
let clock = SystemDate.UTC(2026, 10, 1, 9, 0, 0);
globalThis.Date = class extends SystemDate {
  constructor(...given: Array<unknown>) {
    if (given.length === 0) {
      super(clock);
      clock += 1000;
    } else {
      super(...(given as [number]));
    }
  }
  static override now() {
    return clock;
  }
} as DateConstructor;

// Fixed IDs: sessions are numbered in the order they are made.
let made = 0;
crypto.randomUUID = () =>
  `00000000-0000-4000-8000-${String(++made).padStart(12, "0")}` as ReturnType<
    typeof crypto.randomUUID
  >;
syncBuiltinESMExports();

const { SessionCache } = await import("../../packages/server/src/runner/cache.ts");
const { CLEARED, SERVER_STOPPED, TAKEN_BACK } = await import(
  "../../packages/server/src/runner/session-state.ts"
);

const folder = mkdtempSync(join(tmpdir(), "uraeda-old-store-"));
const file = join(folder, "runner.sqlite");
const cache = SessionCache.open(file);
const repo = "/home/sample/todo";
const feature = "2026-10-06-recurring-tasks";

// --- A feature's session ---
const spec = cache.createSession({
  agent: "claude",
  effort: "high",
  folder: feature,
  model: "opus",
  nativeId: "native-spec",
  repo,
  step: "spec",
  title: null,
});
cache.updateSession(spec.id, { ranEffort: "High", ranModel: "Opus 5" });

// A workflow turn that ended well: every kind of item the agent's work leaves.
const discovery = cache.addTurn({
  allowed: null,
  kind: "workflow",
  sessionId: spec.id,
  state: "running",
  step: "discovery",
  trigger: "start",
});
cache.appendItem(discovery, { kind: "system", text: CLEARED });
cache.appendItem(discovery, {
  at: "2026-11-01T09:00:02.500Z",
  id: "message-start",
  kind: "message",
  opening: "A human is chatting with you about the feature.",
  origin: "workflow",
  state: "read",
  text: "/uraeda Continue the feature specs/2026-10-06-recurring-tasks/",
});
cache.appendItem(discovery, {
  durationMs: 2300,
  kind: "thought",
  text: "Les tâches récurrentes : faut-il une règle par fuseau horaire ?",
});
const read = cache.appendItem(discovery, {
  id: "tool-read",
  kind: "tool",
  name: "Read",
  status: "in_progress",
  target: "specs/PRIORITIES.md",
  toolKind: "read",
});
cache.updateItem(discovery, read, {
  durationMs: 40,
  id: "tool-read",
  kind: "tool",
  name: "Read",
  output: "# Priorities\n\n- Recurring tasks\n",
  status: "completed",
  target: "specs/PRIORITIES.md",
  toolKind: "read",
});
cache.appendItem(discovery, {
  durationMs: 61_000,
  id: "tool-agent",
  kind: "tool",
  name: "Agent",
  output: "The parser has no rule for a month's last day.",
  status: "completed",
  subagent: { description: "Read the parser" },
  toolKind: "think",
});
cache.appendItem(discovery, {
  durationMs: 1200,
  id: "tool-bash",
  kind: "tool",
  name: "Bash",
  output: "error: no such file",
  parent: "tool-agent",
  status: "failed",
  target: "cat src/parser.rs",
  toolKind: "execute",
});
cache.appendItem(discovery, { durationMs: 0, kind: "thought", parent: "tool-agent" });
cache.appendItem(discovery, { kind: "system", text: "Rate limited, retrying in 12 s." });
cache.appendItem(discovery, {
  kind: "text",
  streaming: false,
  text: "Trois questions vous attendent — 質問は三つです 🎉",
});
cache.addTurnTokens(discovery, { cacheRead: 9000, cacheWrite: 1200, input: 340, output: 5600 });
cache.endTurn(discovery, { state: "done" });

// A chat turn that failed, with its blocked actions: one waits to be allowed, one was allowed, one
// has no rule.
const chat = cache.addTurn({
  allowed: null,
  kind: "chat",
  sessionId: spec.id,
  state: "running",
  step: null,
  trigger: null,
});
cache.appendItem(chat, {
  at: "2026-11-01T09:10:00.000Z",
  id: "message-chat",
  images: [{ height: 600, id: "11111111-2222-4333-8444-555555555555.webp", width: 800 }],
  kind: "message",
  origin: "human",
  state: "read",
  text: "Où est le réglage ? Voir l'image.",
});
// A message steered into the turn, which the agent never read.
cache.appendItem(chat, {
  at: "2026-11-01T09:10:30.000Z",
  id: "message-steer",
  kind: "message",
  origin: "human",
  state: "taken-back",
  text: "Never mind.",
});
cache.appendItem(chat, { kind: "text", streaming: false, text: "I need to change two files." });
cache.appendItem(chat, {
  allowed: false,
  kind: "denial",
  rule: "Edit(src/settings.rs)",
  target: "src/settings.rs",
  tool: "Edit",
});
cache.appendItem(chat, {
  allowed: true,
  kind: "denial",
  rule: "Bash(cargo test)",
  target: "cargo test",
  tool: "Bash",
});
cache.appendItem(chat, { allowed: false, kind: "denial", tool: "WebFetch" });
cache.endTurn(chat, { reason: "Claude Code ended the turn with an error.", state: "failed" });

// An allow turn the server's stop cut mid-stream, dismissed since: a text and a tool call left
// open, and a message written before its time was kept.
const allow = cache.addTurn({
  allowed: "Bash(cargo test)",
  caughtUpTo: "0123456789abcdef0123456789abcdef01234567",
  kind: "allow",
  sessionId: spec.id,
  state: "running",
  step: null,
  trigger: null,
});
cache.appendItem(allow, {
  id: "message-allow",
  kind: "message",
  origin: "human",
  state: "read",
  text: "Try the blocked action again, now allowed: Bash cargo test",
});
cache.appendItem(allow, {
  id: "tool-test",
  kind: "tool",
  name: "Bash",
  status: "in_progress",
  target: "cargo test",
  toolKind: "execute",
});
cache.appendItem(allow, { kind: "text", streaming: true, text: "Running the tests, the fir" });
cache.endTurn(allow, { reason: SERVER_STOPPED, state: "stopped" });
cache.dismiss(allow);

// A turn that waits behind another: its message is not written to the agent yet.
const queued = cache.addTurn({
  allowed: null,
  kind: "workflow",
  sessionId: spec.id,
  state: "queued",
  step: "spec",
  trigger: "answers",
});
cache.appendItem(queued, { kind: "system", text: "Continued after the server restarted." });
cache.appendItem(queued, {
  at: "2026-11-01T09:20:00.000Z",
  id: "message-queued",
  kind: "message",
  origin: "workflow",
  state: "pending",
  text: "The server restarted while you worked. Continue where you left off.",
});
cache.addContinue(spec.id);
cache.addContinue(spec.id);

// --- A sub-session of the feature's session ---
const implementer = cache.createSession({
  agent: "codex",
  folder: feature,
  model: "gpt-6",
  nativeId: "native-implementer",
  parent: spec.id,
  repo,
  role: "implementer",
  step: "build",
  title: "Task 3: the parser",
  worktree: "/home/sample/todo/.worktrees/2026-10-06-recurring-tasks-task-3",
});
const built = cache.addTurn({
  allowed: null,
  kind: "workflow",
  sessionId: implementer.id,
  state: "running",
  step: "implementation",
  trigger: "manual",
});
cache.appendItem(built, { kind: "text", streaming: false, text: "Task 3 is committed." });
cache.endTurn(built, { state: "done" });
// A run its agent's limit failed, which waits to continue by itself.
const limited = cache.addTurn({
  allowed: null,
  kind: "workflow",
  sessionId: implementer.id,
  state: "running",
  step: "implementation",
  trigger: "next-step",
});
cache.appendItem(limited, { kind: "system", text: "You've hit your session limit." });
cache.endTurn(limited, { reason: "You've hit your session limit.", state: "failed" });
cache.scheduleContinue(limited, SystemDate.UTC(2026, 10, 1, 14, 0, 0), "limit", TAKEN_BACK);

// --- A chat without a folder, archived and seen ---
const question = cache.createSession({
  agent: "claude",
  folder: null,
  nativeId: "native-chat",
  repo,
  title: "Où est le réglage ?",
});
const answer = cache.addTurn({
  allowed: null,
  kind: "chat",
  sessionId: question.id,
  state: "running",
  step: null,
  trigger: null,
});
cache.appendItem(answer, {
  at: "2026-11-01T09:30:00.000Z",
  id: "message-question",
  kind: "message",
  origin: "human",
  state: "read",
  text: "Où est le réglage ?",
});
cache.appendItem(answer, { durationMs: 900, kind: "thought" });
cache.appendItem(answer, { kind: "text", streaming: false, text: "Dans Réglages › Thème." });
cache.endTurn(answer, { state: "stopped" });
// It would have continued, past the cap.
cache.markCapped(answer, "restart", TAKEN_BACK);
cache.updateSession(question.id, {
  archivedAt: "2026-11-01T10:00:00.000Z",
  seenAt: "2026-11-01T09:45:00.000Z",
});

// --- A session whose turn still runs, held by another server's process ---
const running = cache.createSession({
  agent: "claude",
  folder: "changes/2026-10-30-fix-login",
  nativeId: "native-running",
  repo,
  title: null,
});
SessionCache.open(file, { pid: 4242 }).claimSession(running.id);
const working = cache.addTurn({
  allowed: null,
  kind: "workflow",
  sessionId: running.id,
  state: "running",
  step: "change",
  trigger: "proposal",
});
cache.appendItem(working, {
  at: "2026-11-01T09:40:00.000Z",
  id: "message-running",
  kind: "message",
  origin: "workflow",
  state: "read",
  text: "/uraeda Continue the change specs/changes/2026-10-30-fix-login/",
});
cache.appendItem(working, { kind: "text", streaming: true, text: "Looking at the redir" });

// --- Last, so that everything above keeps its IDs and times: a run the server's stop cut, which
// nobody dismissed and no continue was decided for. A server continues it at its next start. ---
const cut = cache.addTurn({
  allowed: null,
  kind: "workflow",
  sessionId: implementer.id,
  state: "running",
  step: "implementation",
  trigger: "manual",
});
cache.appendItem(cut, { kind: "text", streaming: false, text: "Starting task 4." });
cache.endTurn(cut, { reason: SERVER_STOPPED, state: "stopped" });

// The account the feature's session runs on, a configuration folder: set last, as a session's
// first turn stores it, so that nothing above changes.
cache.updateSession(spec.id, { account: "/home/sample/.claude-b" });

// --- The scheduled jobs' runs, after the rest: a run that started the chat and had its offer
// refused, a time skipped for an open change, a start that failed, and a run by hand. ---
const due = (hour: number) => SystemDate.UTC(2026, 10, 1, hour, 0, 0);
const run = cache.jobs.add({
  at: due(3),
  due: due(3),
  job: "Dépendances",
  outcome: "started",
  reason: null,
  repository: repo,
  session: question.id,
  trigger: "schedule",
});
cache.jobs.setRefusal(run!.id, { text: "A branch named fix-login exists.", turn: answer });
cache.jobs.add({
  at: due(4),
  blockedBy: "changes/2026-10-30-fix-login",
  due: due(4),
  job: "Dépendances",
  outcome: "skipped",
  reason: "change-open",
  repository: repo,
  session: null,
  trigger: "schedule",
});
cache.jobs.add({
  at: due(5),
  due: due(5),
  error: "the model opus-9 is not listed",
  job: "Dépendances",
  outcome: "failed",
  reason: null,
  repository: repo,
  session: null,
  trigger: "schedule",
});
cache.jobs.add({
  at: due(6),
  due: null,
  job: "Performance",
  outcome: "started",
  reason: null,
  repository: repo,
  session: running.id,
  trigger: "manual",
});

// One file, as a server that stopped leaves it: the write-ahead log is folded in.
cache.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
cache.db.close();
copyFileSync(file, join(here, "old.sqlite"));
rmSync(folder, { force: true, recursive: true });
console.log(`wrote ${join(here, "old.sqlite")}`);
