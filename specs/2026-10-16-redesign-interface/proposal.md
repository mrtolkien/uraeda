---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Redesign sidebars and global interface

## What

Redesign the parts of the UI every page shares: the sidebars, the navigation, the URLs, and the
agent statuses. This is a _functional_ pass: the look comes later, in the
[look and feel pass](look-and-feel.md).

There's a need for clear hierarchy. The flow goes roughly as such: Inbox > Priorities > Draft >
Change > Feature.

An Inbox can directly become a draft, and most Changes never get upgraded to a feature. But the idea
is that this is the order of importance and flow of the concepts in uraeda.

It should be easy to go from one state to another, and the sidebar should also represent that
hierarchy. It can be through icons, animations, ...

- We need to be able to resize the left _and right sidebars_ on desktop. We should also be able to
  hide them easily: the chevron on the bottom of the sidebar is not great: show a hide bar button on
  hover + a handle to resize + animation when it appears/leave.
- We need a button that goes back to the home on mobile: it should be a home icon on the leftmost
  part of the top bar
- The status detection is iffy -> wait for agent runs to _fully_ finish (including sub-agents or
  background comments) before saying it's "waiting on you", include PR URL when it exists, make sure
  the "PR ready" state means the PR was opened (currently it's as soon as the last reviewer runs,
  which can last a long time).
  - Only true uraeda flows should show up in the UI -> `review-findings` was in the UI despite not
    having used the flow?
  - Generally the repo parsing must be ROBUST, ACCURATE, and FAST. If there are actually ambiguous
    states to manage, ask me. But overall it should be pretty simple and focus on the committed
    state of all worktrees.
- We should see the current active step in the sidebar before implementation starts:
  Discovery/Spec/Plan/...
- Add notifications when there's a user action available (ping the user when input is needed). Ask
  for permission to send notification on first accessing the page.
- In the "add a repo" modal, if there's a single option to fill, enter should select it
- Buttons that do background work should ALL have clear feedback
  - All buttons committing to git in particular take some seconds to execute: there should be
    EXTREMELY CLEAR feedback, like a spinner + graying out all buttons on the page
- Only show the last 5 "done" feature, with a `...` to show more. They should be bottom-aligned,
  clearly separated from the rest, and only appear if there's space for them.
- Remove the dark/light setting from the sidebar, it will be part of the settings page

## Why

The global interface is what every other page sits in: it should make the hierarchy of uraeda's
concepts obvious, and tell the human when they're needed.

## Notes

- The page-specific redesigns (priorities, clarifications, specs, session, feature page) come after
  this one, and build on it.
