import type { TurnRow } from "./cache.ts";

/** A session's status in the sidebar and its view. */
export type SessionStatus = "working" | "needs-you" | "attention" | "unread" | "idle";

/**
 * Why a session needs the human: an action to allow, a step that waits on them, or a latest turn
 * that failed, that they stopped, or that ran the workflow and ended before a human gate.
 */
export type StatusReason = "blocked" | "step" | "failed" | "stopped" | "halted";

/** The order of statuses within a sidebar group: what needs the human first. */
export const STATUS_ORDER: Record<SessionStatus, number> = {
  attention: 1,
  idle: 4,
  "needs-you": 0,
  unread: 2,
  working: 3,
};

/**
 * A session's status, from the first rule that matches: a running or queued turn, a blocked action
 * not allowed or a step that waits on the human, a latest turn that failed, was stopped, or ended
 * while the step still waits on the agent, a latest turn that ended after the human last
 * saw the session, and otherwise idle.
 */
export function sessionStatus(input: {
  blocked: boolean;
  latest?: Pick<TurnRow, "endedAt" | "kind" | "state">;
  queued: boolean;
  seenAt: string | null;
  /** The feature's step: past its last task without `gh`, a run that ended there halted nothing. */
  stepName?: string;
  waitsOnAgent?: boolean;
  waitsOnHuman: boolean;
}): { label: string; reason?: StatusReason; status: SessionStatus } {
  const { blocked, latest, queued, seenAt, stepName, waitsOnAgent = false, waitsOnHuman } = input;
  if (queued || latest?.state === "running" || latest?.state === "queued") {
    return { label: "Working", status: "working" };
  }
  if (blocked) {
    return { label: "Needs you", reason: "blocked", status: "needs-you" };
  }
  if (waitsOnHuman) {
    return { label: "Needs you", reason: "step", status: "needs-you" };
  }
  if (latest?.state === "failed" || latest?.state === "stopped") {
    return { label: "Needs attention", reason: latest.state, status: "attention" };
  }
  const unseen =
    latest?.endedAt && (seenAt === null || Date.parse(latest.endedAt) > Date.parse(seenAt));
  // A chat turn flags until the human opens the session; a workflow turn, until the agent moves on.
  if (
    latest?.state === "done" &&
    (latest.kind !== "chat" || unseen) &&
    waitsOnAgent &&
    stepName !== "pull-request-unknown"
  ) {
    return { label: "Needs attention", reason: "halted", status: "attention" };
  }
  if (unseen) {
    return { label: "New reply", status: "unread" };
  }
  return { label: "Idle", status: "idle" };
}
