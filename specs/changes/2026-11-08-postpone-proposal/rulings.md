# Rulings: Postponing a feature makes a proposal

The low-impact choices made while making [the change](proposal.md), inside the limits of the
proposal and the decisions. None binds future work: those are decisions.

## R1: The postponed feature's branch stays, as a dropped one's does

- **Decision**: postponing never merges the branch. Its last commit removes the folder, so no tool
  counts it as a feature, which `branch_feature` in `crates/core/src/workspace/branches.rs` would.
  The worktree goes, the branch stays, and the new proposal names the commit before the last, where
  the discovery, questions, and spec stay readable with `git show`.
- **Rationale**: the proposal asks for a postponed feature to be only a proposal, so its folder,
  code, and decision edits no longer reach the default branch. Keeping the branch, as **Drop**
  already does, means nothing is lost, and the human deletes it when they choose.
- **Alternatives considered**: a `postponed/<slug>` tag on the last commit, which survives the
  branch's deletion, but adds a concept to the workflow for a rare case.
- **If wrong**: once the human deletes the branch, the commit the proposal names can be garbage
  collected. Adding the tag later is one line of the postpone step.
- **Where**: [projects.md](/skills/uraeda/references/projects.md), **Postpone or block**

## R2: Folders postponed the old way still start

- **Decision**: `ura start` and the core keep reading a folder of `specs/proposals/` that holds a
  feature's discovery and spec, and the start step still names it. Nothing in the code changes.
- **Rationale**: projects may hold folders postponed before this change, and the code handling them
  is tested and costs nothing to keep.
- **Where**: [projects.md](/skills/uraeda/references/projects.md), **Start**, step 1
