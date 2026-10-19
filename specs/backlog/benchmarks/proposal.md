# Benchmarks

## What

Benchmark the full Uraeda flow on real software issues.

## Why

I want to validate our development flow to check it's not completely stupid.

## Notes

- Find real software issues where the full flow could apply.
  - Let's target 5 cases minimum
  - This could be software development benchmarks or harnesses benchmark, look for what seems
    adequate
- As the workflow has human touching points, Claude Code _itself_ should roleplay as the human
  - Use Opus 5.5 everywhere for the moment, called through Claude Code
  - Have some guidelines written as part of the test of how the human should behave
- The Claude Code dependency should be loose for this step: we'll add other execution harnesses
  later (codex, pi-durable, ...)
- The benchmarks results should be saved cleanly in the repo: have SHA of the skill version, models
  used, execution harnesses and versions, ... -> create a `benchmarks` folder with a good structure
  for running multiple benchmarks over many months, versions, models, and harnesses
