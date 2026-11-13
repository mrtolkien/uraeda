---
icon: gauge
---

# Benchmarks

> "A benchmark spends real usage: it runs when I say so."

A benchmark runs the whole workflow on real tasks, with an agent playing the human.

## Rules

- No benchmark run starts without a human's explicit approval, whose giver the run's record names.
  _So:_ an agent that wants numbers asks first.
- A run loads the skill from a named commit, and records what makes it comparable: versions,
  models, effort, and each step's time, cost, and outcome. _So:_ a run made months later compares
  with this one.
- The simulated human sees only what a human would open. _So:_ never the hidden tests or the
  reference solution.
- Git holds each run's record, scores, and workflow files, never its raw transcripts. _So:_
  transcripts stay local.

## Why

Runs spend usage, so a human decides when. A pinned skill and recorded versions make runs comparable
over months. What the simulated human knows decides what the benchmark measures. History:
[Benchmarks](../done/2026-10-19-benchmarks.md).

## Alternatives considered

- Harbor as the runner: its steps are fixed upfront, and its simulated user talks in a chat.

## Applies to

- [`benchmarks/`](/benchmarks/) and [`packages/benchmarks/`](/packages/benchmarks/), and every
  feature that runs, changes, or adds a benchmark

## Revisit when

A benchmark runs on another harness than Claude Code, or without a human's approval at each run.
