# Rulings: Claude Code runner (triggered manually)

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Commit, then start the run, in two calls

- **Decision**: the commit mutations stay as they are. After a successful commit, the UI calls
  `run.start` with the trigger and the file, and "Try again" does the same after its retry.
- **Rationale**: a fate mutation returns one type. The pages need the commit's record and the run's,
  and two calls keep each mutation's result unchanged. The spec's `continue` input on six mutations
  becomes one mutation ([Data](spec.md#data)).
- **Alternatives considered**: a `continue` input on each committing mutation, which would return
  the file without the run, so the page could not say the agent started.
- **If wrong**: a commit can succeed and its run be refused. The page shows the refusal, and "Start
  the agent" remains on the feature page.
- **Where**: tasks 5 and 6.

## R2: Two core reads, `nextStep` and `workDir`, without `gitCommonDir`

- **Decision**: `nextStep` returns the step, the branch, and the main checkout's path. `workDir`
  returns, or creates, the worktree. `readWorkspace` is unchanged.
- **Rationale**: spec review C2 moved the cache out of the git folder, into Uraeda's data folder,
  keyed by the main checkout's path, so `gitCommonDir` has no use.
- **Alternatives considered**: one call doing both, which would create a worktree just to check the
  step.
- **If wrong**: a third read is added to the binding.
- **Where**: task 1.

## R3: Log pages of 100 events

- **Decision**: the log is served as `RunLog` records of 100 events, with IDs `<run>:<page>`. A live
  update sends only the run and its last page.
- **Rationale**: one `log` field on `Run` would resend the whole log every 250 ms, on runs with
  thousands of tool calls.
- **Alternatives considered**: a fate connection with cursors, which the project's custom sources
  serve only for lists of roots ([source.ts](/packages/server/src/fate/source.ts)).
- **If wrong**: a different page size is one constant.
- **Where**: tasks 5 and 7.

## R4: Stop with signals, not the stdin control protocol

- **Decision**: stdin carries the run's single message, then closes. Stop sends SIGINT, then
  SIGTERM.
- **Rationale**: SIGINT is the documented way to end a `-p` turn cleanly
  ([headless](https://code.claude.com/docs/en/headless)). The control protocol on stdin is
  documented only through the SDK.
- **Alternatives considered**: the SDK's `interrupt` control request, written by hand.
- **If wrong**: the validation script's interrupt check fails, and the adapter changes alone.
- **Where**: task 4.

## R5: The skill plugin is a tracked folder with a link

- **Decision**: `packages/server/plugin/` holds `.claude-plugin/plugin.json` and a symbolic link,
  `skills/uraeda`, to the repository's `skills/uraeda`.
- **Rationale**: `--plugin-dir` takes a plugin's root, the parent of `skills/`. The repository's
  root would also load anything else Claude Code finds there.
- **Alternatives considered**: a plugin folder generated in the data folder at startup, one more
  moving part.
- **If wrong**: on a system without symbolic links, the plugin is copied at startup instead.
- **Where**: task 4.

## R6: The review page names its verdict in both buttons

- **Decision**: the review page reads "Approve and continue" and "Approve only", and "Request
  changes and continue" and "Request changes only". The other pages read "Commit and continue" and
  "Commit only".
- **Rationale**: the review page has two verdicts, so two pairs of "Commit and continue" and "Commit
  only" would not say which verdict each commits.
- **Alternatives considered**: a single pair, with the verdict picked first, which would add a
  control to the page.
- **If wrong**: two labels in `ReviewPage.tsx`.
- **Where**: task 6.

## R7: The fake adapter keeps a transcript for each session it starts

- **Decision**: every start of `FakeAdapter` adds its session ID to `sessions`, and a scripted run
  exits with code 0 after its events. A test removes a session to make its transcript missing, and
  drives an unscripted run with `emit` and `finish`.
- **Rationale**: Claude Code writes a transcript for every session it runs, so a fake that does the
  same resumes by default, as the real one does. The spec asks for a fake that "can make a
  transcript appear missing", which is one `delete`.
- **Alternatives considered**: an empty `sessions` that tests fill by hand, which makes every
  resumed-session test restate what the real agent does.
- **If wrong**: a test that expects a new session after a first run must clear `sessions` first.
- **Where**: tasks 2 and 3.

## R8: A cache that cannot be opened is replaced on open

- **Decision**: `RunCache.open` deletes a file it cannot read or migrate, logs why on stderr, and
  creates an empty database in its place.
- **Rationale**: the spec's edge case, "the cache is deleted, or cannot be opened. It is created
  again empty", had no task. It is a cache, so losing it costs only new sessions and the old logs.
- **Alternatives considered**: refusing to start the server, which would block commits over a cache.
- **If wrong**: a file that fails to open only for a moment, like one locked by another process,
  loses its sessions and logs. Retrying before deleting is a few lines in `open`.
- **Where**: task 2.

## R9: The runner keys its one-run rule by the server's repository, and the cache by the main checkout

- **Decision**: `Runner.start`, `running`, and `onChange` use the repository path the server was
  given. The cache's rows use `nextStep`'s `mainRoot`, as the agents decision requires. `allow`
  takes the server's repository too, `allow(repo, runId, seq)`, since a run's row holds only the
  main checkout. `onChange` sends the run's state, and a runner change carries no repository.
- **Rationale**: the one-run rule must hold before the first core call, so a second click in a row
  is refused before `nextStep` returns. The server's live updates and write guard know only their
  own repository.
- **Alternatives considered**: keying everything by the main checkout, which needs a core call
  before the refusal, and lets two clicks both pass it.
- **If wrong**: two servers on two worktrees of one repository could each start a run on the same
  feature. The dev server keeps one app per repository path.
- **Where**: tasks 3 and 5.

## R10: A bug's run message names `specs/bugs/<folder>/`

- **Decision**: the runner reads the feature's kind with `readFeature`, and a bug's message reads
  "Continue the bug specs/bugs/<folder>/, on branch fix/...". The rest of the template is the
  spec's.
- **Rationale**: the spec's template names `specs/<folder>/`, which is wrong for a bug, and its edge
  cases say a bug runs the same way, in its own folder. `nextStep` does not give the kind.
- **Alternatives considered**: a `kind` on `NextView`, which changes the core and task 1 for one
  word; guessing from the `fix/` branch prefix, which reimplements the core.
- **If wrong**: one more core read per run, or one sentence in `message.ts`.
- **Where**: task 3.

## R11: The runner is unavailable until its first check

- **Decision**: `Runner.status()` reads unavailable before `check()` has run, and `start` refuses
  then with "Claude Code is not available on this machine." The test helpers await one `check()`.
- **Rationale**: the UI must not offer "Commit and continue" before the server knows `claude` works,
  and the server checks at startup before serving.
- **Alternatives considered**: available until a check fails, which would show the two buttons on a
  machine without `claude` for the first request.
- **If wrong**: the first requests after startup show one button.
- **Where**: tasks 3 and 5.

## R12: Documented lines the runner has no use for give no event

- **Decision**: `parseLine` returns no event for the line types Claude Code documents but the runner
  does not show, like `hook_started`, `rate_limit_event`, and `system/thinking_tokens`. Only a line
  that is not JSON, or of a type the documentation does not list, is `skipped` and counted.
- **Rationale**: a real run here printed hook, rate limit, and thinking lines in every run. Counted
  as skipped, every log would read "Skipped 6 lines Claude Code printed that the runner does not
  read.", which would hide the lines the spec means: those the runner cannot read.
- **Alternatives considered**: skipping every line that gives no event, which follows the plan's
  text, and puts a system line in every run's log.
- **If wrong**: a documented type that should show, like a `permission_denied` notice, gets a case
  in `parseLine`.
- **Where**: task 4.

## R13: The fixtures come from runs shaped to give each line

- **Decision**: the denied result comes from a run given an `ask` rule for `gh pr create`, with
  `--settings` on that recording run only. The error result comes from a run with `--max-turns 1`.
  The retry line follows the documented fields, and the unknown line has a made-up type. The tests
  expect the recorded values, not the plan's examples.
- **Rationale**: `auto` mode ran a force push and a draft pull request that the message asked for
  explicitly, so no message alone gave a denial. An `ask` rule is denied in print mode, and the rule
  lived in that run's arguments only, never in a settings file. A rate limit cannot be caused on
  purpose.
- **Alternatives considered**: lines written by hand from the documentation, which would miss the
  differences from it, like `plugin_errors` printed as `null` rather than left out.
- **If wrong**: a field Claude Code prints differently in a real denial or retry. The validation
  script does not cover them, and their fixtures are recorded again when one is seen.
- **Where**: task 4.

## R14: The interrupt check waits in node, not with `sleep`

- **Decision**: the validation script's fifth check asks for
  `node -e "setTimeout(() => {}, 30000)"`, instead of `sleep 30`.
- **Rationale**: Claude Code 2.1.296 refuses a standalone `sleep 30`, and `sleep 30 && echo`, as a
  tool error telling the model to use a background command, so no tool was running when the run was
  interrupted.
- **Alternatives considered**: interrupting on the refused `sleep`, which checks an interrupt while
  the model writes, not while a command runs.
- **If wrong**: a later version refuses the node wait too, and the check fails without an interrupt:
  its output shows `stoppedIn` undefined.
- **Where**: task 4.
