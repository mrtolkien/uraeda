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
 * The spec page's features, `SpecPage.stories.tsx`'s and the screenshots', built by
 * `addSpecFeature` without a worktree: its spec waiting for review, and the same spec approved.
 */
export const SPEC_PAGES = {
  approved: "2026-10-17-spec-page-approved",
  /** `SPEC_FEATURE` of `uraeda-binding/test-utils`, which only Node loads: a test checks they match. */
  waiting: "2026-10-17-spec-page",
} as const;
