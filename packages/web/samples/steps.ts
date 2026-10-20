// The sample project's features at the steps the fixture repository and the feature page's builders
// leave out, each built from exactly the files and the pull request its step reads in the core
// (`crates/core/src/steps.rs`), on top of the recurring tasks' files of `fixtures/repo/`.
import { CHANGE_FOLDERS } from "./changes.ts";
import { commitsAt, type DatedCommit, ELEVEN, git, planText } from "uraeda-binding/test-utils";
import { STORY_FEATURE } from "uraeda-binding/test-utils";
import { type FakePullRequest, at, proposal, recurring, slugOf, spec } from "./features.ts";
import { FEATURE_PAGES } from "./folders.ts";

/** The steps a feature is at, a gate named by the file it waits on: each has a sample feature. */
export const FEATURE_STEPS = [
  "discovery",
  "round-waiting",
  "spec",
  "spec-waiting",
  "spec-revision",
  "approval",
  "plan",
  "plan-waiting",
  "plan-revision",
  "implementation",
  "final-review",
  "pull-request",
  "pull-request-changes",
  "finish",
  "done",
  "blocked",
] as const;

export type FeatureStep = (typeof FEATURE_STEPS)[number];

/** The folder of each step's sample feature. */
export const FEATURE_FOLDERS: Record<FeatureStep, string> = {
  discovery: "2026-10-19-dark-mode",
  "round-waiting": "2026-10-11-web-ui",
  spec: "2026-10-19-csv-export",
  // Its spec embeds stories, which run the fake Storybook.
  approval: "2026-10-19-tags",
  blocked: FEATURE_PAGES.blocked,
  done: FEATURE_PAGES.done,
  "final-review": "2026-10-18-archive",
  finish: "2026-10-18-themes",
  implementation: FEATURE_PAGES.working,
  plan: "2026-10-19-search",
  "plan-revision": "2026-10-19-undo",
  "plan-waiting": "2026-10-19-notifications",
  "pull-request": FEATURE_PAGES.pullRequest,
  "pull-request-changes": "2026-10-18-offline",
  "spec-revision": "2026-10-19-share-links",
  "spec-waiting": STORY_FEATURE,
};

/** The titles of the features this file builds, by folder. */
const TITLES: Record<string, string> = {
  "2026-10-18-archive": "Archive",
  "2026-10-18-offline": "Offline mode",
  "2026-10-18-themes": "Themes",
  "2026-10-19-csv-export": "CSV export",
  "2026-10-19-dark-mode": "Dark mode",
  "2026-10-19-notifications": "Notifications",
  "2026-10-19-search": "Search",
  "2026-10-19-share-links": "Share links",
  "2026-10-19-tags": "Tags",
  "2026-10-19-undo": "Undo",
};

/** A new decision the spec of the "approval" feature lists, proposed: the human approves it. */
const PROPOSED_DECISION = `---\nstatus: proposed\napproved-by:\nicon: repeat\n---\n\n# Repeating tasks\n\nA repeating task is one task, whose due date moves when it is completed.\n\n## Rules\n\n- A repeating task MUST stay one task. Checked by review.\n\n## Why\n\nOne task keeps its history in one place.\n`;

/** The state of a plan: written and waiting, sent back, or approved with every task done. */
type PlanState = "waiting" | "changes-requested" | "done";

/** A plan in `state`: its first 6 tasks done and the 7th current, unless every task is done. */
function plan(state: PlanState): string {
  if (state === "done") {
    return planText(
      ELEVEN.map(([title, , total]) => [title, total, total]),
      "approved",
    );
  }
  return planText(
    ELEVEN.map(([title, , total]) => [title, 0, total]),
    state === "waiting" ? "awaiting-human" : "changes-requested",
  );
}

/** One commit of a feature at `time`, a typed commit named after its `type`. */
function stage(
  folder: string,
  type: string,
  message: string,
  time: string,
  files: Record<string, string>,
): DatedCommit {
  return { at: at(time), files, message: `${type}(${slugOf(folder)}): ${message}` };
}

/**
 * A feature's commits up to `step`: each step's commit adds what the one before it waits on, from
 * the proposal at 10:52 on Oct 18 to the plan, and the build's one commit.
 */
function commitsUpTo(folder: string, step: FeatureStep): Array<DatedCommit> {
  const path = `specs/${folder}`;
  const title = TITLES[folder]!;
  const proposed = stage(folder, "proposal", title, "18 10:52", {
    [`${path}/proposal.md`]: proposal(title),
  });
  const round = stage(folder, "discovery", "round 01", "18 11:18", {
    [`${path}/clarifications-01.md`]: recurring("clarifications-01.md"),
  });
  const specOf = (status: string, time: string) =>
    stage(folder, "spec", "the spec", time, { [`${path}/spec.md`]: spec(status) });
  const planOf = (state: PlanState) =>
    stage(folder, "plan", "the plan", "18 15:05", { [`${path}/plan.md`]: plan(state) });
  const built = stage(folder, "feat", "the code", "18 15:20", {
    [`src/${slugOf(folder)}/index.ts`]: "export const built = true;\n",
  });
  // The recurring tasks' spec lists two new decisions: the first, proposed, makes the approval.
  const decision = stage(folder, "decision", "Repeating tasks", "18 12:30", {
    "specs/decisions/repeating-tasks.md": PROPOSED_DECISION,
  });
  const approved = specOf("approved", "18 12:11");
  const stages: Partial<Record<FeatureStep, Array<DatedCommit>>> = {
    approval: [proposed, round, approved, decision],
    discovery: [proposed],
    "final-review": [proposed, round, approved, planOf("done"), built],
    plan: [proposed, round, approved],
    "plan-revision": [proposed, round, approved, planOf("changes-requested")],
    "plan-waiting": [proposed, round, approved, planOf("waiting")],
    spec: [proposed, round],
    "spec-revision": [proposed, round, specOf("changes-requested", "18 12:11")],
  };
  stages.finish = stages["final-review"];
  stages["pull-request-changes"] = stages["final-review"];
  return stages[step]!;
}

/** The steps whose feature `commitsUpTo` builds, the build's pull request state in the others. */
const BUILT: Array<FeatureStep> = [
  "discovery",
  "spec",
  "spec-revision",
  "approval",
  "plan",
  "plan-waiting",
  "plan-revision",
  "final-review",
  "finish",
  "pull-request-changes",
];

/** Adds the features of `BUILT` to `repo`, each on its own branch from `main`. */
export function addStepFeatures(repo: string) {
  for (const step of BUILT) {
    const folder = FEATURE_FOLDERS[step];
    git(repo, "branch", folder, "main");
    commitsAt(repo, folder, commitsUpTo(folder, step));
  }
}

/** A pull request `gh` lists, its address the repository's. */
function pullRequest(
  headRefName: string,
  number: number,
  isDraft: boolean,
  reviewDecision: FakePullRequest["reviewDecision"],
): FakePullRequest {
  const url = `https://github.com/mrtolkien/uraeda/pull/${number}`;
  return { headRefName, isDraft, number, reviewDecision, url };
}

/**
 * The pull requests `gh` lists for the sample: the feature page's #31 open, the finished feature's
 * draft, the one with changes requested, and the change's, open.
 */
export function samplePullRequests(): Array<FakePullRequest> {
  return [
    pullRequest(FEATURE_FOLDERS["pull-request"], 31, false, ""),
    pullRequest(FEATURE_FOLDERS.finish, 33, true, ""),
    pullRequest(FEATURE_FOLDERS["pull-request-changes"], 34, false, "CHANGES_REQUESTED"),
    pullRequest(`change/${CHANGE_FOLDERS["pull-request"]}`, 35, false, ""),
  ];
}
