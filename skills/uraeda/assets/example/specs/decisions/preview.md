---
icon: eye
preview-folder: .
preview-command: npx storybook dev --ci --no-open --exact-port --host 127.0.0.1 --port {port}
---

# Preview

> "I want to try a planned view, on my phone and on my desk, before it is built."

Mockups, and the named states of the app's views, are Storybook stories written with the real
components. The frontmatter holds where Storybook runs, and the command that starts it.

## Rules

- A mockup is a story of the real components, one export per state. _So:_ the picked mockup is the
  code that ships, and no HTML copy of a view is drawn beside it.
- Stories read their tasks from the app's own store, on an in-memory database. _So:_ a story shows
  what the app would, with no fake of the store.

## Why

The human checks a planned view by using it, and comments on what is wrong. A mockup written with
the real components cannot drift from the app. How Storybook is set up, its builder, its pinned
versions, and Uraeda's two helper files, is in `.storybook/`.

## Alternatives considered

- HTML mockups in the feature's `mockups/` folder: no dependency, but a second copy of the UI, which
  drifts from the code.

## Applies to

- [Components](/src/components/), [the task screens](/src/tasks/), `.storybook/`, and any feature
  with UI work
