// A feature's status, decided in one place from its step and its sessions: the sidebar, home, the
// feature page, the notifier, and the tab's title read it (see `specs/decisions/feature-status.md`).
import type { FeatureView } from "uraeda-binding";
import type { SessionRow } from "../runner/cache.ts";
import type { SessionStatus, StatusReason } from "../runner/status.ts";
import type { RepoContext } from "./context.ts";
import { blockedOf, latestOf, statusOf, workspaceOf } from "./session-reads.ts";

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

/** The statuses read during one request, by their feature's folder: a feature's is read once. */
const statuses = new WeakMap<RepoContext, Map<string, Promise<FeatureStatus>>>();

/**
 * The rules of the Feature status decision, from the feature's step and its sessions, the first
 * that matches: a session running or queued, the latest started first, gives "Working", whatever
 * the step; a feature with problems needs the human; then the latest session's own status, which
 * reads the step, never an older session's outcome; without a session, the step needs the human
 * when it waits on them, else the feature is idle. Read once per request.
 */
export function featureStatusOf(ctx: RepoContext, feature: FeatureView): Promise<FeatureStatus> {
  let read = statuses.get(ctx);
  if (!read) {
    read = new Map();
    statuses.set(ctx, read);
  }
  let status = read.get(feature.folder);
  if (!status) {
    status = readStatus(ctx, feature);
    read.set(feature.folder, status);
  }
  return status;
}

/** A feature's status, reading of its sessions' turns only what the rules need. */
async function readStatus(ctx: RepoContext, feature: FeatureView): Promise<FeatureStatus> {
  const root = await ctx.sessions.mainRoot(ctx.repo).catch(() => undefined);
  const { cache } = ctx.sessions;
  const sessions = root === undefined ? [] : cache.folderSessions(root, feature.folder);
  // The latest session, unless one runs or waits: the first, latest started first, stops the read.
  let followed: { read: ReturnType<typeof latestOf>; row: SessionRow } | undefined;
  for (const row of sessions) {
    const read = latestOf(cache.turns(row.id));
    const { latest, queued } = read;
    if (queued || latest?.state === "running" || latest?.state === "queued") {
      const turn = latest === undefined ? null : String(latest.id);
      return { label: "Working", reason: null, session: row.id, status: "working", turn };
    }
    followed ??= { read, row };
  }
  if (followed === undefined) {
    return feature.problems.length > 0 || feature.step.waitsOn === "human"
      ? { ...IDLE, ...NEEDS_YOU, reason: feature.problems.length > 0 ? null : "step" }
      : IDLE;
  }
  const { read, row } = followed;
  const of = { session: row.id, turn: read.latest === undefined ? null : String(read.latest.id) };
  if (feature.problems.length > 0) {
    return { ...NEEDS_YOU, reason: null, ...of };
  }
  const blocked = blockedOf(cache, read.latest);
  const { status, statusLabel, statusReason } = statusOf(row, { ...read, blocked }, feature);
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
