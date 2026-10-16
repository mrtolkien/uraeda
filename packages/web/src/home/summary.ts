// What the hub reads from the priorities and the inbox: a running entry's status, the inbox summed
// up, and a section of the priorities as the hub lists it.
import type { PriorityEntry } from "uraeda-server/fate";
import type { useInbox } from "../data.ts";
import { stepTitle } from "../labels.ts";
import { byRunning, type Priorities } from "../lists/PrioritiesList.tsx";

/**
 * A running entry's status in a word, as a badge shows it: what its gate asks of the human, its
 * agent working, or its step.
 */
export function runningStatus(
  running: NonNullable<PriorityEntry["running"]>,
  working: Array<string>,
): { label: string; variant: "info" | "success" | "warning" } {
  if (running.step.waitsOn === "human") {
    return { label: stepTitle(running.step), variant: "warning" };
  }
  return working.includes(running.folder)
    ? { label: "Working", variant: "success" }
    : { label: stepTitle(running.step), variant: "info" };
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

/**
 * The entries the hub lists for a section, as the priorities page shows them (R10): for Now, the
 * running entries of every section first, then Now's others; for another section, its entries not
 * running. Each keeps the file's order.
 */
export function prioritySection(
  priorities: Pick<Priorities, "sections">,
  section: "now" | "next",
): Array<PriorityEntry> {
  const { ongoing, sections } = byRunning(priorities);
  const rest = sections.find((s) => s.section === section)?.entries ?? [];
  return section === "now" ? [...ongoing, ...rest] : rest;
}
