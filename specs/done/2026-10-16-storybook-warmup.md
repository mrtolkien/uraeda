---
kind: change
finished: 2026-10-16
pull-request: https://github.com/mrtolkien/uraeda/pull/23
---

# Record: Faster story embeds

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-16, finished on
> 2026-10-16, in [its pull request](https://github.com/mrtolkien/uraeda/pull/23). Its full files are
> in git: `git log -- specs/changes/2026-10-16-storybook-warmup/`.

## What and why

Opening the settings page's spec froze the whole site: its 12 story frames loaded at once, about
1,800 requests through the server, while the worktree's Storybook was still starting. Story embeds
now load their frames only once on screen, and a feature's Storybook starts before its stories are
embedded. One Storybook per worktree stays, as the preview decision says: putting everything on the
default branch until code was weighed and dropped, since redesign mockups edit existing components.

## Behaviour

- A story's frames load their story once their box is first on screen, and stay loaded: a frame
  below the window, in a closed fold, or scrolled past by the Mockups button loads nothing until it
  shows. The embed's record is still read as the page draws, so its Storybook starts at once.
- A feature's or a change's Storybook starts when one of its agent's turns ends done, once its
  worktree's preview folder has its `node_modules`: without them, nothing starts, as a start would
  only fail. One that failed before, as one a page started during the install, starts again then.
- A feature's or a change's Storybook starts when any page under its folder opens, its page, its
  files, its HTML mockups, its session, or its runs, and stays viewed while one of them shows. It
  still stops after 30 minutes without a view.

## Design

[`StoryFrames`](/packages/web/src/StoryFrames.tsx) holds each frame's address back until an
`IntersectionObserver` sees its box. On the server, the session manager's changes reach
[`onTurnDone`](/packages/server/src/live.ts)'s listeners; [`createApp`](/packages/server/src/app.ts)
registers one that calls [`warmPreview`](/packages/server/src/fate/preview.ts), which views the
checkout's Storybook in the runner without reading a record. In the web UI,
[`StartsStorybook`](/packages/web/src/App.tsx) reads a feature's `Preview` record beside each of its
pages, which is a view.

## Changes after approval

- R1: "when its worktree is set up" is when a feature's turn ends done, with its dependencies
  installed: the server cannot see an install finish.
- R2: every page of a feature starts its Storybook, not only its main page.
- R3: a frame loads once any part of it is on screen, with no margin.
- R4: `createApp` registers its turn listener for the session manager's lifetime, never removed.

## Follow-ups

- The dependency check looks for `node_modules` in the preview folder only: a workspace that hoists
  everything to its root, or Yarn PnP, never warms from a turn, and falls back to the first embed.
- No test pins R3's lack of a margin, or that a file's, a mockup's, or a session's page starts the
  Storybook: the feature's page alone is checked.
- Browsing several features' pages keeps a Storybook for each, about 1.5 GB, for 30 minutes after
  its last view.
