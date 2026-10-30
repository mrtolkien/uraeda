// A feature's status, decided in one place from its step and its sessions: the sidebar, home, the
// feature page, the notifier, and the tab's title read it (see `specs/decisions/feature-status.md`).
import type { FeatureView } from "uraeda-binding";
import type { SessionStatus, StatusReason } from "../runner/status.ts";
import type { RepoContext } from "./context.ts";
import { statusOf, turnsOf, workspaceOf } from "./session-reads.ts";

/** A feature's status, which every view and the notifier read. */
export type FeatureStatus = {
  label: string;
  reason: StatusReason | null;
  /** The session it follows: a running one, else the latest; null without one. */
  session: string | null;
  status: SessionStatus;
  /** That session's latest turn, as an ID: what Dismiss names; null without one. */
  turn: string | null;
};

/** The status of a feature that waits on nothing and no session works on. */
export const IDLE: FeatureStatus = {
  label: "Idle",
  reason: null,
  session: null,
  status: "idle",
  turn: null,
};

const NEEDS_YOU = { label: "Needs you", status: "needs-you" } as const;

/**
 * The rules of the Feature status decision, from the feature's step and its sessions, the first
 * that matches: a session running or queued, the latest started first, gives "Working", whatever
 * the step; a feature with problems needs the human; then the latest session's own status, which
 * reads the step, never an older session's outcome; without a session, the step needs the human
 * when it waits on them, else the feature is idle.
 */
export async function featureStatusOf(
  ctx: RepoContext,
  feature: FeatureView,
): Promise<FeatureStatus> {
  const root = await ctx.sessions.mainRoot(ctx.repo).catch(() => undefined);
  const { cache } = ctx.sessions;
  const sessions = (root === undefined ? [] : cache.folderSessions(root, feature.folder)).map(
    (row) => ({ read: turnsOf(cache, row.id), row }),
  );
  const running = sessions.find(
    ({ read }) =>
      read.queued || read.latest?.state === "running" || read.latest?.state === "queued",
  );
  const followed = running ?? sessions[0];
  if (followed === undefined) {
    return feature.problems.length > 0 || feature.step.waitsOn === "human"
      ? { ...IDLE, ...NEEDS_YOU, reason: feature.problems.length > 0 ? null : "step" }
      : IDLE;
  }
  const { read, row } = followed;
  const of = { session: row.id, turn: read.latest === undefined ? null : String(read.latest.id) };
  if (running) {
    return { label: "Working", reason: null, status: "working", ...of };
  }
  if (feature.problems.length > 0) {
    return { ...NEEDS_YOU, reason: null, ...of };
  }
  const { status, statusLabel, statusReason } = statusOf(row, read, feature);
  return { label: statusLabel, reason: statusReason, status, ...of };
}

/** Each feature in flight of the server's repository, with its status: the notifier's list. */
export async function featureStatuses(
  ctx: RepoContext,
): Promise<Array<{ feature: FeatureView; status: FeatureStatus }>> {
  const features = (await workspaceOf(ctx, ctx.repo)).features.filter(
    (feature) => feature.step.name !== "done" && feature.step.name !== "none",
  );
  return Promise.all(
    features.map(async (feature) => ({ feature, status: await featureStatusOf(ctx, feature) })),
  );
}
