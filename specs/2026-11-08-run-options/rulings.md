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

## R6: The core's pick is `RunPick`

- **Decision**: the struct of an agent, a model, and an effort is `RunPick` in the core and on the
  binding, not `Pick`.
- **Rationale**: the binding's generated `index.d.ts` names its interfaces after the core's structs,
  and an interface `Pick` would hide TypeScript's own `Pick<T, K>` in every file that imports it.
- **Where**: task 1.

## R7: A findings file's title, and its place in a change

- **Decision**: `write_findings` writes the title `# Findings: <feature's title>, wave 2`, or
  `, the branch`, which `ura check` requires from the template, and a change's folder may hold
  `findings-NN.md`. The run step is a method, `Step::run_step()`, and a field of `NextStepView`, so
  every `Step` built elsewhere keeps its fields.
- **Rationale**: every workflow file has a title its check reads; the data model puts findings in
  "the feature's or change's folder"; a method cannot disagree with the step's name.
- **Where**: task 2.

## R8: `/mcp` is one of the server's paths, let through by the session check

- **Decision**: `/mcp` is in `SERVER_PATHS`, and the session check lets exactly `/mcp` through, as
  it lets `/open` through with the host token; the endpoint checks its own tokens. A session holds
  one MCP token at a time: issuing its next process's token revokes the one before.
- **Rationale**: the plan kept `/mcp` out of `SERVER_PATHS`, but two tests require every route of
  the app to be one of them, so that a new route is closed by default. Naming the exception in the
  session check keeps that rule, and `vp dev` forwards `/mcp` to the server like its other paths.
- **Where**: task 3.

## R9: A feature's options are keyed by the main checkout, and set without the repository

- **Decision**: `feature.setRunOptions` takes `{ folder, options }`, a mutation of the repository's
  endpoint, as every other feature mutation: the endpoint gives the repository. `FeatureOptions` is
  keyed by the repository's main checkout, as the sessions' rows are, so the runner reads a
  session's feature's options with its row's `repo`. `ctx.featureOptions` is the store, made by
  `featureOptionsOf` from the session manager's cache and the settings. A promoted change keeps its
  folder's name, as its sessions keep theirs, so its row needs no move. The web UI's settings record
  selects `runs.options` and `runs.claudeEffortFromEnv`, which its type now requires.
- **Rationale**: a `repo` in the input would duplicate the endpoint's, and could name another
  repository than the one the endpoint serves; `promoteChange` moves the change in place, and
  `session-moves.ts` moves no session.
- **Where**: task 4.

## R10: The map's pick is `StepPick`, its runtime always set

- **Decision**: `run-options.ts` names its pick `StepPick`, with `runtime` required, and `toMap`
  fills each pick's runtime from the stored agent or its fallback. A run of a step goes to the
  session of a step before it or of the same step (`stepSession(spec, spec)` is true).
- **Rationale**: `Pick` would hide TypeScript's `Pick<T, K>`, as R6 found; a required runtime keeps
  the web's `SessionPick` the same type, so the map's components compile unchanged; a revision or a
  continue of a step runs in that step's session.
- **If wrong**: `StepPick`'s `runtime` becomes optional and `Agents.runtime` resolves it, already
  written for it.
- **Where**: task 5.

## R11: A feature's other agent drops the settings' model and effort

- **Decision**: when a feature's step or implementers pick an agent other than the settings' agent
  for them, `merge_run_options` drops the settings' model and effort: the feature's own model and
  effort apply, else the agent's defaults. A settings' table without an agent counts as another
  agent. A feature's empty reviewers list keeps the settings' reviewers.
- **Rationale**: a model belongs to its agent; the settings' `opus` for Claude is not a model Codex
  lists, and would make the feature's run fail or pick a wrong model.
- **If wrong**: `merge_pick` in `crates/core/src/settings/runs.rs`.
- **Where**: task 1, from the review of wave 1.

## R12: A feature's record holds only its own options

- **Decision**: the feature's record's `runOptions` is the feature's own options, a `RunOptions`;
  the web UI takes the defaults from the settings' record's `runs.options`. `FeatureRunOptions` is
  gone.
- **Rationale**: a copy of the settings' options in each feature's record goes stale when the
  settings change, since nothing announces the features then; the settings' record is announced on
  every change.
- **Where**: task 4, from the review of wave 2.

## R13: A feature's options have their own database file

- **Decision**: the features' options are in `run-options.sqlite` in Uraeda's data folder, a
  database of their own with its own migration, opened by `FeatureOptions` at its first use; the
  cache's migration 11 adds only the sessions' columns. While the file is locked or cannot be read,
  `set` refuses with `refused: ` and the file's path, and `own` reads none, so the feature runs on
  the settings', and the server prints why. The file is never replaced, nor kept in memory in its
  place. This supersedes the plan's "cache database" for Task 4.
- **Rationale**: the data model says a feature's options are never cleared with the cache, but the
  cache's file is removed when it cannot be read, and kept in memory while it is locked: options in
  it would be lost, or saved where no other server and no restart sees them.
- **If wrong**: `featureOptionsOf` in `packages/server/src/runner/feature-options.ts` names the
  file.
- **Where**: task 4, from the review of wave 2.

## R14: A forced joint takes no cut of the human's

- **Decision**: `withCut(agents, options, index)` takes the agents, and gives the options unchanged
  when the joint is forced; the web's `withCut(runtimes, options, index)` calls it, in the map and
  the strip.
- **Rationale**: a forced joint cuts whatever the human chooses, as the spec's lock says (Space
  changes nothing); a toggle there stored a `new_session` no one sees, which came back as a cut when
  the steps later ran on one model.
- **Where**: task 5, from the review of wave 2.

## R15: A session without a run step takes the run, and a promoted feature starts anew

- **Decision**: a feature's latest session that ran no workflow turn, as a chat moved to a change,
  takes the next workflow run, and starts for its step, when it runs on the step's agent and model,
  its effort set to the step's as a joined step's is; on another pick, the run goes to a new session
  on the step's pick. A change promoted to a feature runs the feature's first step in a new session:
  the change's Build is never joined to a step before it.
- **Rationale**: a chat's turns hold the context the human gave, and no step ran there to cut from;
  the run options decision lets steps share a session only where the human joined them, forward. The
  session moves' test "promote runs the next step in the session" now expects a new session.
- **If wrong**: `runSession` in `packages/server/src/runner/run-session.ts`.
- **Where**: task 6.

## R16: A joined step's effort, a chained run refused, and a legacy session's step

- **Decision**: a run joined to a session sets its effort only when the step picks one: a step on
  the agent's default keeps the session's effort. A chained run that is refused, as on a model gone,
  leaves its reason as the ended turn's last line. A workflow run checks the agent of the session it
  goes to, never the agent of the session it was sent from: a chained run, Continue all, or a
  workflow message runs while the ended session's agent is gone. A legacy session's run step is read
  by the core's `runStepOf`, a new function of the binding.
- **Rationale**: an effort the human set on the session is not undone by a step that picks none; the
  human reads why the next step did not start; TypeScript reaches the core's step mapping only
  through the binding.
- **Where**: task 6.

## R17: US2 2's test joins Spec and Plan

- **Decision**: the test of US2 2 joins Spec, at High, and Plan, at Medium, and sends the plan's run
  after the spec's approval; a spec's revision is the Spec step's own run, on the Spec's effort.
- **Rationale**: `spec-revision` belongs to the Spec run step (R1), so the revision cannot have an
  effort of its own; joining two steps tests the same rule, a joined step's own effort.
- **Where**: task 6.

## R18: A run of the session's own step stays there, and a session that never ran takes the step's pick

- **Decision**: a workflow run of the run step its session runs, not fresh, goes on in that session
  whatever its pick: "Again" at the plan stays in the plan's session. A session that never ran,
  reused for its first run, takes the step's agent, model, and effort, as a new session would. Until
  Task 11 stores a change's start pick as its options, `change.start`'s runtime, model, and effort
  no longer reach its first run: `runtimes.test.ts`'s change start test says so, marked
  `TEMPORARY:`.
- **Rationale**: a continue of a step is the same run, which a session of its own holds; a session
  that never started has no context to keep, so the step's options decide it, as for any new
  session.
- **If wrong**: `runSession` in `packages/server/src/runner/run-session.ts`.
- **Where**: task 6, from its review.
