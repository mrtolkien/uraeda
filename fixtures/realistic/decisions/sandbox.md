---
icon: flask-conical
---

# Sandbox

> "Let me review the app without touching my real projects."

The sandbox is the whole web app, hot-reloading from its checkout, over sample projects and a fake
agent.

## Rules

- The sandbox never reads or writes the human's real repositories, folders, or agent. _So:_ its
  sessions run on a fake agent that changes no file.
- The sandbox's state survives its restarts, until the human asks for a reset. _So:_ a restart
  brings the human back where they were.
- A pick, an element the human points at, is copied as text naming the page, the element, and its
  source. _So:_ an agent finds the code from the pick alone.
- The sandbox never reaches the built app or the package. _So:_ the release holds no sample
  project.

## Why

UI work needs the app in many states, and Storybook's whole-page stories cannot navigate from page
to page. A fake agent costs nothing, answers at once, and answers the same every time. History:
[UI sandbox](../done/2026-10-20-ui-sandbox.md).

## Alternatives considered

- The real agent on the sample projects: costly, slow, and never the same twice.

## Applies to

- [`packages/web/`](/packages/web/), its sandbox and its Vite configuration, and every feature with
  UI work
- The builders of the sample projects, in [`packages/binding/`](/packages/binding/), and every
  feature that adds a workflow step or file
