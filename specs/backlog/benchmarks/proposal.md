# Benchmarks

## What

Benchmark the full Uraeda flow on real software issues.

As we have not written any harness integration yet, this will use Claude Code with the skill present
in this folder.

## Why

We have finished a PoC of the workflow as a skill and I want to validate it's not completely stupid.

## Notes

- Find real software issues where the full flow could apply.
  - Let's target 5 cases
  - This could be software development benchmarks or harnesses benchmark, look for what seems
    adequate
- Instrument Claude Code for this first benchmark pass
  - https://code.claude.com/docs/en/headless
- As the workflow has human touching points, Claude Code _itself_ should roleplay as the human
  - Use Opus 5.5 everywhere
  - Have some guidelines written as part of the test of how the human should behave
- The Claude Code dependency should ideally be loose: we'll add other execution harnesses later
  (codex, pi-durable, ...)
- The benchmarks results should be saved cleanly in the repo: have SHA of the skill version, models
  used, execution harnesses and versions, ...
