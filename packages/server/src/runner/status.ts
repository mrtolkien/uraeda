import type { TurnRow } from "./cache.ts";
import type { ContinueReason } from "./events.ts";
import { SERVER_STOPPED } from "./session-state.ts";

/** A session's status in the sidebar and its view. */
export type SessionStatus = "working" | "needs-you" | "attention" | "unread" | "idle";

/**
 * Why a session needs the human: an action to allow, a step that waits on them, or a latest turn
 * that failed, that they stopped, that the server stopped, that ran the workflow and ended before a
 * human gate, or whose automatic continues reached their cap. Or why it works with no turn
 * running: its latest turn waits to continue by itself.
 */
export type StatusReason =
  | "blocked"
  | "step"
  | "failed"
  | "stopped"
  | "interrupted"
  | "halted"
  | "capped"
  | "waiting";

/** When a waiting run continues by itself, in ISO 8601, and why. */
export type Wait = { at: string; reason: ContinueReason };

/** The reasons of a run that asks for the human and that a message or Continue all goes on with. */
const CONTINUABLE = new Set<StatusReason>(["failed", "stopped", "interrupted", "halted", "capped"]);

/** Whether the status is a run that asks for the human, which a message can continue. */
export function continuable(status: {
  reason: StatusReason | null;
  status: SessionStatus;
}): boolean {
  return status.status === "attention" && status.reason !== null && CONTINUABLE.has(status.reason);
}

/** The wait of the turn, when it waits to continue by itself. */
export function waitOf(turn?: Pick<TurnRow, "continueAt" | "continueReason">): Wait | null {
  return turn?.continueAt != null && turn.continueReason !== null
    ? { at: new Date(turn.continueAt).toISOString(), reason: turn.continueReason }
    : null;
}

/** The order of statuses within a sidebar group: what needs the human first. */
export const STATUS_ORDER: Record<SessionStatus, number> = {
  attention: 1,
  idle: 4,
  "needs-you": 0,
  unread: 2,
  working: 3,
};

/**
 * A session's status, from the first rule that matches: a running or queued turn, a latest turn
 * waiting to continue by itself, a blocked action not allowed, a latest turn that failed or was
 * stopped, until the human dismisses it, as capped when it would have continued, a step that
 * waits on the human, a dismissed turn as idle, a latest turn that ended while the step still waits
 * on the agent, in its folder's latest session, a latest turn that ended after the human last saw
 * the session, and otherwise idle.
 */
export function sessionStatus(input: {
  blocked: boolean;
  latest?: Pick<
    TurnRow,
    "continueAt" | "continueReason" | "dismissedAt" | "endedAt" | "kind" | "reason" | "state"
  >;
  /**
   * Whether the session is its change's or feature's latest: an older one's run halted nothing, as
   * the folder's runs go to the latest.
   */
  latestSession?: boolean;
  queued: boolean;
  seenAt: string | null;
  /** The feature's step: past its last task without `gh`, a run that ended there halted nothing. */
  stepName?: string;
  waitsOnAgent?: boolean;
  waitsOnHuman: boolean;
}): { label: string; reason?: StatusReason; status: SessionStatus } {
  const { blocked, latest, latestSession = true, queued, seenAt, stepName, waitsOnHuman } = input;
  const waitsOnAgent = latestSession && input.waitsOnAgent === true;
  if (queued || latest?.state === "running" || latest?.state === "queued") {
    return { label: "Working", status: "working" };
  }
  if (latest?.continueAt != null) {
    return { label: "Waiting", reason: "waiting", status: "working" };
  }
  const capped = latest?.continueReason != null;
  if (blocked) {
    return { label: "Needs you", reason: "blocked", status: "needs-you" };
  }
  const failed = latest?.state === "failed" || latest?.state === "stopped" ? latest.state : null;
  if (failed && latest?.dismissedAt === null) {
    const stopped = latest.reason === SERVER_STOPPED ? "interrupted" : failed;
    return { label: "Needs attention", reason: capped ? "capped" : stopped, status: "attention" };
  }
  if (waitsOnHuman) {
    return { label: "Needs you", reason: "step", status: "needs-you" };
  }
  if (failed) {
    return { label: "Idle", status: "idle" };
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
    return { label: "Needs attention", reason: capped ? "capped" : "halted", status: "attention" };
  }
  if (unseen) {
    return { label: "New reply", status: "unread" };
  }
  return { label: "Idle", status: "idle" };
}

/**
 * Whether a session without a workflow is done: idle once a turn ended, so seen since its last turn
 * ended, as a later end reads "New reply". A new reply brings it back. An archived session is not,
 * as it leaves the list. A change's or a feature's session is done with its change or feature, once
 * merged.
 */
export function sessionDone(input: {
  archivedAt: string | null;
  folder: string | null;
  latest?: Pick<TurnRow, "endedAt">;
  status: SessionStatus;
}): boolean {
  const { archivedAt, folder, latest, status } = input;
  return (
    archivedAt === null &&
    folder === null &&
    status === "idle" &&
    typeof latest?.endedAt === "string"
  );
}
