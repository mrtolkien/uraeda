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

const URL_PATTERN = /https?:\/\/[^\s"'<>)]+/g;
const LIMIT_PATTERN = /usage limit|limit reached|rate.?limit/i;

/**
 * Runs one fresh session: opens the adapter's process, sends the message, reads the events until
 * the process exits, and gathers what the record needs. Every address a fetch tool or a command
 * names is kept, for the leak audit.
 */
export async function runSession(options: {
  adapter: Adapter;
  allowed?: string;
  cwd: string;
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
  for await (const event of agent.events) {
    if (event.type === "text") {
      result.text += `${result.text === "" ? "" : "\n"}${event.text}`;
    } else if (event.type === "tokens") {
      result.tokens = event.total;
    } else if (event.type === "toolStart") {
      const text = event.target ?? "";
      result.urls.push(
        ...(event.kind === "fetch" || event.kind === "execute"
          ? (text.match(URL_PATTERN) ?? [])
          : []),
      );
    } else if (event.type === "usage") {
      result.usageLimit ||= event.fiveHour.percentUsed >= 100;
    } else if (event.type === "result") {
      Object.assign(result, {
        denials: event.denials,
        errors: event.errors,
        models: event.models ?? [],
        ok: event.ok,
        ...(event.costUsd === undefined ? {} : { costUsd: event.costUsd }),
      });
      result.usageLimit ||= !event.ok && LIMIT_PATTERN.test(event.errors.join(" "));
      agent.close();
    } else if (event.type === "exit") {
      result.exit = { code: event.code, stderr: event.stderr };
    }
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
