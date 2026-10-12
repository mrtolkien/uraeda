# "Finish feature"

## What

We need a clear workflow for finishing up a feature: what exactly stays in the repo, when do we
delete worktrees or branches, …

## Why

Right now there’s a lot of “noise” left in main after a feature is done. This will make navigating
the file tree harder over time, and makes search tools like grep harder to use.

While some of it is useful (specs in particular, and of course decisions), I feel like we should
have a specific format that’s a bit denser.

## Notes

I myself don’t have a clear opinion yet. It could a single “[feature].Md” file in a “done” folder,
with a clear recap of the feature, decisions, and changes during implementation, …

I need you to perform deep research and review other similar tools to propose multiple approaches
