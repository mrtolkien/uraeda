---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Fix testing -> it's flaky and does not actually help

## What

We only added ~5 big features (the skill, the CLI, the web UI, driving agents, then a redesign),
there's definitely no need for the kilometers of tests we have right now.

I want to:

- Cull tests to only keep useful, meaningful ones, properly validating core behaviour and multiple
  systems at once
- Review the skill wording regarding testing so it creates good and useful tests instead of what we
  have right now: tests are noise and a waste time if they are always failing for random shit, and
  even worse they push agents to make BAD changes to pass tests (like not properly listening to user
  intent because it makes a test fail) -> Review literature on testing + agent-written tests
- Have a faster iteration cycle WHILE creating high quality code and not breaking things when making
  changes

It's a hard balance to find. Remember that for you, writing code is cheap. Running 15 minutes tests
on every small change is not. Maintaining a 150k LoC codebase neither.

## Why

Tests, both locally and in CI are:

- Extremely slow
- Flaky
- Mostly pointless

## Notes
