// What the sessions' records and a feature's status read: the workspace, once per request, and a
// session's turns and its status, which `sessions.ts` and `feature-status.ts` both read.
import type { FeatureView, WorkspaceView } from "uraeda-binding";
import type { SessionCache, SessionRow, TurnRow } from "../runner/cache.ts";
import { coveredDenials } from "../runner/allow.ts";
import { TAKEN_BACK } from "../runner/session-state.ts";
import { sessionStatus } from "../runner/status.ts";
import type { RepoContext } from "./context.ts";
import type { SubagentRecord } from "./views.ts";

/** The workspaces read during one request, by their path: a list reads it once. */
const workspaces = new WeakMap<RepoContext, Map<string, Promise<WorkspaceView>>>();

export function workspaceOf(ctx: RepoContext, path: string): Promise<WorkspaceView> {
  let read = workspaces.get(ctx);
  if (!read) {
    read = new Map();
    workspaces.set(ctx, read);
  }
  let workspace = read.get(path);
  if (!workspace) {
    workspace = ctx.binding.readWorkspace(path);
    read.set(path, workspace);
  }
  return workspace;
}

/**
 * The session's latest turn not taken back, as its status reads it: a queued message taken back ran
 * nothing, and never asks for the human. With whether a turn waits in its queue.
 */
export function latestOf(turns: Array<TurnRow>) {
  return {
    latest: turns.findLast((turn) => turn.state !== "stopped" || turn.reason !== TAKEN_BACK),
    queued: turns.some((turn) => turn.state === "queued"),
  };
}

/** Whether the turn was refused an action the human has not allowed. */
export function blockedOf(cache: SessionCache, turn: TurnRow | undefined): boolean {
  return turn ? cache.itemsOf(turn.id, "denial").some((denial) => !denial.allowed) : false;
}

/** What a session's status and its sidebar row read of its turns. */
export function turnsOf(cache: SessionCache, session: string) {
  const turns = cache.turns(session);
  const { latest, queued } = latestOf(turns);
  const running = turns.filter((turn) => turn.state === "running").at(-1);
  const subagents: Array<SubagentRecord> = running ? cache.subagentsOf(running.id) : [];
  return {
    allowable: latest ? coveredDenials(cache, latest.id).length : 0,
    blocked: blockedOf(cache, latest),
    latest,
    queued,
    subagents,
    turns,
  };
}

/**
 * The session's status, from its turns, when it was seen, its feature's step, and whether it is its
 * feature's `latestSession`.
 */
export function statusOf(
  row: SessionRow,
  read: Pick<ReturnType<typeof turnsOf>, "blocked" | "latest" | "queued">,
  feature?: FeatureView,
  latestSession = true,
) {
  const status = sessionStatus({
    ...(read.latest === undefined ? {} : { latest: read.latest }),
    blocked: read.blocked,
    latestSession,
    queued: read.queued,
    seenAt: row.seenAt,
    ...(feature ? { stepName: feature.step.name } : {}),
    waitsOnAgent: feature?.step.waitsOn === "agent",
    waitsOnHuman: feature?.step.waitsOn === "human",
  });
  return { status: status.status, statusLabel: status.label, statusReason: status.reason ?? null };
}
