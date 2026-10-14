import type { TurnRow } from "./cache.ts";

/** A session's status in the sidebar and its view. */
export type SessionStatus = "working" | "needs-you" | "failed" | "unread" | "idle";

/** The order of statuses within a sidebar group: what needs the human first. */
export const STATUS_ORDER: Record<SessionStatus, number> = {
  failed: 1,
  idle: 4,
  "needs-you": 0,
  unread: 2,
  working: 3,
};

/**
 * A session's status, from the first rule that matches: a running or queued turn, a blocked action
 * not allowed or a step that waits on the human, a failed latest turn, a latest turn that ended
 * after the human last saw the session, and otherwise idle, or stopped.
 */
export function sessionStatus(input: {
  blocked: boolean;
  latest?: Pick<TurnRow, "state" | "endedAt">;
  queued: boolean;
  seenAt: string | null;
  waitsOnHuman: boolean;
}): { label: string; reason?: "blocked" | "step"; status: SessionStatus } {
  const { blocked, latest, queued, seenAt, waitsOnHuman } = input;
  if (queued || latest?.state === "running" || latest?.state === "queued") {
    return { label: "Working", status: "working" };
  }
  if (blocked) {
    return { label: "Needs you", reason: "blocked", status: "needs-you" };
  }
  if (waitsOnHuman) {
    return { label: "Needs you", reason: "step", status: "needs-you" };
  }
  if (latest?.state === "failed") {
    return { label: "Failed", status: "failed" };
  }
  if (latest?.endedAt && (seenAt === null || Date.parse(latest.endedAt) > Date.parse(seenAt))) {
    return { label: "New reply", status: "unread" };
  }
  return { label: latest?.state === "stopped" ? "Stopped" : "Idle", status: "idle" };
}
