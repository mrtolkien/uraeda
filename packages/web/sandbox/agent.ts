// The sandbox's fake agent: it answers every message with one canned reply, streamed as a real
// agent's, and plays long turns at work, one on the implementation feature, with three sub-agents,
// and one on the discovery feature, so every session state shows. It runs nothing, and changes no
// file.
import { nextStep, readFeature } from "uraeda-binding";
import type { AgentEvent } from "uraeda-server/runner/events";
import { type FakeStep } from "uraeda-server/runner/fake";
import { runMessage } from "uraeda-server/runner/message";
import { FakeAdapter, type Sessions } from "uraeda-server/testing";
import type { Outgoing } from "uraeda-server/runner/adapter";
import { dirname, join } from "node:path";
import { REALISTIC_FOLDERS, SAMPLE_FOLDERS } from "../samples/index.ts";

/** Waits `ms`, or less once `signal` aborts: a stop or a close ends the wait. */
export type Wait = (ms: number, signal?: AbortSignal) => Promise<void>;

/** The reply to any message. */
export const CANNED_REPLY =
  "This is the sandbox's fake agent: it answers every message with this text, and changes no file.";

/** How long the canned reply streams. */
const REPLY_MS = 3000;

/**
 * How long the turn at work streams tool calls: as long as a sandbox is open in a day, so that
 * the sessions at work stay ongoing, and a restart starts them again.
 */
const AT_WORK_MS = 12 * 60 * 60 * 1000;

/** How long each tool call of the turn at work runs. */
const AT_WORK_CALL_MS = 15 * 1000;

/**
 * A wait on a timer, cleared when `signal` aborts. The signal lives as long as the turn: its
 * listener goes when the timer fires, or it would pile up over the turn's waits.
 */
export const timerWait: Wait = (ms, signal) =>
  new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });

/** The `count` parts of `total`, whole numbers that add up to it exactly. */
function shares(total: number, count: number): Array<number> {
  return Array.from(
    { length: count },
    (_, index) => Math.round(((index + 1) * total) / count) - Math.round((index * total) / count),
  );
}

/** When a usage window resets, `count` hours from now, as the agent reports it. */
const inHours = (count: number) => new Date(Date.now() + count * 3_600_000).toISOString();

/** The plan the turn at work reads: the implementation feature's. */
const PLAN = `specs/${SAMPLE_FOLDERS.features.implementation}/plan.md`;

/** A tool call a turn at work cycles through. */
type ToolCall = {
  input: Record<string, unknown>;
  kind: Extract<AgentEvent, { type: "toolStart" }>["kind"];
  name: string;
  output: string;
  target: string;
};

/** The tool calls the implementation's turn cycles through: reading, searching, editing, testing. */
const TOOL_CALLS: Array<ToolCall> = [
  {
    input: { file_path: PLAN },
    kind: "read",
    name: "Read",
    output: "The plan's current task.",
    target: PLAN,
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

/** The discovery feature's proposal, which its turn reads. */
const PROPOSAL = `specs/${SAMPLE_FOLDERS.features.discovery}/proposal.md`;

/** The tool calls the discovery's turn cycles through: reading the project, searching it. */
const DISCOVERY_CALLS: Array<ToolCall> = [
  {
    input: { file_path: PROPOSAL },
    kind: "read",
    name: "Read",
    output: "The proposal: a dark theme for the todo app.",
    target: PROPOSAL,
  },
  {
    input: { pattern: "theme" },
    kind: "search",
    name: "Grep",
    output: "src/theme.ts",
    target: "theme",
  },
  {
    input: { file_path: "src/theme.ts" },
    kind: "read",
    name: "Read",
    output: "The light palette.",
    target: "src/theme.ts",
  },
  {
    input: { pattern: "prefers-color-scheme" },
    kind: "search",
    name: "Grep",
    output: "No match.",
    target: "prefers-color-scheme",
  },
];

/** What a sub-agent of the implementation's turn does, one tool call after another. */
const SUBAGENT_CALLS: Array<ToolCall> = [
  {
    input: { file_path: "src/Clarifications.tsx" },
    kind: "read",
    name: "Read",
    output: "The question cards.",
    target: "src/Clarifications.tsx",
  },
  {
    input: { pattern: "QuestionCard" },
    kind: "search",
    name: "Grep",
    output: "src/QuestionCard.tsx",
    target: "QuestionCard",
  },
];

/** A turn at work: the calls it cycles through, and the sub-agents it starts first. */
type AtWork = { calls: Array<ToolCall>; subagents: Array<string> };

/** The implementation's turn at work: its plan's tool calls, and three sub-agents. */
const IMPLEMENTATION: AtWork = {
  calls: TOOL_CALLS,
  subagents: [
    "Review the question cards",
    "Find the callers of Clarifications",
    "Run the browser tests",
  ],
};

/** The discovery's turn at work: no sub-agent, only the main agent reading and searching. */
const DISCOVERY: AtWork = { calls: DISCOVERY_CALLS, subagents: [] };

/** A read of `path`, as a turn at work makes one. */
const reading = (path: string, output: string): ToolCall => ({
  input: { file_path: path },
  kind: "read",
  name: "Read",
  output,
  target: path,
});

/**
 * The realistic project's building: the implementation's turn, three sub-agents with it, on the
 * plan of its own feature.
 */
const building = (folder: string): AtWork => ({
  calls: [reading(`specs/${folder}/plan.md`, "The plan's current task."), ...TOOL_CALLS.slice(1)],
  subagents: IMPLEMENTATION.subagents,
});

/** The realistic project's spec writing: the proposal and its answered round read, the spec edited. */
const specifying = (folder: string): AtWork => ({
  calls: [
    reading(`specs/${folder}/proposal.md`, "The proposal: a calendar of the due dates."),
    reading(`specs/${folder}/clarifications-01.md`, "The answered round."),
    {
      input: { pattern: "dueDate" },
      kind: "search",
      name: "Grep",
      output: "src/tasks/Task.ts",
      target: "dueDate",
    },
    {
      input: { file_path: `specs/${folder}/spec.md` },
      kind: "edit",
      name: "Edit",
      output: "The spec was updated.",
      target: `specs/${folder}/spec.md`,
    },
  ],
  subagents: [],
});

/** How many tool calls a turn at work streams, each a share of its time. */
const AT_WORK_CALLS = AT_WORK_MS / AT_WORK_CALL_MS;

/**
 * The fake agent of the sandbox. A message during a turn queues behind it, as the workflow's do,
 * rather than steering into it: the turn at work plays to its end.
 */
export class SandboxAgent extends FakeAdapter {
  #wait: Wait;
  /** The messages that start a turn at work, each once, by their text, with what it plays. */
  #atWorkMessages = new Map<string, AtWork>();

  constructor(wait: Wait) {
    super();
    this.#wait = wait;
    // It never says a message was taken back, which a take-back waits for.
    this.capabilities = { ...this.capabilities, steer: false, takeBack: false };
    this.fallback = (message) => this.#answer(message);
  }

  /**
   * Plays the turn at work on the next message of `text`, rather than the canned reply: chosen by
   * the message itself, so another session's message, reaching the agent first, cannot take it.
   * It is the implementation's, unless `work` says otherwise.
   */
  playAtWorkOn(text: string, work: AtWork = IMPLEMENTATION) {
    this.#atWorkMessages.set(text, work);
  }

  #answer({ text }: Outgoing): Array<FakeStep> {
    const work = this.#atWorkMessages.get(text);
    if (work === undefined) {
      return this.reply();
    }
    this.#atWorkMessages.delete(text);
    return this.atWork(work);
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

  /**
   * The turn at work: tool calls streamed for 12 hours, each running for its share. Its
   * sub-agents start first and run to its end, each making a call as the turn does.
   */
  atWork({ calls, subagents }: AtWork = IMPLEMENTATION): Array<FakeStep> {
    const waits = shares(AT_WORK_MS, AT_WORK_CALLS);
    const usage: FakeStep = {
      fiveHour: { percentUsed: 42, resetsAt: inHours(3) },
      type: "usage",
      week: { percentUsed: 18, resetsAt: inHours(72) },
    };
    const ids = subagents.map((_, index) => `at-work-agent-${index}`);
    const starts = subagents.map((description, index): FakeStep => ({
      id: ids[index] ?? "",
      input: { description, prompt: description },
      kind: "other",
      name: "Agent",
      subagent: { description },
      type: "toolStart",
    }));
    return [
      usage,
      ...starts,
      ...waits.flatMap((ms, index): Array<FakeStep> => {
        const call = calls[index % calls.length];
        if (call === undefined) {
          return [];
        }
        const id = `at-work-${index}`;
        // Each sub-agent makes a call of its own, over at once, so it stays at work to the end.
        const nested = ids.flatMap((parent, which): Array<FakeStep> => {
          const child = SUBAGENT_CALLS[(index + which) % SUBAGENT_CALLS.length];
          if (child === undefined) {
            return [];
          }
          const childId = `${parent}-call-${index}`;
          return [
            {
              id: childId,
              input: child.input,
              kind: child.kind,
              name: child.name,
              parent,
              target: child.target,
              type: "toolStart",
            },
            { id: childId, isError: false, output: child.output, type: "toolEnd" },
          ];
        });
        return [
          {
            id,
            input: call.input,
            kind: call.kind,
            name: call.name,
            target: call.target,
            type: "toolStart",
          },
          ...nested,
          this.#waiting(ms),
          { id, isError: false, output: call.output, type: "toolEnd" },
        ];
      }),
      ...ids.map((id): FakeStep => ({ id, isError: false, output: "Done.", type: "toolEnd" })),
    ];
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
 * Starts `work` on `folder`'s session, as "Continue" does. With `kind`, the session is one of that
 * agent's, to show its mark: a session records the agent it was made by, so the fake agent is that
 * kind while the session is made and the turn sent, and a session of another kind, left by an
 * earlier start, is retagged. Callers run one after another, so the kind never mixes.
 */
async function startAtWork(
  sessions: Sessions,
  repo: string,
  folder: string,
  work: AtWork,
  kind?: string,
): Promise<{ turn: number }> {
  const agent = sessions.adapter as Partial<SandboxAgent>;
  if (agent.playAtWorkOn === undefined) {
    throw new Error("The turn at work runs on the sandbox's agent.");
  }
  // The sandbox's agent, whose kind, unlike an adapter's, can be set for a while.
  const adapter = agent as SandboxAgent;
  const usual = adapter.kind;
  if (kind !== undefined) {
    adapter.kind = kind;
  }
  try {
    const session = await sessions.featureSession(repo, folder);
    if (kind !== undefined && session.agent !== kind) {
      // The one session of the feature, retagged: a second would be the card's older, stopped one.
      sessions.cache.db.prepare("UPDATE sessions SET agent = ? WHERE id = ?").run(kind, session.id);
    }
    const text = await workflowMessage(repo, folder);
    agent.playAtWorkOn(text, work);
    return await sessions.send(repo, session.id, { text, workflow: { trigger: "manual" } });
  } finally {
    adapter.kind = usual;
  }
}

/**
 * Starts the turn at work on the implementation feature's session, as "Continue" does: at each
 * start of the sandbox, since a restart stops the one running. Its three sub-agents run with it.
 */
export function atWork(sessions: Sessions, repo: string): Promise<{ turn: number }> {
  return startAtWork(sessions, repo, SAMPLE_FOLDERS.features.implementation, IMPLEMENTATION);
}

/** The realistic project's folder, beside the sample's in `.sandbox/projects/`. */
export const realisticRepo = (sample: string) => join(dirname(sample), "realistic");

/**
 * Starts the two turns at work of the realistic project at each start like `atWork`: its plan's
 * building with three sub-agents, by Claude Code, and its spec's writing, by Codex, so each mark
 * shows. One after the other: a session takes the kind the fake agent has as it is made.
 */
export async function atWorkOnRealistic(sessions: Sessions, sample: string): Promise<void> {
  const repo = realisticRepo(sample);
  const { building: folder, specifying: specFolder } = REALISTIC_FOLDERS;
  await startAtWork(sessions, repo, folder, building(folder), "claude");
  await startAtWork(sessions, repo, specFolder, specifying(specFolder), "codex");
}

/** Starts the turn at work on the discovery feature's session, at each start like `atWork`. */
export function atWorkOnDiscovery(sessions: Sessions, repo: string): Promise<{ turn: number }> {
  return startAtWork(sessions, repo, SAMPLE_FOLDERS.features.discovery, DISCOVERY);
}
