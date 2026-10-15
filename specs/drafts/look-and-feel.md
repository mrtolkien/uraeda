---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Look and feel pass

## What

Look and feel pass: components style, logo, favicon, ...

- Generally, the happy path should look good: parsed frontmatter should not appear in the edit box,
  we should have color and hierarchy for specs and plans, ...
- We need _many more icons_ to make everything more readable: sidebar, agent statuses, feature step,
  spec layout and paragraphs, ...
- For example specs are very hard to read at the moment, there's no clear user stories UI, it's a
  sea of bullet points, ...
- Icons for the different harnesses (claude code, codex, pi, ...)
- In a "done" feature, we should have a nice view of all its info, not just a dirty link to the
  report
- Better URLs for the navigation, right now it's a bit messy
  (`/f/2026-10-13-chat-in-the-web-ui/clarifications-01.md`)
- The status detection is iffy -> wait for agent runs to finish before saying it's "waiting on you",
  include PR URL, make sure the "PR ready" state means the PR was opened (currently it's at that
  state when the reviewer runs)
- Opening a big session is slow and laggy: I want the full UI to feel instant, the UI should only be
  passed the last X messages by default
- Priorities line -> edit text is too many clicks (one opens the sidebar, then edit, then edit
  again...), it's bad UI for the most standard path
  - And priorities that have a draft file associated should be highlighted!
- "Commit and start the agent" took many seconds for me in the bugfixing flow...
- We need to be able to resize the left and right sidebars on desktop: right now they are a bit too
  small. We should also be able to hide them easily: the chevron on the bottom of the sidebar is not
  great: show a hide bar button on hover + a handle to resize.
- Add a constitution view, should not be part of the sidebar but should be there _somewhere_, maybe
  in the home or a "project overview"

---

There's also a need for clear hierarchy.

The flow goes roughly as such: Inbox > Priorities > Draft > Change > Feature

An Inbox can directly become a draft, and most Changes never get upgraded to a feature. But the idea
is that this is the order of importance and flow of the concepts in uraeda.

It should be easy to go from one state to another, and the sidebar should also represent that
hierarchy.

## Why

The UI works, but it does not look like a finished tool yet: it should look good before v1.0.0.

## Notes

This feature should ideally be almost ONLY about UI: minimal core and server-side changes.

There will be some changes for sure (for example to make sessions load faster), but overall there is
no new operational concept introduced in this feature.
