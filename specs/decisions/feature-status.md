---
icon: activity
---

# Feature status

> "Any agent working on a feature means it's in progress. It can't be waiting for me if something's
> running. Normally."

A feature's status tells the human, in `ura status`, `ura next`, and the page of what waits, whether
it needs them or an agent. They spend their attention where it points, so it says it waits on them
only when there is something for them to do. A check result is something `ura check` found wrong in
a workflow file.

## Rules

- A feature's status is decided in one place, the core, which every command and page reads. _So:_
  the page of what waits lists a spec only when the core's step for its feature is a human gate.
- A feature waits on the human only once an agent's step has ended with its commit. Until then it is
  the agent's. _So:_ a spec with changes requested is the agent's while it revises it, and an open
  pull request that lacks the branch's latest commit reads `push`, not ready for review.
- A check result counts as a feature's problem only when it stops the workflow. Anything else is a
  warning, and never makes a feature read as needing the human. _So:_ a spec missing a required
  section is a warning, and a blank answer in an answered round is a problem.

## Why

A status that calls unfinished work ready, or flags a file still being written, wastes the human's
attention, and a tool that cries wolf gets ignored. Copies of the rule drift apart, so one place
decides. `ura` sees no agent's session, and an agent's step ends with a commit, so the commit is
where the turn passes. The session host shows which agent runs. History:
[Feature state pass](../done/2026-10-30-feature-state.md).

## Alternatives considered

- The rule kept in the UI's guides: proposed first, and refused by the human. A decision binds every
  feature that adds a view, a count, or a notification.
- Reading the agents' sessions to say a feature is working, as the 2.x server did: `ura` runs none,
  and a session host's state is its own.

## Applies to

- [`crates/core/`](/crates/core/), [`crates/cli/`](/crates/cli/), and
  [`crates/serve/`](/crates/serve/), and every feature that shows or counts a feature's status
- Every feature that adds a rule to `ura check`
