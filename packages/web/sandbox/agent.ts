// The sandbox's fake agent: it answers every message with one canned reply, streamed as a real
// agent's, and plays a long turn at work on the implementation feature, so every session state
// shows. It runs nothing, and changes no file.
import { nextStep, readFeature } from "uraeda-binding";
import type { AgentEvent } from "uraeda-server/runner/events";
import { type FakeStep } from "uraeda-server/runner/fake";
import { runMessage } from "uraeda-server/runner/message";
import { FakeAdapter, type Sessions } from "uraeda-server/testing";
import { SAMPLE_FOLDERS } from "../samples/index.ts";

/** Waits `ms`, or less once `signal` aborts: a stop or a close ends the wait. */
export type Wait = (ms: number, signal?: AbortSignal) => Promise<void>;

/** The reply to any message. */
export const CANNED_REPLY =
  "This is the sandbox's fake agent: it answers every message with this text, and changes no file.";

/** How long the canned reply streams. */
const REPLY_MS = 3000;

/** How long the turn at work streams tool calls. */
const AT_WORK_MS = 10 * 60 * 1000;

/** A wait on a timer, cleared when `signal` aborts. */
const timerWait: Wait = (ms, signal) =>
  new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

/** The `count` parts of `total`, whole numbers that add up to it exactly. */
function shares(total: number, count: number): Array<number> {
  return Array.from(
    { length: count },
    (_, index) => Math.round(((index + 1) * total) / count) - Math.round((index * total) / count),
  );
}

/** The tool calls the turn at work cycles through: reading, searching, editing, testing. */
const TOOL_CALLS: Array<{
  input: Record<string, unknown>;
  kind: Extract<AgentEvent, { type: "toolStart" }>["kind"];
  name: string;
  output: string;
  target: string;
}> = [
  {
    input: { file_path: "specs/2026-10-17-redesign-clarifications/plan.md" },
    kind: "read",
    name: "Read",
    output: "The plan's current task.",
    target: "specs/2026-10-17-redesign-clarifications/plan.md",
  },
  {
    input: { pattern: "Clarifications" },
    kind: "search",
    name: "Grep",
    output: "src/Clarifications.tsx",
    target: "Clarifications",
  },
  {
    input: { file_path: "src/Clarifications.tsx" },
    kind: "edit",
    name: "Edit",
    output: "The file was updated.",
    target: "src/Clarifications.tsx",
  },
  {
    input: { command: "npm test" },
    kind: "execute",
    name: "Bash",
    output: "Tests passed.",
    target: "npm test",
  },
];

/** How many tool calls the turn at work streams, each a share of its 10 minutes. */
const AT_WORK_CALLS = 40;

/**
 * The fake agent of the sandbox. A message during a turn queues behind it, as the workflow's do,
 * rather than steering into it: the turn at work plays to its end.
 */
export class SandboxAgent extends FakeAdapter {
  #wait: Wait;

  constructor(wait: Wait) {
    super();
    this.#wait = wait;
    this.capabilities = { ...this.capabilities, steer: false };
    this.fallback = () => this.reply();
  }

  /** A step that waits `ms`, cut short as the turn ends. */
  #waiting(ms: number): FakeStep {
    return (_cwd, signal) => this.#wait(ms, signal);
  }

  /** The canned reply, streamed word by word over 3 seconds, then whole. */
  reply(): Array<FakeStep> {
    const words = CANNED_REPLY.match(/\S+\s*/g) ?? [CANNED_REPLY];
    const waits = shares(REPLY_MS, words.length);
    return [
      ...words.flatMap((word, index): Array<FakeStep> => [
        this.#waiting(waits[index] ?? 0),
        { text: word, type: "textDelta" },
      ]),
      { text: CANNED_REPLY, type: "text" },
    ];
  }

  /** The turn at work: tool calls streamed for 10 minutes, each running for its share. */
  atWork(): Array<FakeStep> {
    const waits = shares(AT_WORK_MS, AT_WORK_CALLS);
    return waits.flatMap((ms, index): Array<FakeStep> => {
      const call = TOOL_CALLS[index % TOOL_CALLS.length];
      if (call === undefined) {
        return [];
      }
      const id = `at-work-${index}`;
      return [
        {
          id,
          input: call.input,
          kind: call.kind,
          name: call.name,
          target: call.target,
          type: "toolStart",
        },
        this.#waiting(ms),
        { id, isError: false, output: call.output, type: "toolEnd" },
      ];
    });
  }
}

/** The sandbox's fake agent, waiting with `wait`, on a timer by default. */
export function sandboxAgent({ wait = timerWait }: { wait?: Wait } = {}): SandboxAgent {
  return new SandboxAgent(wait);
}

/** The workflow's message for a feature waiting on the agent, as "Continue" sends it. */
export async function workflowMessage(repo: string, folder: string): Promise<string> {
  const { branch, step } = await nextStep(repo, folder);
  if (branch === undefined || step.reference === undefined) {
    throw new Error(`${folder} does not wait on the agent`);
  }
  return runMessage({
    branch,
    feature: await readFeature(repo, folder),
    reference: step.reference,
    step: step.name,
    ...(step.planReview === undefined ? {} : { planReview: step.planReview }),
  });
}

/**
 * Starts the turn at work on the implementation feature's session, as "Continue" does: at each
 * start of the sandbox, since a restart stops the one running.
 */
export async function atWork(sessions: Sessions, repo: string): Promise<{ turn: number }> {
  const agent = sessions.adapter as Partial<SandboxAgent>;
  if (agent.atWork === undefined || agent.script === undefined) {
    throw new Error("The turn at work runs on the sandbox's agent.");
  }
  const folder = SAMPLE_FOLDERS.features.implementation;
  const session = await sessions.featureSession(repo, folder);
  const text = await workflowMessage(repo, folder);
  agent.script(agent.atWork());
  return sessions.send(repo, session.id, { text, workflow: { trigger: "manual" } });
}
