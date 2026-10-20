// The fixture's features that stories show, by state: `fixture.ts` builds each, from the sample
// builders' for all but the story embeds' checkouts.

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

// The round page's, the spec page's, and the feature page's features are the sample builders'.
export { FEATURE_PAGES, ROUND_MOCKUPS, SPEC_PAGES } from "../samples/index.ts";
