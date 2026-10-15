import { isAbsolute, relative, sep } from "node:path";

/** A feature's or a change's folder, and the word that names it. */
function subject(folder: string, change?: boolean): string {
  return change ? `change specs/changes/${folder}/` : `feature specs/${folder}/`;
}

const READY = "the pull request is ready for review";

/**
 * What a run does from a step, and where it stops: the next human gate, which the step and the
 * spec's `plan-review` decide.
 */
function goal(step: string, planReview?: boolean): { stop: string; work: string } {
  const plan = (first: string) =>
    planReview
      ? { stop: "the plan waits for my review", work: first }
      : { stop: READY, work: `${first}, then implement it` };
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
      return { stop: `${READY} again`, work: "Address the changes requested on the pull request" };
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
  /** A change lives in `specs/changes/`. */
  change?: boolean;
  folder: string;
  /** The spec's `plan-review`, for the steps before the plan is approved. */
  planReview?: boolean;
  reference: string;
  step: string;
}): string {
  const { stop, work } = goal(input.step, input.planReview);
  return (
    `/uraeda:uraeda Continue the ${subject(input.folder, input.change)} on branch ${input.branch}: ` +
    `${work}, starting with ${input.reference}.\n` +
    `Stop when ${stop}, and earlier only if you need a decision from me.\n`
  );
}

/** The first message of a chat, which tells the agent to wait for the human's requests. */
export function chatOpening(input: { branch: string; change?: boolean; folder: string }): string {
  return (
    `A human is chatting with you about the ${subject(input.folder, input.change)}, on branch ` +
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
