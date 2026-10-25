// A `##` section of a document as a pane titled by its heading, its anchor as id: the plan's, and
// the documents'. A task's, titled "Task N · <title>", has its steps checked out of its total.
import { Badge } from "@astryxdesign/core/Badge";
import { Text } from "@astryxdesign/core/Text";
import type { Block, Document } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import type { Folds } from "../Folds.tsx";
import { Pane } from "../layout/Pane.tsx";
import { type PlanSection, sectionId } from "../planParts.ts";
import { Selectable, type Selection, SelectionRoom } from "../Selection.tsx";
import { Spans } from "../Spans.tsx";

/** What the plan's parts draw with: its tree, and while it waits, its review's folds and taps. */
export type Drawing = { document: Document; folds?: Folds; selection?: Selection };

/**
 * While the plan waits for review, its section's heading line, as written, which its pane's title
 * says: tapped, it takes a comment, shown under it. Read-only, nothing.
 */
function HeadingLine({ heading, selection }: { heading: Block; selection?: Selection }) {
  if (!selection) {
    return null;
  }
  return (
    <Selectable block={heading} selection={selection}>
      <Text as="div" color="secondary" display="block" type="inherit">
        {"## "}
        <Spans spans={heading.spans} />
      </Text>
    </Selectable>
  );
}

/**
 * A section in a pane titled by its heading, its anchor as id, open on the phone as the spec's parts
 * are; a task's titled "Task N · <title>", with its steps checked out of its total, so a link to
 * the heading lands on its pane.
 */
export function SectionPane({ drawing, section }: { drawing: Drawing; section: PlanSection }) {
  const { heading, ids, task } = section;
  const blocks = (
    <SelectionRoom selection={drawing.selection}>
      <HeadingLine heading={heading} selection={drawing.selection} />
      {ids.length > 0 && <Blocks {...drawing} ids={ids} />}
    </SelectionRoom>
  );
  if (!task) {
    return (
      <Pane id={sectionId(heading)} isOpenOnPhone title={heading.heading ?? ""}>
        {blocks}
      </Pane>
    );
  }
  const badge = (
    <Badge
      label={`${task.done}/${task.total}`}
      variant={task.done === task.total ? "success" : "neutral"}
    />
  );
  return (
    <Pane
      id={sectionId(heading)}
      isOpenOnPhone
      title={`Task ${task.number} · ${task.title}`}
      titleSuffix={badge}
    >
      {blocks}
    </Pane>
  );
}
