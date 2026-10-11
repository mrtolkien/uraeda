// The data views of every type the UI reads. Records are the binding's views with an `id`: the
// mapped type turns napi-rs's interfaces into type literals, which fate's record constraint accepts.
import { dataView, list } from "@nkzw/fate/server";
import type { DraftView, FeatureView, FileView, Priorities, WorkspaceView } from "uraeda-binding";

type Record_<T> = { [Key in keyof T]: T[Key] };

export type WorkspaceRecord = Record_<WorkspaceView> & { id: string };
export type FeatureRecord = Record_<FeatureView> & { id: string };
export type FileRecord = Record_<FileView>;
export type PrioritiesRecord = Record_<Priorities> & { id: string };
export type DraftRecord = Record_<DraftView> & { id: string };

export const workspaceDataView = dataView<WorkspaceRecord>("Workspace")({
  id: true,
  root: true,
  defaultBranch: true,
  currentBranch: true,
  features: true,
  priorities: true,
  drafts: true,
  noSpecs: true,
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
  step: true,
  problems: true,
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
});

/** The ids of the records there is one of. */
export const WORKSPACE_ID = "workspace";
export const PRIORITIES_ID = "priorities";

/** The roots: one list per type, so every type is read by id. */
export const Root = {
  workspaces: list(workspaceDataView),
  features: list(featureDataView),
  workflowFiles: list(fileDataView),
  prioritiesList: list(prioritiesDataView),
  drafts: list(draftDataView),
};
