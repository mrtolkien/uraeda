---
icon: refresh-cw
---

# Run lifecycle

> "Will need a few settings, should be able to turn it off too"

Said of Uraeda continuing agents' runs by itself. An automatic run is one Uraeda starts or continues
without the human asking for it then: after a server restart or a usage limit, to catch an open pull
request up with the default branch, or for a scheduled job.

## Rules

- The human's settings decide every automatic run: each kind has a switch that turns it off. _So:_
  continuing after a restart or a limit is on until they turn it off, and catching up open pull
  requests, which spends usage on every merge, is off until they turn it on. A feature that adds a
  kind ships its switch.

- A run the human stopped or dismissed never continues by itself. _So:_ a Stop that arrives while
  the run waits for a limit's reset leaves it stopped at the reset, and a pull request whose run the
  human stopped is not caught up.
- Automatic continues stop after the number in a row the human set, without a commit or a message
  from them. _So:_ a continue on another account counts toward it, and the next step's run, which is
  no continue, does not.

## Why

A run that stops for something outside the work costs hours until the human notices, so Uraeda
continues it, as a best effort. What runs unwatched spends the human's usage: they choose what runs,
how often it may go on, and can stop it for good. A scheduled job is written in the human's
settings, never read from a repository, as [Settings](settings.md) says of everything a repository
holds. History: [Worker lifecycle](../done/2026-11-03-worker-lifecycle.md).

## Alternatives considered

- Asking a run that ended before its human gate to go on: built, then removed, "It misfires 99% of
  the time." A run that ends early asks for the human.
- Keeping a run a usage limit refused on its own account until the reset: it goes on at once on
  another account with room.
- Making up a job's missed time once the server is back: a missed time is never made up.

## Applies to

- [`crates/server/src/runner/`](/crates/server/src/runner/), the settings in
  [`crates/core/`](/crates/core/), and every feature that starts, follows, schedules, or stops an
  agent's run

## Revisit when

The human decides whether Uraeda keeps running agents itself, or sits on another orchestrator with
its skill, its CLI, and a small view: they asked on 2026-11-13, and it is open.
