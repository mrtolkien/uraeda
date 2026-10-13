import type { TurnRow } from "./cache.ts";

/** A session's status in the sidebar and its view. */
export type SessionStatus = "working" | "needs-you" | "failed" | "unread" | "idle";

/** The order of statuses within a sidebar group: what needs the human first. */
export const STATUS_ORDER: Record<SessionStatus, number> = {
  "needs-you": 0,
  failed: 1,
  unread: 2,
  working: 3,
  idle: 4,
};

/**
 * A session's status, from the first rule that matches: a running or queued turn, a blocked action
 * not allowed or a step that waits on the human, a failed latest turn, a latest turn that ended
 * after the human last saw the session, and otherwise idle, or stopped.
 */
export function sessionStatus(input: {
  latest?: Pick<TurnRow, "state" | "endedAt">;
  queued: boolean;
  blocked: boolean;
  waitsOnHuman: boolean;
  seenAt: string | null;
}): { status: SessionStatus; label: string; reason?: "blocked" | "step" } {
  const { latest, queued, blocked, waitsOnHuman, seenAt } = input;
  if (queued || latest?.state === "running" || latest?.state === "queued") {
    return { status: "working", label: "Working" };
  }
  if (blocked) {
    return { status: "needs-you", label: "Needs you", reason: "blocked" };
  }
  if (waitsOnHuman) {
    return { status: "needs-you", label: "Needs you", reason: "step" };
  }
  if (latest?.state === "failed") {
    return { status: "failed", label: "Failed" };
  }
  if (latest?.endedAt && (seenAt === null || Date.parse(latest.endedAt) > Date.parse(seenAt))) {
    return { status: "unread", label: "New reply" };
  }
  return { status: "idle", label: latest?.state === "stopped" ? "Stopped" : "Idle" };
}
