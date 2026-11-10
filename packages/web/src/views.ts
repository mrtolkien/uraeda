// The fields each page reads, by type. Arrays come whole; objects are selected field by field, as
// fate asks.
import { view } from "react-fate";
import type {
  Agent,
  AllBranchChanges,
  BranchChanges,
  BranchDecision,
  ExtensionAction,
  ExtensionRecord,
  ProposalFile,
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
  SlugProposal,
  StartPlan,
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
    verdict: true,
  },
  dataModel: { intro: true, sections: true },
  plan: { lead: true, tasks: true },
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
  },
} as const;

const VersionSelection = {
  document: DocumentSelection,
  items: ItemsSelection,
  mockups: true,
  stories: true,
  text: true,
} as const;

export const WorkspaceView = view<Workspace>()({
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

export const FeatureView = view<Feature>()({
  agent: { runningSince: true, seconds: true },
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
  notes: true,
  path: true,
  preview: true,
  problems: true,
  pullRequest: { number: true, state: true, url: true },
  runOptions: {
    merged: { implementers: true, reviewDepth: true, reviewers: true, steps: true },
    own: { implementers: true, reviewDepth: true, reviewers: true, steps: true },
  },
  runtime: true,
  session: true,
  sessions: true,
  slug: true,
  source: true,
  status: {
    label: true,
    reason: true,
    session: true,
    status: true,
    turn: true,
    wait: { at: true, reason: true },
  },
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
  tokens: { input: true, output: true, partial: true, since: true },
  uncommitted: true,
  worktree: true,
});

/** A feature's start, as planned: the session opens on its folder with its message. */
export const StartPlanView = view<StartPlan>()({
  folder: true,
  id: true,
  message: true,
  title: true,
});

/** A feature's branch changes, by its folder: null without a branch, and whether they `failed`. */
export const BranchChangesView = view<BranchChanges>()({
  changes: { added: true, count: true, files: true, removed: true },
  failed: true,
  id: true,
});

/** Every feature's count of changed files and lines, for the sidebar's cards, in one record. */
export const AllBranchChangesView = view<AllBranchChanges>()({
  failed: true,
  features: true,
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
  candidates: true,
  committed: VersionSelection,
  current: VersionSelection,
  decisionChanges: true,
  folder: true,
  id: true,
  kind: true,
  missing: true,
  name: true,
  path: true,
  resumable: true,
  review: ItemsSelection,
  reviewStale: true,
  sinceReview: { found: true, parts: true, revision: true },
  status: true,
  takesImages: true,
  tip: true,
});

export const PrioritiesView = view<Priorities>()({
  changeLines: true,
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

export const ProposalFileView = view<ProposalFile>()({
  committed: true,
  discovery: true,
  discoveryLevels: true,
  document: DocumentSelection,
  emptySections: true,
  folder: true,
  hash: true,
  id: true,
  kind: true,
  mockups: true,
  path: true,
  priorityChanges: true,
  proposal: {
    feature: true,
    file: true,
    id: true,
    key: true,
    link: true,
    position: true,
    section: true,
    text: true,
  },
  slug: true,
  stories: true,
  text: true,
  title: true,
  written: true,
});

/**
 * A proposal file's title and text, for the lists that offer proposal files, like the inbox's `p`
 * picker.
 */
export const ProposalFileTextView = view<ProposalFile>()({
  id: true,
  path: true,
  text: true,
  title: true,
});

export const AgentView = view<Agent>()({
  id: true,
  runtimes: true,
});

/**
 * A session's runtime by the name it stored, and its account, as the sidebar's usage and a
 * session's header read them.
 */
export const SessionAgentView = view<Session>()({
  account: true,
  agent: true,
  id: true,
});

/** What a running session runs on, as its composer's effort picker reads it: agent IDs, null for the agent's default. */
export const SessionPickView = view<Session>()({
  agent: true,
  effort: true,
  id: true,
  model: true,
});

export const SessionView = view<Session>()({
  account: true,
  agent: true,
  allowable: true,
  archived: true,
  automaticContinues: true,
  edited: true,
  folder: true,
  id: true,
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
  wait: { at: true, reason: true },
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

/** An extension's named record, `<extension>/<name>`: its value as JSON, or why it was not read. */
export const ExtensionRecordView = view<ExtensionRecord>()({ error: true, id: true, value: true });

/** An extension's action's answer, its output as JSON. */
export const ExtensionActionView = view<ExtensionAction>()({ id: true, outputJson: true });

/** The folders the add form suggests for a typed text, its id. */
export const FolderSuggestionsView = view<FolderSuggestions>()({
  id: true,
  rows: true,
});

/** The slug the core proposes for a typed change's or feature's whole text, its id (R14). */
export const SlugProposalView = view<SlugProposal>()({
  discoveryLevels: true,
  id: true,
  slug: true,
});

/**
 * A story link of a checkout, `<folder>:<path>#<export>`: its Storybook's state, and its frame and
 * story page once ready. Reading it is a view of the checkout's Storybook.
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
  decisionsCheck: true,
  id: true,
  problems: true,
});
