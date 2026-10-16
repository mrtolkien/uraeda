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
hierarchy.

- We need to be able to resize the left and right sidebars on desktop: right now they are a bit too
  small. We should also be able to hide them easily: the chevron on the bottom of the sidebar is not
  great: show a hide bar button on hover + a handle to resize.
- We need a home link that goes back to the project root (the icon/logo itself is part of the look
  and feel pass)
- Better URLs for the navigation, right now it's a bit messy
  (`/f/2026-10-13-chat-in-the-web-ui/clarifications-01.md`)
- The status detection is iffy -> wait for agent runs to finish before saying it's "waiting on you",
  include PR URL, make sure the "PR ready" state means the PR was opened (currently it's at that
  state when the reviewer runs)
- Add notifications when there's a user action available (ping the user when input is needed)
- Only true uraeda flows should show up in the UI -> `review-findings` was in the UI despite not
  having used the flow
- In the "add a repo" modal, if there's a single option, enter should select it
- Buttons that do background work should ALL have clear feedback
  - All buttons committing to git in particular take some seconds to execute: there should be
    EXTREMELY CLEAR feedback, like a spinner + graying out all buttons on the page

## Why

The global interface is what every other page sits in: it should make the hierarchy of uraeda's
concepts obvious, and tell the human when they're needed.

## Notes

- The page-specific redesigns (priorities, clarifications, specs, session, feature page) come after
  this one, and build on it.
