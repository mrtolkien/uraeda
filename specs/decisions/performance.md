---
icon: gauge
---

# Performance

> "pages should simply ALL DRAW in 100ms."

The human gave two numbers, and one stance: "I want the UI to feel instant, but we don't have to
"lie" to the user". A page or an action takes 100 ms. What moves keeps 120 frames a second: "The
goal is 120fps, not 60." Both hold on the machine Uraeda runs on, and both are targets: "It's not a
_hard_ target, but it's a SHOULD, for sure". The [performance guide](../guides/performance.md) says
how pages reach them, and how to measure.

## Rules

- Every page draws, and every action shows its result, within 100 ms, by a key as fast as by a
  click. _So:_ a page reached with `j` then `Enter` draws from what the app already holds. Reading a
  page ahead when the pointer is over its link is not enough: "Prefetch doesn't work well with
  keyboard navigation. Need a cache."
- Scrolling and streaming keep 120 frames a second, which leaves 8.3 ms for a frame. _So:_ a result
  that holds 60 frames a second is not done. The frame benchmark streams and scrolls a session of
  20,000 messages, and reads each frame against 8.3 ms.
- A page shows no loading state for what the app can already hold. _So:_ a thin bar at the top of a
  page not drawn after 100 ms was proposed, and refused: the page draws in time instead. A commit's
  hooks and an agent's work do take longer, and show their progress where they run.
- The numbers are targets: a miss is measured, named, and worked on, and never fails a check. _So:_
  the first benchmark run found 47 of 54 pages within 100 ms. The misses were listed in the
  feature's record, and the feature merged.

## Why

The human reads and decides in Uraeda for hours, mostly from the keyboard, and a wait after each key
breaks their pace. A page that asks git again cannot draw in 100 ms, so the app answers from what it
has already read. A spinner does not shorten a wait, and a result shown before it is true is a lie.
Timings change with the machine, so a benchmark run on demand measures them. History:
[Performance pass](../done/2026-10-29-performance-pass.md).

## Alternatives considered

- A bar, a spinner, or a skeleton for a page that is late: it shows the wait without removing it.
- The benchmark inside the full check: timings in every push, which vary with the machine.

## Applies to

- [`crates/core/`](/crates/core/), `crates/server/`, and `app/`, and every feature that adds a page,
  a read, a write, or something that scrolls or streams
