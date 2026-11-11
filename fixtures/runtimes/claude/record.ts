// Records a stream of the real `claude`, beside this file, as `<name>.jsonl`: what Claude Code
// prints for one short message, sent as a session sends it.
//
//   nix develop -c node fixtures/runtimes/claude/record.ts [name ...]
//
// Run by hand, after a Claude Code upgrade: it uses this machine's `claude` and its account, and
// costs a few cents. With no name it records every stream of `STREAMS`. Then run `node-events.ts`,
// which writes the events of each stream.
//
// - **As a session runs it**: the arguments are `claudeArgs`'s, of the Node server
//   (`packages/server/src/runner/claude.ts`), on Sonnet at a low effort, and the message is the
//   line a session writes to stdin.
// - **In a temporary folder**, outside any repository, removed at the end. No prompt asks for a
//   write outside it: the blocked write is to a file inside it, which a rule of that run alone
//   blocks. No transcript is kept, and what a sub-agent leaves in Claude Code's own folder is
//   removed.
// - **Scrubbed**: the session's folder is written `/session-dir`, the home folder `/home/me`, and
//   the `init` line keeps only its fields a runtime reads, so no stream holds this machine's
//   paths, tools, or servers.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { claudeArgs } from "../../../packages/server/src/runner/claude.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");

/** The folder a recorded stream names as its session's. */
const SESSION_DIR = "/session-dir";

/** A stream to record: its message, and what its run takes besides a session's arguments. */
type Stream = {
  /** More arguments, as `--max-turns 1`. */
  args?: Array<string>;
  /** A file of the session's folder the run may not write: an `ask` rule of this run alone. */
  blocked?: string;
  /** The effort the run takes: `low` unless the stream needs the agent to think. */
  effort?: string;
  prompt: string;
};

const STREAMS: Record<string, Stream> = {
  // A blocked action: a denial of the turn's result.
  denied: {
    blocked: "blocked.txt",
    prompt:
      "Use the Write tool to create the file blocked.txt in the current folder, containing the word hi. If it is refused, do not try any other way: reply with the word refused.",
  },
  // A result that is an error: the turn's cap is reached by its first tool call.
  error: {
    args: ["--max-turns", "1"],
    prompt: "Run the shell command `echo ok` with the Bash tool, then reply with the word done.",
  },
  // A plain reply, streamed in pieces.
  reply: {
    prompt:
      "Reply with exactly this sentence and nothing else: The quick brown fox jumps over the lazy dog, twice.",
  },
  // A sub-agent, and its own tool call.
  "sub-agent": {
    prompt:
      "Use the Agent tool to start one sub-agent, with the description `List the folder`, whose whole job is to run the shell command `ls` with the Bash tool and reply with the word hi. Then reply with the word done.",
  },
  // A thinking block before the reply.
  thought: {
    effort: "max",
    prompt:
      "Five people sit in a row. Ann is not at an end. Bo sits right of Cy. Di sits next to Ann and next to Ed. Cy is at an end. Work out one seating that fits, and reply with it as five names only.",
  },
  // A tool call with its result.
  tool: {
    prompt: "Run the shell command `echo ok` with the Bash tool, then reply with the word done.",
  },
};

/** The environment of the run: this one's, without what a `claude` gives the commands it runs. */
function environment(): NodeJS.ProcessEnv {
  const keep = ([name]: [string, string | undefined]) =>
    name === "CLAUDE_CONFIG_DIR" || !/^(CLAUDE|ANTHROPIC_)/.test(name);
  return Object.fromEntries(Object.entries(process.env).filter(keep));
}

/** The `init` line's fields a runtime reads: the rest names this machine's tools and servers. */
const INIT_FIELDS = [
  "type",
  "subtype",
  "cwd",
  "session_id",
  "model",
  "permissionMode",
  "claude_code_version",
  "plugins",
  "plugin_errors",
  "uuid",
];

/** A line of the stream, read: none for a line that is no JSON object. */
function read(line: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(line) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** The piece of a tool call's input a line streams, with its block's index: none for another line. */
function inputPiece(line: string): { index: number; text: string } | undefined {
  const event = read(line)?.event as Record<string, unknown> | undefined;
  const delta = event?.delta as Record<string, unknown> | undefined;
  return delta?.type === "input_json_delta" && typeof delta.partial_json === "string"
    ? { index: event?.index as number, text: delta.partial_json }
    : undefined;
}

/**
 * The pieces of one text, cut so that `path` is whole in one piece wherever the text holds it: a
 * piece that ends inside it gives its end to the next one.
 */
function unsplit(pieces: Array<string>, path: string): Array<string> {
  const whole = pieces.join("");
  let start = 0;
  let held = "";
  return pieces.map((piece) => {
    let text = held + piece;
    held = "";
    const end = start + text.length;
    for (let cut = Math.max(start, end - path.length + 1); cut < end; cut += 1) {
      if (whole.startsWith(path, cut)) {
        held = text.slice(cut - start);
        text = text.slice(0, cut - start);
        break;
      }
    }
    start += text.length;
    return text;
  });
}

/**
 * The lines, each tool call's input streamed in pieces that hold `path` whole: Claude Code cuts
 * the pieces anywhere, and a path cut in two would be scrubbed in neither.
 */
function withWholePaths(lines: Array<string>, path: string): Array<string> {
  const blocks = new Map<number, Array<number>>();
  lines.forEach((line, at) => {
    const piece = inputPiece(line);
    if (piece !== undefined) {
      blocks.set(piece.index, [...(blocks.get(piece.index) ?? []), at]);
    }
  });
  const out = [...lines];
  for (const at of blocks.values()) {
    const pieces = unsplit(
      at.map((line) => inputPiece(lines[line]!)!.text),
      path,
    );
    at.forEach((line, piece) => {
      const message = read(lines[line]!)!;
      ((message.event as Record<string, unknown>).delta as Record<string, unknown>).partial_json =
        pieces[piece];
      out[line] = JSON.stringify(message);
    });
  }
  return out;
}

/**
 * The printed lines without this machine's paths, and the `init` line with only what is read.
 * Claude Code also names a folder by its path with `-` for each `/`.
 */
function scrubbed(printed: Array<string>, cwd: string): Array<string> {
  const paths: Array<[string, string]> = [
    [cwd, SESSION_DIR],
    [cwd.replaceAll("/", "-"), SESSION_DIR.replaceAll("/", "-")],
    [root, "/home/me/uraeda"],
    [homedir(), "/home/me"],
  ];
  let lines = printed;
  for (const [path, shown] of paths) {
    lines = withWholePaths(lines, path).map((line) => line.replaceAll(path, shown));
  }
  return lines.map((line) => {
    const message = read(line);
    if (message?.type !== "system" || message.subtype !== "init") {
      return line;
    }
    return JSON.stringify(Object.fromEntries(INIT_FIELDS.map((field) => [field, message[field]])));
  });
}

/** Runs one stream's message to its result, and writes what `claude` printed. */
async function record(name: string, stream: Stream): Promise<void> {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "uraeda-record-")));
  const images = join(cwd, ".images");
  mkdirSync(images);
  const settings = join(cwd, ".settings.json");
  const rule = stream.blocked && `Edit(/${join(cwd, stream.blocked)})`;
  writeFileSync(settings, JSON.stringify({ permissions: { ask: rule ? [rule] : [] } }));
  const args = [
    ...claudeArgs(
      {
        cwd,
        effort: stream.effort ?? "low",
        model: "sonnet",
        nativeId: randomUUID(),
        resume: false,
        skills: [],
      },
      join(root, "packages/server/plugin"),
      images,
    ),
    "--settings",
    settings,
    // No transcript is kept in Claude Code's own folder.
    "--no-session-persistence",
    ...(stream.args ?? []),
  ];
  const child = spawn("claude", args, { cwd, env: environment(), stdio: ["pipe", "pipe", "inherit"] });
  const exited = new Promise((resolve) => child.on("close", resolve));
  child.stdin.write(
    `${JSON.stringify({
      message: { content: stream.prompt, role: "user" },
      priority: "later",
      type: "user",
      uuid: randomUUID(),
    })}\n`,
  );
  const lines: Array<string> = [];
  for await (const line of createInterface({ input: child.stdout })) {
    if (line === "") {
      continue;
    }
    lines.push(line);
    if (read(line)?.type === "result") {
      child.stdin.end();
    }
  }
  await exited;
  rmSync(cwd, { force: true, recursive: true });
  // A sub-agent leaves a file in Claude Code's own folder, even with no transcript kept.
  const claudeDir = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
  const project = join(claudeDir, "projects", cwd.replaceAll(/[/.]/g, "-"));
  rmSync(project, { force: true, recursive: true });
  writeFileSync(join(here, `${name}.jsonl`), `${scrubbed(lines, cwd).join("\n")}\n`);
  process.stdout.write(`${name}: ${lines.length} lines\n`);
}

const names = process.argv.slice(2);
for (const name of names.length > 0 ? names : Object.keys(STREAMS)) {
  const stream = STREAMS[name];
  if (stream === undefined) {
    throw new Error(`no stream is named ${name}: ${Object.keys(STREAMS).join(", ")}`);
  }
  await record(name, stream);
}
