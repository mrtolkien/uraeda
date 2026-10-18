import { Badge } from "@astryxdesign/core/Badge";
import { Heading } from "@astryxdesign/core/Heading";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { Block } from "uraeda-binding";
import type { useFile } from "./data.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

const styles = stylex.create({
  band: {
    // A story's heading, after a band to the screen's edges on the phone.
    backgroundColor: colorVars["--color-background-muted"],
    height: spacingVars["--spacing-2"],
    marginBlock: spacingVars["--spacing-5"],
  },
  bandBleed: {
    // The page's inset, taken back (see `Page`).
    marginInline: "var(--page-bleed)",
  },
  task: {
    marginBlock: spacingVars["--spacing-4"],
  },
});

/** The band before a story or a review's end, to the screen's edges on the phone. */
export function Band({ wide }: { wide: boolean }) {
  return <div {...stylex.props(styles.band, !wide && styles.bandBleed)} />;
}

/**
 * The headings a plan's review draws its own way: a task's, with its steps checked out of its total.
 * A spec has its own page.
 */
export function reviewHeadings(items: File["current"]["items"]) {
  const tasks = new Map((items.plan?.tasks ?? []).map((task) => [task.headingBlock, task]));
  return (block: Block): ReactNode | undefined => {
    const task = tasks.get(block.id);
    if (task) {
      return (
        <div id={block.anchor} key={block.id} {...stylex.props(styles.task)}>
          <Heading level={3}>
            Task {task.number}: {task.title}{" "}
            <Badge
              label={`${task.done}/${task.total}`}
              variant={task.done === task.total ? "success" : "neutral"}
            />
          </Heading>
        </div>
      );
    }
    return undefined;
  };
}
