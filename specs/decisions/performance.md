---
status: active
approved-by: mrtolkien
icon: gauge
---

# Performance

Uraeda feels instant on the machine it runs on: every page draws, and every action shows its result,
within 100 ms. The server answers from what it has already read, and the browser keeps what it has
shown, so nothing waits on git for what git already said. It is a target to keep, not a hard limit.

## Rules

- The server MUST answer reads from what it already read, reading git again only for what changed
  since. Checked by the core's tests.
- The browser MUST keep the data of the pages it has shown, and read the page of the selected row
  ahead, so a key reaches it as fast as a click. Checked by review.
- A benchmark over the sandbox's projects MUST measure the target's pages and actions on demand, and
  a development build MUST warn when an interaction passes 100 ms. Checked by the benchmark's run in
  each feature's review.
- Every navigation and every action SHOULD draw its result within 100 ms, and a reload within 1
  second, on a release build serving a repository the size of Uraeda's own. Checked by the
  benchmark.
- A page SHOULD NOT show a loading state: what it shows comes from what the server and the browser
  already hold. Checked by review and the benchmark.
- A commit's hooks and an agent's work MAY take longer than the target, as long as their progress
  shows. Checked by review.

## Why

Every read rebuilt the whole workspace from every branch, about 95 ms on this repository even in a
release build, and pages chained 2 to 4 reads
([where the 10 seconds go](../2026-10-29-performance-pass/discovery-01.md#where-the-10-seconds-go)).
The human chose 100 ms for every click and key, and 1 second for a reload
([what 100 ms measures](../2026-10-29-performance-pass/clarifications-01.md#q2-what-should-no-page-over-100-ms-measure)).
Reading pages ahead on hover does not help keys, so the human asked for a cache, on the server, with
the browser keeping what it read
([where values are cached](../2026-10-29-performance-pass/clarifications-01.md#q3-where-should-values-be-cached-ahead-of-time)).
They wanted the target kept as a SHOULD, "not a _hard_ target"
([a lasting rule](../2026-10-29-performance-pass/clarifications-01.md#q6-should-the-target-become-a-lasting-rule)).
A pending bar after 100 ms was refused: pages "should simply ALL DRAW in 100ms".

## Alternatives considered

- The browser keeping data on disk across reloads: a new dependency, and a first frame that may show
  data a moment old.
- The benchmark in `vp run ready`: browser timings in every push, varying with the machine.

## Consequences

- A cache that misses a change shows stale data: invalidation is the core's to get right, and its
  tests guard it.
- Every feature checks its pages against the benchmark in its review.
- The core keeps state between calls, where it read everything afresh before.

## Applies to

- [`crates/core/`](/crates/core/), [`packages/server/`](/packages/server/), and
  [`packages/web/`](/packages/web/), and every feature that adds a page, a read, or a write
