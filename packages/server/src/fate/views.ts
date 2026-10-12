// The data views of every type the UI reads. Records are the binding's views with an `id`: the
// mapped type turns napi-rs's interfaces into type literals, which fate's record constraint accepts.
import { dataView, list } from "@nkzw/fate/server";
import type { DraftView, FeatureView, FileView, Priorities, WorkspaceView } from "uraeda-binding";
import type { RunEvent } from "../runner/events.ts";

type Record_<T> = { [Key in keyof T]: T[Key] };

export type WorkspaceRecord = Record_<WorkspaceView> & {
  id: string;
  /** The folders with a run going on. */
  running: Array<string>;
};
export type FeatureRecord = Record_<FeatureView> & {
  id: string;
  /** The IDs of its runs, newest first. */
  runs: Array<string>;
};
export type FileRecord = Record_<FileView>;
export type PrioritiesRecord = Record_<Priorities> & { id: string };
export type DraftRecord = Record_<DraftView> & { id: string };

/** Whether the agent works on this machine: one record, `runner`. */
export type RunnerRecord = { id: string; available: boolean; version: string | null };

/** A run, from the runner's cache, without its log. */
export type RunRecord = {
  id: string;
  folder: string;
  trigger: string;
  step: string;
  state: string;
  reason: string | null;
  costUsd: number | null;
  startedAt: string;
  endedAt: string | null;
  newSession: boolean;
  allowed: string | null;
  /** The count of its log pages, of 100 events each. */
  pages: number;
  /** The actions `auto` mode blocked, with the rule "Allow and continue" passes. */
  denials: Array<{ seq: number; tool: string; target: string | null; rule: string }>;
};

/** A page of 100 events of a run's log, `<run>:<page>`, from page 0. */
export type RunLogRecord = {
  id: string;
  run: string;
  page: number;
  events: Array<RunEvent & { seq: number }>;
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
  step: true,
  problems: true,
  leftWorktree: true,
  leftBranch: true,
  runs: true,
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

export const runnerDataView = dataView<RunnerRecord>("Runner")({
  id: true,
  available: true,
  version: true,
});

export const runDataView = dataView<RunRecord>("Run")({
  id: true,
  folder: true,
  trigger: true,
  step: true,
  state: true,
  reason: true,
  costUsd: true,
  startedAt: true,
  endedAt: true,
  newSession: true,
  allowed: true,
  pages: true,
  denials: true,
});

export const runLogDataView = dataView<RunLogRecord>("RunLog")({
  id: true,
  run: true,
  page: true,
  events: true,
});

/** The ids of the records there is one of. */
export const WORKSPACE_ID = "workspace";
export const PRIORITIES_ID = "priorities";
export const RUNNER_ID = "runner";

/** The roots: one list per type, so every type is read by id. */
export const Root = {
  workspaces: list(workspaceDataView),
  features: list(featureDataView),
  workflowFiles: list(fileDataView),
  prioritiesList: list(prioritiesDataView),
  drafts: list(draftDataView),
  runners: list(runnerDataView),
  runs: list(runDataView),
  runLogs: list(runLogDataView),
};
