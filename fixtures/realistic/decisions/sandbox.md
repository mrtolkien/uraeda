---
status: active
approved-by: human
icon: flask-conical
---

# Sandbox

Uraeda's built UI is reviewed in a sandbox: the whole web app, hot-reloading from the code of the
checkout it runs in, over sample projects and a fake agent. It never touches the human's real
projects, data, or agent. Storybook stays the place for mockups and variants, and the sandbox is
where pages are browsed together, as a user does.

## Rules

- The sandbox MUST serve the whole web UI from the checkout it runs in, with hot reload, over sample
  projects only. Checked by review.
- The sandbox MUST NOT read or write the human's real repositories, data folder, config folder, or
  agent. Checked by a test.
- The sandbox's sessions MUST run on a fake agent, which answers from canned text and changes no
  file. Checked by a test.
- The sandbox's state MUST survive its restarts, until the human asks for a reset. Checked by a
  test.
- A pick, an element the human points at in the sandbox, MUST be copied to the clipboard as text
  naming the page, the element, and its source location. Checked by a test.
- The sandbox's code, sample projects, and picker MUST NOT reach the built app or the package.
  Checked by a test of the build's output.
- Mockups and variants SHOULD stay Storybook stories, as [Preview](preview.md) says. Checked by
  review.
- The sandbox MAY take source locations from a build plugin that only the sandbox loads. Checked by
  review.

## Why

UI work needs the app in many states, and Storybook's whole-page stories cannot navigate from page
to page. A fake agent costs nothing, answers at once, and answers the same every time. State kept
until a reset brings the human back where they were. A pick pasted to the agent carries what it
needs to find the code. History: [UI sandbox](../done/2026-10-20-ui-sandbox.md).

## Alternatives considered

- A sandbox mode inside the development server: sample and real data in one app.
- The real agent on the sample projects: costly, slow, and never the same twice.
- A queue of picks an agent waits on: more to build, when the human types a request with each pick
  anyway.

## Consequences

- Every UI feature can be reviewed in the sandbox, at every step of the workflow.
- The sample projects need upkeep as the workflow's files and steps change.
- A step never moves on by itself in the sandbox: the human sees an agent at work, not its result.
- The sandbox adds a development dependency for source locations.

## Applies to

- [`packages/web/`](/packages/web/), its sandbox and its Vite configuration, and every feature with
  UI work
- The builders of the sample projects, in [`packages/binding/`](/packages/binding/), and every
  feature that adds a workflow step or file
