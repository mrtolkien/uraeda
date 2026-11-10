---
status: proposed
approved-by:
icon: refresh-cw
---

# Run lifecycle

Uraeda starts a run by itself only where the human set it up. It continues a run the server's
restart cut or a usage limit stopped, catches up open pull requests once the human turns it on, and
runs the jobs the human scheduled. Each automatic run says why in its session and can be turned off.

## Rules

- A run cut by a server restart, or stopped by a usage limit, MUST continue by itself from its
  agent's session, as a best effort. Checked by the runner's tests.
- Automatic continues MUST stop after the number in a row the human set, without a commit or a
  message from them. Checked by the runner's tests.
- An open pull request behind the default branch MUST be caught up by itself only when the human
  turned it on, at most once per tip of the default branch. Checked by the server's tests.
- A scheduled job MUST be the human's own, written in their settings, never read from a repository.
  Checked by the core's tests.
- Each automatic run MUST say in its session why it happened. Checked by the runner's tests.
- A run the human stopped or dismissed MUST NOT continue by itself. Checked by the runner's tests.
- Each kind of automatic run MUST have a setting that turns it off. Checked by the core's tests.
- Agents SHOULD wait for their background work by its notice, never by polling it.

## Why

A run that stops for something outside the work costs hours until the human notices, and upkeep
nobody starts does not happen. Continuing and scheduling keep the workflow asynchronous. Continues
without a cap could loop, and catching up spends usage on every merge, so the human sets both. A job
read from a repository would let whoever pushes there run an agent on the human's machine. A run
that polls cannot read the human's messages. History:
[Scheduled jobs](../2026-11-10-scheduled-jobs/spec.md).

## Alternatives considered

- Agents outliving the server, which reattaches to them: nothing redone, but a large change to how
  agents are run, on undocumented behaviour.
- Letting the agent wait out a limit inside its own process: a restart during the wait loses it.
- Jobs as files of the repository: shared and reviewed, but whoever pushes there chooses what runs
  unattended on the human's machine.

## Consequences

- A tool call or background work cut by a restart is redone by the continued run.
- Weekly limits are not continued, and a run that ends before its next human gate is not asked to go
  on: both ask for the human.
- A scheduled run spends usage unwatched, and a page it reads can talk it into starting a change:
  nothing merges without the human.
- Every later agent runtime must report restarts, limits, and their reset time for runs to continue.

## Applies to

- [`packages/server/src/runner/`](/packages/server/src/runner/), the settings in
  [`crates/core/`](/crates/core/), and every feature that starts, follows, schedules, or stops an
  agent's run
- The skill's guidance on background work, in [`skills/uraeda/`](/skills/uraeda/)
