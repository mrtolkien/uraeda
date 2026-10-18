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
