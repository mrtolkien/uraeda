---
status: active
approved-by: mrtolkien
icon: gauge
---

# Benchmarks

A benchmark runs the whole workflow on real tasks, with an agent playing the human, and costs real
usage. It runs only when a human says so, loads the skill from a named commit, and records enough to
compare runs made months apart. The simulated human sees only what a human would, and results are
kept in git as plain text.

## Rules

- Agents MUST NOT start a benchmark run without a human's explicit approval, whose giver the run's
  record names. Checked by the runner's tests and review.
- A benchmark MUST reach agents through the server's adapter, reusing its parsing rather than
  copying it. Checked by review.
- A run MUST load the skill from a named commit, never from the working tree. Checked by the
  runner's tests.
- The simulated human MUST see only what a human would open, never the hidden tests or the reference
  solution. Checked by the runner's tests.
- A run MUST be marked invalid when the simulated human's commit touches a file outside the
  feature's workflow files. Checked by the runner's tests.
- A run MUST be marked failed when an agent answered with another model than the one asked for.
  Checked by the runner's tests.
- A run MUST record what makes it comparable: its versions, models, effort, task, simulated human,
  and each step's time, cost, and outcome. Checked by the record's schema test.
- Git MUST hold each run's record, scores, workflow files, and final diff, but not its raw
  transcripts, which stay local. Checked by `.gitignore` and the runner's tests.
- Each case SHOULD have one plain-agent baseline run, on the same task, model, and effort as the
  runs it is compared with. Checked by review.
- Agents SHOULD NOT read the task's upstream repository. Checked by the audit of the addresses they
  fetched.

## Why

Benchmarks of a workflow with human gates do not exist yet, so this one sets its own protocol. Runs
spend usage, so a human decides when. A pinned skill and recorded versions make runs comparable over
months. What the simulated human knows decides what the benchmark measures. Transcripts weigh
megabytes, so git keeps only plain text. History: [Benchmarks](../done/2026-10-19-benchmarks.md).

## Alternatives considered

- The benchmark making its own `claude -p` calls: a second parser of events and cost.
- Harbor as the runner: its steps are fixed upfront, and its simulated user talks in a chat, not
  through files.

## Consequences

- A new agent is benchmarked by writing its adapter, and the record's fields carry over.
- Every run needs a human's word first, so a scheduled benchmark needs a change to this decision.
- A run that touches the wrong model or file is thrown out, not corrected.
- Transcripts live on one machine: a failure reads in git only through its workflow files and diff.

## Applies to

- [`benchmarks/`](/benchmarks/) and [`packages/benchmarks/`](/packages/benchmarks/), and every
  feature that runs, changes, or adds a benchmark

## Revisit when

A benchmark runs on another harness than Claude Code, or without a human's approval at each run.
