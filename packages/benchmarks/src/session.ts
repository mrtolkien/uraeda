import { randomUUID } from "node:crypto";
import type { Adapter } from "uraeda-server/runner/adapter";
import type { Denial } from "uraeda-server/runner/events";
import type { Step, Tokens } from "./record.ts";

/** A run that broke a rule of the benchmark, and is thrown out, not corrected. */
export class InvalidRun extends Error {
  override name = "InvalidRun";
  /** The human's session whose turn broke the rule, which the record keeps. */
  session: SessionResult | undefined;

  constructor(message: string, session?: SessionResult) {
    super(message);
    this.session = session;
  }
}

/** Whether an error is an `InvalidRun`: by name, since the linter forbids `instanceof`. */
export const isInvalidRun = (error: unknown): error is InvalidRun =>
  error instanceof Error && error.name === "InvalidRun";

/** What one session did. */
export type SessionResult = {
  costUsd?: number;
  denials: Array<Denial>;
  errors: Array<string>;
  exit?: { code: number | null; stderr: string };
  models: Array<string>;
  nativeId: string;
  ok: boolean;
  seconds: number;
  /** What the agent wrote, its text blocks in order. */
  text: string;
  tokens: Tokens;
  urls: Array<string>;
  usageLimit: boolean;
};

/** The characters an address runs on: up to a space, a quote, or punctuation that ends it. */
const ADDRESS = String.raw`[^\s"'<>)` + "`" + String.raw`,;]+`;
const URL_PATTERN = new RegExp(String.raw`\b(?:https?|ssh|git)://${ADDRESS}`, "g");
/**
 * A git remote in scp form, `git@github.com:owner/repo.git` or `github.com:owner/repo`: its host
 * and its path. Not inside a URL, and never a port: the path starts with a letter.
 */
const SCP_PATTERN = /(?<!\/\/)\b(?:[\w.-]+@)?([\w.-]+\.[a-z]+):\/?([A-Za-z_][\w.-]*\/[\w.-]+)/g;
/**
 * A repository `gh` is pointed at: `gh repo clone owner/repo`, or `--repo owner/repo` in the same
 * `gh` command, quoted or not.
 */
const GH_REPO_PATTERN =
  /(?:\bgh\s+repo\s+[\w-]+|\bgh\s[^;&|\n]*?\s(?:--repo|-R))[\s=]+["']?([\w.-]+\/[\w.-]+)/g;
/** A path `gh api` reads on GitHub's API, after its flags, quoted or not: `gh api repos/o/r/pulls`. */
const GH_API_PATTERN = new RegExp(
  String.raw`\bgh\s+api\s+(?:-\S+\s+)*["']?\/?(repos\/${ADDRESS})`,
  "g",
);
/** A command that reaches a network address, not one that merely mentions it (a test's config). */
const FETCHING =
  /\b(curl|wget|gh|git\s+(clone|fetch|pull|ls-remote|remote)|pip3?\s+(download|install)|httpie?|nc|ssh)\b/;
/** The server gives a process that long to end after its result, twice. */
const GRACE_MS = 10_000;
const LIMIT_PATTERN = /usage limit|limit reached|rate.?limit/i;

/**
 * The network addresses a fetch or a command names, as URLs: its URLs, its scp-form git remotes,
 * and the GitHub repositories and API paths `gh` reaches without one.
 */
function addressesOf(text: string): Array<string> {
  const all = (pattern: RegExp) => [...text.matchAll(pattern)];
  return [
    ...(text.match(URL_PATTERN) ?? []),
    ...all(SCP_PATTERN).map(([, host, path]) => `https://${host}/${path}`),
    ...all(GH_REPO_PATTERN).map(([, repository]) => `https://github.com/${repository}`),
    ...all(GH_API_PATTERN).map(([, path]) => `https://api.github.com/${path}`),
  ];
}

/**
 * Runs one fresh session: opens the adapter's process, sends the message, reads the events until
 * the process exits, and gathers what the record needs. Every address a fetch tool or a command
 * names is kept, for the leak audit.
 */
export async function runSession(options: {
  adapter: Adapter;
  allowed?: ReadonlyArray<string>;
  cwd: string;
  /** How long a process may stay up after its result, before SIGTERM, and again before SIGKILL. */
  graceMs?: number;
  message: string;
  nativeId?: string;
  now?: () => number;
  resume?: boolean;
}): Promise<SessionResult> {
  const now = options.now ?? Date.now;
  const nativeId = options.nativeId ?? randomUUID();
  const started = now();
  const agent = options.adapter.open({
    ...(options.allowed === undefined ? {} : { allowed: options.allowed }),
    cwd: options.cwd,
    nativeId,
    resume: options.resume ?? false,
  });
  agent.send({ id: randomUUID(), images: [], text: options.message, when: "queue" });
  const result: SessionResult = {
    denials: [],
    errors: [],
    models: [],
    nativeId,
    ok: false,
    seconds: 0,
    text: "",
    tokens: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 },
    urls: [],
    usageLimit: false,
  };
  const stops: Array<ReturnType<typeof setTimeout>> = [];
  const grace = options.graceMs ?? GRACE_MS;
  let answered = false;
  for await (const event of agent.events) {
    if (event.type === "text") {
      result.text += `${result.text === "" ? "" : "\n"}${event.text}`;
    } else if (event.type === "tokens") {
      result.tokens = event.total;
    } else if (event.type === "toolStart") {
      const text = event.target ?? "";
      const fetches = event.kind === "fetch" || (event.kind === "execute" && FETCHING.test(text));
      result.urls.push(...(fetches ? addressesOf(text) : []));
    } else if (event.type === "usage") {
      result.usageLimit ||= event.fiveHour.percentUsed >= 100;
    } else if (event.type === "result") {
      // A session may answer several turns: nothing an earlier one did is overwritten.
      result.denials.push(...event.denials);
      result.errors.push(...event.errors);
      result.models.push(...(event.models ?? []).filter((model) => !result.models.includes(model)));
      result.ok = (answered ? result.ok : true) && event.ok;
      answered = true;
      if (event.costUsd !== undefined) {
        result.costUsd = event.costUsd;
      }
      result.usageLimit ||= !event.ok && LIMIT_PATTERN.test(event.errors.join(" "));
      agent.close();
      // A process that stays up after its result is ended, as the server ends one: SIGTERM, then
      // SIGKILL, each a grace period apart.
      stops.push(
        setTimeout(() => agent.kill("SIGTERM"), grace),
        setTimeout(() => agent.kill("SIGKILL"), grace * 2),
      );
    } else if (event.type === "exit") {
      result.exit = { code: event.code, stderr: event.stderr };
    }
  }
  for (const stop of stops) {
    clearTimeout(stop);
  }
  result.seconds = (now() - started) / 1000;
  return result;
}

/** The record's step for a session. */
export function stepOf(role: Step["role"], step: string, session: SessionResult, gate = ""): Step {
  return {
    cost: {
      amount: session.costUsd ?? 0,
      kind: session.costUsd === undefined ? "estimated" : "reported",
    },
    gate,
    role,
    seconds: session.seconds,
    step,
    tokens: session.tokens,
  };
}
