---
status: active
approved-by: mrtolkien
icon: flask-conical
---

# Sandbox

Uraeda's built UI is reviewed in a sandbox. It is the whole web app, hot-reloading from the code of
the checkout it runs in, over sample projects and a fake agent. It never touches the human's real
projects, data, or agent. Storybook stays the place for mockups and variants: the sandbox is where
the pages are browsed together, as a user does.

## Rules

- The sandbox MUST serve the whole web UI from the checkout it runs in, with hot reload, over sample
  projects only. Checked by review.
- The sandbox MUST NOT read or write the human's real repositories, data folder, config folder, or
  agent. Checked by a test.
- The sandbox's sessions MUST run on the fake agent, which answers from canned text and changes no
  file. Checked by a test.
- The sandbox's state MUST survive its restarts, until the human asks for a reset. Checked by a
  test.
- A pick MUST be copied to the clipboard as text that names the page, the element, and its source
  location. Checked by a test.
- The sandbox's code, sample projects, and picker MUST NOT reach the built app or the package.
  Checked by a test of the build's output.
- Mockups and variants SHOULD stay Storybook stories, as the [preview](preview.md) decision says:
  the sandbox shows the built app, not choices to pick from. Checked by review.
- The sandbox MAY take source locations from a build plugin that only the sandbox loads. Checked by
  review.

## Why

UI work needs the app in many states, and the review of the built UI was dropped from the UI
iteration flow ([discovery](../2026-10-20-ui-sandbox/discovery-01.md#worth-it-and-feasibility)). The
human chose a whole-app command beside Storybook
([where the sandbox lives](../2026-10-20-ui-sandbox/clarifications-01.md#q2-where-does-the-sandbox-live)),
a fake agent
([agents in the sandbox](../2026-10-20-ui-sandbox/clarifications-01.md#q4-how-do-agents-behave-inside-the-sandbox)),
state kept until a reset
([state lifetime](../2026-10-20-ui-sandbox/clarifications-01.md#q5-how-long-does-the-sandboxs-state-last)),
picks pasted to the agent from the clipboard
([where a pick goes](../2026-10-20-ui-sandbox/clarifications-01.md#q3-where-does-a-pick-go)), and
source locations from a build plugin
([what a pick tells the agent](../2026-10-20-ui-sandbox/clarifications-01.md#q7-what-does-a-pick-tell-the-agent)).

## Alternatives considered

- More whole-page stories in Storybook: links between pages do not navigate.
- A sandbox mode inside `vp run dev`: sample and real data in one app.
- The real agent on the sample projects: costly, slow, and never the same twice.
- A pick queue an agent waits on: more surface, when the human types a request with each pick
  anyway.

## Consequences

- Every UI feature can be reviewed in the sandbox, at every step of the workflow.
- The sample projects need upkeep as the workflow's files and steps change.
- A step never moves on by itself in the sandbox: the human sees an agent at work, not its result.
- The sandbox adds a development dependency for source locations.

## Applies to

- [`packages/web/`](/packages/web/), its sandbox and its Vite configuration, and every feature with
  UI work
- [`packages/binding/test-utils.ts`](/packages/binding/test-utils.ts), the builders of the sample
  projects, and every feature that adds a workflow step or file
