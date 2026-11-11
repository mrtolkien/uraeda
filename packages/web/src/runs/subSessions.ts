// A sub-session (spec of Run options): a sub-agent Uraeda runs as a session of its own, an
// implementer of a task or a reviewer of a wave or the branch, started by a workflow session, its
// parent. The Sub-agents pane, the feature's sessions, and the sub-session's page all draw it from
// its parent's record, which lists them.
import type { Session } from "uraeda-server/fate";

/** A sub-session, as its parent's record lists it. */
export type SubSession = Session["subSessions"][number];

/** Where a sub-session stands: at work, ended with its answer, failed, or stopped. */
export type SubSessionState = SubSession["state"];

/** A role's name, "Implementer" or "Reviewer". */
export const roleName = (role: SubSession["role"]) =>
  role === "implementer" ? "Implementer" : "Reviewer";

/** A state's word, as the marks' labels and screen readers read it. */
export const STATE_NAMES: Record<SubSessionState, string> = {
  done: "Done",
  failed: "Failed",
  stopped: "Stopped",
  working: "Working",
};

/** A count of tokens, short: 41 k, 1.2 M. */
export function tokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")} M`;
  }
  return count >= 1000 ? `${Math.round(count / 1000)} k` : `${count}`;
}

/** Its usage, "41 k in · 3 k out", or nothing before its agent reported it. */
export function usageText(sub: SubSession): string | undefined {
  return sub.usage ? `${tokens(sub.usage.input)} in · ${tokens(sub.usage.output)} out` : undefined;
}

/** What it runs on, "Sonnet 5.5 · Low". */
export const runsOnText = (sub: SubSession) =>
  [sub.model, sub.effort].filter((part) => part !== null).join(" · ");
