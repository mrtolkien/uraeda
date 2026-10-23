// Home's core, above the "Overview" line: the problems that stop the workflow, when there are any,
// what waits on the human, then what agents work on beside the sessions without a workflow.
import { Pane } from "../layout/Pane.tsx";
import { HarnessMark, harnessMark } from "../HarnessMark.tsx";
import { stepLabel, waiting } from "../labels.ts";
import { sessionIdPath, useRepoPath } from "../routes.tsx";
import { byStatus, type Feature, featureStatus, type Row, stepOf } from "../sidebar/cards.ts";
import { StepIcon } from "../sidebar/StepIcon.tsx";
import { Empty, HomeRow } from "./parts.tsx";

/**
 * The features whose files stop the workflow, each with its first problem, opening its page:
 * nothing when there are none.
 */
export function Problems({ features }: { features: Array<Feature> }) {
  const here = useRepoPath();
  if (features.length === 0) {
    return null;
  }
  return (
    <Pane count={features.length} title="Problems" tone="problem">
      {features.map((feature) => (
        <HomeRow
          action="Fix"
          href={here(`/f/${feature.folder}`)}
          icon={<StepIcon step="problem" />}
          key={feature.folder}
          sub={feature.problems[0]?.message}
          title={feature.title}
        />
      ))}
    </Pane>
  );
}

/** What waits on the human: each feature's title, its step and its line, and what it asks. */
export function NeedsYou({ features }: { features: Array<Feature> }) {
  const here = useRepoPath();
  return (
    <Pane count={features.length} title="Needs you" tone="attention">
      {features.length === 0 ? (
        <Empty>Nothing waits on you.</Empty>
      ) : (
        features.map((feature) => {
          const { href, line, name, verb } = waiting(feature);
          return (
            <HomeRow
              action={verb}
              href={here(href)}
              icon={<StepIcon step={stepOf(feature).kind} />}
              key={feature.folder}
              sub={[name, line].filter(Boolean).join(" · ")}
              title={feature.title}
            />
          );
        })
      )}
    </Pane>
  );
}

/** A feature's second line in progress: its step, its task, and its plan's progress. */
function progressLine(feature: Feature) {
  const { progress, task } = feature.step;
  return [
    stepLabel(feature.step.name),
    progress ? `task ${progress.position} of ${progress.total}` : undefined,
    task,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** What agents work on: each feature's title, its step and task, and its session's status. */
export function InProgress({ features, rows }: { features: Array<Feature>; rows: Array<Row> }) {
  const here = useRepoPath();
  return (
    <Pane count={features.length} title="In progress">
      {features.length === 0 ? (
        <Empty>Nothing in progress.</Empty>
      ) : (
        features.map((feature) => {
          const row = rows.find((candidate) => candidate.folder === feature.folder);
          return (
            <HomeRow
              href={here(`/f/${feature.folder}`)}
              icon={<StepIcon step={stepOf(feature).kind} />}
              key={feature.folder}
              status={featureStatus(feature, row)}
              sub={progressLine(feature)}
              title={feature.title}
            />
          );
        })
      )}
    </Pane>
  );
}

/** The sessions without a workflow, what needs the human first: each with its harness and status. */
export function Sessions({ rows }: { rows: Array<Row> }) {
  const here = useRepoPath();
  const sessions = byStatus(
    rows
      .filter((row) => row.folder === null && !row.archived && !row.done)
      .map((row) => ({
        row,
        start: row.startedAt,
        status: { label: row.statusLabel, status: row.status },
      })),
  );
  return (
    <Pane count={sessions.length} title="Sessions">
      {sessions.length === 0 ? (
        <Empty>No session running.</Empty>
      ) : (
        sessions.map(({ row, status }) => (
          <HomeRow
            href={here(sessionIdPath(row.id))}
            icon={<HarnessMark isDecorative kind={row.agent} />}
            key={row.id}
            status={status}
            sub={harnessMark(row.agent).name}
            title={row.title}
          />
        ))
      )}
    </Pane>
  );
}
