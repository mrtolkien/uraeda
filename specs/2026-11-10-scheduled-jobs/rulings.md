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
  live in `jobs/facts.ts` (`nextFact`, `lastFact`), beside `words.ts`. A reason of `agent-off` reads
  the server's words, `next.text`
  ([R27](#r27-the-cards-next-run-follows-the-schedulers-order-and-a-problem-shows-beside-the-time)),
  and `off` reads "Scheduled jobs are off". (3) The built-in `jobs` has order 6, after Git; previews
  and notifications moved to 7 and 8. (4) `/jobs`, `/jobs/<name>`, and `/jobs/new` are routes of the
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

## R21: A read of the Jobs record reads the workspace once

- **Decision**: `Scheduler.nextRun(job, repo, open?)` takes the folders of the changes and features
  the workspace lists as not merged. `jobsRecord` reads them once (`jobs/guards.ts` `openFolders`),
  only when a listed job has a run whose session is in a folder, and gives them to each job. Without
  them, `nextRun` reads the workspace for the one job, as the scheduler's tick does.
- **Rationale**: each job's `nextRun` read the whole workspace, so a record of N jobs that ever
  started a change did N reads, and every connected client repeats the record's read several times
  per run's start.
- **Where**: tasks 4 and 6.

## R22: The Jobs record is announced on what it reads of the server

- **Decision**: besides the settings reads, the runs' rows, and the runs' sessions, the record is
  announced when the repository list or its problem changes (`Hosts.onChange`, a listener set called
  where the `Repositories` update goes out), when an agent is turned on or off or found available or
  not (the session manager's `agent` change), and when `live.publish` reports a feature or a branch
  that changed for a repository of the session manager (`onWorkspaceChange(sessions, listener)`,
  beside `onSessionChange`).
- **Rationale**: a card reads "“notes” is not in Uraeda's list.", "Not running here: … is off in
  this repository.", or `change-open` from the list, the runtimes, and the workspace's open changes,
  and none of them sent an update: the card kept the stale reason until an unrelated job event or a
  reload.
- **Alternatives considered**: announcing on every `publish`, which a file's save in any checkout
  sends: a burst with no feature or branch changed (a git-only one) asks nothing of the jobs.
- **Where**: task 6.

## R23: "Run now" is refused for what makes a run impossible, not for a bad schedule

- **Decision**: besides the job's run working there
  ([R18](#r18-an-acceptance-in-flight-is-the-job-busy-and-the-guards-are-read-right-before-a-start)
  adds an acceptance in flight), "Run now" is refused for a job with no prompt, no name, a name
  another job has, or any problem it has apart from its schedule, with the text the card shows
  ([R13](#r13-a-jobs-problem-is-a-fragment-or-a-sentence-and-the-records-answers-are-two-types)): “A
  job has no prompt.”, “Two jobs are named “<name>”.”. A schedule that is not understood does not
  refuse it. `coreProblem` and the check live in `jobs/problem.ts`.
- **Rationale**: the spec refuses it only while the job's run works there, and a run by hand reads
  no schedule: a job with `schedule = "dayly 06:00"` could not be tried until its schedule was
  mended, and was refused with a fragment (“the schedule … is not understood”) without the card's
  prefix. The core stops at the first problem it finds, in the order name, duplicate, repository,
  schedule, prompt, so a bad schedule hides an empty prompt: the server reads the prompt itself.
- **If wrong**: a job whose only problem is one the core lists after the schedule that is not an
  empty prompt would run by hand; none exists today.
- **Where**: tasks 4 and 6.

## R24: The offer's block is read as markdown reads fences, and must end the text to be accepted

- **Decision**: `lastOffer` (R4) reads fences by the CommonMark rules: an opening fence of N
  backticks or tildes, up to three spaces in, closes only on a line of the same character, N or more
  of them, with nothing after; a block inside another fence is text. The acceptance reads
  `endingOffer`: the last closed block must be a `change` offer with nothing but whitespace after
  its closing fence. The web UI's test of the instructions' sample unwraps the sample's own
  four-backtick fence first, since inside that fence the sample is text by the same rule.
- **Rationale**: the server's line patterns accepted an offer quoted inside an outer fence, which
  the web UI draws as a code sample, and a change offer followed by prose ("do not start it") or a
  code block, which is not the run's last word. The card and the acceptance must read the same
  block.
- **If wrong**: an agent that wraps its real offer in an outer fence gets no change started by
  itself, and no card either.
- **Where**: task 5.

## R25: The phone's schedule is two selectors

- **Decision**: on the phone, a job's schedule kind (Hourly, Daily, Weekdays, Weekly) and its day
  are the app's selector, which opens as a sheet; on wider screens they are the mockup's segmented
  controls. Both write the same text. The page's title says "Jobs" above it as text, as the mockup
  draws it, not as a link.
- **Rationale**: at 390 px the four kinds need about 400 px and the seven days more, so the segments
  ran past the pane's edge. A selector is a 44 px field the whole width, as the sandbox review
  measured. A link above the title was 24 px high on the phone, short of the 44 px every target has
  there, and the list is one tap away in the app's own navigation.
- **If wrong**: a human who wants the segments on the phone gets them from a wrapping control that
  Astryx does not offer today. A job named "new" opens by the address of
  [R29](#r29-a-jobs-address-carries-any-name).
- **Where**: task 8.

## R26: The card's times read in the server's time zone

- **Decision**: the `Jobs` record carries `timeZone`, the server's IANA zone, the one the schedules
  run in. `whenWords(at, now, timeZone)` reads the hour, the calendar day, and the day's name in
  that zone, whatever the browser's zone is, and so do the history's times. `scheduleWords` already
  prints the schedule's hour as the file holds it, the server's.
- **Rationale**: the card read "Every day at 3:00" over "Today at 4:00" on a phone in another zone,
  and the Today, Tomorrow, and Yesterday words fell on the browser's calendar. The times of a
  schedule are the server's local time ([data model](data-model.md)); a human away from it reads
  them in the zone the job runs in.
- **If wrong**: a human who wants times in their own zone gets the server's until a setting asks for
  the browser's.
- **Where**: tasks 6, 7, and 8.

## R27: The card's Next run follows the scheduler's order, and a problem shows beside the time

- **Decision**: (1) the card's Next run reads `next.why` in the scheduler's order, `problem`,
  `paused`, `off`, `agent-off`, `change-open`, else the time: a paused job reads "Paused" even when
  its agent is off. (2) A `problem` of the job that is not that reason, as a repository it names
  that is not listed while it still runs in this one, shows beneath the Next run in the error
  colour, and beneath "Paused" too: it is true whatever the job does. A job's problem that _is_ the
  reason, the core's, is said once, as the reason. The job's page adds it to its schedule note. (3)
  The record's `problem` no longer holds "Not running here: <agent> is off in this repository.";
  `next.text` holds the server's own words for an `agent-off` reason, so the web UI re-words
  nothing: "Not running here: <title> is off in this repository." for a named agent that is not on
  or not registered, "Not running here: <title> is not available on this machine." for one that is
  on and not available (named, or the default one), and "Not running here: no agent is on in this
  repository." when none is on. The title is the runtime's, as its other refusals say it.
- **Rationale**: the card tested the job's `problem` before `why`, so a paused job whose agent was
  off read the agent's problem, never "Paused" (US4 scenario 2), and a job that ran here with
  another repository missing read only the time, never the problem the spec gives a card text for.
  The fallback for `agent-off` printed the agent's id and said no agent was on for an agent that was
  on and not installed or signed out. The server knows the title and the cause; R16's fallback words
  are replaced.
- **Alternatives considered**: keeping the agent's text in `problem`: a paused job would read it
  beside "Paused", which is no longer true of what it does.
- **If wrong**: a job that is paused with its agent off shows no word of the agent until it is
  resumed.
- **Where**: tasks 6 and 7. It replaces R16 (2)'s words for `agent-off`.

## R28: The record gives the job's last run apart from its history

- **Decision**: a `JobRow` has `last`, the job's latest run that started a session in the repository
  (`JobRuns.latestStarted`, as a `JobRunView`), or null. The card's "Last run" and the session it
  reads come from `last`, not from a search of `history`, which holds the 50 newest rows and may
  hold no started one. This replaces R16 (1)'s source, the history, and keeps its rule: a skipped
  time is no run.
- **Rationale**: the cache keeps the latest started row past the 50 (R15), but the card looked for
  it in the 50 rows: an hourly job whose change stays open for two days has 50 skipped rows after
  its last run, and read "Never ran" with its session no longer read.
- **If wrong**: none known; one more small view per job in each read of the record.
- **Where**: tasks 6 and 7.

## R29: A job's address carries any name

- **Decision**: a job's page is `/jobs/<name>` with the name encoded (`encodeURIComponent`), and
  `/jobs/~<name>` for a name the plain form cannot carry: `new`, which is the new job's page, `.`
  and `..`, which the browser normalises away, and a name that starts with `~`. `jobPath` (in
  `routeTable.ts`) builds it, `parseRoute` reads it, so a name written by hand opens its page. The
  core is not asked to refuse those names. This replaces R25's note that a job named "new" cannot be
  opened.
- **Rationale**: the core accepts any non-empty name, and `config.toml` is written by hand: a card
  whose link went to the add form, or to the Jobs list, was a job that could not be opened or edited
  from the web UI.
- **Alternatives considered**: the core refusing those names on write and reporting them as a
  problem on read: it limits what a human may write, and a name such as `a/b` is harmless once
  encoded.
- **If wrong**: a link typed as `/jobs/~new` by a human who meant a job named `~new` opens `new`.
- **Where**: tasks 7 and 8.

## R30: A card is a job's place in the file, not its name

- **Decision**: each `JobRow` has `index`, the job's position in `config.toml`'s list of jobs (so
  the jobs of another repository leave gaps). The Jobs place keys its cards, its selection, the
  list's keys, and the refusals under the cards by `index`. Writes stay by name, as the core's are:
  the second of two jobs of one name shows "Two jobs are named “<name>”." on its card, and a write
  by that name is the core's to refuse or to apply to the first. A job's page is by name and reads
  the first job of that name.
- **Rationale**: the record lists both jobs of a duplicate name, and the spec gives their card a
  text, but the place shared one React key, one selection, and one refusal between them, so the
  second could not be selected or reached by `j` and `k`, and `r`, `p`, and `d` on it acted on the
  first.
- **If wrong**: a page cannot be opened for the second of two jobs of one name; the human renames it
  in `config.toml`, as its card says.
- **Where**: tasks 6 and 7.

## R31: A clock jump drops the whole queue, and a start's reservation skips the wait

- **Decision**: (1) when the clock jumped during a minute's wait (R17), the scheduler empties the
  queue, so every time queued before the jump is dropped, recording nothing, not only the one that
  was waiting. (2) A scheduled start holds its job's reservation (R14) while it reads, releases it
  for the minute's wait, and takes it again as the wait ends, with nothing awaited between: a "Run
  now" that came during the wait starts at once, and the scheduled time, finding it taken, is
  skipped `working`.
- **Rationale**: (1) the jump was returned as an ordinary unsuccessful start of the one item, so the
  items behind it each waited an ordinary minute and, with no age read (R17), started hours late.
  (2) the reservation was held through the whole wait, so "Run now" for a job with no run was
  refused as "still runs here", which US4 does not allow.
- **If wrong**: (2) a run by hand during the wait, then the scheduled time after it, starts a second
  run once the first stopped working; the open-change and working guards still skip it while the
  first works or its change is open.
- **Where**: task 4. It amends R14 (1) and R17.

## R32: Only a fence at column 0 is an offer for the automatic acceptance

- **Decision**: `endingOffer` accepts an offer only when its opening fence starts at column 0, and
  after no fence still open. An offer indented, or in a list item or a quote, is no offer for the
  acceptance. `lastOffer`, which the card reads, keeps the CommonMark rule of up to three spaces, so
  the card's behaviour does not change.
- **Rationale**: an outer fence opened on a list item (`- ` followed by four backticks and `md`) is
  not recognised by the line patterns, so an indented offer inside it, left unclosed, read as an
  offer and was accepted for a change, where markdown draws a code sample.
- **Alternatives considered**: parsing list items and quotes as containers: far more grammar for a
  case the acceptance can refuse.
- **If wrong**: an agent that indents its real offer gets a card and no change started by itself.
- **Where**: task 5. It amends R24.

## R33: The Jobs record is announced on the changed host's bus, for a job's own changes

- **Decision**: `onWorkspaceChange` gives its listener the host and the changes, and the record is
  announced on that host's bus only, when a feature or a branch appeared or went (`workspace`), or a
  folder that some job's run started a change in changed (`JobRuns.allChangeFolders`).
- **Rationale**: every feature-file write in any repository announced the record on every bus, so
  each open Jobs page read the settings, the history of each job, and possibly the workspace, many
  times a minute.
- **If wrong**: a change a job's run did not start, whose step moves what a card says, is not heard
  until the next announcement: the card reads `change-open` only for changes a job's run started.
- **Where**: task 6. It amends R22.

## R34: A form's changes are patches, queued and shown at once

- **Decision**: an existing job's form turns each change of a field into a patch, a function of the
  job as it stands when it is applied. The controls show the file's values with the pending patches
  on them at once, so they move before the server answers. The saves run one after another: each
  applies its patch on the job as the latest accepted save wrote it, and goes to the name the job
  has then (`onSave(input, was)`), so a rename is followed by saves to the new name. A refusal drops
  its patch, the control goes back, and the refusal shows under its field. A change to a row whose
  save is in flight is queued, not dropped. A text stays in its draft until a save of exactly that
  text is accepted: a text typed after an Enter stays, and leaving the line after its Enter sends it
  once.
- **Rationale**: every save sent the whole job as last rendered, so a second save started while the
  first was in flight wrote the first field's old value back (and was refused after a rename), a
  second change of a row was dropped, the accepted save wiped the newer draft, and the controls
  moved only when the server answered, against the optimistic writes of `specs/ui/`.
- **Alternatives considered**: sending only the changed key: the core's `update` takes a whole job,
  and a patch on the accepted job is the same thing, built in one place.
- **If wrong**: a hand edit of `config.toml` that lands between two queued saves is written over by
  the second, which is built on the job as the first wrote it.
- **Where**: task 8.

## R35: The agent row shows what the file holds

- **Decision**: the page's Agent row shows the job's three keys as the file holds them. An agent the
  job names that is not on here shows as that agent, by its ID, with the job's model and effort as
  written, and a note in the error colour with the record's words, `next.text` ("Not running here:
  Claude Code is off in this repository."), else "Off in this repository." when the job's reason is
  another one, as a pause. A `model` or an `effort` with no `agent` shows on the default agent, the
  first on here, which is the one a run starts on. "Default" shows while any of the three keys is
  set, and clears them.
- **Rationale**: the picker fell back to the first agent on here when the job's was not among them,
  so it showed an agent the file does not hold, with nothing to say why the job did not run, and hid
  the model and the effort of a job with no `agent`, which "Default" could then not clear.
- **If wrong**: the picker lists the off agent beside the ones on here, with no models, until the
  page is left.
- **Where**: task 8.

## R36: A skipped time records the change that blocked it

- **Decision**: a time skipped as `change-open` stores the folder of the open change that blocked
  it, in a column `blocked_by` that a step of its own adds to `job_runs` (an earlier step is never
  edited). When several changes the job's runs started are open, it is the change of the latest run.
  The record's `JobRunView.blockedBy` is `{ folder, title }`, the title being the workspace's for
  that change, never the session's, and null for any other row, a row from before the column, and a
  change the workspace no longer lists; the history then says "Skipped: a change it started is still
  open." The record reads the workspace once, as it does for the cards, when a job started a change
  or has such a row.
- **Rationale**: the page named the latest earlier run that had a folder, which is not the open
  change when "Run now" started another one that was merged, and it printed the session's title, the
  job's name, which attaching a session to a change does not change.
- **Alternatives considered**: resolving the change in the record from the open changes: two open
  changes of one job, or one that closed after the skip, would read as the wrong one.
- **If wrong**: a row skipped before the column reads the generic line.
- **Where**: tasks 3, 6, and 8.

## R37: Unticking the page's own repository leaves a page with the way back

- **Decision**: when a save of the job's page leaves its own repository out of the job's
  repositories while another stays, which it was in, the page stops showing the form and says
  "“<name>” no longer runs in <repository>.", with "Run it here again", which ticks the repository
  again and brings the form back, and a link "Open Jobs". The page stays at its address, so no note
  has to cross to the list.
- **Rationale**: the save succeeds and the record stops listing the job in this repository, so the
  page turned into "No job “<name>” here." with no word on what happened and no undo, though the
  human did exactly what the form offered.
- **Alternatives considered**: going to the list with a note: the list has no place for a note that
  came with a navigation, and its undo would need the job's former values carried across.
- **If wrong**: the way back appends the repository at the end of the job's list, not where it was.
- **Where**: task 8.

## R38: A job that runs nowhere is listed in every repository

- **Decision**: the `Jobs` record of a repository lists the jobs that name it, and also every job
  that names no repository of Uraeda's list: no `repositories` key, a value that is not a list of
  names, an empty list, or only names the list lacks. Its `problem` is the core's, else the first
  name the list lacks; its `next` is the problem's, never a time or another reason, since it runs
  nowhere. A job that names a repository of the list, and no more, stays out of the others.
- **Rationale**: the data model says a table that breaks a rule is listed with its problem, and the
  docs said the Jobs place lists it, but the record kept only the jobs that name the current
  repository, so a hand-written job with a misspelt name was in no place, and a human who followed
  the docs to find the job that never runs saw nothing.
- **Alternatives considered**: saying in the docs where it does not show: the human then has no
  place in the web UI to find or mend it.
- **If wrong**: with many repositories, a broken job shows in each of their Jobs places.
- **Where**: tasks 6 and 9.

## R39: A run's session takes its account as any session does

- **Decision**: the branch adds nothing for the accounts the default branch gained while it was
  built. The [models](../decisions/models.md) decision now says a session runs on one account, which
  Uraeda picks, and keeps it. A run's session starts through `sessions.newChat` and `sessions.send`,
  in [`run.ts`](/packages/server/src/jobs/run.ts), so its process picks its account where every
  session's does, and a run a limit refused waits for that account's reset.
- **Rationale**: the decision applies to every feature that starts a session, and the scheduler
  starts none by another path.
- **Where**: the catch-up with the default branch, before the final review. The rebase kept both
  sides of two conflicts: the cache's migrations, the account's column before the jobs' table, as
  the default branch's ran first, and the web UI's page, the accounts' section before the jobs'.

## R40: The sessions' context is built in a file of its own

- **Decision**: [`session-context.ts`](/packages/server/src/runner/session-context.ts) builds the
  context the sessions' parts share, and `Sessions`' constructor calls it. Nothing else changes.
- **Rationale**: `sessions.ts` reached its 500 lines on the default branch, with the accounts, so
  the 27 lines the branch adds there, `removeEmpty` and `announce`, put it past the limit once
  caught up. The constructor's wiring of the parts is the one block that answers no call of the
  server.
- **Alternatives considered**: `removeEmpty` and `announce` as functions the jobs call themselves:
  they need the context and `onChange`, which `Sessions` keeps private.
- **Where**: the catch-up with the default branch, before the final review.

## R41: A write by a name two jobs have is refused

- **Decision**: the core's `update`, `set_on`, and `remove` refuse every write by a name that more
  than one table has, with `Two jobs are named “<name>”. Rename one in config.toml.`, and write
  nothing. A name only one table has is written as before. This replaces R30's "a write by that name
  is the core's to refuse or to apply to the first": it is refused. A job's page still reads the
  first job of its name.
- **Rationale**: a write is by name, and the card of the second job of a name, which the record
  lists in its own right, sent the name of both. `d` on it deleted the first, healthy job, and a
  rename on its page copied the second's values over the first.
- **Alternatives considered**: writes by `index`, the job's place in the file: the file may change
  between a read and the write, so a place would land on another job, which a name does not.
- **If wrong**: a human who wants the second removed edits `config.toml` by hand, as R30's "If
  wrong" already said of its page.
- **Where**: the final review's fix 1, task 1 and the Jobs place.

## R42: "Run now" is refused where the Jobs extension is off

- **Decision**: `runNow`, in [`run-now.ts`](/packages/server/src/jobs/run-now.ts), refuses a
  repository where `isOn` says the Jobs extension is off, with the text of a repository the job does
  not name: `“<name>” does not run in <repository>.`. The gate is in the scheduler, the one code
  that starts a run, not in the `jobs.runNow` mutation. Run now still ignores the pause, the switch
  for all jobs, and an open change, as R23 says.
- **Rationale**: the spec's edge case says that with the extension off its place is gone and no job
  starts there. Only the scheduled path read the extension, so a tab left open on the place, or any
  client of the mutation, started a run, and the change it offered, in a repository where Jobs is
  off.
- **Alternatives considered**: a check in the mutation: another caller of `runNow` would not have
  it.
- **If wrong**: none known: the place is gone where the extension is off, so no human reaches the
  button.
- **Where**: the final review's fix 2, task 4.

## R43: A run's offer is accepted by the rule "Run now" uses

- **Decision**: the acceptance asks `impossible(jobs, job)`, in `jobs/problem.ts`, as "Run now" does
  ([R23](#r23-run-now-is-refused-for-what-makes-a-run-impossible-not-for-a-bad-schedule)), instead
  of refusing every job that has a problem. A job whose only problem is a schedule that is not
  understood has its run's offer accepted, whether the run came by hand or by the schedule. A name
  two jobs share, no name, no prompt, and any other problem still leave the card waiting, and so do
  the report-only check and every other check. This replaces R12 (5)'s "the job has no problem".
- **Rationale**: "Run now" runs a job whose schedule is not understood, and its note promises the
  change starts from the offer, but the acceptance returned on any problem, so that run's offer
  waited with nothing said. One rule for both is simpler than two, and a schedule mistyped after a
  run started does not take back the human's yes: the run read the job as it was.
- **If wrong**: a job whose schedule was broken by hand between its run and its end has its offer
  accepted, where R12 would have left it to the card.
- **Where**: the final review's fix 3, task 5.

## R44: The acceptance and the scheduler read what "works" is in one place

- **Decision**: the acceptance asks `works(ctx, session)`, in `jobs/guards.ts`, which the scheduler
  asks too, instead of `sessionWorking`. `works` also counts a session whose process waits for a
  wakeup the agent set, read from `sessions.wakeup` itself: the status reads the wakeup only for a
  session in a feature's step, and a run's session is a chat with none, so `works` did not see it. A
  turn that ends on an offer while a wakeup is pending starts nothing, and the turn the wakeup
  starts is read as any turn's end is: its offer, when it is the last word, starts the change, once
  the wakeup's time has come. R19 still holds: a refusal is what stops later turns, and a pending
  wakeup records none.
- **Rationale**: `toChange` closes the session's process, which dropped the continuation the agent
  scheduled, and started a change from an offer that was not the run's last act. Two readings of
  "works" also let the scheduler skip a time as working while the acceptance moved the session.
- **Alternatives considered**: the acceptance reading `sessions.wakeup` beside `sessionWorking`: a
  second place that has to agree with the first. A background command of the agent's is not read,
  though `sessions.backgroundCommands` counts them: no status of the app reads a session as working
  for one, and the start from the offer's card closes the process the same way.
- **If wrong**: a wakeup set far ahead (up to a day) holds the run's offer, and the job's next
  times, until it passes; the offer's card is the way.
- **Where**: the final review's fix 4, tasks 4 and 5.

## R45: A scheduled start that failed is recorded, once, and shown

- **Decision**: when `startRun` throws for a scheduled time, the scheduler records the time as a row
  with `outcome` `failed`, and why in a new column `error`, the error's text without its `refused: `
  prefix, at the first failure. A recorded time is not tried again, so there is no retry for 5
  minutes. The history shows the row as `Could not start: <why>`, in the form the skipped times use,
  and the card's "Last run" shows that line, after the time, when a failed start is the job's newest
  run in the repository: the newest row that is not a skip, so the line stays however many skipped
  times follow it, until a run starts. A failed "Run now" records nothing: its refusal shows under
  the card. R9 keeps what it decided: `startRun` still removes the row of a start that failed, and
  the chat with it; the scheduler records the failure after. A refusal of the reads before the start
  (the repository's root, the guards) is not a failed start: it is printed once and the time is
  tried again, as before. The migrations fold into one step: `job_runs` is written once with
  `blocked_by` and `error`, and the two steps after the table (the index's fix and `blocked_by`'s
  `ALTER TABLE`) are removed.
- **Rationale**: a job with a model the agent no longer lists never ran, the row was added and
  removed at each tick for 5 minutes, and then the time was forgotten with nothing in the history or
  on the card: the job silently never ran, night after night. The migrations: no cache holds the
  branch's `job_runs` steps (the data folder's is at an older version without the table, and no
  sandbox was made on the branch), so the table is written once. This also settles review 07's
  finding 7, a cache that applied the earlier steps before the rebase put the accounts' column
  before them, which has no cache to break.
- **Alternatives considered**: keeping the retry and showing the last error: a start that fails for
  a lasting reason, as a model the agent lacks, is tried about ten times for nothing, and one that
  fails for a passing reason is as well started by the next time or "Run now".
- **If wrong**: a start that failed for a passing reason, the agent's process not opening once,
  loses that time instead of retrying it within the 5 minutes; "Run now" is the way, and the next
  time runs.
- **Where**: the final review's fix 5, tasks 3, 4, 6, and 8. Replaces R9's "so the time is not
  marked run" for a scheduled start.

## R46: A clock set back is covered by the history's 50 rows, not for days

- **Decision**: nothing changes. The spec's niche case, "The system clock is set back: a time
  already run does not run again", holds for the 50 latest rows of a job in a repository, which is
  what the unique row of a time reads. That covers a clock corrected by minutes or hours. A time
  whose row was pruned, more than 50 rows ago, starts again when the clock is set back past it: a
  clock set back by days re-lives those days, and a job that runs at its times then does what the
  clock says.
- **Rationale**: a mark of the latest time ever run would stop the repeat, and would also stop a job
  for good after a clock set forward by mistake: it would not run again until the real time passed
  the mark, which is worse than a repeat. A separate ledger of every time run would grow without
  bound, or be pruned in turn.
- **Alternatives considered**: a mark of the latest time run, per job and repository (the review's
  Codex P2): it fails the forward case above. Keeping the rows of every time run: the history keeps
  50 rows by the spec.
- **If wrong**: a clock set back by more than 50 times of a job starts times it already ran, those
  after the moment the server first saw the job (R2): an hourly job on a server up for a week, after
  a clock set back by three days, runs about 70 times over again, one at a time, a minute apart.
- **Where**: the final review's finding X3, task 3. Unchanged: R8 and R15.

## R47: The settings' read ticks, so a job written just before its time runs at it

- **Decision**: `startJobs` ticks the scheduler each time `settings.onRead` fires, as `announce.ts`
  announces the record then, besides the timer's every 30 seconds. R2 stands: the moment a job is
  first seen is the tick's clock, and a job added after its time still waits for the next one. A job
  saved, resumed, or switched on up to 30 seconds before its time is now seen by the read of the
  file, before its time, instead of by the next timer's tick, after it. `startJobs` takes an
  optional clock and `every` for tests, as `startScheduler` does.
- **Rationale**: the card read "Today at 3:00" while the next tick, after 3:00, saw the job for the
  first time and treated it as added after its time: the run was lost, and the card then read
  "Tomorrow at 3:00". A tick is serialised and starts a time once (a row per time), so a tick more
  is safe: the test ticks by the read and by hand, and one session starts.
- **If wrong**: a job whose file was read just after its time, within the same second, is still seen
  after it and waits for the next time, as R2 says.
- **Where**: the final review's fix 6, task 4.

## R48: Every run's note opens its rule on the change with "Change no file."

- **Decision**: `jobMessage` says "Change no file." in the note of every run, report only or not,
  before what each says of the offer: the report-only note that the offer waits for the human, the
  other that Uraeda starts the change from it. The skill's
  [change reference](/skills/uraeda/references/change.md) already said the run's message tells the
  agent to offer the change and change no file, and is unchanged.
- **Rationale**: the spec's tradeoff, a run in the main checkout, relies on two rules only: "Nothing
  but the skill's rule and the run's note keeps an agent from editing there." The note of a job that
  is not report only left the rule out, so an agent that did not load the skill's change reference,
  a plain chat given a prompt such as "upgrade the dependencies", could edit the human's checkout
  before it offered.
- **If wrong**: an agent reads "Change no file." as forbidding the change itself; the same note says
  Uraeda starts the change from its offer, in its own worktree.
- **Where**: the final review's fix 7, task 4.

## R49: One repository's failure does not stop the others, and a start reads the switch last

- **Decision**: (1) the look for due times, `#dueNow`, catches a throw of `#placeOf` (the
  repository's root, its agent) or `dueAt` for one job in one repository, prints it once as the
  scheduler prints its other problems, and goes on with the others; what it had seen of that job
  stays. (2) A start, `#run`, reads the workspace's open changes first (`Starts.openFor`), then
  checks the job (`#fresh`), then reads the skips with the folders it has (`Starts.skipNow`) and the
  switch (`#on()`) without awaiting, and then starts. If the folders were not read, as the job had
  no change then, and a change of its runs is listed by the end, the time is skipped as
  `change-open`, rather than run beside a change.
- **Rationale**: (1) a folder that stopped being a git checkout made `mainRoot` reject, which ended
  the tick, so no healthy repository's time was queued, each silently missed after 5 minutes. (2)
  the workspace read was awaited after `#fresh` checked the job, so a pause, the switch turned off,
  or the job deleted during that read did not stop the start (R14 and R18 asked for the guards right
  before the start, and this read was the one wait left).
- **If wrong**: (1) a repository that fails at every tick prints one line and never runs; (2) a
  pause made in the few microtasks between the last read and the start still does not stop it, as
  nothing can.
- **Where**: the final review's fix 8, task 4.

## R50: A job's schedule is its problem only when nothing else is wrong, and the core says so

- **Decision**: the core reports a job's problems in the order name, duplicate, repository, prompt,
  a key of the wrong type, then the schedule, and a new field of `Job`, `schedule_only`, is true
  exactly when the problem reported is the schedule's, so nothing else is wrong with the job. (A
  list that is not names is still the problem to fix before the empty repositories it causes.) A
  write refuses in the same order, as it shares `check`. `impossible()`, in `jobs/problem.ts`, now
  refuses every problem that is not `scheduleOnly`, in the card's words, and keeps its own read only
  of a name two jobs have, since the core flags the second of the two alone. Its own reads of the
  name and the prompt are dropped: the core reports them before the schedule, so they are the
  problem it reads. This completes [R43](#r43-a-runs-offer-is-accepted-by-the-rule-run-now-uses),
  whose rule is now exact, and replaces what
  [R23](#r23-run-now-is-refused-for-what-makes-a-run-impossible-not-for-a-bad-schedule) says of the
  order and of the server reading the prompt itself.
- **Rationale**: R43 read a problem with no schedule read as the schedule's. But the core kept a
  wrong-typed key only when the schedule passed, and read no schedule for a job with no repository:
  a job with `report_only = "true"` (text) and a schedule not understood read as report only false,
  and a job whose repositories were emptied while its run worked passed the rule, and a change
  started for a job the human wrote as report only, or with no repository.
- **Alternatives considered**: the server telling the schedule's problem by its text: a second
  reading of the core's messages, which the stack decision forbids reimplementing.
- **If wrong**: a job with a wrong type and a bad schedule shows the type's problem first, and its
  schedule's only once the type is mended.
- **Where**: the second pass's fix 1, tasks 1, 4, and 5.

## R51: A change starts only where the job still runs

- **Decision**: right before `toChange`, with the other checks made after the wait, the acceptance
  reads where the job runs, by the names the scheduler uses: the repository's name in Uraeda's list
  for the session's path, that the Jobs extension is on there (`extensions.isOn("jobs", name)`;
  without the extensions' host, as in tests, it is on), and that the job still names it
  (`job.repositories.includes(name)`). A repository no longer in the list, or missing, starts
  nothing. The offer then waits on its card, with nothing said. This completes
  [R42](#r42-run-now-is-refused-where-the-jobs-extension-is-off), which gated only `runNow`.
- **Rationale**: a human who turns Jobs off for a repository, or takes the repository out of the
  job, while a run works there has taken their yes back, as a pause would: the spec says that with
  the extension off no job starts there, and the change is a start.
- **If wrong**: a change the human wanted is left to its card, which starts it with one click.
- **Where**: the second pass's fix 2, task 5.

## R52: A change opened during a start's reads is seen

- **Decision**: `Starts.openFor` returns the open folders together with the folders of the job's
  runs as they were when the read began, and `skipNow` counts a folder the runs name now that they
  did not name then as open, as it does every folder when nothing was read. This completes
  [R49](#r49-one-repositorys-failure-does-not-stop-the-others-and-a-start-reads-the-switch-last)
  (2), which compared only a read that did not happen.
- **Rationale**: with R49's order the workspace is read before `#fresh` awaits, so a change that the
  acceptance of the last run's offer opened meanwhile is in the job's runs but not in the set read:
  the time was not skipped and a second run started beside an open change (the spec's SC-003).
- **If wrong**: a folder new to the runs that the workspace lists as merged skips a time it could
  have run; the next time runs.
- **Where**: the second pass's fix 3, task 4.

## R53: The start's row is written with nothing awaited after the last guard

- **Decision**: `startRun` takes the repository's main checkout as an argument, as `#run` and the
  run by hand already hold it, instead of awaiting `sessions.mainRoot` before its row. The last
  guard (the switch, `skipNow`, the reservation) and the row that reserves the time are one
  synchronous stretch. This corrects
  [R49](#r49-one-repositorys-failure-does-not-stop-the-others-and-a-start-reads-the-switch-last)'s
  "If wrong" (2): a pause made between the last read and the start now stops it, nothing can come
  between, where before it held only while the root was cached.
- **Rationale**: the comment and R49 said nothing was awaited between the last guard and the row,
  but `startRun` awaited `mainRoot` first. It held only because the root was cached: a cache keyed
  differently, or invalidated, would have made it git I/O in the window R49 closed.
- **Alternatives considered**: a test that holds `mainRoot` and turns the switch off: it depends on
  which call of `mainRoot` is held. The test reads the switch with a microtask queued, which has not
  run at the row's write only when nothing was awaited since.
- **If wrong**: none known: the callers read the root first, as before.
- **Where**: the second pass's fix 4, task 4.
