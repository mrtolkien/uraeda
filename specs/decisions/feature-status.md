---
status: active
approved-by: mrtolkien
icon: activity
---

# Feature status

A feature's status tells the human, in every view, whether it needs them, works, or waits. It is
decided in one place, from the branch's commits and the feature's sessions, so a running agent
always shows, an old failure never hides current work, and a warning stays until the human deals
with it.

## Rules

- A feature's status MUST be decided in one place, which every view, notification, and count reads.
  Checked by the server's tests.
- A feature MUST read as working while any of its sessions runs, whatever its step. Checked by the
  server's tests.
- A feature no session works on MUST follow its latest session, never an older session's outcome.
  Checked by the server's tests.
- A failed or stopped run MUST ask for the human until they dismiss it, unless it waits to continue
  by itself. Checked by the runner's tests.
- A run waiting to continue by itself MUST read as in progress, with when it goes on. Checked by the
  server's tests.
- A pull request MUST read as ready for the human's review only when it holds the branch's latest
  commit. Checked by the core's tests.
- A branch's step SHOULD be read from its latest commit, or from a write of the human's that Uraeda
  is still committing. Checked by the core's workspace tests.

## Why

The human spends their attention where the status points. A status that hides a running agent, keeps
an old crash, or calls unfinished work ready wastes it, and copies of the rule in each view drifted
apart. Commits keep the state recoverable from the repository. A write of the human's that is
landing is no guess, and a refused commit puts it back. History:
[Feature state pass](../done/2026-10-30-feature-state.md).

## Alternatives considered

- The most urgent session's status, working ranked first: an old crash came back after every run.
- A warning cleared by opening its session: a glance cleared a failure not dealt with yet.
- A run waiting for a limit's reset asking for the human: a notification with nothing to do.

## Consequences

- The web UI moves when a commit lands or the human's own write is queued, not when a file is saved
  by hand.
- A run that waits to continue by itself never notifies: the human learns of it only if it fails, or
  stops continuing.
- The workflow has a step for the agent to push the commits an open pull request lacks.

## Applies to

- [`crates/core/`](/crates/core/), [`packages/server/`](/packages/server/), and
  [`packages/web/`](/packages/web/), and every feature that shows, notifies, or counts a feature's
  or a session's status
- The skill's step table, in [`skills/uraeda/`](/skills/uraeda/)
