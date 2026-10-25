// The folders the sample builders build, by the page that shows them: the one part of the samples
// the stories and browser tests import, so it imports nothing, and runs in a browser as in Node.

/**
 * The feature page's features, by state, which `addFeaturePages` builds:
 * `FeaturePage.stories.tsx`'s, the browser tests', and the screenshots'.
 */
export const FEATURE_PAGES = {
  /** At implementation, task 7 of 11 current: the agent builds. */
  working: "2026-10-17-redesign-clarifications",
  /** Its spec waiting for review. */
  waiting: "2026-10-17-recurring-reminders",
  /** Its spec approved, no agent working: "Next" offers the plan, with agent time already counted. */
  idle: "2026-10-17-snooze-times",
  /** Its spec's status unreadable, "aproved": the workflow cannot go on. */
  blocked: "2026-10-17-due-dates",
  /** Finished on its branch, its pull request #31 open once `gh` lists it. */
  pullRequest: "2026-10-17-keyboard-shortcuts",
  /** Merged by rebase, its build started the day after its plan, its record in place. */
  done: "2026-10-17-redesign-rounds",
  /** A change merged by rebase, without a round of questions. */
  doneChange: "2026-10-17-symlinks",
} as const;

/**
 * The round page's mockup features, `RoundPage.stories.tsx`'s and the screenshots', without a
 * worktree: `Waiting`'s, its Q1 answered B, and `CommentOnly`'s, its Q1 answered with a comment
 * alone.
 */
export const ROUND_MOCKUPS = {
  commentOnly: "2026-10-17-round-mockup-comment",
  waiting: "2026-10-17-round-mockup",
} as const;

/**
 * The questions page's features, which `addQuestionsPages` builds without a worktree, from the
 * spec's rounds in `fixtures/`: the merge-chats round waiting, its Q2 answered A so that its
 * follow-up shows, and answered; and the layout-look round waiting, with Q4's example.
 */
export const QUESTIONS_PAGES = {
  answered: "2026-10-20-merge-chats-answered",
  layoutLook: "2026-10-20-layout-look",
  waiting: "2026-10-20-merge-chats",
} as const;

/**
 * The spec page's features, `SpecPage.stories.tsx`'s, `PlanPage.stories.tsx`'s, the screenshots',
 * and the sandbox's, built by `addSpecFeature` without a worktree: its spec at its second revision,
 * waiting for review, with what changed since the first; the same spec approved; and the questions
 * page's plan over the approved spec, auto-approved and waiting for review.
 */
export const SPEC_PAGES = {
  approved: "2026-10-17-spec-page-approved",
  /** `fixtures/plan-page/plan.md`, auto-approved. */
  plan: "2026-10-17-plan-page",
  /** `fixtures/plan-page/plan.md`, waiting for review. */
  planWaiting: "2026-10-17-plan-page-waiting",
  /** `SPEC_FEATURE` of `uraeda-binding/test-utils`, which only Node loads: a test checks they match. */
  waiting: "2026-10-17-spec-page",
} as const;
