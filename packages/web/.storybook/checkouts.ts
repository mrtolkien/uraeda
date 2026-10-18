// The fixture's features that stories show, by state: `fixture.ts` builds each.

/** The checkouts `StoryEmbed.stories.tsx` shows. */
export const CHECKOUTS = {
  /** The test feature of the story embeds, `addStoryFeature`'s, its fake Storybook ready. */
  ready: "2026-10-20-sidebar-resize",
  /** A feature whose fake Storybook never serves its index. */
  starting: "2026-10-21-slow-preview",
  /** A feature whose fake Storybook exits with an error. */
  failed: "2026-10-22-broken-preview",
  /** A feature with no worktree. */
  noWorktree: "2026-10-23-no-worktree",
} as const;

/**
 * The round page's mockup features, `RoundPage.stories.tsx`'s, without a worktree: `Waiting`'s, its
 * Q1 answered B, and `CommentOnly`'s, its Q1 answered with a comment alone.
 */
export const ROUND_MOCKUPS = {
  commentOnly: "2026-10-17-round-mockup-comment",
  waiting: "2026-10-17-round-mockup",
} as const;

/**
 * The spec page's features, `SpecPage.stories.tsx`'s, built by `addSpecFeature` without a worktree:
 * its spec waiting for review, and the same spec approved.
 */
export const SPEC_PAGES = {
  approved: "2026-10-17-spec-page-approved",
  waiting: "2026-10-17-spec-page",
} as const;

/**
 * The feature page's features, by state, which `featurePages.ts` builds: `FeaturePage.stories.tsx`'s,
 * the browser tests', and the screenshots'.
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
