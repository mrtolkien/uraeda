// The plan's progress, at the session column's foot: while the feature's step has a current task, a
// link to the plan at that task, "Implementation · task 3 of 7" and the task's title, over a bar 3/7
// full (US2, scenario 3). Before the plan, in review, past its last task, or for a change, which has
// no plan, nothing (ruling R8). The phone's status line shows it as "3 / 7".
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Text } from "@astryxdesign/core/Text";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useFeature, useFile } from "../data.ts";
import { stepLabel } from "../labels.ts";
import { sectionId } from "../planParts.ts";
import { useRepoPath } from "../routes.tsx";

const styles = stylex.create({
  // A rule across the column's whole width over it, as over the split's bottom part, its content
  // kept in the column's inset (`SideColumn.tsx`'s `full`).
  progress: {
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
    display: "block",
    marginInline: `calc(-1 * ${spacingVars["--spacing-4"]})`,
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-4"],
    textDecoration: "none",
  },
  title: {
    minWidth: 0,
  },
});

/** The plan's current task, as the progress draws it. */
type PlanTask = {
  /** The plan's page, at the task's heading. */
  href: string;
  /** "Implementation · task 3 of 7". */
  label: string;
  position: number;
  title: string;
  total: number;
};

/** The current task of the plan of `folder`, while its step has one, or `undefined`. */
function usePlanTask(folder: string): PlanTask | undefined {
  const feature = useFeature(folder);
  const progress = feature && !feature.missing ? feature.step.progress : undefined;
  if (!feature || feature.missing || !progress) {
    return undefined;
  }
  return {
    href: `/f/${folder}/plan.md`,
    label: `${stepLabel(feature.step.name)} · task ${progress.position} of ${progress.total}`,
    position: progress.position,
    title: progress.title,
    total: progress.total,
  };
}

/** The anchor of the plan's task at `position`, its heading's, once the plan is read. */
function useTaskAnchor(folder: string, position: number): string {
  const plan = useFile(folder, "plan.md");
  if (!plan || plan.missing) {
    return "";
  }
  const task = plan.current.items.plan?.tasks[position - 1];
  const heading = task === undefined ? undefined : plan.current.document.blocks[task.headingBlock];
  return heading === undefined ? "" : `#${sectionId(heading)}`;
}

/** The plan's progress, at the column's foot: the task, its title, and the bar. */
export function PlanProgress({ folder }: { folder: string }) {
  const task = usePlanTask(folder);
  return task ? <Bar folder={folder} task={task} /> : null;
}

/** The link to the plan at `task`, over its bar. */
function Bar({ folder, task }: { folder: string; task: PlanTask }) {
  const here = useRepoPath();
  const anchor = useTaskAnchor(folder, task.position);
  return (
    <Link href={here(`${task.href}${anchor}`)} type="inherit" xstyle={styles.progress}>
      <HStack align="baseline" gap={2} justify="between">
        <Text>{task.label}</Text>
        <Text color="secondary" type="supporting" xstyle={styles.title}>
          {task.title}
        </Text>
      </HStack>
      {/* The link says the same in words: the bar is drawn for the eye only. */}
      <div aria-hidden>
        <ProgressBar isLabelHidden label={task.label} max={task.total} value={task.position} />
      </div>
    </Link>
  );
}

/** On the phone's status line, "3 / 7", opening the plan at the task. */
export function ProgressChip({ folder }: { folder: string }) {
  const task = usePlanTask(folder);
  return task ? <Chip folder={folder} task={task} /> : null;
}

/** The status line's link to the plan at `task`. */
function Chip({ folder, task }: { folder: string; task: PlanTask }) {
  const here = useRepoPath();
  const anchor = useTaskAnchor(folder, task.position);
  return (
    <Button
      href={here(`${task.href}${anchor}`)}
      icon={<Icon icon="uraeda:list-checks" />}
      // Its name starts with what it shows, as a spoken command names it.
      label={`${task.position} / ${task.total} · ${task.label}`}
      variant="ghost"
    >
      {`${task.position} / ${task.total}`}
    </Button>
  );
}
