import { Badge } from "@astryxdesign/core/Badge";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
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
    marginInline: `calc(-1 * ${spacingVars["--spacing-4"]})`,
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
 * The headings a review draws its own way: a story's, after its band, its id and priority above its
 * title; and a task's, with its steps checked out of its total.
 */
export function reviewHeadings(items: File["current"]["items"], wide: boolean) {
  const stories = new Map(items.spec?.stories.map((story) => [story.headingBlock, story]) ?? []);
  const tasks = new Map((items.plan?.tasks ?? []).map((task) => [task.headingBlock, task]));
  return (block: Block): ReactNode | undefined => {
    const story = stories.get(block.id);
    if (story) {
      return (
        <div id={block.anchor} key={block.id}>
          <Band wide={wide} />
          <Text color="secondary" type="supporting" weight="semibold">
            {story.id} · {story.priority}
          </Text>
          <Heading level={3}>{story.title}</Heading>
        </div>
      );
    }
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
