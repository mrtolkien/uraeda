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
