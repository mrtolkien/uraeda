---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Nix / Docker based execution environments

## What

Nix / Docker based execution environments.

Ideally, I'd like _all_ agent calls to run sandboxed, with no access to my local filesystem.

The idea would be:

- A flake for the project
  - Would also need to include the coding agent + other dev dependencies, and allow the user to
    login to the coding agent and git

  - Maybe a project flake + an uraeda flake for agentic dependencies?

- Then every worktree has its own container (docker? LXC?, running the agents
- Ideally we could even specify a remote host to share the load (my own machine can’t handle 4
  worktrees running tests in parallel)
- Finishing a feature then simply prunes the container, no local worktree to delete

## Why

- Make it _safer_ to run agents in YOLO mode

## Notes

- Running the storybook mockups would still need to work, but ideally without a full local env for
  the worktree… might be impossible, tell me
- The goal is to increase security and performance. If it doesn’t achieve those goals, we might drop
  it.
