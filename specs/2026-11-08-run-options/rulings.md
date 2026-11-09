# Rulings: Run options

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Which workflow steps each run step covers

- **Decision**: approval and plan revisions belong to Plan; a change's `change` step is its Build;
  the final review and the finish are Review; a push to an open pull request is Comments.
- **Rationale**: the feature page already draws a change's fix as its Build and the pull request as
  Review (`runs/featureStages.ts`); a push follows a pull request's comments, or a catch-up.
- **If wrong**: one line of the mapping in `crates/core/src/steps.rs`.
- **Where**: task 2.

## R2: The hand-over's "Build in a fresh session" switch goes

- **Decision**: the hand-over no longer shows a switch: the joints on the feature page's run map
  decide where the next run goes. The server keeps `workflow.fresh: true` as an explicit override.
- **Rationale**: the switch read the setting the spec replaces, and its rule was the second copy of
  `FRESH_STEPS` the clarifications asked to remove. The map's joints of the steps not started stay
  editable, before the run is sent.
- **If wrong**: a switch reading `stepSession` for the next step can come back in `HandOver.tsx`.
- **Where**: task 6.

## R3: A sub-session's task is its title, and its worktree a cache column

- **Decision**: the sub-session's `about` is stored as the session's `title`; its worktree is a
  `worktree` column of the session cache, beside the data model's `step`, `parent`, and `role`.
- **Rationale**: a sub-session has no first message to title it, and must reopen in its task's
  worktree after a restart. Both are cache, never workflow state.
- **Where**: tasks 4 and 8.

## R4: The tools' names

- **Decision**: one MCP server, `uraeda`, with two tools, `run_agent` and `review`.
- **Rationale**: the review runs several reviewers and commits their findings, which no single
  sub-agent call does; a tool of its own lets the server enforce the review depth.
- **Where**: tasks 3, 8, and 9.

## R5: A chained run has its own trigger

- **Decision**: the next step's run is sent with the trigger `next-step`.
- **Rationale**: the Run lifecycle decision counts automatic continues toward a cap; a chained run
  is no continue, and its trigger keeps them apart in the cache and the transcript.
- **Where**: task 6.
