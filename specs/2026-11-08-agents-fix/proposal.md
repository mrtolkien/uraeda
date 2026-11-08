---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Agents fix merge conflicts on open pull requests on their own, triggered by pulling main after a merge

## What

Agents fix merge conflicts on open pull requests on their own, triggered by pulling main after a
merge.

So:

- When I merge a PR
- Then pull main/merge to main locally
- I want finished features at the PR-step to trigger an agent turn telling them to catch up to main.
  Let them stop on problematic conflicts and raise an issue, but it should be extremely rare if it
  ever happens.
  - This should be a workflow setting

## Why

It's annoying when I start 4 features before going to sleep to then have to restart 3 after merging
the first.

## Notes

I think if we only look at the local state, it's pretty easy? So any change on main to files outside
of /specs?
