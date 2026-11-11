// Writes, for each exchange with Codex kept here, the events the Node server's runtime makes of
// it: what `crates/server/tests/codex.rs` compares the Rust runtime's events with, one by one.
//
//   nix develop -c node fixtures/runtimes/codex/node-events.ts
//
// It runs no agent. It drives `CodexAdapter`, of `packages/server/src/runner/codex.ts`, on
// `stand-in.mjs`, which replays an exchange: it opens the process as the exchange's first line
// says, sends its message, closes the process at its result, and writes every event it read to
// `<name>.events.jsonl`, the session's folder as `/session-dir`. It writes no event by hand.
// Run it again after `record.ts`, or after a change to the Node runtime.
//
// The stand-in waits a moment before each line it writes, so the runtime reads each alone, as it
// does from Codex, which takes its time: the order of two events never depends on two lines read
// at once.
//
// It first writes the two exchanges of `written/`, which `record.ts` does not record:
//
// - `approved.jsonl`: an action Codex's reviewer approved. Its notifications are the exchange the
//   Node server's tests hold, recorded from Codex 0.163.0, as they are:
//   `packages/server/src/runner/__tests__/fixtures/codex-turn.jsonl`. The requests and answers
//   before them are written by hand, in the shape `record.ts` records.
// - `denied.jsonl`: an action its reviewer refused. No exchange was recorded for it: it is
//   `approved.jsonl` with the review's verdict, the command, and its end changed by hand.
// - `items.jsonl` and `limits.jsonl`: notifications written by hand, in `written.ts`, for what
//   no recording shows: the cases of the Node runtime's tests, each kind of item, Codex's own
//   sub-agents, the reviews' other ends, the usage windows, and the limits.
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CodexAdapter } from "../../../packages/server/src/runner/codex.ts";
import { ITEMS, LIMITS } from "./written.ts";

type Json = Record<string, unknown>;

const here = dirname(fileURLToPath(import.meta.url));
const standIn = join(here, "stand-in.mjs");

process.env.URAEDA_STAND_IN_PACE_MS = "5";

const THREAD = "01a1bba7-37d5-70b2-a846-298e7aa9fa2a";
const TURN = "01a1bba7-3854-7a40-b64d-4291bac94b14";
const COMMIT = "git add a.txt && git commit -m 'add a'";
const PUSH = "git push origin main";
const APPROVED =
  "The user explicitly requested adding a.txt and creating this exact local commit; the scoped " +
  "Git mutation is bounded and authorized.";

/** The lines of a file, each read as JSON. */
function jsonLines(path: string): Array<Json> {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Json);
}

/** An exchange's text: one line each. */
const text = (lines: Array<unknown>) => lines.map((line) => `${JSON.stringify(line)}\n`).join("");

/** The start of an exchange, as Codex 0.163.0 answers it, up to its thread's start. */
function handshake(): Array<Json> {
  const model = {
    defaultReasoningEffort: "medium",
    description: "Fast.",
    displayName: "GPT-6-Luna",
    hidden: false,
    id: "gpt-6-luna",
    isDefault: true,
    model: "gpt-6-luna",
    supportedReasoningEfforts: [{ reasoningEffort: "low" }, { reasoningEffort: "medium" }],
  };
  const applied = {
    approvalPolicy: "on-request",
    approvalsReviewer: "auto_review",
    cwd: "/work/project",
    model: "gpt-6-luna",
    reasoningEffort: "medium",
    sandbox: {
      excludeSlashTmp: false,
      excludeTmpdirEnvVar: false,
      networkAccess: false,
      type: "workspaceWrite",
      writableRoots: [],
    },
    thread: { id: THREAD },
  };
  return [
    { client: { id: 1, method: "initialize" } },
    { server: { id: 1, result: { platformFamily: "unix", platformOs: "linux" } } },
    { client: { method: "initialized" } },
    { client: { id: 2, method: "skills/extraRoots/set" } },
    { server: { id: 2, result: {} } },
    { client: { id: 3, method: "model/list" } },
    { client: { id: 4, method: "config/read" } },
    { server: { id: 3, result: { data: [model], nextCursor: null } } },
    { server: { id: 4, result: { config: { model: "gpt-6-luna" } } } },
    { client: { id: 5, method: "thread/start" } },
    { server: { id: 5, result: applied } },
  ];
}

/** Writes the exchanges of `written/`. */
function writeWritten() {
  const tests = join(here, "../../../packages/server/src/runner/__tests__/fixtures");
  const recorded = jsonLines(join(tests, "codex-turn.jsonl"));
  // The thread's start and its settings come before the turn is asked for.
  const before = recorded.slice(0, 3).map((server) => ({ server }));
  const after = recorded.slice(3).map((server) => ({ server }));
  const turn = [
    { client: { id: 6, method: "turn/start" } },
    { server: { id: 6, result: { turn: { id: TURN } } } },
  ];
  const message = {
    text: "Create a.txt containing hi, then git add and git commit it with message 'add a'. Then reply DONE.",
  };
  const header = { message, open: { effort: "low", model: "gpt-6-luna" } };
  const approved = [header, ...handshake(), ...before, ...turn, ...after];
  mkdirSync(join(here, "written"), { recursive: true });
  writeFileSync(join(here, "written/approved.jsonl"), text(approved));

  const refused = JSON.parse(
    JSON.stringify(approved)
      .replaceAll(JSON.stringify(`"${COMMIT}"`).slice(1, -1), `'${PUSH}'`)
      .replaceAll(COMMIT, PUSH)
      .replaceAll(JSON.stringify(message.text).slice(1, -1), "Push main to origin. Then reply DONE.")
      .replaceAll(APPROVED, "It pushes to a remote.")
      .replaceAll("review approved (risk: medium, authorization: high)", "review denied (risk: high)"),
  ) as Array<Json>;
  for (const line of refused) {
    const server = (line.server ?? {}) as Json;
    const params = (server.params ?? {}) as Json;
    const review = params.review as Json | undefined;
    if (server.method === "item/autoApprovalReview/completed" && review !== undefined) {
      Object.assign(review, { riskLevel: "high", status: "denied", userAuthorization: "low" });
    }
    const item = params.item as Json | undefined;
    if (server.method === "item/completed" && item?.type === "commandExecution") {
      const none = { aggregatedOutput: null, exitCode: null, processId: null };
      Object.assign(item, { ...none, source: "agent", status: "declined" });
    }
  }
  writeFileSync(join(here, "written/denied.jsonl"), text(refused));

  for (const [name, notifications] of [
    ["items", ITEMS],
    ["limits", LIMITS],
  ] as const) {
    const lines = [
      { message: { text: "Go on." }, open: { model: "gpt-6-luna" } },
      ...handshake(),
      ...turn,
      ...notifications.map((server) => ({ server })),
    ];
    writeFileSync(join(here, `written/${name}.jsonl`), text(lines));
  }
}

/** Writes the events the Node runtime makes of each exchange of `folder`. */
async function writeEvents(folder: string) {
  for (const file of readdirSync(folder).toSorted()) {
    if (!file.endsWith(".jsonl") || file.endsWith(".events.jsonl")) {
      continue;
    }
    const exchange = readFileSync(join(folder, file), "utf8");
    const header = JSON.parse(exchange.split("\n")[0]!) as {
      message: { review?: boolean; text: string };
      open: { effort?: string; model?: string };
    };
    const dir = mkdtempSync(join(tmpdir(), "uraeda-codex-events-"));
    const session = join(dir, "session");
    mkdirSync(session);
    writeFileSync(join(session, "exchange.jsonl"), exchange);
    const command = join(dir, "codex");
    writeFileSync(command, `#!/bin/sh\nexec "${process.execPath}" "${standIn}" "${dir}" "$@"\n`);
    chmodSync(command, 0o755);
    const adapter = new CodexAdapter({ codexHome: dir, command, pluginDir: "/plugin" });
    const agent = adapter.open({
      cwd: session,
      nativeId: "",
      resume: false,
      skills: [],
      ...header.open,
    });
    agent.send({ id: "m1", images: [], when: "queue", ...header.message });
    const events: Array<unknown> = [];
    for await (const event of agent.events) {
      events.push(JSON.parse(JSON.stringify(event).replaceAll(session, "/session-dir")));
      if (event.type === "result" || (event.type === "init" && event.problem !== undefined)) {
        agent.close();
      }
    }
    writeFileSync(join(folder, file.replace(/\.jsonl$/, ".events.jsonl")), text(events));
    process.stdout.write(`${file}: ${events.length} events\n`);
  }
}

writeWritten();
await writeEvents(here);
await writeEvents(join(here, "written"));
