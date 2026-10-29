// A `##` section of a document as a pane titled by its heading, its anchor as id: the plan's, and
// the documents'. A task's, titled "Task N · <title>", has its steps checked out of its total.
import { Badge } from "@astryxdesign/core/Badge";
import type { Document } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import type { Folds } from "../Folds.tsx";
import { Pane } from "../layout/Pane.tsx";
import { type PlanSection, sectionId } from "../planParts.ts";
import { type Selection, SelectionRoom } from "../Selection.tsx";

/** What the plan's parts draw with: its tree, and while it waits, its review's folds and taps. */
export type Drawing = { document: Document; folds?: Folds; selection?: Selection };

/**
 * A section in a pane titled by its heading, its anchor as id, open on the phone as the spec's parts
 * are; a task's titled "Task N · <title>", with its steps checked out of its total, so a link to
 * the heading lands on its pane. The heading is the title alone, never written again above the
 * section's text ("Remove stuttering").
 */
export function SectionPane({ drawing, section }: { drawing: Drawing; section: PlanSection }) {
  const { heading, ids, task } = section;
  const blocks = (
    <SelectionRoom selection={drawing.selection}>
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
