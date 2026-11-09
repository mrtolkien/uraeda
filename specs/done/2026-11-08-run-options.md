---
kind: feature
finished: 2026-11-10
pull-request: https://github.com/mrtolkien/uraeda/pull/120
supersedes:
  - 2026-10-12-claude-code-runner-triggered-manually-https-code
  - 2026-10-18-redesign-feature
  - 2026-10-20-merge-chats
  - 2026-10-25-feature-page
  - 2026-11-03-worker-lifecycle
  - 2026-11-08-extensions-system
  - 2026-11-08-codex-runtime
---

# Record: Run options

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-11-08, finished on
> 2026-11-10, in [its pull request](https://github.com/mrtolkien/uraeda/pull/120). Its full files
> are in git: `git log -- specs/2026-11-08-run-options/`.

## What and why

The human sets how each workflow step runs: its agent, model, and effort, whether it shares a
session with the step before, the build's implementers, and the reviewers, each an agent or a
command. Defaults live in the settings, and a feature or a change overrides any of them where it
starts or on its page, by keyboard or by tap, through one diagram of the steps. Every step ran the
same way before, while some need a stronger model or a clean context and others a cheaper one; it
waited for Codex, so two agents made the choice real. The human asked for "full control in Uraeda":
sub-agents are sessions Uraeda starts on their role's pick, never the agents' own.

## Behaviour

- **The run map in the settings.** Settings, Runs, "How each step runs" draws six steps in a row,
  Discovery, Spec, Plan, Build, Review, and Comments, each tile with its agent's mark, its model,
  and its effort as a 5-cell meter; between tiles, a line joins two steps into one session and
  scissors start a clean one, locked where the steps run on different agents or models; bands under
  the tiles name the sessions. Under Build is the Implementers tile, under Review the reviewers and
  "Waves" or "Branch". ← → (h l) move along tiles and joints, ↓ ↑ (j k) reach the implementers or
  reviewers; Enter on a tile opens the key picker, agent and model, then effort; a joint is a
  switch, Enter or Space cuts or joins it; `r` resets the selection, `a` adds a reviewer, `d`
  removes one. Each is also a tap (the app's row bar, the floating bar on the phone), and each
  change is saved at once in `config.toml`: `[runs.steps.<step>]` (`agent`, `model`, `effort`,
  `new_session`), `[runs.implementers]`, `[[runs.reviewers]]` (`agent`, `model`, `effort`,
  `instructions`, or `command`), and `[runs] review_depth`. The defaults are today's: Discovery and
  Spec share a session, scissors before Plan, Plan to Comments share a second, every tile on
  "Default". A saved `build_in_fresh_session = false` reads as Spec and Plan joined, until the next
  write replaces it with `[runs.steps.plan] new_session = false`. A `CLAUDE_CODE_EFFORT_LEVEL` in
  the server's environment overrides every Claude Code effort, and the section says so.
- **Each step is a run of its own, chained.** A run's message stops at the end of its step. When it
  ends its step before a human gate, Uraeda starts the next step's run, trigger `next-step`, in the
  same session where the joint joins them, else in a new session on the next step's pick. The
  approval and the plan's revisions belong to Plan, a change's fix to Build, the final review and
  the finish to Review, a push to an open pull request and a catch-up to Comments. A chained run is
  no automatic continue and counts nothing toward their cap; the chain has no cap of its own, as
  each link needs the feature to move to another step. A run stopped, failed, or ended without
  finishing its step chains nothing and asks for the human; a run ending at Catch up chains nothing,
  leaving it to the catcher. A run joined to a session runs on its own step's effort, none when its
  step picks none. A run of the session's own step ("Again") stays in that session; a session made
  without a pick (a start, a message, a move, a new session) is made on its next step's pick, one
  picked where it starts keeps it. A step whose model its agent no longer lists is refused before it
  runs, its reason the ended turn's last line; a step whose agent is off falls back to the first
  agent on. A server stopped between a run's end and its chained send leaves the run halted.
  Continue all and automatic continues go to the step's session.
- **Implementers are sub-sessions.** A workflow session gets Uraeda's MCP server, `uraeda`, with
  `run_agent` and `review`, and its agent's own sub-agents are off: Claude Code's `Agent`, `Task`,
  `Workflow`, and `TeamCreate` disallowed, Codex on a copy of its model catalog with every model's
  sub-agents disabled. `run_agent` starts the task in a sub-session on the implementers' pick, in
  the task's worktree, which must be a linked worktree of the repository whose branch starts with
  the feature's branch and a dash; it reports progress every 30 seconds and answers with the
  sub-session's last message once its turn ends, or why it failed or stopped. Sub-sessions never
  become their folder's latest session, never wait for each other, keep the parent's watchdog
  waiting, and make the feature read Working. The same task asked again answers the first call while
  it works or once it ended done; once stopped or failed, it runs again in the same sub-session.
  Stop on the parent, or its turn failing or halting (not a usage limit), stops its working
  sub-sessions; a sub-session's limit continue runs beside its parent, whose own continue waits for
  its sub-sessions. A chat keeps its agent's own sub-agents.
- **Reviewers.** `review` runs every reviewer at once: an agent reviewer through its agent's own
  review, Claude Code's `/code-review <level> <base>..<head>` at a level matching its effort,
  Codex's `review/start` on a custom target on its model and effort, its instructions added; a
  command reviewer in the feature's worktree, its output and exit code its section. Its input is
  checked, and its commits resolved to their IDs, before any reviewer runs. Uraeda commits the next
  `findings-NN.md` in the feature's folder, a section per reviewer, through the repository's write
  queue, before answering; a reviewer that failed says why ("Did not review: Codex is not available
  on this machine.") and the others stand. Findings a hook refused are committed by the same review
  asked again, without running the reviewers. With "Branch", a wave's review runs nothing. A review
  has no time or output limit: it ends with its reviewers, Stop, or the parent's turn failing, its
  command reviewers' process group then ended and no findings written.
- **A feature's own options.** The feature's and the change's start dialogs show a strip, six tiny
  tiles and their joints, then what differs from the settings, "defaults" or "Spec on Opus · High";
  a change's strip shows its one step and its reviewers. Tab reaches it, and it takes the map's
  keys, so one step's model takes five keys. What the human changes is the feature's own, kept in
  `run-options.sqlite` in Uraeda's data folder, keyed by the main checkout and the folder, never
  cleared with the session cache; the rest follows the settings, a feature's agent other than the
  settings' dropping the settings' model and effort. A feature's first session starts on its first
  step's pick, which the composer's picker shows until the human picks. A promoted change keeps its
  options and runs the feature's next step in a new session.
- **The feature page's run map.** It replaces the timeline: a Proposal cap opens the track and a
  Merged cap ends it; each tile carries its stage's time ("12:11 · 2 h 50 min", "since 15:08"), its
  files as links, Discovery its rounds, Build its tasks. A joint where the workflow waits for the
  human shows the gate, in the `needs-you` colour while the feature waits there. Steps done dim, the
  current one is in the accent, the steps not started stay editable, from their next run; a finished
  feature's map is read only.
- **Sub-sessions in view.** A session's Sub-agents pane lists its sub-sessions, each with its role,
  task or range, agent, model, and effort, state, time, and usage; a click or Enter opens its page,
  the transcript without a composer, Stop while it works, and a link to its parent. On a feature's
  page, the sessions pane nests each under its parent, in the `sub-agent` colour; the sidebar's list
  and search leave them out. A feature's tokens count its sub-sessions.

## Design

Steps became runs, chained by the server, so a step's pick and session are real; sub-agents go
through a tool Uraeda serves, since only then does a pick hold on any agent. The core owns the
options' data, the server owns runs, and one TypeScript module owns which joints cut.

- The core: the `[runs]` tables, their check, the old switch's migration, and the merge of a
  feature's options over the settings, in [`settings/runs.rs`](/crates/core/src/settings/runs.rs)
  and [`runs_write.rs`](/crates/core/src/settings/runs_write.rs); each workflow step's run step,
  `StepName::run_step`, in [`steps.rs`](/crates/core/src/steps.rs); writing and committing
  `findings-NN.md` in [`actions/findings.rs`](/crates/core/src/actions/findings.rs); a revision
  resolved to its commit in [`api/git_page.rs`](/crates/core/src/api/git_page.rs).
- The joint rule, `stepSession` and `withCut`, shared by the server and the web UI as
  `uraeda-server/run-options`, in [`run-options.ts`](/packages/server/src/run-options.ts).
- Runs: which session a run goes to and on which pick, `runSession` and `newPickOf`, in
  [`runner/run-session.ts`](/packages/server/src/runner/run-session.ts); the step chain in
  [`runner/chain.ts`](/packages/server/src/runner/chain.ts); a feature's options in
  [`runner/feature-options.ts`](/packages/server/src/runner/feature-options.ts) and
  [`fate/run-options.ts`](/packages/server/src/fate/run-options.ts); the run messages in
  [`runner/message.ts`](/packages/server/src/runner/message.ts).
- The tools: the MCP endpoint and its per-process tokens in
  [`mcp/endpoint.ts`](/packages/server/src/mcp/endpoint.ts) and
  [`mcp/tokens.ts`](/packages/server/src/mcp/tokens.ts); sub-sessions and `run_agent` in
  [`runner/sub-sessions.ts`](/packages/server/src/runner/sub-sessions.ts) and
  [`parent-holds.ts`](/packages/server/src/runner/parent-holds.ts); reviews in
  [`runner/reviews.ts`](/packages/server/src/runner/reviews.ts); the agents' wiring in
  [`uraeda-tools.ts`](/packages/server/src/runner/uraeda-tools.ts),
  [`claude.ts`](/packages/server/src/runner/claude.ts),
  [`codex-thread.ts`](/packages/server/src/runner/codex-thread.ts), and
  [`codex-catalog.ts`](/packages/server/src/runner/codex-catalog.ts).
- The web UI, in [`packages/web/src/runs/`](/packages/web/src/runs/): the map,
  [`RunMap.tsx`](/packages/web/src/runs/RunMap.tsx) and
  [`parts.tsx`](/packages/web/src/runs/parts.tsx), in the settings'
  [`RunSettings.tsx`](/packages/web/src/settings/RunSettings.tsx); the strip,
  [`RunStrip.tsx`](/packages/web/src/runs/RunStrip.tsx) and
  [`StartRuns.tsx`](/packages/web/src/runs/StartRuns.tsx); the feature page's map,
  [`FeatureRuns.tsx`](/packages/web/src/runs/FeatureRuns.tsx),
  [`RunTrack.tsx`](/packages/web/src/runs/RunTrack.tsx), and
  [`featureStages.ts`](/packages/web/src/runs/featureStages.ts); sub-sessions,
  [`SubSessionRow.tsx`](/packages/web/src/runs/SubSessionRow.tsx) and
  [`SubSessionBar.tsx`](/packages/web/src/runs/SubSessionBar.tsx), from the server's
  [`fate/sub-session-views.ts`](/packages/server/src/fate/sub-session-views.ts).
- The skill uses Uraeda's tools when they are offered, and its own sub-agents and a hand-written
  `findings-NN.md` otherwise, in [`implementation.md`](/skills/uraeda/references/implementation.md),
  with the
  [findings template](/skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/findings-01.md).
- `validate:claude --tools` and `--review`, and `validate:codex --review`, check the tools and the
  reviews on the real agents: [`validate-tools.ts`](/packages/server/scripts/validate-tools.ts) and
  [`validate-reviews.ts`](/packages/server/scripts/validate-reviews.ts).
- A relaxed guard, as the spec said: Codex's sandbox does not cover Uraeda's tool, so a hostile page
  an agent reads could make it start more sub-agents, spending usage; each runs with no more
  permission than its session. Claude Code's own commands and hooks inherit the session's token in
  their environment: one token per process, revoked when it ends.

## Replaced behaviour

- **The feature page's timeline drew the stages as a vertical spine.** Guarded by no test of its
  look; `stage-files.test.ts` keeps guarding which stage each file goes to. `Timeline.tsx` is gone.
- **The run after an approval wrote the plan, then built, reviewed, and opened the pull request.**
  Guarded by `packages/server/src/runner/__tests__/message.test.ts`'s "a spec without plan-review
  runs through the implementation", removed.
- **A fresh session took the model of the session before it.** Guarded by
  `packages/server/src/runner/__tests__/runtimes.test.ts`'s "a fresh run keeps the runtime, model,
  and effort of the session it was sent to, not the first one on's (R20)", rewritten as "a session
  made without a pick runs on its step's, one picked keeps it, and a run of its step stays there".
- **"Build in a fresh session" decided the session after an approval.** Guarded by
  `crates/core/tests/settings.rs`'s `sets_building_in_a_fresh_session_in_its_own_table`,
  `packages/server/src/runner/__tests__/sessions.test.ts`'s "a workflow run at the plan step sent
  without fresh follows the setting", `packages/server/src/__tests__/sessions.test.ts`'s
  "session.send of the plan's message without fresh follows the build_in_fresh_session setting", and
  `packages/server/src/__tests__/settings.test.ts`'s "the build starts in a fresh session by
  default, and the file's value turns it off", all removed; the binding's `setBuildInFreshSession`
  is gone.
- **A new session started on the agent's defaults when nobody picked.** Guarded by `picks.test.ts`'s
  `newSessionPick` cases and `runtimes.test.ts`'s "a session on the agent's defaults opens without a
  model or an effort", which now hold only without a step's pick.
- **A change's start dialog had a "Runs on" picker.** Guarded by `runtimes.test.ts`'s "change.start
  sends the change's first run on the runtime, model, and effort picked (R20)", rewritten as
  "change.start sends the change's first run on its options' build step, kept as its own".
- **Workflow sessions used the agent's own sub-agents.** Guarded by `claude.test.ts`'s "the model
  and effort picked are arguments; none skips permissions" and `codex.test.ts`'s thread parameters,
  extended.
- **A promoted change ran the feature's next step in the same session.** Guarded by
  `packages/server/src/__tests__/session-moves.test.ts`'s "promote runs the next step in the
  session", renamed "promote runs the next step in a session of its own", by ruling: no joint runs
  from a change's Build back to a feature's first step.

## Gotchas

- Codex's sub-agents are off through a model catalog, in
  [`codex-catalog.ts`](/packages/server/src/runner/codex-catalog.ts): Codex 0.163.0 has no
  `agents.enabled`, and `features.multi_agent = false` or `multi_agent_v2 = false`, in the thread's
  configuration or as `--disable`, left `spawn_agent` to GPT-6-Luna. The adapter runs
  `codex debug models` in the session's directory, sets each model's `multi_agent_version` to
  `"disabled"`, writes `<data folder>/codex-catalog/models-<hash>.json` afresh at each open (about
  40 ms), and starts `codex app-server -c model_catalog_json=<file>`.
- The token is in the process's environment, `URAEDA_MCP_TOKEN`, in
  [`uraeda-tools.ts`](/packages/server/src/runner/uraeda-tools.ts): a process's arguments are
  readable by every user of the machine. Claude Code expands `${URAEDA_MCP_TOKEN}` in its
  `--mcp-config` header; Codex refuses an inline `bearer_token` and takes `bearer_token_env_var`.
  The call's limit is the server's own `timeout`, 2 hours, in Claude Code's configuration, and
  `tool_timeout_sec` in Codex's, as progress does not extend it.
- A Claude reviewer's level is always given, `medium` for an effort `/code-review` does not name, in
  [`claude.ts`](/packages/server/src/runner/claude.ts): without one it reuses the level the human
  last typed. It reads all the text after its level as its target, and runs as its own forked
  command even with `Agent` and `Task` disallowed.
- Codex's review uses a `custom` target naming the range, in
  [`codex-thread.ts`](/packages/server/src/runner/codex-thread.ts): `baseBranch` compares with the
  branch's upstream and takes no instructions; `review/start` takes no effort, so a reviewer's
  thread starts on it, `model_reasoning_effort` in `thread/start`'s configuration.
- A joint is a switch, `role="switch"`, in [`parts.tsx`](/packages/web/src/runs/parts.tsx): Space is
  the app's leader, so the registry binds no Space for the map, and a switch's own Space toggles it.
- The strip listens for its own keys, in [`RunStrip.tsx`](/packages/web/src/runs/RunStrip.tsx), and
  is on `keys-structural.test.ts`'s list: the start dialogs are a layer the key registry leaves to
  its owner, so a `useKeys` binding would never run there.
- A feature's options have their own database file, in
  [`feature-options.ts`](/packages/server/src/runner/feature-options.ts): the cache's file is
  removed when unreadable and kept in memory while locked, which would lose options or hide them
  from a restart. While `run-options.sqlite` cannot be read, setting options is refused with its
  path, and the feature runs on the settings'.
- Findings are written through the repository's write queue, in
  [`reviews.ts`](/packages/server/src/runner/reviews.ts): a hosted repository defers its commits, so
  a write outside the queue left the commit for the next unrelated queued write.

## Questions

### Round 01

#### Q1: What should count as a step, with its own session and model?

**Answer:** A: six steps, each its own run, discovery, spec, plan, build, review, and pull request
comments, Uraeda starting the next step's run when one ends before a human gate.

#### Q2: Should a feature run in one session, or a new session at each step?

**Answer:** C, today's, but "we should be able to define an agent for multiple steps in a row! And
it should be visually clear and simple to use": the spec read it as joints the human cuts or joins,
the default Discovery and Spec joined and a cut before Plan.

#### Q3: What happens when the next step's model differs from its session's?

**Answer:** A: a step on another agent or model starts a new session, steps on the same pick
continue it, "only if the user asked for a 'master session' approach", read as a joint the human
joined.

#### Q4: Should the build's sub-agents get their own model and effort?

**Answer:** A, through Uraeda's own tool: "If we can pass our own 'sub-agent' tool to Claude Code
and Codex, letting us control the agent and model, imo that'd be the best. Full control in uraeda."

#### Q5: How should reviewers be set?

**Answer:** A and C together: a list of reviewers, each an agent, using "the actual 'review'
features of the harnesses", or a command.

#### Q5.A: Who runs a reviewer on another agent?

**Answer:** A: Uraeda runs it as a session of the feature, its findings committed to a file, which
the build's session then fixes.

#### Q6: What should a review's depth mean?

**Answer:** A: where reviews happen, "the branch only" or "each wave and the branch", the default.

#### Q7: Where should a feature's own options be kept?

**Answer:** A: in Uraeda's data folder, shown and edited on the feature's page.

#### Q8: How should a start dialog show the options?

**Answer:** A, with mockups: "an interactive diagram with models at each step (with icons, not a ton
of text), and symbols showing when we start a clean session", all by keyboard. "Be original. Be
bold." The spec made it the run map, in the settings and the dialogs as a strip.

## Decisions

- [Run options](../decisions/run-options.md), new: a run ends with its step and Uraeda starts the
  next; steps share a session only where the human joined them; every sub-agent of a workflow run is
  a session Uraeda starts; a reviewer is an agent's own review or a command; findings are committed
  before they are fixed; a feature's options stay out of the repository; one diagram everywhere.
- [Models](../decisions/models.md), changed: a new session starts on its step's or role's pick, and
  a session's effort may follow the next step it runs.
- [Agents](../decisions/agents.md), changed: a sub-agent's session may run in its task's worktree,
  beside its parent's.

## Changes after approval

- The hand-over's "Build in a fresh session" switch is gone: the feature page's joints decide where
  the next run goes, and the server keeps an explicit `fresh` as an override.
- A promoted change runs the feature's next step in a new session, as no joint runs from a change's
  Build back to a feature's first step; a chat moved to a change takes a workflow run only when it
  runs on the step's agent and model.
- US2's scenario 2, a spec revision on its own effort, cannot happen with six steps, as a revision
  belongs to Spec: its test joins Spec and Plan instead.
- A feature's options live in their own database file, `run-options.sqlite`, not the session cache,
  so clearing the cache never loses them; while it cannot be read, a change of them is refused.
- A feature's step on another agent than the settings' drops the settings' model and effort, and a
  pick is stored with its agent, so the merge gives back the human's pick; the feature's record
  carries the core's merge, sent again when the settings change.
- A forced joint ignores the human's cut, so a stored cut never comes back once the steps share a
  pick again.
- A joined step on the agent's default effort runs on none; a refused chained run says why in the
  ended turn; a workflow run checks the agent of the session it goes to.
- A run of the session's own step stays in that session whatever the pick, and a session made
  without a pick takes its next step's; a feature's first session takes its first step's, shown in
  the composer, and `change.start` takes the strip's options instead of a runtime, model, and
  effort.
- The chain has no cap of its own, and a restart between a run's end and its chained send leaves the
  run halted.
- The agents read their token from their environment; Codex's own sub-agents are off through a copy
  of its model catalog, and a session whose copy cannot be written says its sub-agents may run;
  Claude Code's `TeamCreate` is disallowed too; a call's limit is 2 hours.
- `run_agent` answers when the sub-session's turn ends; a task stopped or failed runs again when
  asked again; a parent's watchdog and continue wait for its sub-sessions; a parent's failed or
  halted turn stops them; a working sub-session makes its feature Working; `run_agent` refuses a
  worktree that is not the repository's, a change's or a feature's, or another feature's task's, and
  starts nothing once Stop halted its call.
- A review's input is checked and its commits resolved to IDs before any reviewer runs; its findings
  are committed through the write queue, and those a hook refused by the same review asked again; it
  ends when its parent's turn halts, with no time or output limit; a reviewer whose agent is off is
  not moved to another agent.
- The run map's joints are switches, and its presses a row's bar, with Reset and Remove taps; the
  strip keeps the map's keys, so changing one step's model in a start dialog takes five keys, Tab,
  two moves over a joint, Enter, and the pick, not SC-001's four.
- Sub-sessions leave the sidebar's list and search; their parent's record lists them, and a
  feature's tokens count them.
- A catch-up is part of Comments, on its agent, model, and session, and the chain starts no run at
  Catch up, as main's Agents fix merged meanwhile; a catch-up's message stops at the end of its
  step.
- A workflow message's composer checks the agent of the step's session it goes to, not the open
  session's.
- The plan's text was edited during the work to describe what was built, with a ruling for each
  deviation. Two reviewers reviewed the branch, every critical and important finding fixed.

## Follow-ups

- Tile names break mid-word at desktop widths in the monospace font.
- `skills/uraeda/SKILL.md` is at 19,996 of its 20,000-character cap.
- `validate:claude`'s two failures, already there: "a first run loads the uraeda plugin" gives
  `skillLoaded: false`, and the script crashes on a merged fixture branch,
  `refused: 2026-10-10-cli-core is merged`, so its stdin checks never run.
- A model not in an agent's list shows its raw ID in the sub-session rows.
- Files close to the 500-line limit: `runner/sessions.ts`, `continuer.ts`, `codex.ts`, `cache.ts`,
  and the core's `workspace.rs` at 500.
- The human's personal `uraeda-external-review` skill can be replaced by a Codex reviewer in
  `[[runs.reviewers]]`.
