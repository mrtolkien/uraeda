---
status: proposed
approved-by:
icon: gauge
---

# Benchmarks

A benchmark runs the whole workflow on real tasks, with an agent playing the human, and costs real
usage. It runs only when a human says so, loads the skill from a named commit, and records
everything needed to compare runs made months apart. The simulated human sees only what a human
would, and the results in git are plain text.

## Rules

- Agents MUST NOT start a benchmark run without a human's explicit approval, and the run's record
  MUST name who gave it. Checked by the runner's tests and review.
- A benchmark MUST reach agents only through the server's adapter, with the model and the effort set
  in a benchmark-only configuration folder, never passed as flags. Checked by review.
- A run MUST load the skill from a named commit, never from the working tree, and MUST record that
  commit and whether the tree was clean. Checked by the runner's tests.
- The simulated human MUST see only what a human would open, never the hidden tests or the reference
  solution, and a run MUST be marked invalid when the human's commit touches a file outside the
  feature's workflow files. Checked by the runner's tests.
- A run MUST be marked failed when a session's models name one other than the model asked for.
  Checked by the runner's tests.
- A run MUST record the commits, the harness and its version, the models asked for and answered, the
  effort, the task and its image digest, the simulated human's model and guidelines, each step's
  time, cost, and gate outcome, and every address the agents fetched. Checked by the record's schema
  test.
- Git MUST hold each run's record, scores, `specs/` files, and final diff, and MUST NOT hold raw
  transcripts, which stay local with their SHA-256 recorded. Checked by `.gitignore` and the
  runner's tests.
- Each full-flow run SHOULD have a plain-agent run on the same task, image, model, and effort, and
  the agents SHOULD NOT read the task's upstream repository, which the audit of fetched addresses
  checks. Checked by review.

## Why

Benchmarks of a workflow with human gates do not exist yet, so this one sets its own protocol. A
human decides when it spends usage, and a pinned skill, model, and recorded versions make runs
comparable
([cost and approval](../2026-10-19-benchmarks/clarifications-01.md#q9-how-many-runs-and-with-what-budget)).
The simulated human is a stand-in for the human of the gates, and what it knows decides what the
benchmark measures
([what it knows](../2026-10-19-benchmarks/clarifications-01.md#q5-what-does-the-simulated-human-know)).
The adapter keeps one home for each agent
([how agents are reached](../2026-10-19-benchmarks/clarifications-01.md#q4-how-does-the-benchmark-reach-the-agents)).
Plain text in git keeps results reviewable, and transcripts of megabytes stay out
([what is committed](../2026-10-19-benchmarks/clarifications-01.md#q11-what-is-committed-to-the-repository)).

## Alternatives considered

- Making the benchmark's own `claude -p` calls: a second parser of events and cost, and a change to
  the agents decision.
- Harbor as the runner: its steps are fixed upfront, and its simulated user talks in a chat, not
  through files.

## Consequences

- A new agent is benchmarked by writing its adapter, and the record's fields carry over.
- Every run needs a human's word first, so a scheduled or automatic benchmark needs this decision
  changed.
- A run that touches the wrong model or file is thrown out, not corrected.
- Transcripts live on one machine: a failure can be read in git only through its `specs/` files and
  diff.

## Applies to

- [`benchmarks/`](/benchmarks/) and [`packages/benchmarks/`](/packages/benchmarks/), and every
  feature that runs, changes, or adds a benchmark

## Revisit when

A benchmark runs on another harness than Claude Code, or without a human's approval at each run.
