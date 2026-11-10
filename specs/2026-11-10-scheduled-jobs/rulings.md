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

## R12: The acceptance's small shapes beyond the plan

- **Decision**: (1) `jobChangeLine` is appended to the turn once `toChange` succeeded, not before
  it; (2) `Sessions.announce(repo, session, turn?)` reports a change of a session that no turn's end
  made, which the refusal and the line are; (3) the dismissal of a turn also takes a done turn that
  a run's row names as its `refused_turn`; (4) acceptances go one after another, and
  `acceptOffers`'s stop has `settled()`, the promise of those queued, for tests; (5) the acceptance
  also reads that the job has no problem, the session is not archived, the turn is the session's
  latest, and no block opens after the offer's.
- **Rationale**: (1) a refused start must not leave a line saying the change started; (2) the
  sidebar and the banner read the status from stored data, which changed without an event; (3)
  Dismiss is the banner's way out, and the cache refused a done turn that was not a catch-up's; (4)
  a start writes the main checkout, two at once would race, and a test cannot wait on time; (5) each
  is a way the offer may be less than the run's last word, or the human's yes may no longer hold.
- **If wrong**: (1) the line comes after the new run's first message in the session, not before; (5)
  a job whose settings were edited into a problem between its run and its end waits for the card.
- **Where**: task 5.

## R13: A job's problem is a fragment or a sentence, and the record's answers are two types

- **Decision**: the record's `problem` of a job puts "Not running: " before the core's problem only
  when it is a fragment, as the schedule's (“the schedule “dayly 06:00” is not understood”): a
  problem that ends with a full stop is a sentence, and stands alone (“Two jobs are named
  “Dependencies”.”, “A time is from 00:00 to 23:59.”). "Run now" answers a record of its own,
  `JobsRun`, which is the `Jobs` record and its `session`.
- **Rationale**: the spec's card texts are "Not running: the schedule “<text>” is not understood"
  and "Two jobs are named “<name>”.", the second without the prefix, and the edge cases quote the
  second alone. Prefixing every problem, as the plan reads, would give "Not running: Two jobs are
  named…". `JobsRecord` stays as the plan types it, with no `session` that is null on a read.
- **If wrong**: a new core problem written as a fragment is shown with the prefix, one written as a
  sentence without it; the reader of the core's texts must keep to that rule.
- **Where**: task 6.

## R14: A job's start is one exclusion, and a queued time is checked again

- **Decision**: (1) a job's start in a repository, by the job's and the repository's names, is
  reserved before anything is awaited, for a scheduled time and for "Run now" alike, and held until
  the start ends: a "Run now" that finds it taken is refused with “<name>” still runs here., and a
  scheduled time that finds it taken is skipped `working`. (2) A tick only looks, and queues the
  times due, none twice; a drain starts them one after another, a minute after the last _start_,
  while the ticks go on. A time skipped or already recorded waits for nothing. `Scheduler.tick()`
  resolves once the times are queued, and `settled()` once the queue is empty. (3) Right before each
  start the job is read again: it must exist, be on, have no problem, keep its schedule, be in the
  repository with its extension and its agent on and available, and the switch on, and the clock
  must not have jumped ([R17](#r17-a-queued-time-seen-in-time-stays-valid-until-the-clock-jumps),
  which replaces this rule's 5 minutes); otherwise the time is dropped and records nothing, as a
  missed one. The run starts with the job as it reads then. (4) The moment the server first saw a
  job in a repository belongs to the schedule it was seen with: an edited schedule is a job added
  (R2). (5) `startRun` removes a chat whose send failed through the session manager, which reports
  it to the clients.
- **Rationale**: (1) the open-change check awaits a workspace read, and the check and the key were
  apart; (2) the waits were inside the serialised tick, so times that fell due meanwhile were seen
  after their 5 minutes, and a minute was waited even before a skip; (3) a pause, a deletion, an
  edit, or an extension turned off stands for the starts still queued, and a machine that sleeps
  during a wait must not start hours-old times; (4) a schedule edited to a time just past would run
  at once, which R2 forbids for a job added just after its time; (5) the chat is shown in the
  sidebar from its creation, so its removal must reach it.
- **If wrong**: (1) a "Run now" during a queued start's minute is refused as “still runs here”,
  although the run has not started; (3) a job edited in its prompt only runs with the new prompt,
  not the one it was due with.
- **Where**: task 4.

## R15: An open change is found by the job's runs, not by its latest run

- **Decision**: a time is skipped `change-open` while any started run of the job in the repository
  has a session in a change or a feature the workspace lists as not merged. `JobRuns.changeFolders`
  gives those folders, in one query. Pruning keeps, besides the 50 latest rows, the latest started
  row that has a session, and every started row whose session has a folder. `latestStarted` is the
  latest started row with a session. "Run now" still starts with an open change, as the plan says.
- **Rationale**: the guard read only the latest started run, so a run by hand that opened no change
  hid the change an earlier run left open, and a second pull request touched the same files
  (SC-003). The latest started row _with a session_ is the one pruning keeps, so the row of a start
  in flight, which a failed start removes (R9), never displaces the previous one. Keeping the
  folders' rows in the record needs no second source for open changes.
- **Alternatives considered**: asking the workspace for the open changes whose sessions a job
  started, which has no row to name the job once pruned; keeping only the newest 50 such rows, which
  leaves a change open for longer than 50 later runs unguarded.
- **If wrong**: a job whose runs each opened a change keeps one small row per change in the cache
  for good, not shown in the history, which lists 50.
- **Where**: tasks 3 and 4.

## R16: The Jobs place's card reads the last run from the latest started row, and the routes are the UI's

- **Decision**: (1) "Last run" reads the latest _started_ row of the job's history, not the latest
  row: a skipped time is no run, and has no session to ask anything. A job with only skipped rows
  reads "Never ran". The skipped rows stay in the job's page, task 8. (2) The words of a job's card
  live in `jobs/facts.ts` (`nextFact`, `lastFact`), beside `words.ts`. A reason of `agent-off` with
  no problem reads "Not running here: no agent is on in this repository." for a job with no agent,
  and "Not running here: <agent> is not available." for one that names its agent, and `off` reads
  "Scheduled jobs are off". (3) The built-in `jobs` has order 6, after Git; previews and
  notifications moved to 7 and 8. (4) `/jobs`, `/jobs/<name>`, and `/jobs/new` are routes of the
  UI's table (`routeTable.ts`), owned by `jobs` in `extensions/routes.tsx`, so a turned-off Jobs
  place says so on all three; the two of a job's page draw the app's page for a missing item until
  task 8. (5) The card's mark stays the mockup's `uraeda:history`, and the place's icon is the new
  `uraeda:clock`. (6) The go key `g j` made the keyboard test of a pending `g` use `k` for its key
  no sequence uses: `j` is a sequence now.
- **Rationale**: (1) the plan says "the latest row of the history", and what its session asks has no
  meaning for a skipped one; the spec's card shows what a run left for the human. (3) the plan says
  "after `git`"; the orders are integers. (4) a place has one path, and a job's page is a route.
- **If wrong**: (1) a skipped time after the last run would show on the card, if the owner reads the
  latest row. (4) task 8's routes draw their page where `RoutePage` draws `Nothing` now.
- **Where**: task 7.

## R17: A queued time seen in time stays valid until the clock jumps

- **Decision**: a time a tick saw within its 5 minutes stays valid in the queue, however long the
  minutes between starts make it wait. A queued item is dropped as missed, recording nothing, only
  when the clock jumped during its wait: the wait took more than `MISSED_AFTER_MS` beyond its own
  length (a minute), by the scheduler's injected clock, which is what the machine sleeping does.
  This replaces the 5-minute check of
  [R14](#r14-a-jobs-start-is-one-exclusion-and-a-queued-time-is-checked-again) (3), made right
  before each start.
- **Rationale**: runs due together start a minute apart, so the sixth and every later one of them
  reached the check more than 5 minutes past its time and was dropped, every time, with no row,
  although the spec says a time is missed only when more than 5 minutes past when the server sees
  it. The reason of R14 (3), a machine that sleeps during a wait must not start hours-old times, is
  kept by reading the clock around the wait.
- **If wrong**: a sleep shorter than 6 minutes inside a wait starts the queue's times late, up to 6
  minutes after the time was seen.
- **Where**: task 4.

## R18: An acceptance in flight is the job busy, and the guards are read right before a start

- **Decision**: (1) `jobs/busy.ts` is a small record of the jobs an acceptance is opening a change
  for, by job name and repository root. `acceptOffers` enters a run's job when a turn of the run's
  session ends done without a folder, and leaves it when the acceptance ends, whatever it decides;
  the scheduler, built with the same `Busy` by `startJobs`, reads it with the other guards: a
  scheduled time finds the job `working` (a skip row), and "Run now" is refused with “<name>” still
  runs here. (2) Right before each start, after the minute's wait and the read of the job, while
  holding the reservation, the scheduler reads the skip guards again (the last run works, the job is
  busy, a change of its runs is open) and records the skip it finds. The open-change read, which
  awaits, comes first, so the synchronous reads of what works come last.
- **Rationale**: (1) the session joins its change's folder only at `attach`, and its agent does not
  work while `toChange` creates the worktree, so neither the open-change check nor the status said
  the run was still at work: a 03:00 time started a second run in the main checkout meanwhile
  (SC-003). (2) the guards were read before the wait, so a run resumed, or an offer accepted, during
  the minute was not seen.
- **Alternatives considered**: a second reservation key in the scheduler for the acceptance: the
  acceptance knows the repository's root, the scheduler's reservation is by its name.
- **If wrong**: a time that falls while a turn's end is read for an offer is skipped `working`
  although the run offered nothing; the run's next ordinary time starts.
- **Where**: tasks 4 and 5.

## R19: A run's offer is accepted at most once

- **Decision**: once a run's row holds a refusal (`refused_turn` is set), no later turn of its
  session starts a change by itself, whether the human dismissed the refusal or not. The offer's
  card is the human's path. This replaces the turn-by-turn check of
  [R1](#r1-two-more-fields-on-a-jobs-run), which kept only the refused turn from asking again.
- **Rationale**: a wakeup the agent set, or a background task ending, starts a turn with no human
  message. Ending on an offer again, it was accepted again after the human had dismissed the
  refusal: the change started by itself, or the banner asked a second time.
- **If wrong**: a refusal caused by a passing state (the agent working) that the human did not
  notice leaves the run's later offer to the card.
- **Where**: task 5.

## R20: A session in a change no longer reads its refusal

- **Decision**: `toChange` clears the run's refusal (`setRefusal(id, null)`) once the session moved,
  and announces the session; and the refusal the session's view reads, hence its status, is null
  while the session has a folder, whatever the row stores.
- **Rationale**: when the human started the change from the card and no turn followed (the agent
  unavailable, or no workflow message to send), the session's latest turn was still the refused one:
  it kept reading "Needs attention: The change could not start by itself.", and after Dismiss read
  idle before the change's own statuses.
- **Alternatives considered**: the status guard alone: the row would keep a refusal that no longer
  holds. Clearing alone: a session attached another way would keep reading it.
- **Where**: task 5.
