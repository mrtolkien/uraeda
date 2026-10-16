// What the hub reads from the workspace and the inbox: a started feature's status, the inbox summed
// up, and a section of the priorities, its running lines first.
import type { useInbox, useWorkspace } from "../data.ts";
import { agentState, type Feature } from "../Home.tsx";
import { waiting } from "../labels.ts";

/** The workspace's priorities, as the hub reads them. */
type Priority = NonNullable<ReturnType<typeof useWorkspace>>["priorities"][number];

/**
 * A started feature's status in a word, as a badge shows it: what it waits on the human for, its
 * agent working, or its step.
 */
export function featureStatus(
  feature: Feature,
  running: Array<string>,
): { label: string; variant: "info" | "success" | "warning" } {
  if (feature.step.waitsOn === "human") {
    return { label: waiting(feature).verb, variant: "warning" };
  }
  const { step, working } = agentState(feature, running);
  return working ? { label: "Working", variant: "success" } : { label: step, variant: "info" };
}

/**
 * The inbox as the hub sums it up: its count, each category with its number of notes, the notes
 * without one first, and the last `latest` notes written. Notes carry no date: quick add writes at
 * the end of the notes without a category, so the latest are taken from there first.
 */
export function inboxSummary(inbox: ReturnType<typeof useInbox>, latest = 3) {
  const categories = (inbox?.categories ?? []).filter((category) => category.notes.length);
  const loose = categories.filter((category) => !category.name).flatMap((c) => c.notes);
  const sorted = categories.filter((category) => category.name).flatMap((c) => c.notes);
  return {
    categories: categories.map((category) => ({
      count: category.notes.length,
      name: category.name ?? "Not sorted",
    })),
    count: inbox?.count ?? 0,
    latest: [...loose.toReversed(), ...sorted.toReversed()].slice(0, latest),
  };
}

/** A line of the priorities, with the feature it started while that feature is not done. */
export type SectionEntry = { entry: Priority; running?: Feature };

/**
 * The lines of a section of the priorities, those whose feature runs first, each keeping its order:
 * a line runs when it links a feature that is not done.
 */
export function prioritySection(
  workspace: { features: Array<Feature>; priorities: Array<Priority> },
  section: string,
): Array<SectionEntry> {
  const entries = workspace.priorities
    .filter((entry) => entry.section === section)
    .map((entry) => {
      const feature = workspace.features.find((f) => f.folder === entry.feature);
      return { entry, running: feature?.step.name === "done" ? undefined : feature };
    });
  return [...entries.filter((e) => e.running), ...entries.filter((e) => !e.running)];
}
