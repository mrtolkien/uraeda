---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Storybook preview fixes

## What

- A Storybook whose first commit read failed never restarts on a commit until it idles out: a view
  at an unknown commit keeps it, and one at a known commit after it should restart once (runner.ts
  moved)
- Two views racing a commit can restart a Storybook back to the older commit, then forward again:
  restart only for a commit read after the Storybook started (runner.ts view)
- storybook-preview.test.ts pins neither that the helper's security forwards Storybook's options to
  a project's preset function, nor a head preset returning undefined (uraeda-preview.js run callers)
- validate-storybook.ts opens Storybook's interface top-level through the proxy, not inside Uraeda's
  /f/<folder>/storybook page: a regression only in the page's frame (pathOf's ?path= forwarding)
  would not show
- validate-storybook.ts: the 'an added export shows in the sidebar, without a reload' failure prints
  'got false' whether the export was never listed or the page reloaded

## Why

## Notes
