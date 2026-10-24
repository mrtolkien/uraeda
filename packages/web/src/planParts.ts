// A plan's parts, in its file's order, from the core's tree and items: the blocks before its first
// section, its lead paragraphs among them, then each `##` section, a task's or not.
import type { Block, Document, PlanItems, TaskItem } from "uraeda-binding";

/** A run of the blocks before the first section: a lead paragraph alone, or the others in a row. */
export type OpeningRun =
  | { block: number; kind: "lead"; label: string }
  | { ids: Array<number>; kind: "blocks" };

/** A `##` section: its heading, its blocks after it, and its task, if it is one. */
export type PlanSection = { heading: Block; ids: Array<number>; task?: TaskItem };

const isSection = (block: Block) => block.kind === "heading" && block.level === 2;
const isTitle = (block: Block) => block.kind === "heading" && block.level === 1;

/**
 * The plan's top-level blocks, cut at its `##` headings: the opening runs before the first, its
 * title left out, and the sections. A plan with no tasks has sections only.
 */
export function planParts(
  document: Document,
  items: PlanItems | undefined,
): { opening: Array<OpeningRun>; sections: Array<PlanSection> } {
  const leads = new Map((items?.lead ?? []).map((lead) => [lead.block, lead.label]));
  const tasks = new Map((items?.tasks ?? []).map((task) => [task.headingBlock, task]));
  const opening: Array<OpeningRun> = [];
  const sections: Array<PlanSection> = [];
  for (const block of document.blocks) {
    if (block.parent != null || isTitle(block)) {
      continue;
    }
    const label = leads.get(block.id);
    const last = sections.at(-1);
    if (isSection(block)) {
      sections.push({ heading: block, ids: [], task: tasks.get(block.id) });
    } else if (last) {
      last.ids.push(block.id);
    } else if (label !== undefined) {
      opening.push({ block: block.id, kind: "lead", label });
    } else {
      const run = opening.at(-1);
      if (run?.kind === "blocks") {
        run.ids.push(block.id);
      } else {
        opening.push({ ids: [block.id], kind: "blocks" });
      }
    }
  }
  return { opening, sections };
}
