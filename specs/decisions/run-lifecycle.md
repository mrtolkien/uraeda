---
status: proposed
approved-by:
icon: refresh-cw
---

# Run lifecycle

A run goes on to the next human gate without the human typing "Continue". Uraeda continues a run the
server's restart cut, a usage limit stopped, or that ended before its gate, and says so in the
session. Each automatic continue can be turned off, and their number in a row is capped.

## Rules

- A run cut by a server restart MUST continue by itself from its agent's session, when it was cut
  recently. Checked by the runner's tests.
- A run stopped by a usage limit MUST continue by itself once the limit resets, as a best effort.
  Checked by the runner's tests.
- A run that ends before the next human gate MUST be asked once to continue to it. Checked by the
  runner's tests.
- Automatic continues MUST stop after the number in a row the human set, without a commit or a
  message from them. Checked by the runner's tests.
- Each automatic continue MUST say in its session why it happened. Checked by the runner's tests.
- A run the human stopped or dismissed MUST NOT continue by itself. Checked by the runner's tests.
- Each kind of automatic continue MUST have a setting that turns it off. Checked by the core's
  tests.
- Agents SHOULD wait for their background work by its notice, never by polling it.

## Why

A run that stops for something outside the work, a restart, a limit, or an early end, costs hours
until the human notices, often overnight. Continuing it keeps the workflow asynchronous. Continuing
without a cap could loop and spend usage, so the human sets one. A run that polls cannot read the
human's messages, and its waits outlive the work. History:
[Worker lifecycle](../2026-11-03-worker-lifecycle/spec.md).

## Alternatives considered

- Agents outliving the server, which reattaches to them: nothing redone, but a large change to how
  agents are run, on undocumented behaviour.
- Letting the agent wait out a limit inside its own process: a restart during the wait loses it.
- A hook that refuses polling commands: works for one agent only, and refuses waits that were right.

## Consequences

- A tool call or background work cut by a restart is redone by the continued run.
- Weekly limits are not continued: they stop the run, which asks for the human.
- Every later agent runtime must report restarts, limits, and their reset time for runs to continue.

## Applies to

- [`packages/server/src/runner/`](/packages/server/src/runner/), the settings in
  [`crates/core/`](/crates/core/), and every feature that starts, follows, or stops an agent's run
- The skill's guidance on background work, in [`skills/uraeda/`](/skills/uraeda/)
