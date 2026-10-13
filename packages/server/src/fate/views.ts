// The data views of every type the UI reads. Records are the binding's views with an `id`: the
// mapped type turns napi-rs's interfaces into type literals, which fate's record constraint accepts.
import { dataView, list } from "@nkzw/fate/server";
import type {
  DraftView,
  FeatureView,
  FileView,
  Priorities,
  ProposalHint,
  WorkspaceView,
} from "uraeda-binding";
import type { Capabilities } from "../runner/adapter.ts";
import type { Item, Trigger, TurnKind, TurnState } from "../runner/events.ts";
import type { SessionStatus } from "../runner/status.ts";

type Record_<T> = { [Key in keyof T]: T[Key] };

export type WorkspaceRecord = Record_<WorkspaceView> & {
  id: string;
  /** The folders whose session has a turn running or queued. */
  running: Array<string>;
};
/** A feature, or `missing` alone when no feature has its folder. */
export type FeatureRecord = Record_<FeatureView> & {
  id: string;
  /** Its session's ID, null before its first message. */
  session: string | null;
  missing?: boolean;
};
/** A workflow file, or `missing` alone when its feature has no such file. */
export type FileRecord = Record_<FileView> & { missing?: boolean };

/**
 * A file as it is sent: its optional fields, when absent, sent as null. The client's cache keeps a
 * field an answer leaves out, so a review removed or a version committed would stay on screen.
 */
export function sentFile(record: FileRecord): FileRecord {
  const cleared = { status: null, tip: null, committed: null, review: null, missing: null };
  return { ...cleared, ...record } as unknown as FileRecord;
}
export type PrioritiesRecord = Record_<Priorities> & { id: string };
export type DraftRecord = Record_<DraftView> & { id: string };
/** The proposal template's guidance, by heading, which the editor shows in empty sections. */
export type ProposalHintsRecord = { id: string; hints: Array<Record_<ProposalHint>> };

/** The agent sessions run on, and what it can do: one record, `agent`. */
export type AgentRecord = {
  id: string;
  /** Its kind, stored with its sessions: `claude`. */
  kind: string;
  /** Its name, for people: "Claude Code". */
  name: string;
  available: boolean;
  version: string | null;
  /** What the UI may offer, and nothing more. */
  capabilities: Capabilities;
};

/** A sub-agent working in a session's running turn. */
export type SubagentRecord = { id: string; description: string };

/** A session, without its turns' items. */
export type SessionRecord = {
  id: string;
  /** The feature's folder, null for a chat. */
  folder: string | null;
  /** The agent's kind. */
  agent: string;
  /** A chat's title, "New chat" before its first message, or its feature's title. */
  title: string;
  status: SessionStatus;
  /** "Working", "Needs you", "Failed", "New reply", "Idle", or "Stopped". */
  statusLabel: string;
  /** Why it needs you: a blocked action, or the feature's step. */
  statusReason: "blocked" | "step" | null;
  /**
   * Whether its latest turn ended after the human last saw it, whatever its status: the view
   * records it seen.
   */
  unseen: boolean;
  /** Where it works: "branch <branch>", or "main checkout, branch <branch>" for a chat. */
  place: string;
  /** The agent's running total for the session, at its last turn's end. */
  costUsd: number | null;
  /** Its turns' IDs, oldest first. */
  turns: Array<string>;
  archived: boolean;
  /** The sub-agents of its running turn that have not ended. */
  subagents: Array<SubagentRecord>;
};

/** A turn of a session, without its items. */
export type TurnRecord = {
  id: string;
  session: string;
  kind: TurnKind;
  trigger: Trigger | null;
  /** A workflow turn's step when it started. */
  step: string | null;
  /** An allow turn's rule. */
  allowed: string | null;
  state: TurnState;
  /** Why it failed or stopped. */
  reason: string | null;
  startedAt: string | null;
  endedAt: string | null;
  /** The count of its item pages, of 100 items each. */
  pages: number;
};

/**
 * A page of 100 items of a turn, `<turn>:<page>`, from page 0, by their `seq`. Messages taken
 * back are left out: they leave the transcript.
 */
export type TurnLogRecord = {
  id: string;
  turn: string;
  page: number;
  items: Array<Item & { seq: number }>;
};

/** A session's row in the sidebar. */
export type SessionRowRecord = {
  id: string;
  folder: string | null;
  title: string;
  status: SessionStatus;
  statusLabel: string;
  archived: boolean;
  /** The last turn's start or end. */
  updatedAt: string;
  subagents: Array<SubagentRecord>;
};

/** The sidebar's sessions, what needs the human first: one record, `all`, kept live. */
export type SessionListRecord = { id: string; rows: Array<SessionRowRecord> };

/** The sessions whose title or messages hold the query, which is its ID: not live. */
export type SessionSearchRecord = { id: string; rows: Array<SessionRowRecord> };

/**
 * The workflow's message for a feature and a trigger, `<folder>:<trigger>[:<file>]`, which the
 * composer is filled with. Empty, with the refusal, when the feature does not wait on the agent.
 */
export type WorkflowMessageRecord = {
  id: string;
  text: string;
  /** The step the message starts. */
  step: string;
  refusal: string | null;
};

export const workspaceDataView = dataView<WorkspaceRecord>("Workspace")({
  id: true,
  root: true,
  defaultBranch: true,
  currentBranch: true,
  features: true,
  priorities: true,
  prioritiesHash: true,
  drafts: true,
  noSpecs: true,
  running: true,
});

export const featureDataView = dataView<FeatureRecord>("Feature")({
  id: true,
  kind: true,
  folder: true,
  slug: true,
  title: true,
  branch: true,
  source: true,
  worktree: true,
  uncommitted: true,
  behind: true,
  files: true,
  mockups: true,
  step: true,
  problems: true,
  leftWorktree: true,
  leftBranch: true,
  session: true,
  missing: true,
});

export const fileDataView = dataView<FileRecord>("WorkflowFile")({
  id: true,
  folder: true,
  name: true,
  path: true,
  kind: true,
  status: true,
  current: true,
  tip: true,
  committed: true,
  review: true,
  reviewStale: true,
  missing: true,
});

export const prioritiesDataView = dataView<PrioritiesRecord>("Priorities")({
  id: true,
  hash: true,
  sections: true,
  changes: true,
});

export const draftDataView = dataView<DraftRecord>("Draft")({
  id: true,
  path: true,
  title: true,
  text: true,
  hash: true,
  document: true,
  committed: true,
  entry: true,
  priorityChanges: true,
  kind: true,
  folder: true,
  slug: true,
  discovery: true,
  discoveryLevels: true,
  written: true,
  emptySections: true,
});

export const agentDataView = dataView<AgentRecord>("Agent")({
  id: true,
  kind: true,
  name: true,
  available: true,
  version: true,
  capabilities: true,
});

export const sessionDataView = dataView<SessionRecord>("Session")({
  id: true,
  folder: true,
  agent: true,
  title: true,
  status: true,
  statusLabel: true,
  statusReason: true,
  unseen: true,
  place: true,
  costUsd: true,
  turns: true,
  archived: true,
  subagents: true,
});

export const turnDataView = dataView<TurnRecord>("Turn")({
  id: true,
  session: true,
  kind: true,
  trigger: true,
  step: true,
  allowed: true,
  state: true,
  reason: true,
  startedAt: true,
  endedAt: true,
  pages: true,
});

export const turnLogDataView = dataView<TurnLogRecord>("TurnLog")({
  id: true,
  turn: true,
  page: true,
  items: true,
});

export const sessionListDataView = dataView<SessionListRecord>("SessionList")({
  id: true,
  rows: true,
});

export const sessionSearchDataView = dataView<SessionSearchRecord>("SessionSearch")({
  id: true,
  rows: true,
});

export const workflowMessageDataView = dataView<WorkflowMessageRecord>("WorkflowMessage")({
  id: true,
  text: true,
  step: true,
  refusal: true,
});

export const proposalHintsDataView = dataView<ProposalHintsRecord>("ProposalHints")({
  id: true,
  hints: true,
});

/** The ids of the records there is one of. */
export const WORKSPACE_ID = "workspace";
export const PRIORITIES_ID = "priorities";
export const AGENT_ID = "agent";
export const SESSION_LIST_ID = "all";
export const PROPOSAL_HINTS_ID = "proposal";

/** The roots: one list per type, so every type is read by id. */
export const Root = {
  workspaces: list(workspaceDataView),
  features: list(featureDataView),
  workflowFiles: list(fileDataView),
  prioritiesList: list(prioritiesDataView),
  drafts: list(draftDataView),
  agents: list(agentDataView),
  sessions: list(sessionDataView),
  turns: list(turnDataView),
  turnLogs: list(turnLogDataView),
  sessionLists: list(sessionListDataView),
  sessionSearches: list(sessionSearchDataView),
  workflowMessages: list(workflowMessageDataView),
  proposalHintsList: list(proposalHintsDataView),
};
