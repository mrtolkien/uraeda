// The session manager's records, read from its cache: the agent, sessions, their turns and item
// pages, the sidebar's list and search, and the workflow's message.
import type { FeatureView, WorkspaceView } from "uraeda-binding";
import type { SessionCache, SessionRow, TurnRow } from "../runner/cache.ts";
import type { Trigger } from "../runner/events.ts";
import { runMessage } from "../runner/message.ts";
import { REFUSALS } from "../runner/sessions.ts";
import { sessionStatus, STATUS_ORDER } from "../runner/status.ts";
import type { Context } from "./context.ts";
import { callSiteError } from "./errors.ts";
import {
  AGENT_ID,
  type AgentRecord,
  type FeatureRecord,
  SESSION_LIST_ID,
  type SessionListRecord,
  type SessionRecord,
  type SessionRowRecord,
  type SessionSearchRecord,
  type SubagentRecord,
  type TurnLogRecord,
  type TurnRecord,
  type WorkflowMessageRecord,
} from "./views.ts";

/** The items in each page of a turn's log. */
export const TURN_PAGE = 100;

/** The triggers a workflow message takes. */
export const TRIGGERS: Array<Trigger> = [
  "answers",
  "approval",
  "changes",
  "proposal",
  "start",
  "manual",
];

/** How many sessions the sidebar lists: every feature's, and the chats. */
const LIST_LIMIT = 10_000;

/** A chat's title before its first message. */
const NEW_CHAT = "New chat";

/** The count of the turn's item pages. */
export function pages(cache: SessionCache, turn: number): number {
  return Math.ceil(cache.itemCount(turn) / TURN_PAGE);
}

export function agentRecord({ sessions }: Context): AgentRecord {
  const { kind, name, capabilities } = sessions.adapter;
  return { id: AGENT_ID, kind, name, ...sessions.status(), capabilities: { ...capabilities } };
}

/** The workspaces read during one request, by their path: a list reads it once. */
const workspaces = new WeakMap<Context, Map<string, Promise<WorkspaceView>>>();

function workspaceOf(ctx: Context, path: string): Promise<WorkspaceView> {
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

/** The session of this ID, when it is one of the server's repository: the cache holds them all. */
async function ownSession(ctx: Context, id: string): Promise<SessionRow | undefined> {
  const row = ctx.sessions.cache.session(id);
  if (!row) {
    return undefined;
  }
  return row.repo === (await ctx.sessions.mainRoot(ctx.repo)) ? row : undefined;
}

/** The turn of this ID, when its session is one of the server's repository. */
async function ownTurn(ctx: Context, id: string): Promise<TurnRow | undefined> {
  const turn = /^\d+$/.test(id) ? ctx.sessions.cache.turn(Number(id)) : undefined;
  return turn && (await ownSession(ctx, turn.sessionId)) ? turn : undefined;
}

/** What a session's status and its sidebar row read of its turns. */
function turnsOf(cache: SessionCache, session: string) {
  const turns = cache.turns(session);
  const latest = turns.at(-1);
  const running = turns.filter((turn) => turn.state === "running").at(-1);
  const subagents: Array<SubagentRecord> = running
    ? cache
        .itemsOf(running.id, "tool")
        .filter((tool) => tool.subagent !== undefined && tool.status === "in_progress")
        .map((tool) => ({ id: tool.id, description: tool.subagent?.description ?? "" }))
    : [];
  return {
    turns,
    latest,
    queued: turns.some((turn) => turn.state === "queued"),
    blocked: latest ? cache.itemsOf(latest.id, "denial").some((denial) => !denial.allowed) : false,
    subagents,
  };
}

/** The session's status, from its turns, when it was seen, and its feature's step. */
function statusOf(row: SessionRow, read: ReturnType<typeof turnsOf>, feature?: FeatureView) {
  const status = sessionStatus({
    ...(read.latest === undefined ? {} : { latest: read.latest }),
    queued: read.queued,
    blocked: read.blocked,
    waitsOnHuman: feature?.step.waitsOn === "human",
    seenAt: row.seenAt,
  });
  return { status: status.status, statusLabel: status.label, statusReason: status.reason ?? null };
}

function titleOf(row: SessionRow, feature?: FeatureView): string {
  if (row.folder === null) {
    return row.title ?? NEW_CHAT;
  }
  return feature?.title || row.folder;
}

/** A feature by its folder, or undefined once it is gone, as when it was finished. */
function featureOf(ctx: Context, folder: string): Promise<FeatureView | undefined> {
  return ctx.binding.readFeature(ctx.repo, folder).catch(() => undefined);
}

/** Where the session works: its feature's branch, or the main checkout. */
async function placeOf(ctx: Context, row: SessionRow, feature?: FeatureView): Promise<string> {
  if (row.folder !== null) {
    return feature?.branch ? `branch ${feature.branch}` : "no branch yet";
  }
  const branch = await workspaceOf(ctx, row.repo).then(
    (workspace) => workspace.currentBranch,
    () => undefined,
  );
  return branch ? `main checkout, branch ${branch}` : "main checkout";
}

/** Whether the session's latest turn ended, with none waiting, after the human last saw it. */
function unseen(row: SessionRow, read: ReturnType<typeof turnsOf>): boolean {
  const ended = read.latest?.endedAt;
  return (
    !read.queued &&
    ended !== undefined &&
    ended !== null &&
    (row.seenAt === null || Date.parse(ended) > Date.parse(row.seenAt))
  );
}

export async function sessionRecord(ctx: Context, row: SessionRow): Promise<SessionRecord> {
  const read = turnsOf(ctx.sessions.cache, row.id);
  const feature = row.folder === null ? undefined : await featureOf(ctx, row.folder);
  return {
    id: row.id,
    folder: row.folder,
    agent: row.agent,
    title: titleOf(row, feature),
    ...statusOf(row, read, feature),
    unseen: unseen(row, read),
    place: await placeOf(ctx, row, feature),
    turns: read.turns.map((turn) => String(turn.id)),
    archived: row.archivedAt !== null,
    subagents: read.subagents,
  };
}

/** The session of this ID, for the server's repository. */
export async function readSession(ctx: Context, id: string): Promise<SessionRecord | undefined> {
  const row = await ownSession(ctx, id);
  return row ? sessionRecord(ctx, row) : undefined;
}

export async function readTurn(ctx: Context, id: string): Promise<TurnRecord | undefined> {
  const turn = await ownTurn(ctx, id);
  if (!turn) {
    return undefined;
  }
  return {
    id: String(turn.id),
    session: turn.sessionId,
    kind: turn.kind,
    trigger: turn.trigger,
    step: turn.step,
    allowed: turn.allowed,
    state: turn.state,
    reason: turn.reason,
    startedAt: turn.startedAt,
    endedAt: turn.endedAt,
    pages: pages(ctx.sessions.cache, turn.id),
    activity: (turn.state === "running" && ctx.sessions.activity(turn.id)) || null,
  };
}

/** A page of a turn's items, by its ID, `<turn>:<page>`, without the messages taken back. */
export async function readTurnLog(ctx: Context, id: string): Promise<TurnLogRecord | undefined> {
  const match = /^(\d+):(\d+)$/.exec(id);
  if (!match || !(await ownTurn(ctx, match[1]))) {
    return undefined;
  }
  const [turn, page] = [Number(match[1]), Number(match[2])];
  return {
    id,
    turn: String(turn),
    page,
    items: ctx.sessions.cache
      .items(turn, page * TURN_PAGE, TURN_PAGE)
      .filter((item) => !(item.kind === "message" && item.state === "taken-back")),
  };
}

/**
 * The sidebar's rows of the sessions, what needs the human first, then the last updated. A
 * feature's session leaves the list with its feature, as when it was finished into its record.
 */
async function rows(ctx: Context, sessions: Array<SessionRow>): Promise<Array<SessionRowRecord>> {
  const features = new Map(
    (await workspaceOf(ctx, ctx.repo)).features.map((feature) => [feature.folder, feature]),
  );
  const { cache } = ctx.sessions;
  return sessions
    .filter((row) => row.folder === null || features.has(row.folder))
    .map((row) => {
      const feature = row.folder === null ? undefined : features.get(row.folder);
      const read = turnsOf(cache, row.id);
      const { status, statusLabel } = statusOf(row, read, feature);
      return {
        id: row.id,
        folder: row.folder,
        title: titleOf(row, feature),
        status,
        statusLabel,
        archived: row.archivedAt !== null,
        updatedAt: row.updatedAt,
        subagents: read.subagents,
      };
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

export async function sessionList(ctx: Context): Promise<SessionListRecord> {
  // A repository the core gives no main checkout for, like one without a commit, has no sessions.
  const root = await ctx.sessions.mainRoot(ctx.repo).catch(() => undefined);
  if (root === undefined) {
    return { id: SESSION_LIST_ID, rows: [] };
  }
  return {
    id: SESSION_LIST_ID,
    rows: await rows(ctx, ctx.sessions.cache.sessions(root, { limit: LIST_LIMIT })),
  };
}

/**
 * The sessions whose title, folder, or messages hold the query, ignoring case, with the sessions
 * of the features whose title holds it.
 */
export async function sessionSearch(ctx: Context, query: string): Promise<SessionSearchRecord> {
  const root = await ctx.sessions.mainRoot(ctx.repo).catch(() => undefined);
  const { cache } = ctx.sessions;
  if (root === undefined) {
    return { id: query, rows: [] };
  }
  if (query.trim() === "") {
    return { id: query, rows: (await sessionList(ctx)).rows };
  }
  const found = cache.sessions(root, { query });
  const ids = new Set(found.map((row) => row.id));
  const needle = query.toLowerCase();
  for (const feature of (await workspaceOf(ctx, ctx.repo)).features) {
    const row = feature.title.toLowerCase().includes(needle)
      ? cache.featureSession(root, feature.folder)
      : undefined;
    if (row && !ids.has(row.id)) {
      ids.add(row.id);
      found.push(row);
    }
  }
  found.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { id: query, rows: await rows(ctx, found) };
}

/**
 * The workflow's message for `<folder>:<trigger>[:<file>]`: empty, with the refusal, when the
 * feature has no branch, or does not wait on the agent.
 */
export async function readWorkflowMessage(
  ctx: Context,
  id: string,
): Promise<WorkflowMessageRecord | undefined> {
  const [folder, trigger, ...file] = id.split(":");
  if (!folder || !TRIGGERS.includes(trigger as Trigger)) {
    return undefined;
  }
  const next = await ctx.binding.nextStep(ctx.repo, folder).catch(() => undefined);
  if (!next) {
    return undefined;
  }
  const { step, branch } = next;
  const refusal =
    branch === undefined
      ? REFUSALS.noBranch
      : step.waitsOn !== "agent" || !step.reference
        ? REFUSALS.human
        : null;
  if (refusal !== null || branch === undefined || !step.reference) {
    return { id, text: "", step: step.name, refusal };
  }
  const feature = await featureOf(ctx, folder);
  return {
    id,
    text: runMessage({
      folder,
      branch,
      bug: feature?.kind === "bug",
      step: step.name,
      reference: step.reference,
      trigger: trigger as Trigger,
      ...(file.length === 0 ? {} : { file: file.join(":") }),
    }),
    step: step.name,
    refusal: null,
  };
}

/** A feature's record: its view, with its session's ID. */
export async function featureRecord(ctx: Context, feature: FeatureView): Promise<FeatureRecord> {
  const root = await ctx.sessions.mainRoot(ctx.repo).catch(() => undefined);
  const session =
    root === undefined ? undefined : ctx.sessions.cache.featureSession(root, feature.folder);
  return { id: feature.folder, ...feature, session: session?.id ?? null };
}

/**
 * The folders of the server's repository whose session has a turn running or queued: none in a
 * repository the core gives no main checkout for, like one without a commit.
 */
export async function working(ctx: Context): Promise<Array<string>> {
  try {
    await ctx.sessions.mainRoot(ctx.repo);
  } catch {
    return [];
  }
  return ctx.sessions.working(ctx.repo);
}

/**
 * Refuses a write to a feature while an agent works on it, before the binding is called. `path` is
 * a file's path from the top level: a feature's when it is under `specs/<folder>/` or
 * `specs/bugs/<folder>/`.
 */
export async function writable(
  ctx: Context,
  target: { folder: string } | { path: string },
): Promise<void> {
  const folder =
    "folder" in target
      ? target.folder
      : (/^specs\/bugs\/([^/]+)\//.exec(target.path) ?? /^specs\/([^/]+)\//.exec(target.path))?.[1];
  if (folder !== undefined && (await working(ctx)).includes(folder)) {
    throw callSiteError(`refused: ${REFUSALS.working}`);
  }
}
