// The data views of every type the UI reads. Records are the binding's views with an `id`: the
// mapped type turns napi-rs's interfaces into type literals, which fate's record constraint accepts.
import { dataView, list } from "@nkzw/fate/server";
import type {
  BranchDecision,
  ProposalItem,
  FeatureView,
  FileView,
  Inbox,
  Priorities,
  RunningFeature,
  RunOptions,
  SectionItems,
  StepView,
  TaskProgress,
  WorkspaceView,
} from "uraeda-binding";
import type { EditedFile, SubagentRow } from "../runner/cache.ts";
import type { RuntimeRecord } from "../runner/runtimes.ts";
import type { Role } from "../runner/sub-sessions.ts";
import type { SessionStatus, StatusReason, Wait } from "../runner/status.ts";
import type { FeatureStatus } from "./feature-status.ts";
import type { ItemLook } from "./items.ts";
import { needsYouListDataView } from "./needs-you.ts";
import { previewDataView, storyDataView, storyHrefDataView } from "./preview.ts";
import { recommendedDataView } from "./recommended.ts";
import { settingsDataView } from "./settings.ts";
import { themesDataView } from "./themes.ts";
import type { FeatureAgent } from "./agentTime.ts";
import type { FeatureTokens } from "./tokens.ts";
import { allBranchChangesDataView, branchChangesDataView } from "./views-branch.ts";
import {
  type ProposalFileRecord,
  proposalFileDataView,
  type ProposalHintsRecord,
  proposalHintsDataView,
  type SlugProposalRecord,
  slugProposalDataView,
} from "./views-proposal-file.ts";
import { droppedDataView } from "./views-dropped.ts";
import type { ChangeRecord } from "./views-undo.ts";
import { bufferDataView } from "./views-buffer.ts";
import { historyDataView } from "./views-history.ts";
import { ledgerDataView } from "./views-ledger.ts";
import { folderSuggestionsDataView, repositoriesDataView } from "./views-repositories.ts";
import { type WorkflowMessageRecord, workflowMessageDataView } from "./views-workflow-message.ts";
import type { SubSessionRecord } from "./sub-session-views.ts";
import {
  type TurnLogRecord,
  turnDataView,
  turnLogDataView,
  type TurnRecord,
} from "./views-turns.ts";

export type Record_<T> = { [Key in keyof T]: T[Key] };

export { proposalFileDataView, proposalHintsDataView, slugProposalDataView };
export type { ProposalFileRecord, ProposalHintsRecord, SlugProposalRecord };
export { turnDataView, turnLogDataView, workflowMessageDataView };
export type { TurnLogRecord, TurnRecord, WorkflowMessageRecord };

/** A feature's step, its progress sent as null when it has none. */
export type StepRecord = Omit<StepView, "progress"> & { progress: TaskProgress | null };

/**
 * A step as it is sent: its progress, when absent, sent as null. fate merges a record's fields
 * shallowly and replaces a nested object like `step` whole, so this is not for freshness: every
 * step has one shape, `TaskProgress | null`, wherever the UI reads it.
 */
export function sentStep(step: StepView): StepRecord {
  return { ...step, progress: step.progress ?? null };
}

export type WorkspaceRecord = Omit<Record_<WorkspaceView>, "features"> & {
  /** Its features, each step sent as `sentStep` sends it, with its name (R2) and its status. */
  features: Array<
    Omit<FeatureView, "step"> & ItemLook & { status: FeatureStatus; step: StepRecord }
  >;
  id: string;
  /** Whether the main checkout has an active preview decision. */
  preview: boolean;
};

/** A feature, or `missing` alone when no feature has its folder. */
export type FeatureRecord = Omit<Record_<FeatureView>, "leftBranch" | "leftWorktree" | "step"> &
  // Its name in the sidebar, or null (R2).
  ItemLook & {
    /** Its sessions' agent time, null when no turn has a start. */
    agent: FeatureAgent | null;
    id: string;
    /** For a merged feature, its local branch still there, else null. */
    leftBranch: string | null;
    /** For a merged feature, its worktree still there, else null. */
    leftWorktree: string | null;
    missing?: boolean;
    /**
     * What a session of it made without a pick runs on: its next run step's pick, over the
     * settings', the agent's default for a model or an effort null; null at a step no agent runs.
     * A new session's picker shows it until the human picks.
     */
    newPick: { effort: string | null; model: string | null; runtime: string } | null;
    /** Whether its worktree, or else the main checkout, has an active preview decision (R7). */
    preview: boolean;
    /**
     * Its run options: `own`, only what it changed, which `feature.setRunOptions` keeps; and
     * `merged`, the core's merge of them over the settings' `runs.options`, what its next run
     * starts on, sent again as the settings' run options change.
     */
    runOptions: { merged: RunOptions; own: RunOptions };
    /**
     * The runtime of its latest session, which its runs go to, null before its first message, when
     * they go to a new session on the runtime picked, or the first one on.
     */
    runtime: string | null;
    /** Its latest session's ID, the one its runs go to, null before its first message. */
    session: string | null;
    /** Its sessions' IDs, the latest started first. */
    sessions: Array<string>;
    status: FeatureStatus;
    step: StepRecord;
    /** Its sessions' tokens, summed, null when no turn has counts. */
    tokens: FeatureTokens | null;
  };
/** A workflow file, or `missing` alone when its feature has no such file. */
export type FileRecord = Record_<FileView> & { change?: ChangeRecord | null; missing?: boolean };

/**
 * A file as it is sent: its optional fields, when absent, sent as null. The client's cache keeps a
 * field an answer leaves out, so a review removed or a version committed would stay on screen.
 */
export function sentFile(record: FileRecord): FileRecord {
  const cleared = {
    answered: null,
    change: null,
    committed: null,
    missing: null,
    review: null,
    status: null,
    tip: null,
  };
  return { ...cleared, ...record } as unknown as FileRecord;
}
/**
 * A decision as a feature's branch has it, by `<folder>/<name>`, with its change; or `missing`
 * alone when the branch has no such decision.
 */
export type BranchDecisionRecord = Record_<BranchDecision> & { id: string; missing?: boolean };

/** A branch's decision as it is sent: `missing` sent as null, for the client's cache. */
export function sentBranchDecision(decision: BranchDecision): BranchDecisionRecord {
  return {
    ...decision,
    id: `${decision.folder}/${decision.name}`,
    missing: null,
  } as unknown as BranchDecisionRecord;
}
/** A proposal, the step of its running feature sent as `sentStep` sends it. */
type ProposalRecord = Omit<ProposalItem, "running"> & {
  running?: Omit<RunningFeature, "step"> & { step: StepRecord };
};
export type PrioritiesRecord = Omit<Record_<Priorities>, "sections"> & {
  change?: ChangeRecord | null;
  id: string;
  sections: Array<Omit<SectionItems, "proposals"> & { proposals: Array<ProposalRecord> }>;
};

/** The inbox: one record, `inbox`, its triage's status sent as null when there is no triage. */
export type InboxRecord = Omit<Record_<Inbox>, "triage"> & {
  change?: ChangeRecord | null;
  id: string;
  triage: string | null;
};

/**
 * The agent runtimes sessions run on, the one a new session runs on here first, then in
 * registration order, with what each can do, its usage, and
 * whether it is on in the endpoint's repository: one record, `agent`.
 */
export type AgentRecord = { id: string; runtimes: Array<RuntimeRecord> };

/**
 * A sub-agent working in a session's running turn: its calls, the latest of them, the sub-agent
 * that started it, and when it started.
 */
export type SubagentRecord = SubagentRow;

/** A session, without its turns' items. */
export type SessionRecord = {
  /**
   * The account it runs on, by its runtime's name for it ("b" for `~/.claude-b`): null for a
   * session on the agent's own login.
   */
  account: string | null;
  /**
   * The account's id, what the session stored (for Claude Code, its folder), by which the sidebar
   * finds it among the runtime's accounts: two accounts may share a name, never an id. Null with
   * no account.
   */
  accountId: string | null;
  /** The agent's kind. */
  agent: string;
  /** How many blocked actions of its latest turn "Allow all" would allow: 0 without a turn. */
  allowable: number;
  archived: boolean;
  /** Its runs' automatic continues in a row, which the cap counts. */
  automaticContinues: number;
  /** The background commands of its running turn still running. */
  backgroundCommands: number;
  /**
   * Why the change its job's run offered could not start, the core's refusal, while the turn that
   * offer ended is its latest: null otherwise.
   */
  changeRefusal: string | null;
  /**
   * The files its completed edit calls changed, of every turn and sub-agent, in the order of their
   * first edit, with their count of completed edits: a failed edit does not count.
   */
  edited: Array<EditedFile>;
  /** The effort picked, by the agent's ID: null for the agent's default. */
  effort: string | null;
  /** The feature's folder, null for a chat. */
  folder: string | null;
  id: string;
  /** The model picked, by the agent's ID: null for the agent's default. */
  model: string | null;
  /**
   * Its own title, a chat's, kept once it became a change's or a feature's: null for a session
   * started in a change or a feature, whose `title` is its feature's.
   */
  name: string | null;
  /** The session that started it, a sub-session's: null for every other session. */
  parent: string | null;
  /** Where it works: "branch <branch>", or "main checkout, branch <branch>" for a chat. */
  place: string;
  /** The effort its agent last reported running on, by its name for people: null for none. */
  ranEffort: string | null;
  /** The model its agent last reported running on, by its name for people: null before it did. */
  ranModel: string | null;
  /** A sub-session's role in its parent's run: null for every other session. */
  role: Role | null;
  /** When it started, which its place in a feature's sessions follows. */
  startedAt: string;
  status: SessionStatus;
  /** "Working", "Needs you", "Needs attention", "New reply", or "Idle". */
  statusLabel: string;
  /** Why it needs you, or why it works with no turn running: see `StatusReason`. */
  statusReason: StatusReason | null;
  /** The turn its status follows, its latest not taken back, which Dismiss sends: null before. */
  statusTurn: string | null;
  /** The sub-agents of its running turn that have not ended. */
  subagents: Array<SubagentRecord>;
  /** The sub-sessions Uraeda started for its runs, the first started first. */
  subSessions: Array<SubSessionRecord>;
  /** A chat's title, "New session" before its first message, or its feature's title. */
  title: string;
  /** Its turns' IDs, oldest first. */
  turns: Array<string>;
  /**
   * Whether its latest turn ended after the human last saw it, whatever its status: the view
   * records it seen.
   */
  unseen: boolean;
  /** When its run continues by itself, while it waits; null otherwise. */
  wait: Wait | null;
};

/** A session's row in the sidebar. */
export type SessionRowRecord = {
  /** The kind of the agent it runs on: `claude`, or `fake`. */
  agent: string;
  archived: boolean;
  /** The background commands of its running turn still running. */
  backgroundCommands: number;
  /** Whether it is a session without a workflow read to its last message: Done lists it. */
  done: boolean;
  folder: string | null;
  id: string;
  /** When it started, which its place in the list follows. */
  startedAt: string;
  status: SessionStatus;
  statusLabel: string;
  subagents: Array<SubagentRecord>;
  title: string;
  /** The last turn's start or end. */
  updatedAt: string;
  /** When its run continues by itself, while it waits; null otherwise. */
  wait: Wait | null;
};

/** The sidebar's sessions, what needs the human first: one record, `all`, kept live. */
export type SessionListRecord = { id: string; rows: Array<SessionRowRecord> };

/** The sessions whose title or messages hold the query, which is its ID: not live. */
export type SessionSearchRecord = { id: string; rows: Array<SessionRowRecord> };

export const workspaceDataView = dataView<WorkspaceRecord>("Workspace")({
  currentBranch: true,
  defaultBranch: true,
  features: true,
  id: true,
  noSpecs: true,
  preview: true,
  priorities: true,
  prioritiesHash: true,
  proposals: true,
  root: true,
  setup: true,
});

export const featureDataView = dataView<FeatureRecord>("Feature")({
  agent: true,
  behind: true,
  branch: true,
  files: true,
  folder: true,
  id: true,
  kind: true,
  label: true,
  leftBranch: true,
  leftWorktree: true,
  missing: true,
  mockups: true,
  newPick: true,
  notes: true,
  path: true,
  preview: true,
  problems: true,
  pullRequest: true,
  runOptions: true,
  runtime: true,
  session: true,
  sessions: true,
  slug: true,
  source: true,
  status: true,
  step: true,
  title: true,
  tokens: true,
  uncommitted: true,
  worktree: true,
});

export const fileDataView = dataView<FileRecord>("WorkflowFile")({
  answered: true,
  candidates: true,
  change: true,
  committed: true,
  current: true,
  decisionChanges: true,
  folder: true,
  id: true,
  kind: true,
  missing: true,
  name: true,
  path: true,
  resumable: true,
  review: true,
  reviewStale: true,
  sinceReview: true,
  status: true,
  takesImages: true,
  tip: true,
});

export const branchDecisionDataView = dataView<BranchDecisionRecord>("BranchDecision")({
  change: true,
  document: true,
  folder: true,
  id: true,
  missing: true,
  name: true,
});

export const prioritiesDataView = dataView<PrioritiesRecord>("Priorities")({
  change: true,
  changeLines: true,
  changes: true,
  hash: true,
  id: true,
  sections: true,
});

export const inboxDataView = dataView<InboxRecord>("Inbox")({
  categories: true,
  change: true,
  changes: true,
  count: true,
  hash: true,
  id: true,
  names: true,
  triage: true,
});

export const agentDataView = dataView<AgentRecord>("Agent")({
  id: true,
  runtimes: true,
});

export const sessionDataView = dataView<SessionRecord>("Session")({
  account: true,
  accountId: true,
  agent: true,
  allowable: true,
  archived: true,
  automaticContinues: true,
  backgroundCommands: true,
  changeRefusal: true,
  edited: true,
  effort: true,
  folder: true,
  id: true,
  model: true,
  name: true,
  parent: true,
  place: true,
  ranEffort: true,
  ranModel: true,
  role: true,
  startedAt: true,
  status: true,
  statusLabel: true,
  statusReason: true,
  statusTurn: true,
  subagents: true,
  subSessions: true,
  title: true,
  turns: true,
  unseen: true,
  wait: true,
});

export const sessionListDataView = dataView<SessionListRecord>("SessionList")({
  id: true,
  rows: true,
});

export const sessionSearchDataView = dataView<SessionSearchRecord>("SessionSearch")({
  id: true,
  rows: true,
});

/** The ids of the records there is one of. */
export const WORKSPACE_ID = "workspace";
export const PRIORITIES_ID = "priorities";
export const INBOX_ID = "inbox";
export const AGENT_ID = "agent";
export const SESSION_LIST_ID = "all";
export const PROPOSAL_HINTS_ID = "proposal";

/** The roots: one list per type, so every type is read by id. */
export const Root = {
  agents: list(agentDataView),
  allBranchChangesList: list(allBranchChangesDataView),
  branchChangesList: list(branchChangesDataView),
  branchDecisions: list(branchDecisionDataView),
  buffers: list(bufferDataView),
  droppedItems: list(droppedDataView),
  features: list(featureDataView),
  folderSuggestionsList: list(folderSuggestionsDataView),
  histories: list(historyDataView),
  inboxes: list(inboxDataView),
  ledgers: list(ledgerDataView),
  needsYouLists: list(needsYouListDataView),
  previews: list(previewDataView),
  prioritiesList: list(prioritiesDataView),
  proposalFiles: list(proposalFileDataView),
  proposalHintsList: list(proposalHintsDataView),
  recommendedMessages: list(recommendedDataView),
  repositoriesList: list(repositoriesDataView),
  sessionLists: list(sessionListDataView),
  sessions: list(sessionDataView),
  sessionSearches: list(sessionSearchDataView),
  settingsList: list(settingsDataView),
  slugProposals: list(slugProposalDataView),
  stories: list(storyDataView),
  storyHrefs: list(storyHrefDataView),
  themesList: list(themesDataView),
  turnLogs: list(turnLogDataView),
  turns: list(turnDataView),
  workflowFiles: list(fileDataView),
  workflowMessages: list(workflowMessageDataView),
  workspaces: list(workspaceDataView),
};
