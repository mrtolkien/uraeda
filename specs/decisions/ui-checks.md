---
status: proposed
approved-by:
icon: scan-eye
---

# UI checks

UI work is checked by what it does for the human, not by how its markup looks. Every test earns its
maintenance by guarding something the human asked for. Screenshots reviewed by the agent, then the
human, catch what no rule names.

## Rules

- Every UI test MUST guard a spec's scenario, edge case, or success criterion, a change's expected
  behaviour, or a UI decision's rule, and MUST change or go with it, never loosened to keep passing.
  Checked by review.
- UI tests MUST drive the UI as a user does, by roles, labels, and visible text, and MUST NOT assert
  markup, class names, snapshots, or pixel comparisons. Checked by review.
- UI tests MUST be Vitest tests, in happy-dom or WebKit, and Storybook stories MUST NOT run as
  tests. Checked by review.
- `vp run ready` MUST check every page a UI decision governs in WebKit, at a phone and a desktop
  size: no cut text, no sideways scroll, the [UI layout](ui-layout.md) measures, and WCAG 2.1 A and
  AA in both themes. Checked by review.
- Before handing over a UI change, the agent MUST screenshot every changed view at both sizes and in
  both themes, review and fix them against the decisions and the mockups or proposal, and commit
  them under the folder's `screenshots/`. Checked by review.

## Why

Nothing checked the desktop, and the components drifted from their spec unseen. The human wants
useful tests only: "each test is added maintenance, because tests also drift away from expected
behaviour"
([how the rules are checked](../done/2026-10-12-ui-improvements.md#q4-what-checks-an-agents-ui-work)).
Checks on behaviour and measures survive markup changes. Pixel comparisons break across systems and
fonts, so a local run would differ from CI, against the [toolchain](toolchain.md) decision. Most UI
tests are whole-page flows that write to the repository or script the fake agent, which Storybook's
shared fixture cannot reset.

## Alternatives considered

- Pixel comparisons in CI: every visual change flagged, but images to update with each intended
  change, and failures only CI shows.
- Storybook stories as UI tests, replayed in its Interactions panel: dropped, as flows need a fresh
  repository and an agent channel per story.

## Consequences

- A visual slip no rule names is caught by the screenshots' review, not by a test.
- Pull requests of UI work carry images, kept in git history after the finish step removes them.
- Browser tests are slower than happy-dom ones, so they stay limited to what needs a real layout.
- Reviewing a UI test means reading it against the spec.

## Applies to

- [`packages/web/`](/packages/web/), its tests, and every feature or change that adds or changes a
  view
