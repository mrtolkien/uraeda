// The fields each page reads, by type. Arrays come whole; objects are selected field by field, as
// fate asks.
import { view } from "react-fate";
import type {
  Agent,
  BranchChanges,
  Draft,
  Feature,
  FolderSuggestions,
  Priorities,
  ProposalHints,
  Repositories,
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
  frontmatterLines: { end: true, start: true },
  hash: true,
} as const;

const ItemsSelection = {
  clarifications: {
    block: true,
    context: true,
    notes: true,
    notesLine: true,
    questions: true,
    settled: true,
    settledComments: true,
    settledPoints: true,
    status: true,
  },
  plan: { tasks: true },
  review: { comments: true, commit: true, summary: true, verdict: true },
  rulings: true,
  spec: {
    criteria: true,
    details: true,
    mockups: true,
    planReview: true,
    riskTier: true,
    stories: true,
    tiers: true,
  },
} as const;

const VersionSelection = {
  document: DocumentSelection,
  items: ItemsSelection,
  text: true,
} as const;

export const WorkspaceView = view<Workspace>()({
  currentBranch: true,
  defaultBranch: true,
  drafts: true,
  features: true,
  id: true,
  noSpecs: true,
  priorities: true,
  prioritiesHash: true,
  root: true,
  running: true,
});

export const FeatureView = view<Feature>()({
  behind: true,
  branch: true,
  files: true,
  folder: true,
  id: true,
  kind: true,
  leftBranch: true,
  leftWorktree: true,
  missing: true,
  mockups: true,
  problems: true,
  session: true,
  slug: true,
  source: true,
  step: { file: true, implemented: true, name: true, progress: true, task: true, waitsOn: true },
  title: true,
  uncommitted: true,
  worktree: true,
});

/** A feature's branch changes, by its folder: null without a branch, and whether they `failed`. */
export const BranchChangesView = view<BranchChanges>()({
  changes: { added: true, count: true, files: true, removed: true },
  failed: true,
  id: true,
});

export const FileView = view<WorkflowFile>()({
  committed: VersionSelection,
  current: VersionSelection,
  folder: true,
  id: true,
  kind: true,
  missing: true,
  name: true,
  path: true,
  review: ItemsSelection,
  reviewStale: true,
  status: true,
  tip: true,
});

export const PrioritiesView = view<Priorities>()({
  changes: true,
  hash: true,
  id: true,
  sections: true,
});

export const DraftView = view<Draft>()({
  committed: true,
  discovery: true,
  discoveryLevels: true,
  document: DocumentSelection,
  emptySections: true,
  entry: {
    draft: true,
    feature: true,
    id: true,
    key: true,
    link: true,
    position: true,
    section: true,
    text: true,
  },
  folder: true,
  hash: true,
  id: true,
  kind: true,
  path: true,
  priorityChanges: true,
  slug: true,
  text: true,
  title: true,
  written: true,
});

export const AgentView = view<Agent>()({
  available: true,
  capabilities: {
    approvals: true,
    images: true,
    queue: true,
    steer: true,
    subagents: true,
    takeBack: true,
  },
  id: true,
  kind: true,
  name: true,
  version: true,
});

export const SessionView = view<Session>()({
  agent: true,
  archived: true,
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

export const TurnView = view<Turn>()({
  activity: { label: true, since: true },
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

export const TurnLogView = view<TurnLog>()({
  id: true,
  items: true,
  page: true,
  turn: true,
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
  refusal: true,
  step: true,
  text: true,
});

export const ProposalHintsView = view<ProposalHints>()({
  hints: true,
  id: true,
});

/** The list of repositories, which every endpoint serves. */
export const RepositoriesView = view<Repositories>()({
  added: true,
  id: true,
  problem: true,
  rows: true,
});

/** The folders the add form suggests for a typed text, its id. */
export const FolderSuggestionsView = view<FolderSuggestions>()({
  id: true,
  rows: true,
});
