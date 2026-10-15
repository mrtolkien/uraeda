---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Add a "scratchpad" concept

## What

Add a "scratchpad" concept: quick notes about the system, small issues, ...

I want a small, structured way to write down ideas and feedback when using the software

## Why

I feel like it happens often: a feature is built, it's mostly good but there's small feedback to
give. It's not enough to block merging the PR and running all tests again, or it could be irrelevant
to the current feature.

We want to write it down and treat it later, and saving it in the repo makes it easier to track it
and analyze it.

## Notes

- Right now I just added lines at the end of "priorities", but it's not great. It's lines that could
  become their priorities, or could go inside drafts, or could be fixed quickly without a full dev
  flow
- Maybe the right name is "Inbox" for the feature?
- Generally I want a simple but structured way to take notes about the software I'm building,
  focusing on _capture_. Organization is a second step (that we also need to integrate in this
  feature)
