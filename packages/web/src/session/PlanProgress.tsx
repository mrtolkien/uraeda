// The plan's progress, at the session column's foot: while the feature's step has a current task, a
// link to the plan at that task, "Implementation · task 3 of 7" and the task's title, over a bar 3/7
// full (US2, scenario 3). Before the plan, in review, past its last task, or for a change, which has
// no plan, nothing (ruling R8). The phone's status line shows it as "3 / 7". The link reaches the
// task's heading once the plan is read, or the plan's top when its read fails.
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Text } from "@astryxdesign/core/Text";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { useFeature, useFile } from "../data.ts";
import { stepLabel } from "../labels.ts";
import { sectionId } from "../planParts.ts";
import { useRepoPath } from "../routes.tsx";
import { Section } from "./Section.tsx";

const styles = stylex.create({
  // A rule across the column's whole width over it, as over the split's bottom part, its content
  // kept in the column's inset (`SideColumn.tsx`'s `full`).
  progress: {
    // Its own width decides whether the task's title fits beside the label.
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
    containerType: "inline-size",
    display: "block",
    marginInline: `calc(-1 * ${spacingVars["--spacing-4"]})`,
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-4"],
    textDecoration: "none",
  },
  // The label, then the task's title beside it, apart at the row's ends; in a column narrower than
  // a document's, as the session's at semi-wide, the title under the label, so neither wraps in a
  // sliver of the row.
  row: {
    alignItems: { "@container (max-width: 360px)": "start", default: "baseline" },
    columnGap: spacingVars["--spacing-2"],
    display: "flex",
    flexDirection: { "@container (max-width: 360px)": "column", default: "row" },
    justifyContent: "space-between",
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
  return task ? <AtTask folder={folder} link={Bar} task={task} /> : null;
}

/**
 * `link` at the anchor of the plan's task `task` of `folder`, once the plan is read, or at the
 * plan's top once its read failed. While it loads, nothing: the link is drawn once, at its place.
 */
function AtTask({
  folder,
  link: Linked,
  task,
}: {
  folder: string;
  link: (props: { anchor: string; task: PlanTask }) => ReactNode;
  task: PlanTask;
}) {
  return (
    <Section failed={<Linked anchor="" task={task} />}>
      <Anchored folder={folder} link={Linked} task={task} />
    </Section>
  );
}

/** `link` at the anchor of the plan's task, which it reads. */
function Anchored({
  folder,
  link: Linked,
  task,
}: {
  folder: string;
  link: (props: { anchor: string; task: PlanTask }) => ReactNode;
  task: PlanTask;
}) {
  return <Linked anchor={useTaskAnchor(folder, task.position)} task={task} />;
}

/** The link to the plan at `task`, its heading's `anchor`, over its bar. */
function Bar({ anchor, task }: { anchor: string; task: PlanTask }) {
  const here = useRepoPath();
  return (
    <Link href={here(`${task.href}${anchor}`)} type="inherit" xstyle={styles.progress}>
      <span {...stylex.props(styles.row)}>
        <Text>{task.label}</Text>
        <Text color="secondary" type="supporting" xstyle={styles.title}>
          {task.title}
        </Text>
      </span>
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
  return task ? <AtTask folder={folder} link={Chip} task={task} /> : null;
}

/** The status line's link to the plan at `task`, its heading's `anchor`. */
function Chip({ anchor, task }: { anchor: string; task: PlanTask }) {
  const here = useRepoPath();
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
