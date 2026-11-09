---
status: active
approved-by: mrtolkien
icon: refresh-cw
---

# Run lifecycle

A run goes on to the next human gate without the human typing "Continue". Uraeda continues a run the
server's restart cut or a usage limit stopped, and, once the human turns it on, catches up an open
pull request when the default branch moves. Each automatic run says why in its session, can be
turned off, and is capped.

## Rules

- A run cut by a server restart MUST continue by itself from its agent's session, when it was cut
  recently. Checked by the runner's tests.
- A run stopped by a usage limit MUST continue by itself once the limit resets, as a best effort.
  Checked by the runner's tests.
- Automatic continues MUST stop after the number in a row the human set, without a commit or a
  message from them. Checked by the runner's tests.
- An open pull request behind the default branch MUST be caught up by itself only when the human
  turned it on, at most once per tip of the default branch. Checked by the server's tests.
- Each automatic run MUST say in its session why it happened. Checked by the runner's tests.
- A run the human stopped or dismissed MUST NOT continue by itself. Checked by the runner's tests.
- Each kind of automatic run MUST have a setting that turns it off. Checked by the core's tests.
- Agents SHOULD wait for their background work by its notice, never by polling it.

## Why

A run that stops for something outside the work, a restart or a limit, costs hours until the human
notices, often overnight. Continuing it keeps the workflow asynchronous. Continuing without a cap
could loop and spend usage, so the human sets one. Catching up a pull request behind spends usage on
every merge, so the human turns it on. A run that polls cannot read the human's messages, and its
waits outlive the work. History: [Worker lifecycle](../done/2026-11-03-worker-lifecycle.md).

## Alternatives considered

- Agents outliving the server, which reattaches to them: nothing redone, but a large change to how
  agents are run, on undocumented behaviour.
- Letting the agent wait out a limit inside its own process: a restart during the wait loses it.
- A hook that refuses polling commands: works for one agent only, and refuses waits that were right.

## Consequences

- A tool call or background work cut by a restart is redone by the continued run.
- Weekly limits are not continued: they stop the run, which asks for the human.
- A run that ends before its next human gate asks for the human: Uraeda never asks it to go on, as
  that misfired almost every time.
- Every later agent runtime must report restarts, limits, and their reset time for runs to continue.

## Applies to

- [`packages/server/src/runner/`](/packages/server/src/runner/), the settings in
  [`crates/core/`](/crates/core/), and every feature that starts, follows, or stops an agent's run
- The skill's guidance on background work, in [`skills/uraeda/`](/skills/uraeda/)
