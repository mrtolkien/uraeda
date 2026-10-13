import { isAbsolute, relative, sep } from "node:path";
import type { Denial, Trigger } from "./events.ts";

/** What a committed file is, in a sentence: "round 01", "spec", "bug report". */
function fileName(file = ""): string {
  const round = /^clarifications-(\d+)\.md$/.exec(file);
  if (round) {
    return `round ${round[1]}`;
  }
  if (file === "report.md") {
    return "bug report";
  }
  return file.replace(/\.md$/, "");
}

/** The sentence that tells the agent why it runs. */
export function triggerSentence({ trigger, file }: { trigger: Trigger; file?: string }): string {
  switch (trigger) {
    case "answers":
      return `The human answered ${file} of the questions.`;
    case "approval":
      return `The human approved the ${fileName(file)}.`;
    case "changes":
      return `The human requested changes on the ${fileName(file)}.`;
    case "proposal":
      return `The human committed the ${fileName(file)}.`;
    case "start":
      return "The human started the feature.";
    case "manual":
      return "The human asked you to continue.";
  }
}

/** A feature's or a bug's folder, and the word that names it. */
function subject(folder: string, bug?: boolean): string {
  return bug ? `bug specs/bugs/${folder}/` : `feature specs/${folder}/`;
}

/**
 * The workflow's message, which the human reads and may change before sending. A resumed session
 * keeps its first system prompt, so every message names the skill, the step, its reference, and
 * the trigger.
 */
export function runMessage(input: {
  folder: string;
  branch: string;
  /** A bug lives in `specs/bugs/`. */
  bug?: boolean;
  step: string;
  reference: string;
  trigger: Trigger;
  /** The file the human committed, for the trigger's sentence. */
  file?: string;
}): string {
  return (
    `/uraeda:uraeda Continue the ${subject(input.folder, input.bug)}, on branch ${input.branch}.\n` +
    `${triggerSentence(input)}\n` +
    `Its next step is ${input.step}: follow ${input.reference}.\n`
  );
}

/** The first message of a chat, which tells the agent to wait for the human's requests. */
export function chatOpening(input: { folder: string; branch: string; bug?: boolean }): string {
  return (
    `A human is chatting with you about the ${subject(input.folder, input.bug)}, on branch ` +
    `${input.branch}: answer, and change files, commit, or move the workflow only when they ask.`
  );
}

/** The message that asks the agent to retry an action the human allowed. */
export function retryMessage(denial: { tool: string; target?: string }): string {
  const action = denial.target ? `${denial.tool} ${denial.target}` : denial.tool;
  return `Try the blocked action again, now allowed: ${action}`;
}

const TITLE_LENGTH = 80;

/** A chat's title: its first message's first non-blank line, cut at 80 characters. */
export function chatTitle(text: string): string {
  const line = text
    .split("\n")
    .map((part) => part.trim())
    .find((part) => part !== "");
  return line ? line.slice(0, TITLE_LENGTH) : "New chat";
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

/**
 * The narrowest allow rule for a blocked action, for `--allowedTools`. Claude Code checks files
 * against `Edit` and `Read` rules only, so a blocked `Write` gets an `Edit` rule. In a file rule,
 * `/path` is relative to the settings' folder, so an absolute path takes two slashes:
 * `Edit(//home/me/a)`. A tool with no target gets its bare name, which allows its every call for
 * the run.
 */
export function allowRule({ tool, input }: Denial): string {
  const value = (key: string) => (typeof input[key] === "string" ? input[key] : undefined);
  if (tool === "Bash" && value("command")) {
    return `Bash(${value("command")})`;
  }
  const file = value("file_path");
  if (["Edit", "Write", "MultiEdit", "Read"].includes(tool) && file) {
    const path = file.startsWith("/") && !file.startsWith("//") ? `/${file}` : file;
    return `${tool === "Read" ? "Read" : "Edit"}(${path})`;
  }
  const url = value("url");
  if (tool === "WebFetch" && url && URL.canParse(url)) {
    return `WebFetch(domain:${new URL(url).hostname})`;
  }
  return tool;
}
