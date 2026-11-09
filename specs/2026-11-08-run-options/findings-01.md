---
reviewed: branch
commits: 5e3a466b..5ec0cfe6
---

# Findings: Run options, the branch

## Claude Code · Opus

- **Critical**: `packages/server/src/runner/reviews.ts:95` and `:115`. The server never commits a
  review's findings: `writeFindings` runs outside the host's write queue, and every hosted
  repository defers its commits (`repositories.ts:269`), so the file is written and the commit is
  only recorded for the next queued write. Findings get fixed before they are in git, against the
  Run options decision. Run the write through the feature's write queue, await its landing, and test
  with deferred commits.
- **Important**: `packages/server/src/run-options.ts:175-183` with
  `crates/core/src/settings/runs.rs:141`. A step moved to another agent stores its effort only when
  it differs from the settings', but the merge drops the settings' effort on another agent: the High
  the human picked is lost. Store the model and effort whenever the agent differs from the
  fallback's.
- **Important**: `reviews.ts:203` and `:76`. A review asked again with symbolic commit names
  (`main..HEAD`) reuses its reviewers' earlier answers, as the key holds the names as typed. Resolve
  `base` and `head` to commit IDs before building the key and the findings' `commits`.
- **Important**: `rulings.md` R26. The strip takes five keys to change Spec's model, against
  SC-001's four, settled by a ruling. Name it in the pull request for the human to decide.
- **Minor**: `crates/core/src/actions/findings.rs:57-60`. `commits` is written as unquoted YAML,
  which some allowed characters break. Quote it, or narrow the pattern.
- **Minor**: `sub-sessions.ts:235`. `run_agent` accepts another feature's task worktree. Check the
  worktree's branch starts with the parent feature's branch.
- **Minor**: R15. A promoted change now runs its first step in a new session, which the spec's
  replaced behaviour does not list. Name it in the pull request.
- **Minor**: `run-options.ts` `toMap` holds the data model's defaults in TypeScript, close to the
  rule that TypeScript never reimplements the core.
- **Minor**: several files grew to just under 500 lines: `runner/sessions.ts` 498, `continuer.ts`
  497, `codex.ts` 497, `cache.ts` 495, `core/workspace.rs` 500.
