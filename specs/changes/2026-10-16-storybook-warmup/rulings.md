# Rulings: Faster story embeds

The low-impact choices made while building [the change](proposal.md), inside the limits of its
proposal and the decisions. None binds future work: those are decisions.

## R1: "When its worktree is set up" is when a feature's turn ends done

- **Decision**: the server starts a feature's or a change's Storybook each time one of its agent's
  turns ends done, once the worktree's preview folder has its `node_modules`.
- **Rationale**: the agent sets the worktree up inside its turn, as the git decision asks, and the
  server cannot see an install finish. A turn that ends done is when the agent comes back to you, so
  the Storybook warms while you get to it. Without `node_modules`, a start only fails, and every
  embed then shows the failure until "Try again"
  ([`warmPreview`](/packages/server/src/fate/preview.ts),
  [`onTurnDone`](/packages/server/src/live.ts)).
- **Alternatives considered**: watching each worktree for its `node_modules` to appear, which needs
  a watcher outside the repository's files; starting every worktree's Storybook at the server's
  start, which holds about 1.5 GB each for features you are not looking at.
- **If wrong**: a turn that ends on a feature with no stories starts a Storybook it does not need,
  stopped after 30 minutes without a view. Removing the listener in
  [`createApp`](/packages/server/src/app.ts) undoes it.
- **Where**: `packages/server/src/live.ts`, `packages/server/src/app.ts`,
  `packages/server/src/fate/preview.ts`

## R2: Every page of a feature starts its Storybook, not only its main page

- **Decision**: the feature's or change's page, its files, its HTML mockups, and its session read
  its Storybook's record, which starts it and keeps it running while one of them shows.
- **Rationale**: a spec or a round is often opened from a link, without the feature's page first;
  the session is where an agent's stories show. The Storybook page reads it already.
- **Alternatives considered**: the feature's page alone, as the proposal says it: a link straight to
  the spec would still wait for the start.
- **If wrong**: a page you keep open keeps its Storybook running past 30 minutes. The routes are
  listed in `StartsStorybook`, in [`App.tsx`](/packages/web/src/App.tsx).
- **Where**: `packages/web/src/App.tsx`

## R3: A frame loads once any part of it is on screen, with no margin

- **Decision**: a story's frames get their address once their box first intersects the window, and
  keep it after.
- **Rationale**: a margin would load the embeds just below the window too, which a page of many
  embeds is meant to avoid; the Storybook is already running, so a frame shows its story in under a
  second once scrolled to.
- **Alternatives considered**: the browser's `loading="lazy"`, whose distance differs by browser and
  loads frames far below the window in Chromium.
- **If wrong**: frames appear a moment after you scroll to them. A `rootMargin` on the observer in
  [`StoryFrames.tsx`](/packages/web/src/StoryFrames.tsx) loads them earlier.
- **Where**: `packages/web/src/StoryFrames.tsx`
