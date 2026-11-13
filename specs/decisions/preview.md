---
icon: eye
---

# Preview

> "I AM NOT LOOKING FOR SCREENSHOTS. I want REAL, INTERACTIVE MOCKUPS that PROPERLY show how the
> feature will BEHAVE. That's where the issues lie usually."

A mockup is how a spec shows planned UI before it is built. Uraeda has two kinds. A gallery page
shows the app's real components alone, in named states. The gallery is an app of its own, in
`app/gallery/`, started with `just gallery`. An HTML page in the feature's `mockups/` folder shows a
layout or a sketch, and the spec's page draws it live. The gallery is a native app, not a page to
embed, so this decision names no preview command. The [mockups guide](../guides/mockups.md) says
which kind fits which job.

## Rules

- A spec's mockup behaves as the feature will: it can be pressed and typed in, and is never a
  picture of a view. _So:_ a new picker's mockup opens, filters, and closes. Pictures of its states
  side by side, as review tools show them, settle nothing about its keys.
- A mockup of what the app's components can draw is a gallery page, written with those components.
  _So:_ the first mockups of the new session page "look nothing like the actual app, making it
  extremely hard to decide", and were redone. A mockup made of the real components looks like the
  app, and the picked one is the first commit of its view.
- A page's layout, or a sketch no component holds yet, may be an HTML page. _So:_ the Native Shell
  app's whole look was one HTML page, tuned with the human over several rounds, before any of its
  components existed.

## Why

The faults of UI an agent built lie in how it behaves: its keys, its focus, what moves. A picture
shows none of them. A mockup drawn apart from the app drifts from it: "HTML-only mockups end up
pretty far from the actual results". One made of the real components cannot. A whole layout or a new
look would cost too much to build that way first, so a page of HTML carries it. History:
[UI iteration](../done/2026-10-15-ui-iteration.md).

## Alternatives considered

- Storybook, the app's preview until it moved to Native Shell: it draws in a browser, with a web
  framework, and cannot show the app's components. A user project's Storybook is still embedded.

## Applies to

- `app/gallery/`, the `mockups/` folders under `specs/`, and every feature with UI work

## Revisit when

The gallery can be drawn inside a spec's page, as a user project's Storybook is. This decision then
names its preview folder and command.
