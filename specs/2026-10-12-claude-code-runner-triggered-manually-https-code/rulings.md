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

## R15: A feature's runs are read with the main checkout from its first step

- **Decision**: the server reads a feature's `runs` from the cache with the `mainRoot` of the first
  `nextStep` it asks for in that repository, kept for as long as the server runs. A feature whose
  step cannot be read has no runs.
- **Rationale**: the cache's rows are keyed by the main checkout
  ([R9](#r9-the-runner-keys-its-one-run-rule-by-the-servers-repository-and-the-cache-by-the-main-checkout)),
  and only the core knows it: `readWorkspace` gives the checkout the server opened, which may be a
  worktree. The main checkout of a repository does not change while the server runs.
- **Alternatives considered**: a `mainRoot` on `WorkspaceView`, which changes the core and the
  binding for one path; `nextStep` on every feature read, which asks `gh` each time.
- **If wrong**: a repository whose main checkout moves while the server runs shows no runs until the
  server restarts.
- **Where**: task 5.

## R16: The test runner is a server export, and the UI's tests already pass one

- **Decision**: `uraeda-server/testing` exports `fakeRunner`, a runner on the fake adapter and an
  in-memory cache. The server's `testApp` and `testServer`, and the UI's `renderPage`, build their
  runner with it. `renderPage` passes an unavailable one now, before task 6 adds its `agent` option.
- **Rationale**: `createApp` takes a runner, as the plan says, so the UI's test helper no longer
  type-checks without one, and the web package's checks run on every commit. One helper keeps the
  server's and the UI's fakes alike.
- **Alternatives considered**: an optional `runner` in `createApp`, which would put a test default
  in the server's code.
- **If wrong**: task 6 changes `renderPage` to take the fake from `fakeRunner`, as it would anyway.
- **Where**: tasks 5 and 6.

## R17: `URAEDA_DATA_DIR` is read from `.env` too

- **Decision**: `loadDataDir(root)` reads `URAEDA_DATA_DIR` from the environment, then from
  `<root>/.env`, as the server's other settings, and falls back to `dataDir`'s defaults. `Env` is
  unchanged.
- **Rationale**: `.env.example` gains `URAEDA_DATA_DIR`, so a value written in `.env` must apply.
  The plan's `dataDir(process.env, ...)` reads only the environment.
- **Alternatives considered**: a `dataDir` field on `Env`, which every `createApp` call and the
  settings' tests would then carry, for a path only the runner needs.
- **If wrong**: one function in `env.ts`.
- **Where**: task 5.

## R18: Stop returns the run still running, and the last two log pages are updated

- **Decision**: `run.stop` returns the run as it is when SIGINT is sent, still `running`: the live
  update brings `stopped` once the process exits. A live update of a run sends its last two log
  pages, not only the last one.
- **Rationale**: a run stops when its process exits, up to 10 seconds after SIGINT, longer than a
  mutation should wait. A tool call that starts on one page and ends after the next page begins
  updates the page before the last.
- **Alternatives considered**: waiting for the run to end in `run.stop`; the page of every updated
  event in the runner's changes, which changes the runner's `onChange` for one case.
- **If wrong**: a tool call that ends two pages after it started shows running until the page is
  read again.
- **Where**: tasks 5 and 7.

## R19: `startRun` returns the page's message and the run

- **Decision**: `startRun` returns `{ ok: true, run, message }`, with "The agent is working on the
  <step>.", or `{ ok: false, message }` with the refusal, in place of the refusal alone.
- **Rationale**: every page says which step the agent took, which only the started run knows, and
  the agent panel shows the run it started before a live update brings the feature's runs.
- **Alternatives considered**: the refusal alone, as the plan said, which leaves each page to read
  the run again for its step.
- **If wrong**: one type in `runs.ts`.
- **Where**: tasks 6 and 7.

## R20: Starting a feature reads "Start and continue" and "Start only"

- **Decision**: the draft editor's "Start the feature" becomes "Start and continue" and "Start
  only". A proposal's or a report's "Commit" becomes "Commit and continue" and "Commit only".
- **Rationale**: the draft editor keeps its draft's own "Commit" button, so "Commit only" next to it
  would not say that it starts the feature, as
  [R6](#r6-the-review-page-names-its-verdict-in-both-buttons) found for the review page.
- **Alternatives considered**: "Commit and continue" and "Commit only", as the plan's test said,
  next to "Commit".
- **If wrong**: two labels in `EditorPage.tsx`.
- **Where**: task 6.

## R21: The run log alone may import Astryx `Markdown`

- **Decision**: the stack test that forbids markdown parsers in the sources lets
  `packages/web/src/RunLog.tsx` import `@astryxdesign/core/Markdown`. Every other file is checked as
  before.
- **Rationale**: the stack decision now lets the UI render an agent's messages, which are not
  workflow files, with Astryx's `Markdown` (spec review, C3), and the test predates it.
- **Alternatives considered**: dropping `Markdown` from the test's list, which would let any page
  render workflow files with it.
- **If wrong**: a second file that renders agent messages joins the exception.
- **Where**: task 7.

## R22: "Allow and continue" shows when a run can start

- **Decision**: a blocked action always shows, in its banner. Its "Allow and continue" shows only
  when the feature waits on an agent and Claude Code is available, as "Try again" does.
- **Rationale**: "Allow and continue" starts a run, which the runner refuses on a feature waiting on
  the human ("Nothing for the agent: the feature waits on you."). A button that can only be refused
  would cost the human a tap.
- **Alternatives considered**: the button on every blocked action, as the spec's mockup draws it on
  a run done at a gate, then the refusal under it.
- **If wrong**: one condition in `AgentPanel.tsx`.
- **Where**: task 7.

## R23: `AGENTS.md` is left as it is

- **Decision**: task 8 updates `README.md` only. `AGENTS.md` does not gain the plugin and script
  folders.
- **Rationale**: `AGENTS.md` is not formatted on the default branch, which makes `vp check` and
  `vp run ready` fail before this feature. Editing it would have the pre-commit hook reformat the
  whole file: a fix in passing, which the implementation step forbids. The folders are named in the
  [agents](../decisions/agents.md) decision and the README.
- **Alternatives considered**: editing it, and letting the hook reformat it.
- **If wrong**: two lines in `AGENTS.md` once it is formatted.
- **Where**: task 8.

## R24: The real run used a new feature's discovery, stopped after 40 seconds

- **Decision**: task 8's real run went through the server's fate API on a temporary fixture
  repository, not through a browser. It started the `git-listener` draft as a feature, ran its
  discovery, stopped it after 40 seconds, ran it again with "Try again", and stopped it again.
- **Rationale**: `2026-10-12-cli-tuis` fails the core's checks once its worktree exists (task 7's
  report), so it has no step for the agent. Two short runs cover the checks the plan asks for, at
  about $0.67.
- **Alternatives considered**: a full step, at several dollars, for no more coverage.
- **If wrong**: run it in the browser with `vp dev` on a fixture repository.
- **Where**: task 8.

## R25: The browser tests run the fake agent, and it reports its own version

- **Decision**: the WebKit project replaces the web config's server plugin with one on the
  `FakeAdapter`, and its global setup points `URAEDA_DATA_DIR` at a temporary folder, removed after
  the run. The fake's `version()` reads "0.0.0 (fake agent)" in place of a real Claude Code version,
  and a browser test reads it through `/fate`.
- **Rationale**: the browser config spread the web config, whose plugin started the runner on Claude
  Code and the user's own cache: `claude --version` ran, and `interrupted()` wrote to
  `~/.local/share/uraeda/runner.sqlite`, which the [agents](../decisions/agents.md) decision forbids
  for the tests `vp run ready` runs. A fake that reported the installed version could not be told
  apart from the real binary.
- **Alternatives considered**: an option on the web config read from the environment, which `vp dev`
  could pick up by mistake.
- **If wrong**: a test that needs the fake to read like Claude Code sets its own version.
- **Where**: the final review, after task 8.

## R26: The cache is shared by every server's process, and stops only the runs of a gone one

- **Decision**: the cache opens in WAL mode, with statements that wait 5 seconds for another
  process's lock. It replaces the file only when SQLite says it is not a database or is damaged
  (`SQLITE_NOTADB`, `SQLITE_CORRUPT`). On any other error, like a lock held longer, it keeps the
  file and lives in memory for that server. Migration 2 records each run's process ID, and startup
  marks stopped only the `running` runs whose process is gone, is this one, or is unknown (runs from
  version 1).
- **Rationale**: the servers of every repository, and `vp dev` next to `pnpm start`, share
  `runner.sqlite`. A server that opened it during another's write read "database is locked", took it
  for a damaged file, and deleted it; and each server's startup marked every other server's runs
  stopped. The spec's "cannot be opened: it is created again empty" now means a damaged file, or an
  empty cache in memory, never deleting a live one.
- **Alternatives considered**: refusing to start the server on a lock, which leaves the UI without
  its pages for a cache; a lock file per repository, which still shares the runs table.
- **If wrong**: a process ID reused after a crash, by another process, keeps that crashed server's
  run `running` until the process ends. Storing the process's start time with its ID would tell them
  apart.
- **Where**: the final review, after task 8.
