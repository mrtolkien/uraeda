import { isAbsolute, relative, sep } from "node:path";
import type { FeatureView, NextView } from "uraeda-binding";
import type { Trigger } from "./events.ts";
import {
  REFUSALS,
  SENT_AS_CHAT,
  SENT_AS_CHAT_MOVED_ON,
  SENT_AS_CHAT_NO_PULL_REQUEST,
} from "./session-state.ts";

export { APPLY_TRIAGE, ORGANIZE_INBOX } from "./triage-messages.ts";

/** What a message is about: a feature's or a change's kind, and its folder's path. */
type Subject = { kind: string; path: string };

/** A feature's or a change's folder, and the word that names it. */
function subject({ kind, path }: Subject): string {
  return `${kind} ${path}/`;
}

const READY = "the pull request is ready for review";

/** What a run does from a step, where it stops, and its name: its work, without what follows. */
type Goal = { name?: string; stop: string; work: string };

/** The comments message's goal: the pull request's comments, until it waits for review again. */
const COMMENTS: Goal = { stop: `${READY} again`, work: "Address the comments on its pull request" };

/**
 * What a run does from a step, and where it stops: the next human gate, which the step and the
 * spec's `plan-review` decide.
 */
function goal(step: string, planReview?: boolean): Goal {
  const plan = (first: string): Goal =>
    planReview
      ? { stop: "the plan waits for my review", work: first }
      : { name: first, stop: READY, work: `${first}, then implement it` };
  switch (step) {
    case "discovery":
      return {
        stop: "the questions wait for my answers",
        work: "Investigate it and ask me your questions",
      };
    case "spec":
      return { stop: "the spec waits for my review", work: "Write the spec from the answers" };
    case "spec-revision":
      return { stop: "the spec waits for my review again", work: "Revise the spec from my review" };
    case "approval":
      return plan("Record the approved decisions and write the plan");
    case "plan":
      return plan("Write the plan");
    case "plan-revision":
      return plan("Revise the plan");
    case "implementation":
      return { stop: READY, work: "Implement the plan" };
    case "final-review":
      return { stop: READY, work: "Review the implementation" };
    case "pull-request-changes":
      return COMMENTS;
    case "change":
      return { stop: READY, work: "Investigate it, then make the change" };
    default:
      return { stop: READY, work: "Finish it" };
  }
}

/**
 * The workflow's message, which the human reads and may change before sending: the goal of the run
 * and where it stops. A resumed session keeps its first system prompt, so every message names the
 * skill and the step's reference.
 */
export function runMessage(input: {
  branch: string;
  feature: Subject;
  /** The spec's `plan-review`, for the steps before the plan is approved. */
  planReview?: boolean;
  reference: string;
  step: string;
  /** `comments` runs the comments message, whatever the step. */
  trigger?: Trigger;
}): string {
  const { stop, work } =
    input.trigger === "comments" ? COMMENTS : goal(input.step, input.planReview);
  return (
    `/uraeda Continue the ${subject(input.feature)} on branch ${input.branch}: ` +
    `${work}, starting with ${input.reference}.\n` +
    `Stop when ${stop}, and earlier only if you need a decision from me.\n`
  );
}

/** The reference the comments message starts from: the change's for a change. */
export function commentsReference(feature: Subject): string {
  return feature.kind === "change"
    ? "skills/uraeda/references/change.md"
    : "skills/uraeda/references/implementation.md";
}

/** The one workflow message that applies to a feature now, or why there is none. */
export type Recommended =
  | { name: string; step: string; text: string; trigger: Trigger }
  | { reason: string };

/** Why no message is recommended to a feature that waits on the human, or on nobody. */
export const NOTHING_TO_RECOMMEND = "No recommended message: the feature waits on you";

/** The comments message's name. */
const COMMENTS_NAME = "Address the pull request's comments";

/**
 * The steps waiting on the agent whose message is not recommended: an unknown pull request's,
 * whose state `gh` could not read.
 */
const NOT_RECOMMENDED = new Set(["none", "done", "pull-request-unknown"]);

/**
 * The one workflow message that applies to a feature now: nothing without its branch or its agent;
 * the step's own while it waits on the agent, the comments message for changes requested on its
 * pull request; else the comments message while its pull request is open or a draft (R3), and
 * its state known (R10).
 */
export function recommendedMessage({
  agent,
  feature,
  next,
}: {
  agent: { available: boolean; name: string };
  feature: FeatureView;
  next: NextView;
}): Recommended {
  const { branch, step } = next;
  if (branch === undefined) {
    return { reason: REFUSALS.noBranch };
  }
  if (!agent.available) {
    return { reason: REFUSALS.unavailable(agent.name) };
  }
  const message = (reference: string, trigger?: Trigger) =>
    runMessage({
      branch,
      feature,
      reference,
      step: step.name,
      ...(step.planReview === undefined ? {} : { planReview: step.planReview }),
      ...(trigger === undefined ? {} : { trigger }),
    });
  const comments = (reference: string): Recommended => ({
    name: COMMENTS_NAME,
    step: step.name,
    text: message(reference, "comments"),
    trigger: "comments",
  });
  if (step.waitsOn === "agent" && step.reference && !NOT_RECOMMENDED.has(step.name)) {
    if (step.name === "pull-request-changes") {
      return comments(step.reference);
    }
    const { name, work } = goal(step.name, step.planReview);
    const words = name ?? work;
    return {
      name: `Continue, ${words.charAt(0).toLowerCase()}${words.slice(1)}`,
      step: step.name,
      text: message(step.reference),
      trigger: "manual",
    };
  }
  // Without `gh`, the pull request is its record's, read as open: its state is unknown (R10).
  const unknown = step.name === "pull-request-unknown" || step.pullRequest === "unknown";
  if (feature.pullRequest !== undefined && !unknown) {
    return comments(commentsReference(feature));
  }
  return { reason: NOTHING_TO_RECOMMEND };
}

/**
 * Why a workflow message sent now runs as a chat, the line its turn shows, or undefined when it
 * still applies: a comments message while the comments message is recommended; a message read at
 * a step, `workflow.step`, while that step's is; a hand-over's, without a step, while the step
 * waits on the agent. The line says what holds now: the feature waits on the human, no pull
 * request is open for a comments message, or the feature is at another step. The sender checked
 * the agent is available.
 */
export async function sentAsChat({
  feature: read,
  next,
  workflow,
}: {
  /** Read only when the recommended message, or the line, decides. */
  feature: () => Promise<FeatureView>;
  next: NextView;
  workflow: { step?: string; trigger: Trigger };
}): Promise<string | undefined> {
  let view: Promise<FeatureView> | undefined;
  const feature = () => (view ??= read());
  if (await applies({ feature, next, workflow })) {
    return undefined;
  }
  if (next.step.waitsOn === "human") {
    return SENT_AS_CHAT;
  }
  if (workflow.trigger === "comments" && (await feature()).pullRequest === undefined) {
    return SENT_AS_CHAT_NO_PULL_REQUEST;
  }
  return SENT_AS_CHAT_MOVED_ON;
}

/** Whether a workflow message sent now still applies, as `sentAsChat` says. */
async function applies({
  feature,
  next,
  workflow,
}: Parameters<typeof sentAsChat>[0]): Promise<boolean> {
  if (workflow.trigger !== "comments" && workflow.step === undefined) {
    return next.step.waitsOn === "agent";
  }
  const recommended = recommendedMessage({
    agent: { available: true, name: "" },
    feature: await feature(),
    next,
  });
  if (workflow.trigger === "comments") {
    return "trigger" in recommended && recommended.trigger === "comments";
  }
  return "step" in recommended && recommended.step === workflow.step;
}

/** The first message of a chat, which tells the agent to wait for the human's requests. */
export function chatOpening(input: { branch: string; feature: Subject }): string {
  return (
    `A human is chatting with you about the ${subject(input.feature)}, on branch ` +
    `${input.branch}: answer, and change files, commit, or move the workflow only when they ask.`
  );
}

/** The message that asks the agent to retry an action the human allowed. */
export function retryMessage(denial: { target?: string; tool: string }): string {
  const action = denial.target ? `${denial.tool} ${denial.target}` : denial.tool;
  return `Try the blocked action again, now allowed: ${action}`;
}

const TITLE_LENGTH = 80;

/**
 * A chat's title: its first message's first non-blank line, cut at 80 characters, or "Image" for a
 * message of images alone.
 */
export function chatTitle(text: string, images = false): string {
  const line = text
    .split("\n")
    .map((part) => part.trim())
    .find((part) => part !== "");
  if (line) {
    return line.slice(0, TITLE_LENGTH);
  }
  return images ? "Image" : "New chat";
}

const TARGETS = ["command", "file_path", "url", "pattern", "path"];
const PATHS = ["file_path", "path"];

/**
 * What a tool call acts on, for its log line: its command, file, URL, or pattern. A file under
 * `cwd`, the session's directory, is relative to it.
 */
export function toolTarget(
  _name: string,
  input: Record<string, unknown>,
  cwd?: string,
): string | undefined {
  for (const key of TARGETS) {
    const value = input[key];
    if (typeof value !== "string") {
      continue;
    }
    if (cwd && PATHS.includes(key) && isAbsolute(value)) {
      const path = relative(cwd, value);
      if (path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path)) {
        return path;
      }
    }
    return value;
  }
  return undefined;
}
