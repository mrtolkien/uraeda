---
icon: gauge
---

# Benchmarks

> "No caps though, but benchmarks are only run on clear human approval (you have my approval to run
> them for this feature)"

A benchmark runs Uraeda's whole workflow on real software tasks, with an agent playing the human at
each gate. The human wants it "to validate our development flow". Each run spends the usage of their
own subscription, which is why they answered a question about budgets this way.

## Rules

- An agent never starts a benchmark run without the human's explicit approval of it. _So:_ the
  approval above covered that feature's runs, and no later one. A benchmark on a schedule changes
  this decision first.
- A benchmark measures Uraeda as it ships: the skill and `ura`, with the agent run as a person runs
  it, through its own command, since Uraeda runs no agent. _So:_ a new runner starts `claude` or
  `codex` on each step's pick from `ura next`, in the feature's worktree, and adds no prompt or tool
  of its own beyond the simulated human.
- Nothing in a run sees what grades it. _So:_ the agent that plays the human knows only the
  proposal, the task's text word for word. It never sees the hidden tests or the reference solution.
  The workflow's own questions "should NATURALLY push towards fulfilling hidden requirements".
- Each run is kept in git as plain text, with what makes it comparable months later: the skill's
  commit, the models, and the versions of the tools. _So:_ a run loads the skill from a named
  commit, never from the working tree, which has no commit to name. Raw transcripts weigh megabytes,
  and stay on the machine.

## Why

A run costs real usage, so the human decides when one starts. A benchmark that reaches agents its
own way measures that way, not Uraeda: "What matters is that we use the server's adapter and stay as
close as possible to our code." With the server gone, the closest is the skill, `ura`, and the
agent's own command. A simulated human who knows the answers makes any workflow look good. Each run
says exactly what produced it. History: [Benchmarks](../done/2026-10-19-benchmarks.md).

## Applies to

- [`benchmarks/`](/benchmarks/), its runner once a new one is written, and every feature that runs,
  changes, or adds a benchmark
