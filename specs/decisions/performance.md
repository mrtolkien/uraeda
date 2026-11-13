---
icon: gauge
---

# Performance

Uraeda feels instant on the machine it runs on: every page draws, and every action shows its result,
within 100 ms, and scrolling and streaming keep 120 frames a second. The server answers from what it
has already read, and the client keeps what it has shown, so nothing waits on git for what git
already said. It is a target to keep, not a hard limit.

## Rules

- The server MUST answer reads from what it already read, reading git again only for what changed
  since. Checked by the core's tests.
- The client MUST keep the data of the pages it has shown, and read the page of the selected row
  ahead, so a key reaches it as fast as a click.
- A benchmark over the sandbox's projects MUST measure the target's pages and actions on demand.
  Checked by the benchmark's run in each feature's review.
- A development build MUST warn when an interaction passes 100 ms. Checked by the benchmark's run in
  each feature's review.
- Every navigation and every action SHOULD draw its result within 100 ms, and a reload within 1
  second, on a release build serving a repository the size of Uraeda's own. Checked by the
  benchmark, against 100 ms and 1 second.
- Scrolling and streaming SHOULD cost at most 8.3 ms a frame at the 99th percentile, the budget of
  120 frames a second, on the Linux app over a session of 20,000 messages. Checked by the benchmark.
- A page SHOULD NOT show a loading state: what it shows comes from what the server and the client
  already hold. Checked by the benchmark.
- A commit's hooks and an agent's work MAY take longer than the target, as long as their progress
  shows.

## Why

Rebuilding the workspace from every branch takes about 95 ms on this repository, and a page chains 2
to 4 reads, so a page that asks git again cannot draw within 100 ms. A frame at 120 frames a second
lasts 8.3 ms, and a long session is where frames are lost. The target is "not a _hard_ target", yet
pages "should simply ALL DRAW in 100ms", with no pending bar. History:
[Performance pass](../done/2026-10-29-performance-pass.md).

## Alternatives considered

- The browser keeping data on disk across reloads: a new dependency, and a first frame that may show
  data a moment old.
- The benchmark in `just ready`: timings in every push, varying with the machine.

## Consequences

- A cache that misses a change shows stale data: invalidation is the core's to get right, and its
  tests guard it.
- Every feature checks its pages against the benchmark in its review.
- The core keeps state between calls, where it read everything afresh before.
- The frame budget was measured on a 60 Hz display only: pacing at 120 frames a second is still to
  check.

## Applies to

- [`crates/core/`](/crates/core/), `crates/server/`, and `app/`, and every feature that adds a page,
  a read, or a write
