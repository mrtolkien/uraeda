// The data views of every type the UI reads. Records are the binding's views with an `id`: the
// mapped type turns napi-rs's interfaces into type literals, which fate's record constraint accepts.
import { dataView, list } from "@nkzw/fate/server";
import type {
  AddCommit,
  BranchDecision,
  DraftView,
  EntryItem,
  FeatureView,
  FileView,
  Inbox,
  Priorities,
  ProposalHint,
  RunningFeature,
  SectionItems,
  StepView,
  TaskProgress,
  WorkspaceView,
} from "uraeda-binding";
import type { Capabilities } from "../runner/adapter.ts";
import type {
  Item,
  Trigger,
  TurnActivity,
  TurnKind,
  TurnState,
  UsageLimit,
} from "../runner/events.ts";
import type { SessionStatus, StatusReason } from "../runner/status.ts";
import type { ItemLook } from "./items.ts";
import { needsYouListDataView } from "./needs-you.ts";
import { previewDataView, storyDataView, storyHrefDataView } from "./preview.ts";
import { settingsDataView } from "./settings.ts";
import { branchChangesDataView } from "./views-branch.ts";
import { ledgerDataView } from "./views-ledger.ts";
import { folderSuggestionsDataView, repositoriesDataView } from "./views-repositories.ts";

type Record_<T> = { [Key in keyof T]: T[Key] };

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
  /** Its features, each step sent as `sentStep` sends it, with its name and colour (R2). */
  features: Array<Omit<FeatureView, "step"> & ItemLook & { step: StepRecord }>;
  id: string;
  /** Whether the main checkout has an active preview decision. */
  preview: boolean;
  /** The folders whose session has a turn running or queued. */
  running: Array<string>;
};

/** A feature, or `missing` alone when no feature has its folder. */
export type FeatureRecord = Omit<Record_<FeatureView>, "step"> &
  // Its name and colour in the sidebar, or null (R2).
  ItemLook & {
    id: string;
    missing?: boolean;
    /**
     * Whether its worktree, or the main checkout for a feature without one, has an active preview
     * decision (R7).
     */
    preview: boolean;
    /** Its session's ID, null before its first message. */
    session: string | null;
    step: StepRecord;
  };
/** A workflow file, or `missing` alone when its feature has no such file. */
export type FileRecord = Record_<FileView> & { missing?: boolean };

/**
 * A file as it is sent: its optional fields, when absent, sent as null. The client's cache keeps a
 * field an answer leaves out, so a review removed or a version committed would stay on screen.
 */
export function sentFile(record: FileRecord): FileRecord {
  const cleared = {
    answered: null,
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
/** An entry, the step of its running feature sent as `sentStep` sends it. */
type EntryRecord = Omit<EntryItem, "running"> & {
  running?: Omit<RunningFeature, "step"> & { step: StepRecord };
};
/** Whether "Add and commit" committed: set on the answer of an add, null on other answers. */
type Added = { added?: Record_<AddCommit> | null };
export type PrioritiesRecord = Omit<Record_<Priorities>, "sections"> &
  Added & {
    id: string;
    sections: Array<Omit<SectionItems, "entries"> & { entries: Array<EntryRecord> }>;
  };

/** The inbox: one record, `inbox`, its triage's status sent as null when there is no triage. */
export type InboxRecord = Omit<Record_<Inbox>, "triage"> &
  Added & { id: string; triage: string | null };

export type DraftRecord = Record_<DraftView> & { id: string };
/** The proposal template's guidance, by heading, which the editor shows in empty sections. */
export type ProposalHintsRecord = { hints: Array<Record_<ProposalHint>>; id: string };

/** The slug the core proposes for a typed change, whose text is its ID: "New change" shows it. */
export type SlugProposalRecord = { id: string; slug: string };

/** The agent sessions run on, and what it can do: one record, `agent`. */
export type AgentRecord = {
  available: boolean;
  /** What the UI may offer, and nothing more. */
  capabilities: Capabilities;
  fiveHourLimit: UsageLimit | null;
  id: string;
  /** Its kind, stored with its sessions: `claude`. */
  kind: string;
  /** Its name, for people: "Claude Code". */
  name: string;
  version: string | null;
};

/** A sub-agent working in a session's running turn. */
export type SubagentRecord = { description: string; id: string };

/** A session, without its turns' items. */
export type SessionRecord = {
  /** The agent's kind. */
  agent: string;
  archived: boolean;
  /** The background commands of its running turn still running. */
  backgroundCommands: number;
  /** The feature's folder, null for a chat. */
  folder: string | null;
  id: string;
  /** Where it works: "branch <branch>", or "main checkout, branch <branch>" for a chat. */
  place: string;
  status: SessionStatus;
  /** "Working", "Needs you", "Needs attention", "New reply", or "Idle". */
  statusLabel: string;
  /**
   * Why it needs you: a blocked action, the feature's step, or a latest turn that failed, was
   * stopped, or ended before a human gate.
   */
  statusReason: StatusReason | null;
  /** The sub-agents of its running turn that have not ended. */
  subagents: Array<SubagentRecord>;
  /** A chat's title, "New chat" before its first message, or its feature's title. */
  title: string;
  /** Its turns' IDs, oldest first. */
  turns: Array<string>;
  /**
   * Whether its latest turn ended after the human last saw it, whatever its status: the view
   * records it seen.
   */
  unseen: boolean;
};

/** A turn of a session, without its items. */
export type TurnRecord = {
  /** What it does now while it runs, "Thinking" or "Writing spec.md", and since when. */
  activity: TurnActivity | null;
  /** An allow turn's rule. */
  allowed: string | null;
  endedAt: string | null;
  id: string;
  kind: TurnKind;
  /** The count of its item pages, of 100 items each. */
  pages: number;
  /** Why it failed or stopped. */
  reason: string | null;
  session: string;
  startedAt: string | null;
  state: TurnState;
  /** A workflow turn's step when it started. */
  step: string | null;
  trigger: Trigger | null;
};

/**
 * A page of 100 items of a turn, `<turn>:<page>`, from page 0, by their `seq`. Messages taken
 * back are left out: they leave the transcript.
 */
export type TurnLogRecord = {
  id: string;
  items: Array<Item & { seq: number }>;
  page: number;
  turn: string;
};

/** A session's row in the sidebar. */
export type SessionRowRecord = {
  archived: boolean;
  /** The background commands of its running turn still running. */
  backgroundCommands: number;
  folder: string | null;
  id: string;
  status: SessionStatus;
  statusLabel: string;
  subagents: Array<SubagentRecord>;
  title: string;
  /** The last turn's start or end. */
  updatedAt: string;
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
  refusal: string | null;
  /** The step the message starts. */
  step: string;
  text: string;
};

export const workspaceDataView = dataView<WorkspaceRecord>("Workspace")({
  currentBranch: true,
  defaultBranch: true,
  drafts: true,
  features: true,
  id: true,
  noSpecs: true,
  preview: true,
  priorities: true,
  prioritiesHash: true,
  root: true,
  running: true,
});

export const featureDataView = dataView<FeatureRecord>("Feature")({
  behind: true,
  branch: true,
  color: true,
  files: true,
  folder: true,
  id: true,
  kind: true,
  label: true,
  leftBranch: true,
  leftWorktree: true,
  missing: true,
  mockups: true,
  path: true,
  preview: true,
  problems: true,
  pullRequest: true,
  session: true,
  slug: true,
  source: true,
  step: true,
  title: true,
  uncommitted: true,
  worktree: true,
});

export const fileDataView = dataView<FileRecord>("WorkflowFile")({
  answered: true,
  committed: true,
  current: true,
  decisionChanges: true,
  folder: true,
  id: true,
  kind: true,
  missing: true,
  name: true,
  path: true,
  review: true,
  reviewStale: true,
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
  added: true,
  changes: true,
  hash: true,
  id: true,
  sections: true,
});

export const inboxDataView = dataView<InboxRecord>("Inbox")({
  added: true,
  categories: true,
  changes: true,
  count: true,
  hash: true,
  id: true,
  names: true,
  triage: true,
});

export const draftDataView = dataView<DraftRecord>("Draft")({
  committed: true,
  discovery: true,
  discoveryLevels: true,
  document: true,
  emptySections: true,
  entry: true,
  folder: true,
  hash: true,
  id: true,
  kind: true,
  path: true,
  priorityChanges: true,
  slug: true,
  stories: true,
  text: true,
  title: true,
  written: true,
});

export const agentDataView = dataView<AgentRecord>("Agent")({
  available: true,
  capabilities: true,
  fiveHourLimit: true,
  id: true,
  kind: true,
  name: true,
  version: true,
});

export const sessionDataView = dataView<SessionRecord>("Session")({
  agent: true,
  archived: true,
  backgroundCommands: true,
  folder: true,
  id: true,
  place: true,
  status: true,
  statusLabel: true,
  statusReason: true,
  subagents: true,
  title: true,
  turns: true,
  unseen: true,
});

export const turnDataView = dataView<TurnRecord>("Turn")({
  activity: true,
  allowed: true,
  endedAt: true,
  id: true,
  kind: true,
  pages: true,
  reason: true,
  session: true,
  startedAt: true,
  state: true,
  step: true,
  trigger: true,
});

export const turnLogDataView = dataView<TurnLogRecord>("TurnLog")({
  id: true,
  items: true,
  page: true,
  turn: true,
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
  refusal: true,
  step: true,
  text: true,
});

export const proposalHintsDataView = dataView<ProposalHintsRecord>("ProposalHints")({
  hints: true,
  id: true,
});

export const slugProposalDataView = dataView<SlugProposalRecord>("SlugProposal")({
  id: true,
  slug: true,
});

/** The ids of the records there is one of. */
export const WORKSPACE_ID = "workspace";
export const PRIORITIES_ID = "priorities";
export const INBOX_ID = "inbox";
/** The inbox's triage, among workflow files: the core's id for it, as it has no feature. */
export const TRIAGE_ID = "inbox-triage";
export const AGENT_ID = "agent";
export const SESSION_LIST_ID = "all";
export const PROPOSAL_HINTS_ID = "proposal";

/** The roots: one list per type, so every type is read by id. */
export const Root = {
  agents: list(agentDataView),
  branchChangesList: list(branchChangesDataView),
  branchDecisions: list(branchDecisionDataView),
  drafts: list(draftDataView),
  features: list(featureDataView),
  folderSuggestionsList: list(folderSuggestionsDataView),
  inboxes: list(inboxDataView),
  ledgers: list(ledgerDataView),
  needsYouLists: list(needsYouListDataView),
  previews: list(previewDataView),
  prioritiesList: list(prioritiesDataView),
  proposalHintsList: list(proposalHintsDataView),
  repositoriesList: list(repositoriesDataView),
  sessionLists: list(sessionListDataView),
  sessions: list(sessionDataView),
  sessionSearches: list(sessionSearchDataView),
  settingsList: list(settingsDataView),
  slugProposals: list(slugProposalDataView),
  stories: list(storyDataView),
  storyHrefs: list(storyHrefDataView),
  turnLogs: list(turnLogDataView),
  turns: list(turnDataView),
  workflowFiles: list(fileDataView),
  workflowMessages: list(workflowMessageDataView),
  workspaces: list(workspaceDataView),
};
