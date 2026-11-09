// What a feature's page adds to its run map, in place of the timeline it replaces: each step's
// time, its files as links, the current build's tasks; the proposal and the merge at the map's two
// ends; and the gates on the joints where the workflow waits for the human, in the `needs-you` role
// while the feature waits there.
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, sizeVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { TaskProgress } from "uraeda-binding";
import type { TimelineFile } from "../feature/stageFiles.ts";
import { useRepoPath } from "../routes.tsx";
import type { Gate, StagePart } from "./featureStages.ts";
import { GitMerge, User } from "./glyphs.tsx";

const styles = stylex.create({
  detail: { display: "flex", flexDirection: "column", gap: spacingVars["--spacing-0-5"] },
  // A file's link, as tall as a control: a finger's 44 px under a coarse pointer.
  end: {
    alignItems: "flex-start",
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-0-5"],
    minInlineSize: 0,
  },
  endHead: {
    alignItems: "baseline",
    columnGap: spacingVars["--spacing-2"],
    display: "flex",
    flexWrap: "wrap",
  },
  file: {
    alignItems: "center",
    display: "inline-flex",
    minHeight: sizeVars["--size-element-sm"],
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fileLine: { display: "flex", flexDirection: "column", minInlineSize: 0 },
  files: {
    columnGap: spacingVars["--spacing-4"],
    display: "flex",
    flexWrap: "wrap",
    rowGap: spacingVars["--spacing-0-5"],
  },
  gate: {
    alignItems: "center",
    color: colorVars["--color-text-secondary"],
    display: "flex",
    justifyContent: "center",
  },
  waiting: { color: "var(--role-needs-you)" },
});

/** "6 tasks", or "1 task". */
const tasks = (count: number) => (count === 1 ? "1 task" : `${count} tasks`);

/**
 * Build's tasks, as the timeline listed them: those done, the current one by its title, then those
 * left. Once every task is done, none is current.
 */
function Tasks({ progress }: { progress: TaskProgress }) {
  const { done, title, total } = progress;
  const left = total - done - 1;
  return (
    <div {...stylex.props(styles.detail)}>
      {done > 0 && <Text color="secondary" size="sm">{`✓ ${tasks(done)} done`}</Text>}
      {done < total && <Text size="sm">{`◉ ${title}`}</Text>}
      {left > 0 && <Text color="secondary" size="sm">{`○ ${tasks(left)} left`}</Text>}
    </div>
  );
}

/** A file of a stage: its link, and under it its status, "to review" while it waits on you. */
function FileLink({ file }: { file: TimelineFile }) {
  const here = useRepoPath();
  return (
    <span {...stylex.props(styles.fileLine)}>
      <Link href={here(file.href)} xstyle={styles.file}>
        {file.label}
      </Link>
      {file.status && (
        <Text color={file.waiting ? "inherit" : "secondary"} size="xsm">
          <span {...stylex.props(file.waiting && styles.waiting)}>{file.status}</span>
        </Text>
      )}
    </span>
  );
}

/** A step's history under its pick: its time, its files, and the build's tasks while at work. */
export function StageDetail({ part }: { part: StagePart | undefined }) {
  if (!part || (part.line === undefined && part.files.length === 0 && !part.tasks)) {
    return null;
  }
  return (
    <div {...stylex.props(styles.detail)}>
      {part.line && (
        <Text color="secondary" size="xsm">
          {part.line}
        </Text>
      )}
      {part.files.length > 0 && (
        <div {...stylex.props(styles.files)}>
          {part.files.map((file) => (
            <FileLink file={file} key={file.href} />
          ))}
        </div>
      )}
      {part.tasks && <Tasks progress={part.tasks} />}
    </div>
  );
}

/** One of the map's two ends: the proposal before the first step, the merge after the last. */
export function MapEnd({ kind, part }: { kind: "proposal" | "merged"; part: StagePart }) {
  const isProposal = kind === "proposal";
  const name = isProposal ? "Proposal" : "Merged";
  const tone =
    part.state === "current" ? "accent" : part.state === "todo" ? "secondary" : "primary";
  return (
    <div aria-current={part.state === "current" ? "step" : undefined} {...stylex.props(styles.end)}>
      <span {...stylex.props(styles.endHead)}>
        <Icon color={tone} icon={isProposal ? "uraeda:step-proposal" : GitMerge} size="sm" />
        <Text color={tone} size="sm" weight="bold">
          {name}
        </Text>
      </span>
      <StageDetail part={part} />
    </div>
  );
}

/** A gate's mark on a joint: the human's turn, in `needs-you` while the feature waits there. */
export function GateMark({ gate }: { gate: Gate }) {
  return (
    <span {...stylex.props(styles.gate, gate === "waiting" && styles.waiting)}>
      <Icon
        color="inherit"
        icon={User}
        label={gate === "waiting" ? "Waits for you here" : "Your turn here"}
        size="xsm"
      />
    </span>
  );
}
