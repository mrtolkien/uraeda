// A feature's or a change's timeline: its stages as a vertical spine, each with its time, its files
// as links, and, for the current Build, its tasks. A stage not reached shows its name only, dimmed.
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, fontWeightVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { TaskProgress } from "uraeda-binding";
import { Pane } from "../layout/Pane.tsx";
import { useRepoPath } from "../routes.tsx";
import { filesByStage, type FilesFeature, type TimelineFile } from "./stageFiles.ts";
import { LABELS, stageLine, type StagesHistory } from "./timeline.ts";

const styles = stylex.create({
  files: {
    columnGap: spacingVars["--spacing-4"],
    display: "flex",
    flexWrap: "wrap",
    rowGap: spacingVars["--spacing-0-5"],
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-3"],
    listStyleType: "none",
    margin: 0,
    padding: 0,
  },
  mark: {
    color: colorVars["--color-text-secondary"],
    flexShrink: 0,
    inlineSize: spacingVars["--spacing-6"],
    marginInlineEnd: spacingVars["--spacing-2"],
  },
  markCurrent: { color: colorVars["--color-accent"] },
  name: { fontWeight: fontWeightVars["--font-weight-bold"] },
  nameCurrent: { color: colorVars["--color-accent"] },
  nameTodo: {
    color: colorVars["--color-text-secondary"],
    fontWeight: fontWeightVars["--font-weight-normal"],
  },
  row: { display: "flex" },
  stage: {
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-1"],
    minInlineSize: 0,
  },
  tasks: { display: "flex", flexDirection: "column", gap: spacingVars["--spacing-0-5"] },
  title: {
    alignItems: "baseline",
    columnGap: spacingVars["--spacing-3"],
    display: "flex",
    flexWrap: "wrap",
  },
  waiting: { color: colorVars["--color-text-orange"] },
});

/** The stage's mark: passed, current, or ahead; the list says which is current. */
const MARKS = { current: "◉", done: "✓", todo: "○" } as const;

/** "Tasks 1–6", or "Task 8" for one: a run of the plan's tasks, by position. */
function tasksOf(from: number, to: number): string {
  return from === to ? `Task ${from}` : `Tasks ${from}–${to}`;
}

/** Build's tasks: the done ones grouped, the current one by number and title, the rest grouped. */
function Tasks({ progress }: { progress: TaskProgress }) {
  const { position, title, total } = progress;
  return (
    <div {...stylex.props(styles.tasks)}>
      {position > 1 && <Text color="secondary">✓ {tasksOf(1, position - 1)}</Text>}
      <Text>
        ◉ {position} {title}
      </Text>
      {position < total && <Text color="secondary">○ {tasksOf(position + 1, total)}</Text>}
    </div>
  );
}

/** A file of a stage: a link, and its status after a middot, "to review" while it waits on you. */
function FileLink({ file }: { file: TimelineFile }) {
  const here = useRepoPath();
  return (
    <span>
      <Link href={here(file.href)}>{file.label}</Link>
      {file.status && (
        <span {...stylex.props(file.waiting && styles.waiting)}> · {file.status}</span>
      )}
    </span>
  );
}

/**
 * The timeline: a pane with one item per stage. The current one is `aria-current="step"`, marked
 * by its glyph and its colour; a stage ahead shows its name only, dimmed.
 */
export function Timeline({
  feature,
  history,
  progress,
}: {
  feature: FilesFeature;
  history: StagesHistory;
  progress?: TaskProgress | null;
}) {
  const files = filesByStage(
    feature,
    history.stages.map((stage) => stage.name),
  );
  return (
    <Pane id="stages" title="Timeline">
      <ol aria-label="Stages" {...stylex.props(styles.list)}>
        {history.stages.map((stage, index) => {
          const state =
            index < history.current ? "done" : index === history.current ? "current" : "todo";
          const line = stageLine(history, index);
          const listed = files.get(stage.name) ?? [];
          return (
            <li
              aria-current={state === "current" ? "step" : undefined}
              key={stage.name}
              {...stylex.props(styles.row)}
            >
              <span
                aria-hidden="true"
                {...stylex.props(styles.mark, state === "current" && styles.markCurrent)}
              >
                {MARKS[state]}
              </span>
              <div {...stylex.props(styles.stage)}>
                <div {...stylex.props(styles.title)}>
                  <span
                    {...stylex.props(
                      styles.name,
                      state === "current" && styles.nameCurrent,
                      state === "todo" && styles.nameTodo,
                    )}
                  >
                    {LABELS[stage.name] ?? stage.name}
                  </span>
                  {line && <Text color="secondary">{line}</Text>}
                </div>
                {listed.length > 0 && (
                  <div {...stylex.props(styles.files)}>
                    {listed.map((file) => (
                      <FileLink file={file} key={file.href} />
                    ))}
                  </div>
                )}
                {stage.name === "build" && state === "current" && progress && (
                  <Tasks progress={progress} />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Pane>
  );
}
