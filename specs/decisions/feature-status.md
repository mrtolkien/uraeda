---
icon: activity
---

# Feature status

> "Any agent working on a feature means it's in progress. It can't be waiting for me if something's
> running. Normally."

A feature's status tells the human, in every view, whether it needs them, works, or waits. They
spend their attention where it points, so it says "Needs you" only when there is something for them
to do. A session is a conversation with an agent, and a run is one stretch of the agent's work in
it. A check result is something `ura check` found wrong in a workflow file.

## Rules

- A feature's status is decided in one place, which every view, notification, and count reads. _So:_
  a scheduled job's session takes its status from the server, like any other session, and its page
  works out none of its own.
- A feature reads as working while any of its sessions runs, or waits to continue by itself,
  whatever its step. _So:_ a spec waiting for approval reads "Working" while an agent revises it. An
  open pull request is not ready for review while a session runs. A run paused by a usage limit
  reads "Waiting until 8:41", in progress.
- A failed or stopped run asks for the human until they dismiss it. _So:_ opening its session clears
  nothing, and a newer run that fails asks again.
- A check result counts as a feature's problem only when it stops the workflow. Anything else is a
  note, and never makes a feature read as needing the human. _So:_ a spec missing a required section
  is a note on its page, and a blank answer in an answered round is a problem.

## Why

A status that hides a running agent, keeps an old crash, calls unfinished work ready, or flags a
file still being written wastes the human's attention, and a tool that cries wolf gets ignored.
Copies of the rule in each view drift apart, so one place decides. A failure cleared by a glance is
a failure nobody dealt with. History: [Feature state pass](../done/2026-10-30-feature-state.md).

## Alternatives considered

- The rule kept in the UI's guides: proposed first, and refused by the human. A decision binds every
  feature that adds a view, a count, or a notification.
- A warning cleared by opening its session: proposed first, and refused by the human, for an
  explicit Dismiss.
- A run waiting for a limit's reset asking for the human: a notification with nothing to do.

## Applies to

- [`crates/core/`](/crates/core/), [`crates/server/`](/crates/server/), and [`app/`](/app/), and
  every feature that shows, notifies, or counts a feature's or a session's status
- Every feature that adds a rule to `ura check`
