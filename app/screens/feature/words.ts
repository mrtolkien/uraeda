// The feature page's words: times as a person reads them, the names of steps, stages, and files,
// and what a status means. Pure, with the clock an argument: the rules they say are the server's,
// these only put them in words.
import { serverDay, serverTime } from "../../store";
import type { Feature, FileSummary, Session, Turn, Wait } from "../../store/protocol";

const two = (value: number) => String(value).padStart(2, "0");

/** A time as the server sends it: RFC 3339, `YYYY-MM-DD`, or milliseconds since 1970. */
export type When = string | number;

/** "17 Oct": a day, in the server's zone, as the store writes every day. */
export const day = (when: When): string => serverDay(when);

/** "14:02" today, "Tue 14:02" within the week, "17 Oct 14:02" before: the server's zone. */
export const clock = (when: When, now: number = Date.now()): string => serverTime(when, now);

/** "45 s", "12 min", "2 h 50 min", "3 d 4 h". */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const minutes = Math.floor(s / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
  const days = Math.floor(hours / 24);
  return hours % 24 === 0 ? `${days} d` : `${days} d ${hours % 24} h`;
}

/** "Feature" or "Change". */
export const kindWord = (feature: Pick<Feature, "kind">) =>
  feature.kind === "change" ? "Change" : "Feature";

/** A stage of the history, as the core names it, in words. */
export const STAGES: Readonly<Record<string, string>> = {
  build: "Build",
  fix: "Fix",
  merged: "Merged",
  plan: "Plan",
  proposal: "Proposal",
  "pull-request": "Pull request",
  questions: "Questions",
  spec: "Spec",
};

/** A step of the workflow, as the core names it, in words. */
const STEPS: Readonly<Record<string, string>> = {
  approval: "Approval",
  "catch-up": "Catch up",
  change: "Change",
  discovery: "Discovery",
  done: "Done",
  "final-review": "Final review",
  finish: "Finish",
  implementation: "Build",
  none: "No step",
  plan: "Plan",
  "plan-revision": "Plan revision",
  "pull-request": "Pull request",
  "pull-request-changes": "Changes requested",
  "pull-request-unknown": "Pull request",
  push: "Push",
  spec: "Spec",
  "spec-revision": "Spec revision",
};

export const stepWord = (name: string) => STEPS[name] ?? name;

/** What the agent does at each of its steps. */
const AGENT_DOES: Readonly<Record<string, string>> = {
  approval: "The agent applies your approval",
  "catch-up": "The agent catches the branch up with the default branch",
  change: "The agent makes the change",
  discovery: "The agent investigates and asks",
  "final-review": "The agent reviews the feature",
  finish: "The agent opens the pull request",
  implementation: "The agent builds the plan",
  plan: "The agent writes the plan",
  "plan-revision": "The agent revises the plan",
  "pull-request-changes": "The agent answers the changes requested",
  push: "The agent pushes what the pull request lacks",
  spec: "The agent writes the spec",
  "spec-revision": "The agent revises the spec",
};

export const agentDoes = (step: string) => AGENT_DOES[step] ?? stepWord(step);

/** A file of the feature's folder, in words: "Questions 01", "Spec review". */
export function fileWord(file: Pick<FileSummary, "kind" | "name" | "round">): string {
  const round = file.round === null ? "" : ` ${two(file.round)}`;
  switch (file.kind) {
    case "discovery":
      return `Discovery${round}`;
    case "clarifications":
      return `Questions${round}`;
    case "findings":
      return `Findings${round}`;
    case "review":
      return file.name.startsWith("plan") ? "Plan review" : "Spec review";
    case "data-model":
      return "Data model";
    case "proposal":
    case "plan":
    case "record":
    case "rulings":
    case "spec":
      return file.kind[0].toUpperCase() + file.kind.slice(1);
    default:
      return file.name;
  }
}

/** The stages, in workflow order: a file whose own stage the feature lacks falls back along it. */
const ORDER = ["proposal", "questions", "spec", "plan", "fix", "build", "pull-request", "merged"];

function wanted(file: Pick<FileSummary, "kind" | "name">, stages: ReadonlyArray<string>): string {
  switch (file.kind) {
    case "proposal":
      return "proposal";
    case "discovery":
    case "clarifications":
      return "questions";
    case "review":
      return file.name.startsWith("plan") ? wanted({ kind: "plan", name: "" }, stages) : "spec";
    case "plan":
    case "rulings":
      return stages.includes("plan") ? "plan" : "fix";
    case "findings":
      return stages.includes("build") ? "build" : "fix";
    case "record":
      return "merged";
    default:
      return "spec";
  }
}

/** The stage of `stages` a file shows under: its own, else the nearest earlier one, else the first. */
export function stageOf(
  file: Pick<FileSummary, "kind" | "name">,
  stages: ReadonlyArray<string>,
): string {
  const target = wanted(file, stages);
  if (stages.includes(target)) return target;
  const earlier = ORDER.slice(0, ORDER.indexOf(target)).toReversed();
  return earlier.find((name) => stages.includes(name)) ?? stages[0] ?? target;
}

/** Why a run waits to go on by itself, and when: "Waits for the usage limit to reset, at 15:08". */
export function waitWords(wait: Wait, account: string | null, now: number): string {
  const at = clock(wait.at, now);
  const on = account === null ? "" : `, on ${account}`;
  switch (wait.reason) {
    case "limit":
      return `Waits for the usage limit to reset${on}: goes on at ${at}`;
    case "account":
      return `Waits for an account with usage left${on}: goes on at ${at}`;
    case "restart":
      return `Waits to go on after the server's restart: at ${at}`;
    default:
      return `Waits to go on by itself at ${at}`;
  }
}

/** What a turn that ended badly says: "The run failed: <why>". */
export function endedWords(turn: Pick<Turn, "reason" | "state">): string | undefined {
  if (turn.state === "failed") return turn.reason ?? "The run failed, and said nothing of why.";
  if (turn.state === "stopped") return turn.reason ?? "The run was stopped.";
  return undefined;
}

/** "Claude · Opus 5.5 · on work": who runs a session. */
export function whoWords(session: Pick<Session, "account" | "agent" | "ranModel" | "model">) {
  const model = session.ranModel ?? session.model;
  return [session.agent, model, session.account === null ? null : `on ${session.account}`]
    .filter((part): part is string => part !== null && part !== "")
    .join(" · ");
}
