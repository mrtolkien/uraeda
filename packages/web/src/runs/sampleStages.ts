// The features the run map's page stories draw, as the core reads them: a feature building task 4
// of 9, the same feature merged, and a change whose pull request waits for its review. Times are
// in UTC, drawn in the browser's time zone.
import type { StagesHistory } from "../feature/timeline.ts";
import type { StagesFeature } from "./featureStages.ts";

const FOLDER = "2026-11-02-recurring-tasks";

const FILES: StagesFeature["files"] = [
  { kind: "proposal", name: "proposal.md" },
  { kind: "discovery", name: "discovery-01.md", round: 1 },
  { kind: "clarifications", name: "clarifications-01.md", round: 1, status: "answered" },
  { kind: "spec", name: "spec.md", status: "approved" },
  { kind: "review", name: "spec-review.md" },
  { kind: "data-model", name: "data-model.md" },
  { kind: "plan", name: "plan.md", status: "auto-approved" },
  { kind: "rulings", name: "rulings.md" },
];

const STAGES = [
  { name: "proposal", started: "2026-11-02T08:40:00Z" },
  { name: "questions", started: "2026-11-02T09:12:00Z" },
  { name: "spec", started: "2026-11-02T14:05:00Z" },
  { name: "plan", started: "2026-11-03T08:31:00Z" },
  { name: "build", started: "2026-11-03T09:02:00Z" },
  { name: "pull-request" },
  { name: "merged" },
];

/** A feature at work on its build, task 4 of 9. */
export const BUILDING: { feature: StagesFeature; history: StagesHistory } = {
  feature: {
    files: FILES,
    folder: FOLDER,
    kind: "feature",
    mockups: [],
    step: {
      name: "implementation",
      progress: { done: 3, title: "Task 4: Next due date on completion", total: 9 },
      waitsOn: "agent",
    },
  },
  history: { current: 4, folder: FOLDER, rounds: 1, stages: STAGES },
};

/** The same feature, merged, its record in place. */
export const MERGED: { feature: StagesFeature; history: StagesHistory } = {
  feature: {
    files: [{ kind: "record", name: "record.md" }],
    folder: FOLDER,
    kind: "feature",
    mockups: [],
    step: { name: "done", waitsOn: "nobody" },
  },
  history: {
    current: 6,
    folder: FOLDER,
    rounds: 1,
    stages: [
      ...STAGES.slice(0, 5),
      { name: "pull-request", started: "2026-11-03T16:48:00Z" },
      { name: "merged", started: "2026-11-04T10:15:00Z" },
    ],
  },
};

const CHANGE_FOLDER = "2026-11-05-tasks-reappear";

/** A change whose pull request waits for your review. */
export const CHANGE: { feature: StagesFeature; history: StagesHistory } = {
  feature: {
    files: [
      { kind: "proposal", name: "proposal.md" },
      { kind: "clarifications", name: "clarifications-01.md", round: 1, status: "answered" },
    ],
    folder: CHANGE_FOLDER,
    kind: "change",
    mockups: [],
    step: { name: "pull-request-review", waitsOn: "human" },
  },
  history: {
    current: 3,
    folder: CHANGE_FOLDER,
    rounds: 1,
    stages: [
      { name: "proposal", started: "2026-11-05T10:02:00Z" },
      { name: "questions", started: "2026-11-05T10:20:00Z" },
      { name: "fix", started: "2026-11-05T13:40:00Z" },
      { name: "pull-request", started: "2026-11-05T15:05:00Z" },
      { name: "merged" },
    ],
  },
};
