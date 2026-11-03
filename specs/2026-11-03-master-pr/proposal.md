---
discovery: medium # low, medium, or high: how far the agent researches before asking
---

# "Master" PR

## What

"Master" PR: when multiple agents runs, make sure all PRs can merge smoothy. Also, make workflow
file changes less problematic with merge issues.

## Why

Right now it’s a pain in the ass to merge when multiple features were built in parallel

And also there’s a ton of merge issues on mundane files like the inbox or priorities

We need to review the workflow and how it edit files to reduce merge conflicts, and review how PRs
are created and what they catch up to in the last step (could be selectable at feature start time
for example, if another feature is running it could make sure it’s mergable after the ongoing
features).

Look at gh stack too iirc might be some inspiration

## Notes
