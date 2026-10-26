---
status: active
approved-by: mrtolkien
icon: scan-eye
---

# UI checks

The human checks UI work by using the running app, when they choose: after one change, or after
several merged together. Automated tests of the UI are rare, and only for what using the app would
not show. A pull request that adds a view shows one screenshot of it, and screenshots are never kept
in the repository.

## Rules

- A UI change MUST be easy to try in the running app, through the sandbox. Checked by review.
- The agent MUST NOT wait for a live review of each UI change: the human may review several
  together, after merging. Checked by review.
- A pull request that adds a view MUST show one screenshot of it, in the pull request only. Checked
  by review.
- Screenshots MUST NOT be committed to the repository for review. Checked by review.
- The agent MUST review each changed view in the running app before handing it over, in both themes
  and at a phone's width and a desktop's, against the decisions. Checked by review.

## Why

Nothing checked the desktop, and the components drifted from their spec unseen. Automated UI tests
then grew to a suite that was slow, tied to the markup and the look, and made every visual change
cost test edits. The human prefers to "review actual behaviour with the sandbox", often several
features at once after merging, and wants at most one screenshot of a new view, in the pull request
([how the UI is tested](../2026-10-26-testing-communication/clarifications-01.md#q4-how-should-the-web-ui-be-tested)).
Pixel comparisons break across systems and fonts, against the [toolchain](toolchain.md) decision.

## Alternatives considered

- Pixel comparisons in CI: every visual change flagged, but images to update with each intended
  change, and failures only CI shows.
- Storybook stories as UI tests: dropped, as flows need a fresh repository and an agent channel per
  story.
- Browser tests with measures, such as a size or a width: dropped, as the look changes them without
  a bug.
- Screenshots reviewed by the agent and committed with the change: dropped, as they filled the
  repository with images nobody read again.

## Consequences

- A regression in a UI behaviour, an accessibility rule, or a layout is found mostly by the human's
  review, no longer by a test.
- The sandbox must stay easy to start, since it is the check.
- Pull requests of UI work carry images, kept by the forge and not by git.

## Applies to

- [`packages/web/`](/packages/web/), and every feature or change that adds or changes a view

## Revisit when

The human sets the project's stage to `growing` in the [testing](testing.md) decision.
