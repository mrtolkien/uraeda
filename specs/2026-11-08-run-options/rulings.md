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

- **Decision**: a run joined to a session runs on its step's effort, and a step that picks none on
  the agent's default: the session's effort is set back to none. The session takes the effort, as a
  session that never ran takes the step's pick, only once the run is delivered, never before a
  refusal. A chained run that is refused, as on a model gone, leaves its reason as the ended turn's
  last line. A workflow run checks the agent of the session it goes to, never the agent of the
  session it was sent from: a chained run, Continue all, or a workflow message runs while the ended
  session's agent is gone. A legacy session's run step is read by the core's `runStepOf`, a new
  function of the binding.
- **Rationale**: each step runs on its own options, wherever its session started, as the run options
  decision says; a refused run leaves the session as it was; the human reads why the next step did
  not start; TypeScript reaches the core's step mapping only through the binding.
- **Where**: task 6.

## R17: US2 2's test joins Spec and Plan

- **Decision**: the test of US2 2 joins Spec, at High, and Plan, at Medium, and sends the plan's run
  after the spec's approval; a spec's revision is the Spec step's own run, on the Spec's effort.
- **Rationale**: `spec-revision` belongs to the Spec run step (R1), so the revision cannot have an
  effort of its own; joining two steps tests the same rule, a joined step's own effort.
- **Where**: task 6.

## R18: A run of the session's own step stays there, and a session made without a pick takes its step's

- **Decision**: a workflow run of the run step its session runs, not fresh, goes on in that session
  whatever its pick: "Again" at the plan stays in the plan's session. A session that never ran,
  reused for its first run, keeps the pick it was made on. A feature's or a change's session made
  without a pick, by a start, a message, a move, or a new session, is made on the pick of the run
  step of its next step, from the feature's resolved options (a change's next step is its build),
  and on the agent's defaults at a step no agent runs, as a gate; a pick given where it starts, as
  `change.start`'s runtime, model, and effort or the composer's picker, is used as given
  (`newPickOf`). The step's pick is checked as a run's, except that its agent may be unavailable, as
  any session's may be when it is made.
- **Rationale**: the Models decision: "A new session MUST start on the model and effort the human
  picked for it, where it starts or in the run options of its step or role, else on the agent's own
  defaults." A pick made where a session starts is the human's, which the first run keeps; a session
  made without one has its step's options. A first version took the step's pick on the first run,
  which overrode a pick made at the start.
- **If wrong**: `runSession` and `newPickOf` in `packages/server/src/runner/run-session.ts`.
- **Where**: task 6, from its review, and the follow-up of the Task 6 fixes.

## R19: The chain has no cap of its own, and a restart before a chained send leaves the run halted

- **Decision**: the step chain counts no run and has no limit of its own: each chained run needs the
  run before it to commit files that move the feature to another run step, and a run whose step did
  not move on starts nothing. A server that stops between a run's end and its chained send sends
  nothing once restarted: the run reads as halted, and the human starts the next step.
- **Rationale**: a loop of chained runs needs the workflow to move forward each time, which ends at
  the next human gate; the restart's scan continues only runs a restart cut, and a run that ended
  done was not cut. Both are rare, and the human sees the run waiting.
- **If wrong**: `Chain` in `packages/server/src/runner/chain.ts`, and the continuer's restart scan.
- **Where**: task 6, from its review.

## R20: The agents read their token from their environment, and Codex runs on a catalog without sub-agents

- **Decision**: a workflow process gets its `/mcp` token in its environment, `URAEDA_MCP_TOKEN`
  (`spawnGrouped` takes `env`): Claude Code's `--mcp-config` names it as
  `Authorization: Bearer ${URAEDA_MCP_TOKEN}`, which Claude Code expands, and Codex's
  `mcp_servers.uraeda` as `bearer_token_env_var`, as Codex refuses an inline `bearer_token`. The
  call's limit is the server's own `timeout` in Claude Code's configuration, 2 hours, instead of
  `MCP_TOOL_TIMEOUT`, and `tool_timeout_sec` in Codex's. Claude Code's `TeamCreate`, which starts
  teammates, is disallowed beside `Agent`, `Task`, and `Workflow`. Codex's sub-agents are off
  through its model catalog: as a workflow session or a sub-session opens, the adapter runs
  `codex debug models` in the session's working directory, so a project's own Codex configuration
  counts, sets every model's `multi_agent_version` to `"disabled"`, every model and field kept,
  writes it to `<data folder>/codex-catalog/models-<hash of the directory>.json`, and starts
  `codex app-server -c model_catalog_json=<file>`; a chat keeps Codex's own catalog. The catalog is
  written afresh at each such open, about 40 ms, so a new Codex version or catalog is never missed:
  asynchronously, the process started once it is written, and once for the sessions of one directory
  opening together (`CodexCatalogs`), which share its run. When it cannot be written, the process
  starts on Codex's own catalog, the server prints why on stderr, and the session shows a system
  line saying Codex's own sub-agents may run in it; `validate:codex` then fails, as it reads
  `spawn_agent` calls from the thread's rollout.
- **Rationale**: a process's arguments are readable by every user of the machine, its environment
  only by its own; the server's own limit leaves the user's other servers' limits as they are, and
  holds past SC-003's 60 minutes, as progress does not extend it. Codex 0.163.0 has no
  `agents.enabled`, and `features.multi_agent = false` and `features.multi_agent_v2 = false`, in a
  thread's configuration or as `codex app-server --disable`, left `spawn_agent` to GPT-6-Luna, which
  its catalog puts on multi-agent v2: the model called it. The catalog's `"disabled"` took it away,
  and writes nothing in Codex's home. The human chose this way.
- **If wrong**: `packages/server/src/runner/uraeda-tools.ts` holds the variable's name and the
  limit; `toolsArgs` in `claude.ts`, `toolsConfig` and `codexServerArgs` in `codex-thread.ts`, and
  `codex-catalog.ts` the agents' settings.
- **Found on the way**: the full `validate:claude` fails two checks that pass no `tools`, unrelated
  to this task: "a first run loads the uraeda plugin…" gives `skillLoaded: false`, and after the
  image checks the script throws
  `refused: 2026-10-10-cli-core is merged: it has no branch to write on`, so its stdin checks never
  run. Its tool check passes alone (`--tools`).
- **Where**: task 7, checked with `validate:claude --tools` and `validate:codex` on Claude Code
  2.1.319 and Codex 0.163.0.

## R21: An implementer's call answers as its turn ends, and the worktrees are the Git page's

- **Decision**: `run_agent` answers once the sub-session's turn ends: its last text when done, else
  an error saying it failed or stopped, and why. A sub-session's own automatic continue, after a
  limit or a restart, runs beside its parent, never waiting for its folder's sessions, and its
  answer goes to the parent's next call of the same task, which starts nothing. A parent's continue
  waits while one of its sub-sessions works or waits to continue, and goes once the last one ends,
  or its wait leaves without a turn: stopped, dropped by its setting turned off, or refused as it
  fires (`ParentHolds`, released from the continuer's one `#left`); after a restart, the
  sub-sessions' cuts are decided first. The worktrees `run_agent` accepts are the linked worktrees
  the core's `gitPage` lists, not missing, compared by real path, but those with a `folder`, a
  change's or a feature's, which have its branch: the parent's own, another one's, and so every
  workflow session's working directory. No new core or binding function. A parent's running turn
  that fails, but by a usage limit, or stops, but by the server's stop, stops its working
  sub-sessions too, as Stop on the parent does: halted by its watchdog, or its process crashed,
  nothing waits for their answers. One that ends done leaves them: its agent may ask again in its
  next turn.
- **Rationale**: a limit's continue may wait hours, past the call's 2-hour limit (R20); the parent
  asks again once it continues, as the plan's repeated call already answers. `gitPage` lists the
  worktrees through gix, as `git worktree list` does, and a call of `run_agent` is rare enough for
  its other reads.
- **If wrong**: `SubSessions.#idle` and `#worktree` in `packages/server/src/runner/sub-sessions.ts`,
  `endsSubSessions` in `turns.ts`, and `Continuer.fire` in `continuer.ts` and `ParentHolds` in
  `parent-holds.ts`.
- **Where**: task 8.

## R22: A parent's watchdog waits for its sub-sessions

- **Decision**: a workflow session's turn is not halted for 30 minutes without output while one of
  its tool calls waits for a sub-session, or one of its sub-sessions works or waits to continue
  (`SubSessions.busy`, reached as the context's `subSessions`): its watchdog starts again, as for a
  background command. Each sub-session keeps its own watchdog.
- **Rationale**: an implementer's task often runs past 30 minutes, and the parent writes nothing
  while it waits for the call's answer: the review found the parent halted mid-wave.
- **If wrong**: `Turns.watch` in `packages/server/src/runner/turns.ts`, and `SubSessions.busy` in
  `sub-sessions.ts`.
- **Where**: task 8's review.

## R23: A task stopped or failed runs again when the parent asks again

- **Decision**: the same task asked again answers the first call's turn while its sub-session works
  or waits to continue, or once that turn ended done. Once it stopped or failed without a continue
  to wait for (Stop, a halt, a crash, or a capped limit), the new call sends its prompt as a new
  workflow turn of the same sub-session, which keeps its worktree and its agent session.
- **Rationale**: the review found a task stopped once could never run again: every later call
  answered the old stop. A limit's wait still answers its failure at once, as R21 says.
- **If wrong**: `runsAgain` and `SubSessions.#begin` in
  `packages/server/src/runner/sub-sessions.ts`.
- **Where**: task 8's review.

## R24: A working sub-session makes its feature Working, from its parent

- **Decision**: a feature reads Working while one of its sessions' sub-sessions runs or queues a
  turn, as while the session itself does, and the status names the parent session and its latest
  turn: the feature's pages show workflow sessions, and a sub-session's page comes with task 12.
- **Rationale**: a parent's continue waits while its sub-sessions work (R21), so the parent alone
  read "Needs attention" while its implementers worked.
- **If wrong**: `readStatus` in `packages/server/src/fate/feature-status.ts`.
- **Where**: task 8's review.

## R25: Space on a joint is the joint's own, a switch's, and the map's presses are a row's bar

- **Decision**: a joint of the run map is a switch (`role="switch"`, `aria-checked` when cut), so
  Space toggles it as Space toggles any switch, and the registry declares no Space for the map. The
  map's other keys are the registry's, a selection's while the map holds the focus; a move with
  nowhere to go returns `false`, so the page's `j` `k` run instead. Under the map, the place's
  actions are the app's row bar (`RowBar`): framed presses with their keys on wider screens, and on
  the phone, while the map holds the focus, the floating bar with Reset and Remove.
- **Rationale**: Space is the leader, which a binding of Space alone would clash with; the registry
  already leaves Space to switches (`keys/fields.ts`). Reset and remove had no tap, which US1 and
  the Keyboard decision ask for, and the decision hides key hints on narrow screens.
- **If wrong**: `Joint` in `packages/web/src/runs/parts.tsx`, and `MapBar` and `useMapKeys` in
  `packages/web/src/runs/RunMap.tsx`.
- **Where**: task 10.

## R26: The strip keeps its keys, the map's, in the start dialogs

- **Decision**: the run strip listens for its own keys, on its group, as home's grid of cards and a
  radio group do, and is on `keys-structural.test.ts`'s list: it is drawn only in the start dialogs,
  a layer the key registry leaves to its owner, so a binding declared with `useKeys` would never run
  there. Its keys are the map's: ← → (h l, while single keys are on) move along the steps and the
  joints between them, the focus with them (one tab stop), Enter on a step or an agent reviewer
  opens the key picker, and Enter or Space on a joint cuts or joins it. So changing Spec's model
  from the dialog takes Tab, two moves (over the joint Discovery to Spec), Enter, and the pick: one
  key more than SC-001's four.
- **Rationale**: the Run options decision: "Run options MUST be shown and edited as one diagram of
  the steps, the same wherever they appear", which outranks the spec's success criterion; the
  Keyboard decision's list exists for a dialog's and a widget's own keys.
- **If wrong**: for SC-001's count, ← → on the strip could step from step to step, a joint reached
  another way, as Space on a step cutting the joint before it: `useStripKeys` in
  `packages/web/src/runs/RunStrip.tsx`. For keys in the registry, the registry would need a binding
  that runs inside a layer, `keys/registry.tsx`'s `dispatch`.
- **Where**: task 11.

## R27: A feature's first session takes its first step's pick, and the composer shows it

- **Decision**: `feature.startText` and `change.start` take `options`, only what the strip changed,
  kept as the feature's own: a feature's once planned, before a message can make its session, and
  removed if the start is refused; a change's once it landed, before its first run, after its build
  step's pick was checked as a new session's before anything is committed. `change.start` no longer
  takes `runtime`, `model`, and `effort`. A session made without a pick while its folder's start is
  still in the write queue takes the pick of the run step the start begins with (Discovery for a
  feature, Build for a change), as the folder cannot be read yet. A feature's record says what such
  a session runs on, `newPick`, which the composer's picker shows until the human picks; a composer
  that makes a feature's session sends no pick then, so the server makes it on its step's.
- **Rationale**: the composer sent the first runtime on as a pick, which R18 uses as given: a
  discovery set on another agent or model in the strip would never run there.
- **If wrong**: `useComposerRuntime` in `packages/web/src/ComposerPicker.tsx`, `newPickOf` and
  `stepPickOf` in `packages/server/src/runner/run-session.ts`, `StartMessages.open`.
- **Where**: task 11.
