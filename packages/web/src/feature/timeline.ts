// A feature's or a change's stages as the timeline reads them: their names, and each one's line of
// time, from the core's reading of its commits.
import { clock, duration } from "./times.ts";
import { plural } from "../labels.ts";

/** Each stage's name, as the core sends it, in words. */
export const LABELS: Record<string, string> = {
  build: "Build",
  fix: "Fix",
  merged: "Merged",
  plan: "Plan",
  proposal: "Proposal",
  "pull-request": "Pull request",
  questions: "Questions",
  spec: "Spec",
};

/** A stage, and its start, RFC 3339, when a commit started it. */
type Stage = { name: string; started?: string | null };

/** The history the stages draw, and its folder, whose day the page's header gives. */
export type StagesHistory = {
  current: number;
  folder?: string;
  rounds?: number | null;
  stages: Array<Stage>;
};

/** The start of the first stage after `index` that started: when the stage at `index` ended. */
function endOf(stages: Array<Stage>, index: number): string | undefined {
  return stages.slice(index + 1).find((stage) => stage.started)?.started ?? undefined;
}

/**
 * The start of the last stage before `index` that started, against which its day is told: for the
 * first, the folder's day, which the page's header gives (C1).
 */
function previousStart({ folder, stages }: StagesHistory, index: number): string | undefined {
  return (
    stages
      .slice(0, index)
      .reverse()
      .find((stage) => stage.started)?.started ??
    folder?.slice(0, 10) ??
    undefined
  );
}

/**
 * A stage's line: "12:11 · 2 h 50 min" once passed, "since 15:08" while current, and nothing before
 * it started; Questions adds its rounds, "1 round" or "2 rounds".
 */
export function stageLine(history: StagesHistory, index: number): string | undefined {
  const stage = history.stages[index];
  const parts: Array<string> = [];
  if (stage?.started) {
    const at = clock(stage.started, previousStart(history, index));
    const end = index < history.current ? endOf(history.stages, index) : undefined;
    if (index === history.current) {
      parts.push(`since ${at}`);
    } else if (end) {
      parts.push(at, duration((Date.parse(end) - Date.parse(stage.started)) / 1000));
    } else {
      parts.push(at);
    }
  }
  if (stage?.name === "questions" && (history.rounds ?? 0) > 0) {
    parts.push(plural(history.rounds ?? 0, "round"));
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}
