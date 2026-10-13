// The fields each page reads, by type. Arrays come whole; objects are selected field by field, as
// fate asks.
import { view } from "react-fate";
import type {
  Agent,
  Draft,
  Feature,
  Priorities,
  ProposalHints,
  Session,
  SessionList,
  SessionSearch,
  Turn,
  TurnLog,
  WorkflowFile,
  WorkflowMessage,
  Workspace,
} from "uraeda-server/fate";

const DocumentSelection = {
  blocks: true,
  frontmatterLines: { start: true, end: true },
  hash: true,
} as const;

const ItemsSelection = {
  clarifications: {
    status: true,
    block: true,
    context: true,
    questions: true,
    settled: true,
    notes: true,
    notesLine: true,
  },
  spec: { stories: true, criteria: true, riskTier: true, planReview: true },
  plan: { tasks: true },
  review: { verdict: true, commit: true, summary: true, comments: true },
  rulings: true,
} as const;

const VersionSelection = {
  text: true,
  document: DocumentSelection,
  items: ItemsSelection,
} as const;

export const WorkspaceView = view<Workspace>()({
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

export const FeatureView = view<Feature>()({
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
  step: { name: true, waitsOn: true, file: true, task: true },
  problems: true,
  leftWorktree: true,
  leftBranch: true,
  session: true,
  missing: true,
});

export const FileView = view<WorkflowFile>()({
  id: true,
  folder: true,
  name: true,
  path: true,
  kind: true,
  status: true,
  current: VersionSelection,
  tip: true,
  committed: VersionSelection,
  review: ItemsSelection,
  reviewStale: true,
  missing: true,
});

export const PrioritiesView = view<Priorities>()({
  id: true,
  hash: true,
  sections: true,
  changes: true,
});

export const DraftView = view<Draft>()({
  id: true,
  path: true,
  title: true,
  text: true,
  hash: true,
  document: DocumentSelection,
  committed: true,
  entry: {
    id: true,
    key: true,
    section: true,
    position: true,
    text: true,
    link: true,
    feature: true,
    draft: true,
  },
  priorityChanges: true,
});

export const AgentView = view<Agent>()({
  id: true,
  kind: true,
  name: true,
  available: true,
  version: true,
  capabilities: { steer: true, queue: true, takeBack: true, approvals: true, subagents: true },
});

export const SessionView = view<Session>()({
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

export const TurnView = view<Turn>()({
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

export const TurnLogView = view<TurnLog>()({
  id: true,
  turn: true,
  page: true,
  items: true,
});

export const SessionListView = view<SessionList>()({
  id: true,
  rows: true,
});

export const SessionSearchView = view<SessionSearch>()({
  id: true,
  rows: true,
});

export const WorkflowMessageView = view<WorkflowMessage>()({
  id: true,
  text: true,
  step: true,
  refusal: true,
});

export const ProposalHintsView = view<ProposalHints>()({
  id: true,
  hints: true,
});
