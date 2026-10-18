// A feature's or a change's stages, as the core read them from its commits: the current one marked,
// each passed one with its start and duration, the current one since when.
import { Step, Stepper } from "@astryxdesign/core/Stepper";
import * as stylex from "@stylexjs/stylex";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { useWidthOf } from "../layout/useWidthOf.ts";
import { clock, duration } from "./times.ts";

const styles = stylex.create({
  // Each stage as wide as its own label or line, the room left shared out: a dated line takes
  // the width it needs, and the stages around it give theirs (C3).
  step: { flex: "1 0 auto" },
});

/** The room left between two stages' texts, at the least, for the row to read as stages. */
const BREATH = 16;

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
 * it started; Questions adds its rounds when it had several.
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
  if (stage?.name === "questions" && (history.rounds ?? 0) > 1) {
    parts.push(`${history.rounds} rounds`);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** The width of the widest text a stage draws, its label or its line, read out words left out. */
function textWidth(item: Element): number {
  const range = document.createRange();
  const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
  let widest = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    // A word for screen readers only sits in a box of a pixel.
    if ((node.parentElement?.getBoundingClientRect().width ?? 0) > 1) {
      range.selectNodeContents(node);
      widest = Math.max(widest, range.getBoundingClientRect().width);
    }
  }
  return widest;
}

/**
 * Whether the stages hold in one row of `room` px, each stage's label and line on one line, read on
 * the row as drawn, before the screen shows it, whenever the room or the texts change: a row too
 * wide for its room is drawn as a column, and tried again once the room grows past the width it
 * needed.
 */
function useRowFits(
  list: RefObject<HTMLDivElement | null>,
  { room, texts, wide }: { room: number; texts: string; wide: boolean },
) {
  const [needed, setNeeded] = useState(0);
  const row = wide && room >= needed;
  useLayoutEffect(() => {
    const measure = () => {
      const items = list.current?.querySelector("ol")?.children;
      if (!row || !items || room === 0) {
        return;
      }
      // Stages never shrink below their texts, so each text is on one line here.
      const width = [...items].reduce((sum, item) => sum + textWidth(item) + BREATH, 0);
      if (width > room) {
        setNeeded(width);
      }
    };
    measure();
  }, [list, room, row, texts]);
  return row;
}

/**
 * The stages: a row on a wide screen when every stage's line holds on one line in it, a column on
 * the phone, and on a wide screen too narrow for the row (C3).
 */
export function Stages({ history }: { history: StagesHistory }) {
  const wide = useWidthClass() === "wide";
  const ref = useRef<HTMLDivElement>(null);
  const lines = history.stages.map((_, index) => stageLine(history, index));
  const row = useRowFits(ref, { room: useWidthOf(ref), texts: lines.join("\n"), wide });
  return (
    <div id="stages" ref={ref}>
      <Stepper
        activeStep={history.current}
        density="compact"
        // The row's own measure decides when it holds: Astryx's collapse would drop the lines.
        horizontalOptions={{ collapsedVariant: "withLabel", minimumStepWidth: 0 }}
        indicatorPosition={row ? "on-track" : "separated"}
        label="Stages"
        orientation={row ? "horizontal" : "vertical"}
      >
        {history.stages.map((stage, index) => (
          <Step
            description={lines[index]}
            key={stage.name}
            label={LABELS[stage.name] ?? stage.name}
            status={index < history.current ? "success" : undefined}
            step={index}
            xstyle={row ? styles.step : undefined}
          />
        ))}
      </Stepper>
    </div>
  );
}
