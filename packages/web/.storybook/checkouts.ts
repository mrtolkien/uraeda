// The fixture's checkouts that `StoryEmbed.stories.tsx` shows, by state: `fixture.ts` builds each.
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
