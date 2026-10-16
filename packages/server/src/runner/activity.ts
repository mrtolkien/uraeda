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

/** The line of a reply that ended while its background tasks run: its sub-agents, its commands. */
export function waitingLabel(background: Map<string, "subagent" | "command">): string {
  const kinds = [...background.values()];
  const count = (kind: string, one: string, many: string) => {
    const n = kinds.filter((each) => each === kind).length;
    return n === 0 ? [] : [`${n} ${n === 1 ? one : many}`];
  };
  const parts = [
    ...count("subagent", "sub-agent", "sub-agents"),
    ...count("command", "background command", "background commands"),
  ];
  return `Waiting for ${parts.join(" and ")}`;
}
