import type { Denial, Trigger } from "./events.ts";

/** What started a run: its trigger, the file it committed, or the rule it allows. */
export type TriggerDetail = { trigger: Trigger; file?: string; rule?: string };

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
export function triggerSentence({ trigger, file, rule }: TriggerDetail): string {
  switch (trigger) {
    case "answers":
      return `The human answered ${fileName(file)} of the questions.`;
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
    case "allow":
      return `The human allowed \`${rule}\`: run it again, then continue.`;
  }
}

/**
 * A run's single message. A resumed session keeps its first system prompt, so every message names
 * the skill, the step, its reference, and the trigger.
 */
export function runMessage(input: {
  folder: string;
  branch: string;
  /** A bug lives in `specs/bugs/`. */
  bug?: boolean;
  step: string;
  reference: string;
  detail: TriggerDetail;
}): string {
  const path = input.bug ? `specs/bugs/${input.folder}/` : `specs/${input.folder}/`;
  return (
    `/uraeda:uraeda Continue the ${input.bug ? "bug" : "feature"} ${path}, on branch ${input.branch}.\n` +
    `${triggerSentence(input.detail)}\n` +
    `Its next step is ${input.step}: follow ${input.reference}.\n` +
    "No chat session is attached: work until the next human gate, and commit every step. The commit is\n" +
    "the message.\n"
  );
}

const TARGETS = ["command", "file_path", "url", "pattern", "path"];

/** What a tool call acts on, for its log line: its command, file, URL, or pattern. */
export function toolTarget(_name: string, input: Record<string, unknown>): string | undefined {
  for (const key of TARGETS) {
    if (typeof input[key] === "string") {
      return input[key];
    }
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
