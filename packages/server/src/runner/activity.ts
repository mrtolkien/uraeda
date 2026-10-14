import type { Activity, TurnActivity } from "./events.ts";

/** What a running turn says when nothing more precise is known: a tool runs, or the model answers. */
export const WORKING = "Working";

/** The activity of a turn that shows something new now. */
export function working(label = WORKING): TurnActivity {
  return { label, since: new Date().toISOString() };
}

/** What the agent writes, for people: "Thinking", "Writing spec.md", "Preparing Bash". */
export function activityLabel(activity: Activity): string {
  if (activity.kind === "thinking") {
    return "Thinking";
  }
  const { name, target } = activity;
  if (name === "Write") {
    return target === undefined ? "Writing a file" : `Writing ${target}`;
  }
  if (["Edit", "MultiEdit", "NotebookEdit"].includes(name)) {
    return target === undefined ? "Editing a file" : `Editing ${target}`;
  }
  return `Preparing ${name}`;
}

/** The line of a reply that ended while its background sub-agents run. */
export function waitingLabel(count: number): string {
  return `Waiting for ${count} ${count === 1 ? "sub-agent" : "sub-agents"}`;
}
