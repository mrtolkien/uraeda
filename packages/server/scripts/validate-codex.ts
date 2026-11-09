/**
 * Checks the Codex integration against this machine's `codex`, signed in: its model list and
 * defaults, a turn that commits a file in a git worktree, the commit landing after Codex's
 * automatic review, a message steered into a running turn, an interrupt, the model a session runs
 * on, an image sent by its path, a session given a stand-in of Uraeda's tool calling it, and that
 * the user's `config.toml` is left as it was (R24).
 *
 * Run it by hand, with `vp run validate:codex`, after a Codex upgrade, or when runs break. It is
 * not part of `vp test` or `vp run ready`: it runs the real `codex`, which spends a little of the
 * account's plan, on the cheapest listed model at its lowest effort, in throwaway repositories
 * under a temporary folder. `URAEDA_CODEX_MODEL` picks another model.
 *
 * With `--tools`, only the check of Uraeda's tool runs. Then the check of a reviewer: Codex's own
 * review of a commit that adds a bug, on the model and effort picked; with `--review`, only it
 * runs.
 *
 * It prints one line per check, `PASS` or `FAIL` with what it got, and exits 1 on any failure.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import type { AgentModel, AgentProcess, ModelList, Outgoing } from "../src/runner/adapter.ts";
import { CodexAdapter } from "../src/runner/codex.ts";
import type { AgentEvent } from "../src/runner/events.ts";
import { layout } from "../src/paths.ts";
import { reviewCheck } from "./validate-reviews.ts";
import { toolsCheck } from "./validate-tools.ts";

/** A turn that has not ended after this long is stopped, and its check fails. */
const RUN_TIMEOUT_MS = 240_000;
/** An interrupted turn must end within this long. */
const INTERRUPT_MS = 15_000;

const codexHome = process.env.CODEX_HOME ?? join(homedir(), ".codex");
const configPath = join(codexHome, "config.toml");
/** The throwaway repositories, an image, the catalog without sub-agents, and nothing else. */
const root = mkdtempSync(join(tmpdir(), "uraeda-codex-"));
const adapter = new CodexAdapter({
  catalogDir: join(root, "codex-catalog"),
  codexHome,
  pluginDir: layout().plugin,
});
let failed = false;

function report(name: string, ok: boolean, got: unknown) {
  if (ok) {
    process.stdout.write(`PASS ${name}\n`);
  } else {
    failed = true;
    process.stdout.write(
      `FAIL ${name}: got ${typeof got === "string" ? got : JSON.stringify(got)}\n`,
    );
  }
}

const git = (cwd: string, ...args: Array<string>) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

/** A git repository with one commit, and a worktree of it on a branch: the worktree's path. */
function repoWithWorktree(): { main: string; worktree: string } {
  const main = join(root, "repo");
  mkdirSync(main);
  git(main, "init", "-q", "-b", "main");
  git(main, "config", "user.name", "Uraeda Validation");
  git(main, "config", "user.email", "validation@uraeda.invalid");
  writeFileSync(join(main, "README.md"), "# Throwaway\n");
  git(main, "add", "README.md");
  git(main, "commit", "-q", "-m", "init");
  const worktree = join(root, "worktree");
  git(main, "worktree", "add", "-q", "-b", "feature", worktree);
  return { main, worktree };
}

/** A chunk of a PNG: its length, its type and data, and their checksum. */
function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** A 32 by 32 PNG of one colour, written by hand: its path. */
function solidPng(path: string, [r, g, b]: [number, number, number]): string {
  const size = 32;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.from([0, ...Array.from({ length: size }, () => [r, g, b]).flat()]);
  const pixels = deflateSync(Buffer.concat(Array.from({ length: size }, () => row)));
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", header),
      chunk("IDAT", pixels),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
  return path;
}

/** The cheapest listed model, as its description says, else the last listed: Codex lists by tier. */
function cheapest(list: ModelList): AgentModel | undefined {
  const asked = process.env.URAEDA_CODEX_MODEL;
  if (asked !== undefined) {
    return list.models.find((model) => model.id === asked);
  }
  return (
    list.models.find((model) => /affordable|cheap/i.test(model.description ?? "")) ??
    list.models.at(-1)
  );
}

/** What a turn gave: its events, each with when it came, in milliseconds from the send. */
type Run = { events: Array<AgentEvent>; times: Array<number> };

/**
 * Opens a process on the picked model and effort, sends it one message, and reads its turn to its
 * `result`, calling `onEvent` on each event; then closes it and reads it to its exit.
 */
async function run(
  cwd: string,
  pick: { effort?: string; model?: string },
  message: Pick<Outgoing, "images" | "text">,
  onEvent?: (event: AgentEvent, agent: AgentProcess) => void,
): Promise<Run> {
  const agent = adapter.open({ cwd, nativeId: randomUUID(), resume: false, skills: [], ...pick });
  const timeout = setTimeout(() => agent.kill("SIGKILL"), RUN_TIMEOUT_MS);
  const sent = Date.now();
  const result: Run = { events: [], times: [] };
  agent.send({ id: randomUUID(), when: "queue", ...message });
  try {
    for await (const event of agent.events) {
      result.events.push(event);
      result.times.push(Date.now() - sent);
      onEvent?.(event, agent);
      if (event.type === "result" || (event.type === "init" && event.problem !== undefined)) {
        agent.close();
      }
    }
  } finally {
    clearTimeout(timeout);
  }
  return result;
}

const find = <T extends AgentEvent["type"]>(events: Array<AgentEvent>, type: T) =>
  events.find((event): event is Extract<AgentEvent, { type: T }> => event.type === type);

/** What a turn gave, when a check fails: each event's type and when it came, but the deltas. */
const summary = ({ events, times }: Run) =>
  events.flatMap((event, index) =>
    ["textDelta", "activity", "usage", "tokens"].includes(event.type)
      ? []
      : [{ at: times[index], ...event }],
  );

/** The text a turn wrote, lower-cased. */
const said = (events: Array<AgentEvent>) =>
  events
    .flatMap((event) => (event.type === "text" ? [event.text] : []))
    .join("\n")
    .toLowerCase();

/** A command Codex runs long enough for the checks to act while it runs. */
const sleeping = (seconds: number, then: string) =>
  `Run the shell command \`sleep ${seconds}\` in the foreground, once, and wait for it to end. Then reply with the word ${then}, and do nothing else.`;

/** The model list, and the pick of the cheapest model at its lowest effort. */
async function modelChecks(): Promise<{ effort?: string; model?: AgentModel }> {
  let list: ModelList | undefined;
  let failure: unknown;
  try {
    list = await adapter.models();
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }
  const listed = (id: string | undefined) => list?.models.some((model) => model.id === id);
  report(
    "models() lists models, with a default model and effort",
    list !== undefined &&
      list.models.length > 0 &&
      listed(list.defaults.model) === true &&
      list.defaults.effort !== undefined,
    list === undefined ? failure : list.defaults,
  );
  const model = list && cheapest(list);
  const effort = model?.efforts[0]?.id;
  process.stdout.write(`  on ${model?.name ?? "no model"}, effort ${effort ?? "default"}\n`);
  return { ...(effort === undefined ? {} : { effort }), ...(model === undefined ? {} : { model }) };
}

/** A turn in a worktree commits a file after Codex's review, and runs on the picked model. */
async function commitChecks(pick: { effort?: string; model?: AgentModel }) {
  const { worktree } = repoWithWorktree();
  const before = git(worktree, "rev-parse", "HEAD");
  const turn = await run(
    worktree,
    { ...(pick.effort ? { effort: pick.effort } : {}), model: pick.model?.id },
    {
      images: [],
      text: "Create the file hello.txt containing the single line `hello`, then commit it on the current branch with the message `Add hello`. Do nothing else.",
    },
  );
  const after = git(worktree, "rev-parse", "HEAD");
  const files = after === before ? "" : git(worktree, "show", "--name-only", "--format=", "HEAD");
  const notices = turn.events.flatMap((event) => (event.type === "notice" ? [event.text] : []));
  report(
    "a turn in a worktree commits a file, and shows the review's notice",
    find(turn.events, "result")?.ok === true && files === "hello.txt" && notices.length > 0,
    { files, notices, summary: summary(turn) },
  );
  for (const notice of notices) {
    process.stdout.write(`  notice: ${notice}\n`);
  }
  // The thread's start gives the default effort; the turn's settings update, the one picked.
  const ran = turn.events.findLast((event) => event.type === "runsOn");
  const wanted = {
    effort: pick.model?.efforts.find((effort) => effort.id === pick.effort)?.name,
    model: pick.model?.name,
  };
  report(
    `runsOn names the model and effort (${ran?.model} · ${ran?.effort})`,
    ran?.model === wanted.model && ran?.effort === wanted.effort,
    { ran, wanted },
  );
  const id = find(turn.events, "init")?.sessionId;
  report("hasSession() finds the thread", id !== undefined && adapter.hasSession(id), id);
}

/** A message steered into a running turn is accepted, in that turn. */
async function steerCheck(cwd: string, pick: { effort?: string; model?: string }) {
  const steer = randomUUID();
  let steeredAt: number | undefined;
  const turn = await run(cwd, pick, { images: [], text: sleeping(8, "done") }, (event, agent) => {
    if (event.type === "toolStart" && steeredAt === undefined) {
      steeredAt = Date.now();
      agent.send({
        id: steer,
        images: [],
        text: "Also reply with the word steered.",
        when: "steer",
      });
    }
  });
  const accepted = turn.events.some((event) => event.type === "accepted" && event.id === steer);
  const results = turn.events.filter((event) => event.type === "result").length;
  report(
    "a message steered into a running turn is accepted",
    steeredAt !== undefined && accepted && results === 1,
    { accepted, results, summary: summary(turn) },
  );
  process.stdout.write(`  the turn says "steered": ${said(turn.events).includes("steered")}\n`);
}

/** An interrupt ends a running turn, its result interrupted. */
async function interruptCheck(cwd: string, pick: { effort?: string; model?: string }) {
  let interruptedAt: number | undefined;
  let endedAt: number | undefined;
  const turn = await run(cwd, pick, { images: [], text: sleeping(60, "done") }, (event, agent) => {
    if (event.type === "toolStart" && interruptedAt === undefined) {
      interruptedAt = Date.now();
      agent.interrupt();
    } else if (event.type === "result") {
      endedAt = Date.now();
    }
  });
  const stoppedIn =
    interruptedAt === undefined || endedAt === undefined ? undefined : endedAt - interruptedAt;
  const result = find(turn.events, "result");
  report(
    `interrupt ends a turn as interrupted (${stoppedIn} ms)`,
    result?.interrupted === true && stoppedIn !== undefined && stoppedIn <= INTERRUPT_MS,
    { stoppedIn, summary: summary(turn) },
  );
}

/** An image sent by its path reaches Codex, which names its colour. */
async function imageCheck(cwd: string, pick: { effort?: string; model?: string }) {
  const path = solidPng(join(root, "colour.png"), [220, 20, 20]);
  const turn = await run(cwd, pick, {
    images: [{ path }],
    text: "What single colour fills the attached image? Reply with that colour's name in one word, and do nothing else.",
  });
  const text = said(turn.events);
  report("an image sent by its path reaches Codex", text.includes("red"), {
    said: text,
    summary: summary(turn),
  });
}

/**
 * The sub-agents a thread started, from its rollout: Codex's events show no call of its
 * `spawn_agent` in the collaboration tools of a model on multi-agent v2.
 */
function spawned(threadId: string): Array<unknown> {
  const found = execFileSync(
    "find",
    [join(codexHome, "sessions"), "-name", `*-${threadId}.jsonl`],
    {
      encoding: "utf8",
    },
  ).split("\n")[0];
  if (!found) {
    return [`no rollout for ${threadId}`];
  }
  return readFileSync(found, "utf8")
    .split("\n")
    .filter((line) => line.includes('"name":"spawn_agent"'));
}

/**
 * What the review of a thread ran on, from the rollout of its review thread, whose parent the
 * thread is: the model and the effort of its turn's context.
 */
function reviewedOn(threadId: string): { effort?: string; model?: string } | undefined {
  const found = execFileSync(
    "grep",
    ["-rl", "--include=*.jsonl", `"parent_thread_id":"${threadId}"`, join(codexHome, "sessions")],
    { encoding: "utf8" },
  ).split("\n")[0];
  const context = found
    ? readFileSync(found, "utf8")
        .split("\n")
        .find((line) => line.includes('"type":"turn_context"'))
    : undefined;
  const payload = context === undefined ? undefined : JSON.parse(context).payload;
  return payload && { effort: payload.effort ?? undefined, model: payload.model ?? undefined };
}

const configBefore = existsSync(configPath) ? readFileSync(configPath) : undefined;
try {
  const version = await adapter.version();
  report(`version() returns a version (${version})`, version !== undefined, version);
  const reviewOnly = process.argv.includes("--review");
  const toolsOnly = process.argv.includes("--tools") || reviewOnly;
  const pick = await modelChecks();
  if (!toolsOnly) {
    await commitChecks(pick);
  }
  const chat = join(root, "chat");
  mkdirSync(chat);
  git(chat, "init", "-q");
  const plain = { ...(pick.effort ? { effort: pick.effort } : {}), model: pick.model?.id };
  if (!toolsOnly) {
    await steerCheck(chat, plain);
    await interruptCheck(chat, plain);
    await imageCheck(chat, plain);
  }
  if (!reviewOnly) {
    await toolsCheck(adapter, { cwd: chat, pick: plain, report, settings: configPath, spawned });
  }
  if (reviewOnly || !process.argv.includes("--tools")) {
    await reviewCheck(adapter, {
      ...(plain.effort ? { effort: plain.effort } : {}),
      pick: plain,
      report,
      reviewedOn,
    });
  }
} finally {
  rmSync(root, { force: true, recursive: true });
  const configAfter = existsSync(configPath) ? readFileSync(configPath) : undefined;
  const same =
    configBefore === undefined || configAfter === undefined
      ? configBefore === configAfter
      : configBefore.equals(configAfter);
  report(`${configPath} is left byte for byte as it was`, same, {
    after: configAfter?.length ?? "removed",
    before: configBefore?.length ?? "absent",
  });
}

process.exit(failed ? 1 : 0);
