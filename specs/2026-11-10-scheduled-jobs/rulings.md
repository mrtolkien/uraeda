# Rulings: Scheduled jobs

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Two more fields on a job's run

- **Decision**: a run's row also keeps `refusal`, why the change its run offered could not start,
  and `refused_turn`, the turn that offer ended. The [data model](data-model.md) lists neither.
- **Rationale**: the spec's banner "The change could not start by itself." shows the reason and asks
  until dismissed, and a session's status is decided in one place, from stored data, as the
  [feature status](../decisions/feature-status.md) decision asks. The turn keeps a later turn of the
  session from asking again.
- **Alternatives considered**: the reason in the turn's own `reason`, which a `done` turn does not
  use: it would read as a failure's wherever a turn's reason is shown.
- **Where**: tasks 3 and 5.

## R2: A time is started only by a server that saw it arrive

- **Decision**: the scheduler starts a scheduled time only when it is later than the moment this
  server first saw the job on, in memory, and at most 5 minutes past. A server that starts at 3:02
  does not run a 3:00 job.
- **Rationale**: the spec says a time that passes while Uraeda is not running is missed, and a job
  added at 10:00 reads "Tomorrow at 3:00". Without it, a job added at 3:02 would run at once.
- **If wrong**: a restart inside the 5 minutes after a time loses that run. Storing the moment would
  bring it back.
- **Where**: task 4.

## R3: The job's allowance is not in the skill's entry point

- **Decision**: the skill says scheduling a job is the human's yes in its change and projects
  references only. Rule 8 of `SKILL.md` stays as it is.
- **Rationale**: `SKILL.md` holds 19,996 characters of the 20,000 its test allows
  (`crates/cli/tests/skill.rs`), and the rule's words, "Start nothing without their yes", still
  hold: the job is their yes.
- **Where**: task 2.

## R4: The offer's block is read by the server's module

- **Decision**: the grammar of the offer's block moves from the web UI's `offers.ts` to
  `packages/server/src/runner/offers.ts`, which the web UI imports, as it already imports the
  block's language from the server's instructions.
- **Rationale**: the server now reads the block too, and a rule has one home.
- **Where**: task 5.

## R5: The sandbox turns the schedule off by its variable

- **Decision**: the sandbox's server runs with `URAEDA_SCHEDULED_JOBS=false`, over two sample jobs
  in its own config folder. "Run now" starts one on the fake agent.
- **Rationale**: the [sandbox](../decisions/sandbox.md) decision keeps a step from moving by itself
  there, and the switch already does it.
- **Where**: task 9.

## R6: A built-in's manifest is `<name>.toml`, and a write may reach the whole document

- **Decision**: the `jobs` built-in's manifest is `crates/core/extensions/jobs.toml`, where the
  other nine are, not `jobs/extension.toml`. `change_path` in `settings.rs` now calls a new
  `change_document`, which hands its edit the whole document, and the jobs' `add` uses it. The
  plan's test command runs the core's and the binding's tests apart.
- **Rationale**: the built-ins' loader reads `<name>.toml`. A comment-only file, and the header a
  first write creates, are the document's trailing text in `toml_edit`, so a first `[[jobs]]` table
  added through the top-level table would have ended up above the header, which moved to the file's
  end. `cargo nextest run -p uraeda-core -p uraeda-binding` does not link: cargo unifies the
  binding's `napi` feature into the core's test binaries.
- **Alternatives considered**: keeping the header above the table by writing an empty `[[jobs]]`
  into a new file, which would put a jobs rule in `change_path`.
- **Where**: task 1.

## R7: The settings record's selection and fixtures carry `scheduledJobs` from task 3

- **Decision**: task 3 also adds `scheduledJobs: SettingSelection` to the web UI's
  `SettingsRecordView` (`packages/web/src/settings/settingsViews.ts`), and the key to the settings
  story's and the fate test's fixtures.
- **Rationale**: `ServerSettings.runs()` gains the switch, so the record the server serves has it,
  and the web UI's `Values` type requires every key of the record: `vp run fast` fails without the
  selection. The switch itself is drawn in task 7.
- **Where**: tasks 3 and 7.

## R8: Pruning keeps the latest started run

- **Decision**: the history shows 50 rows per job and repository, but pruning also keeps the job's
  latest `started` row in the repository, however many skipped rows follow it. The
  [data model](data-model.md) says so.
- **Rationale**: the open-change check (`latestStarted`) and the offer's acceptance (`ofSession`)
  read that row. An hourly job whose change stays open adds a skip per hour, so after 50 hours a
  plain "50 newest" would delete the row, and the scheduler would start a second run on the same
  files.
- **Alternatives considered**: reading the open change from the session instead of the row, which
  would move the record's authority elsewhere.
- **Where**: task 3.

## R9: A run's row can take its session later, and be removed

- **Decision**: `JobRuns` has `setSession(id, session)` and `remove(id)`. `startRun` adds the row,
  opens the chat, and sets the row's session; when the chat does not start, it removes the row and
  throws.
- **Rationale**: the row must exist before the session, so the unique index stops a second start of
  one time. Without a way to set the session or drop the row, a failed `newChat` would leave a
  `started` row with no session: the time would never be retried, and `latestStarted` would return a
  run with nothing to check.
- **Alternatives considered**: writing the row after the session, which lets two servers start one
  time ([review focus](plan.md#review-focus): a time started twice).
- **Where**: tasks 3 and 4.

## R10: An hourly schedule runs in each real hour

- **Decision**: `hourly` is at minute 0 of every hour, counted in elapsed hours: the night the clock
  goes back, the repeated hour has two tops, both are scheduled times, and no hour is missed. The
  night it goes forward, the skipped hour has none. A daily, weekday, or weekly time that happens
  twice is still its first.
- **Rationale**: both contracts hold: `nextAfter` is strictly after `now`, and `dueAt` is the latest
  time at or before it. Skipping the second top would leave a two-hour gap in a job that says "every
  hour", and `dueAt` would stay 80 minutes old through the second pass.
- **If wrong**: the hourly job runs twice in the clock-change night's repeated hour, by the wall
  clock.
- **Where**: task 3.

## R11: The scheduler's small shapes beyond the plan

- **Decision**: (1) the catcher's `serially` moves to `packages/server/src/serially.ts`, and the
  scheduler's ticks use it; (2) `startRun` sets the row's session right after the chat is made,
  before its first turn, not after the send; (3) `jobs` is carried by the app's contexts too
  (`app.ts`), as `RepoContext.jobs`, so task 6's record reads it; (4) `nextRun` answers the first of
  `problem`, `paused`, `off`, `agent-off`, `change-open`, and an agent that is not available at its
  last check reads as `agent-off`; (5) a time the server saw arrive is by job and repository, and a
  job loses that moment while it is off, has a problem, or is in a repository where its extension or
  its agent is off, so turning any of them on just after a time does not run it (R2); (6) a stop
  cuts the minute between two runs short, and starts no other.
- **Rationale**: (1) one implementation of "joins the one after it", with no import of the catcher
  by the jobs; (2) the turn's end, which task 5 reads by `ofSession`, may come before a later
  `setSession`; (3) the Jobs record is read on every endpoint; (4) the plan names the values, not
  their order; (5) a repository added to a job at 3:02 is a job added at 3:02; (6) the server's stop
  must not wait a minute.
- **If wrong**: (4) the card shows another reason first when two hold; (5) an agent turned off and
  on within a time's 5 minutes loses that run.
- **Where**: task 4.
