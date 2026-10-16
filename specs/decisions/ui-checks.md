---
status: active
approved-by: mrtolkien
---

# UI checks

UI work is checked by what it does, not by how its markup looks. `vp run ready` runs the UI
decisions' lint rules, layout and accessibility checks at a phone size and a desktop size, and tests
that drive the UI like a user. Before handing a UI change over, the agent looks at screenshots of
what it changed and commits them for the human's review.

## Rules

- Every UI test MUST guard a spec's acceptance scenario, edge case, or success criterion, the
  expected behaviour stated in a change's proposal, or a rule of a UI decision. A test that guards
  none of them MUST NOT be added.
- UI tests MUST drive the UI as a user does, through roles, labels, and visible text, and assert
  what the user sees or what is written to the repository. They MUST NOT assert markup structure,
  class names, or snapshots of rendered output.
- A test that no longer matches the spec MUST be changed or removed with the spec, never kept
  passing by loosening its assertion.
- `vp run ready` MUST run, in WebKit, at 402 × 874 and at 1440 × 900, on every page a UI decision
  governs: no text cut, no sideways scroll, the text sizes and control heights of the
  [UI layout](ui-layout.md) decision, and axe-core's WCAG 2.1 A and AA rules in light and dark.
- Pixel comparisons of screenshots MUST NOT be used.
- UI tests MUST be Vitest tests, in happy-dom or in WebKit. Storybook stories MUST NOT be run as
  tests: they stay previews and mockups. Checked by review.
- Before handing over a UI change, the agent MUST take screenshots of every changed view at both
  sizes and in both themes, review them against the UI decisions and the spec's mockups, or the
  change's proposal, fix what it finds, and commit them in the feature's or the change's folder
  under `screenshots/`, where the pull request shows them. The finish step removes them with the
  folder.

## Why

Nothing checked the desktop, and the web UI's components drifted from its spec unseen
([Q4](../done/2026-10-12-ui-improvements.md#q4-what-checks-an-agents-ui-work),
[how the rules are checked](../done/2026-10-12-ui-improvements.md#q4-what-checks-an-agents-ui-work)).
The human wants tests, but useful ones: "each test is added maintenance, because tests also drift
away from expected behaviour" (Q4's answer). Checks that guard behaviour and the decisions' measures
stay true as the markup changes, while pixel comparisons break across systems and fonts and would
make a local run differ from CI, against the [toolchain](toolchain.md) decision. Screenshots
reviewed by the agent, then by the human, catch what no rule names.

Moving the UI tests to Storybook was investigated on 2026-10-16, to make them easier to review, and
dropped as too much work for little gain. Most of Uraeda's UI tests are whole-page flows that write
to the repository or script the fake agent. Storybook serves every story from one shared fixture,
with no reset and no channel to the agent, so those tests could only move after Storybook-only
server code was written and maintained. Only about 20 single-view tests would move cheaply. The
design systems checked, Astryx, Fluent UI, and GitLab, keep their behaviour tests in Vitest or Jest,
and use stories for states ([Astryx](https://github.com/facebook/astryx),
[Fluent UI](https://github.com/microsoft/fluentui),
[GitLab](https://docs.gitlab.com/development/fe_guide/accessibility/storybook_tests/)). Storybook's
own guidance keeps whole flows out of stories
([user flow testing](https://storybook.js.org/tutorials/ui-testing-handbook/react/en/user-flow-testing)).
Replaying a story's steps inside Uraeda also needs Storybook's full interface there, which it does
not have yet.

## Alternatives considered

- Pixel comparisons in CI, with reference images made there: any visual change flagged, at the cost
  of images to update with every intended change, and failures only CI shows.
- Storybook stories as UI tests, run by `@storybook/addon-vitest`, replayed step by step in
  Storybook's Interactions panel: tests a human can watch, at the cost of a new dependency, a
  rewrite, and a fresh repository per story and an agent channel inside Storybook for the flows.

## Consequences

- A visual slip no rule names is caught by the review of the screenshots, not by a test.
- Pull requests of UI work carry images, kept in git history once the folder is finished.
- The browser tests take longer than the happy-dom ones; they stay limited to what needs a real
  layout.
- Reviewing a UI test means reading it against the spec. Vitest 5's trace view, which replays a
  browser test's steps without moving it, remains open to a later change.

## Applies to

- [`packages/web/`](/packages/web/), its tests, and every feature or change that adds or changes a
  view
