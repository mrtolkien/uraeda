// A feature's or a change's stages, as the core read them from its commits: the current one marked,
// each passed one with its start and duration, the current one since when.
import { Step, Stepper } from "@astryxdesign/core/Stepper";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { clock, duration } from "./times.ts";

/** Each stage's name, as the core sends it, in words. */
const LABELS: Record<string, string> = {
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

/** The history the stages draw. */
export type StagesHistory = { current: number; rounds?: number | null; stages: Array<Stage> };

/** The start of the first stage after `index` that started: when the stage at `index` ended. */
function endOf(stages: Array<Stage>, index: number): string | undefined {
  return stages.slice(index + 1).find((stage) => stage.started)?.started ?? undefined;
}

/** The start of the last stage before `index` that started, against which its day is told. */
function previousStart(stages: Array<Stage>, index: number): string | undefined {
  return (
    stages
      .slice(0, index)
      .reverse()
      .find((stage) => stage.started)?.started ?? undefined
  );
}

/**
 * A stage's line: "12:11 · 2 h 50 min" once passed, "since 15:08" while current, and nothing before
 * it started; Questions adds its rounds when it had several.
 */
export function stageLine(history: StagesHistory, index: number): string | undefined {
  const stage = history.stages[index];
  const parts: Array<string> = [];
  if (stage?.started) {
    const at = clock(stage.started, previousStart(history.stages, index));
    const end = index < history.current ? endOf(history.stages, index) : undefined;
    if (index === history.current) {
      parts.push(`since ${at}`);
    } else if (end) {
      parts.push(at, duration((Date.parse(end) - Date.parse(stage.started)) / 1000));
    } else {
      parts.push(at);
    }
  }
  if (stage?.name === "questions" && (history.rounds ?? 0) > 1) {
    parts.push(`${history.rounds} rounds`);
  }
  // Each part keeps its words together: a line too long for its stage breaks between parts only
  // (C3).
  return parts.length > 0
    ? parts.map((part) => part.replaceAll(" ", "\u00a0")).join(" · ")
    : undefined;
}

/** The stages, horizontal on a wide screen and vertical on the phone. */
export function Stages({ history }: { history: StagesHistory }) {
  const wide = useWidthClass() === "wide";
  return (
    <div id="stages">
      <Stepper
        activeStep={history.current}
        density="compact"
        indicatorPosition={wide ? "on-track" : "separated"}
        label="Stages"
        orientation={wide ? "horizontal" : "vertical"}
      >
        {history.stages.map((stage, index) => (
          <Step
            description={stageLine(history, index)}
            key={stage.name}
            label={LABELS[stage.name] ?? stage.name}
            status={index < history.current ? "success" : undefined}
            step={index}
          />
        ))}
      </Stepper>
    </div>
  );
}
