// The fields each page reads, by type. Arrays come whole; objects are selected field by field, as
// fate asks.
import { view } from "react-fate";
import type {
  Agent,
  BranchChanges,
  BranchDecision,
  Draft,
  Feature,
  FolderSuggestions,
  History,
  Inbox,
  Ledger,
  NeedsYouList,
  Preview,
  Priorities,
  ProposalHints,
  RecommendedMessage,
  Repositories,
  Session,
  SessionList,
  SessionSearch,
  Settings,
  SlugProposal,
  Story,
  StoryHref,
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
    settledComments: true,
    settledGroups: true,
    settledPoints: true,
    status: true,
  },
  plan: { tasks: true },
  review: { comments: true, commit: true, summary: true, verdict: true },
  rulings: true,
  spec: {
    answers: true,
    approve: true,
    block: true,
    criteria: true,
    decisions: true,
    edges: true,
    minutes: true,
    mockups: true,
    parts: true,
    planReview: true,
    principles: true,
    riskTier: true,
    stories: true,
    tiers: true,
    tradeoffs: true,
    units: true,
  },
} as const;

const VersionSelection = {
  document: DocumentSelection,
  items: ItemsSelection,
  stories: true,
  text: true,
} as const;

export const WorkspaceView = view<Workspace>()({
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

export const FeatureView = view<Feature>()({
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
  notes: true,
  path: true,
  preview: true,
  problems: true,
  pullRequest: { number: true, state: true, url: true },
  session: true,
  slug: true,
  source: true,
  step: {
    file: true,
    fileKind: true,
    implemented: true,
    name: true,
    order: true,
    progress: true,
    task: true,
    waitsOn: true,
  },
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

/** A feature's or a change's history, by its folder: its stages and their starts, from git. */
export const HistoryView = view<History>()({
  current: true,
  decisions: true,
  finished: true,
  folder: true,
  found: true,
  id: true,
  lines: { added: true, files: true, removed: true },
  questions: true,
  rounds: true,
  stages: true,
  totalSeconds: true,
});

/** A decision as a feature's branch has it, with its change against the default branch. */
export const BranchDecisionView = view<BranchDecision>()({
  change: {
    compared: true,
    fields: true,
    kind: true,
    listed: true,
    name: true,
    sections: true,
    title: true,
  },
  document: { blocks: true, hash: true },
  folder: true,
  id: true,
  missing: true,
  name: true,
});

export const FileView = view<WorkflowFile>()({
  answered: { comments: true, commit: true, summary: true, verdict: true },
  committed: VersionSelection,
  current: VersionSelection,
  decisionChanges: true,
  folder: true,
  id: true,
  kind: true,
  missing: true,
  name: true,
  path: true,
  review: ItemsSelection,
  reviewStale: true,
  status: true,
  takesImages: true,
  tip: true,
});

export const PrioritiesView = view<Priorities>()({
  changes: true,
  hash: true,
  id: true,
  sections: true,
});

/** The priorities as an add answers them: with `added`, whether "Add and commit" committed. */
export const PrioritiesAddedView = view<Priorities>()({
  added: { committed: true, message: true, reason: true },
  changes: true,
  hash: true,
  id: true,
  sections: true,
});

/** The inbox: its notes by category, every category's name, and the changes to commit. */
export const InboxView = view<Inbox>()({
  categories: true,
  changes: true,
  count: true,
  hash: true,
  id: true,
  names: true,
  triage: true,
});

/** The inbox as an add answers it: with `added`, whether "Add and commit" committed. */
export const InboxAddedView = view<Inbox>()({
  added: { committed: true, message: true, reason: true },
  categories: true,
  changes: true,
  count: true,
  hash: true,
  id: true,
  names: true,
  triage: true,
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
  stories: true,
  text: true,
  title: true,
  written: true,
});

/** A draft's title, for the lists that offer drafts by title, like "Add to a draft". */
export const DraftTitleView = view<Draft>()({
  id: true,
  path: true,
  title: true,
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
  fiveHourLimit: { percentUsed: true, resetsAt: true },
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

/**
 * A feature's recommended message, by its folder: its name, step, text, and trigger, or why none
 * applies, `reason`.
 */
export const RecommendedView = view<RecommendedMessage>()({
  id: true,
  name: true,
  reason: true,
  step: true,
  text: true,
  trigger: true,
});

export const ProposalHintsView = view<ProposalHints>()({
  hints: true,
  id: true,
});

/** What needs the human across every repository, on the global endpoint, for the notifications. */
export const NeedsYouView = view<NeedsYouList>()({
  id: true,
  rows: true,
});

/** The list of repositories, which every endpoint serves. */
export const RepositoriesView = view<Repositories>()({
  added: true,
  id: true,
  problem: true,
  rows: true,
});

/** A setting: its value in force, the file's, and its source. */
const SettingSelection = { inForce: true, saved: true, source: true } as const;

/**
 * The server's settings, which every endpoint serves: the file, its problem, and each setting's
 * value in force, the file's, and its source. Named apart from the page's `SettingsView`.
 */
export const SettingsRecordView = view<Settings>()({
  file: true,
  id: true,
  problem: true,
  runs: { buildInFreshSession: SettingSelection },
  server: {
    allowedHosts: SettingSelection,
    openBrowser: SettingSelection,
    port: SettingSelection,
  },
});

/** The folders the add form suggests for a typed text, its id. */
export const FolderSuggestionsView = view<FolderSuggestions>()({
  id: true,
  rows: true,
});

/** The slug the core proposes for a typed change's whole text, its id (R14). */
export const SlugProposalView = view<SlugProposal>()({
  id: true,
  slug: true,
});

/**
 * A story link of a checkout, `<folder>:<path>#<export>`: its Storybook's state, and its frame and
 * Storybook page once ready. Reading it is a view of the checkout's Storybook.
 */
export const StoryView = view<Story>()({
  error: true,
  frame: true,
  id: true,
  state: true,
  storybook: true,
});

/** A checkout's Storybook, by its folder or `main`: its state, and its base path once ready. */
export const PreviewView = view<Preview>()({
  base: true,
  error: true,
  id: true,
  state: true,
});

/** Whether an agent's link, by its href, is a story link, as the core reads it: not a view. */
export const StoryHrefView = view<StoryHref>()({
  export: true,
  id: true,
  path: true,
});

/**
 * The constitution and the decisions of the default branch: the constitution's document, its
 * version line's fields, and its principles; each decision whole, its document with it.
 */
export const LedgerView = view<Ledger>()({
  constitution: {
    amended: true,
    document: DocumentSelection,
    principles: true,
    ratified: true,
    title: true,
    version: true,
  },
  decisions: true,
  id: true,
  problems: true,
});
