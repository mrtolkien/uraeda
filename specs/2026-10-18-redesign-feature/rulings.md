# Rulings: Redesign feature and change pages

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: A done feature's lines are the net diff of its run of commits

- **Decision**: a feature merged by rebase or fast-forward counts the diff from the parent of its
  last run of consecutive scoped commits on the default branch to the newest one; a feature merged
  with a merge commit counts the merge's three-dot diff. Both leave out its folder and its record.
- **Rationale**: this repository merges by rebase, and its start commits sit on the default branch
  hours before the branch's commits, with other features between. Summing each commit's own diff
  gave +7,949 −2,938 for the clarifications redesign, against +6,633 −1,455 on its pull request: a
  rewritten line counted twice.
- **Alternatives considered**: the sum of every scoped commit's diff, robust but inflated; the pull
  request's `additions` from `gh`, which counts the folder and needs the network.
- **If wrong**: a figure off by what a branch rewrote; the rule lives in `history/figures.rs`.
- **Where**: task 6

## R2: A turn's tokens are the agent session's running total minus a baseline

- **Decision**: the Claude adapter sends the running total of `modelUsage`, summed over models. The
  runner stores each turn's own counts against a baseline kept by its process: zero for a new agent
  session, the sum of the session's recorded turns since its last fresh start when it resumes.
- **Rationale**: checked while planning, a resumed `claude` restores its earlier totals, and `usage`
  alone leaves sub-agents out. Idle processes close after 15 minutes, so most runs resume.
- **Alternatives considered**: a column holding the agent's last total, not in the reviewed data
  model; a baseline in memory only, lost on every server restart.
- **If wrong**: the first resumed turn after the upgrade also counts its agent session's earlier,
  unrecorded work; the feature's total stays the agent's own.
- **Where**: task 4

## R3: A draft pull request recommends its comments only when the step does not wait on the agent

- **Decision**: the step's message wins while the step waits on the agent; otherwise an open, draft,
  or changes-requested pull request recommends the comments message.
- **Rationale**: the spec's architecture orders the two, and its scenario of a draft pull request
  happens when the folder came back for a round of questions after finishing: the step then waits on
  the human. At the finish step, the draft is the one the agent is finishing.
- **Alternatives considered**: the comments message whenever a pull request exists, which would
  replace "Finish it" before the finish ran.
- **If wrong**: one condition in `recommendedMessage`.
- **Where**: task 5

## R4: The plan stage starts at the approval's decisions or the plan

- **Decision**: the Plan stage starts at the first `decision(<slug>)` or `plan(<slug>)` commit, so
  the Spec stage ends when the spec is approved and its decisions applied.
- **Rationale**: the approval step comes between the spec and the plan, and the mockup's Plan stage
  starts at the decisions' commit, 15:01, as the spec's scenario ends the Spec stage at 15:01.
- **Alternatives considered**: the plan's commit alone, leaving the approval inside the Spec stage.
- **If wrong**: one row of the stage table in `history/stages.rs`.
- **Where**: task 3

## R5: "Next" for a build reads as the mockup draws it

- **Decision**: the heading "The agent is building", and the line "Task 7 of 11: Session column".
- **Rationale**: the spec's scenario quotes both on one line, "The agent is building: task 7 of 11,
  Session column", and the approved mockup splits them into the heading and its line.
- **Alternatives considered**: one heading holding both, too long for the card on the phone.
- **If wrong**: one row of `feature/next.ts`.
- **Where**: task 8
