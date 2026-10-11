// The fields each page reads, by type. Arrays come whole; objects are selected field by field, as
// fate asks.
import { view } from "react-fate";
import type { Draft, Feature, Priorities, WorkflowFile, Workspace } from "uraeda-server/fate";

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
  step: { name: true, waitsOn: true, file: true, task: true },
  problems: true,
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
    section: true,
    position: true,
    text: true,
    link: true,
    feature: true,
    draft: true,
  },
  priorityChanges: true,
});
