---
status: auto-approved
spec-revision: 2
---

# Plan: Scheduled jobs

**Goal:** Jobs written in `config.toml` run a prompt at set times in a new session per repository,
start the change their run offers unless they are report only, and show on a Jobs place where they
are written, paused, and run.

**Architecture:** Jobs are settings, so the Rust core owns their format: reading each `[[jobs]]`
table with its problem, the schedule's forms, and every write. The server owns time: a scheduler
beside the catch-up of pull requests decides which times are due, missed, or skipped, and is the
only code that starts a scheduled run. The cache of sessions is the authority on what ran: one row
per run or skipped time, which the scheduler, the history, and the offer's acceptance read. A run is
a session of the main checkout. Its change starts through `toChange`, the path the offer's card
uses, so the start of a change has one home. The web UI only draws and sends writes. See the spec's
[architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both, with its
[data model](data-model.md) and the [rulings](rulings.md).

## Review focus

- **A time started twice.** Two ticks in one minute, or two jobs' queues, must start a time once:
  the scheduler writes the run's row before it starts the session, and reads it first. Task 4.
- **A job added or turned on just after its time.** A job added at 3:02 with `daily 03:00` must not
  run at once. Task 4, by the rule of [ruling R2](rulings.md).
- **A prompt that TOML could break.** A prompt holding `"""`, a backslash, or a line ending in `\`
  must read back byte for byte after a write. Task 1.
- **`jobs` that is not a list of tables.** `jobs = 3`, or `jobs = [{ ... }]` inline, must not make
  the settings unreadable: the first is the jobs' own problem, the second reads as jobs. Task 1.
- **An offer that is not the run's last word.** A block still open, a `feature` offer, or an offer
  in an earlier text of the turn starts nothing. Task 5.
- **A human message racing the acceptance.** A message that arrives while the run's turn ends must
  leave the card waiting, or reach the session after its move, never start a change the human did
  not see coming twice. `toChange` holds the session while it moves. Task 5.
- **A run row of another repository.** A session is accepted only when its run's repository is the
  session's. Task 5.

## Global constraints

From the [run lifecycle](../decisions/run-lifecycle.md) decision:

- "A scheduled job MUST be the human's own, written in their settings, never read from a
  repository."
- "Each automatic run MUST say in its session why it happened."
- "Each kind of automatic run MUST have a setting that turns it off."
- "A run the human stopped or dismissed MUST NOT continue by itself."

From the [agents](../decisions/agents.md) decision:

- "An agent MUST NOT turn a session into a change, or a change into a feature, without the human's
  yes. Scheduling a job is that yes for the changes its runs start, unless the human made the job
  report only."
- "Tests MUST reach agents through a fake adapter, never a real agent."

From the [settings](../decisions/settings.md) decision:

- "Finding, reading, validating, and writing the settings and the theme files MUST live in the Rust
  core."
- "A write MUST keep a human's comments, unknown keys, and order."
- "A write MUST NOT overwrite a file that is unreadable or invalid."
- "A flag or an environment variable MUST NOT be written into the file."

From the [extensions](../decisions/extensions.md), [stack](../decisions/stack.md),
[feature status](../decisions/feature-status.md), and [code quality](../decisions/code-quality.md)
decisions:

- "Uraeda's own places and agent runtimes MUST be built on the same extension API as the owner's,
  each one able to be turned off."
- "TypeScript MUST reach the core only through the binding, never reimplementing it."
- "A feature's status MUST be decided in one place, which every view, notification, and count
  reads."
- "A new marker MUST NOT be added unless a human approves it in the plan." No task adds one: a file
  near its limit is split, or the new code goes beside it.
- "Unit tests MUST NOT depend on elapsed time": the scheduler takes its clock and its waits.

Exact texts, from the spec:

- The lines: `Started by the schedule “<job>”.`, `Started by “Run now” of the job “<job>”.`, and
  `The job “<job>” started the change “<title>”.`
- The history: `Skipped: the change “<title>” is still open.` and
  `Skipped: its last run still works.`
- The banner: title `The change could not start by itself.`
- The card: `Paused`, `Not running: the schedule “<text>” is not understood`,
  `Not running here: <agent> is off in this repository.`, `“<name>” is not in Uraeda's list.`,
  `Two jobs are named “<name>”.`
- The refusals: `A job named “<name>” exists already.`, `A job runs in one repository at least.`,
  `A time is from 00:00 to 23:59.`, `“<name>” still runs here.`
- The confirmation: `Delete the job “<name>”? Its prompt leaves config.toml, and its sessions stay.`
- The settings: `scheduled_jobs`, `--no-scheduled-jobs`, `URAEDA_SCHEDULED_JOBS`, and the switch
  "Run scheduled jobs". A job's keys are those of the [data model](data-model.md).
- A time is missed once it is more than 5 minutes past. Runs due together start a minute apart. The
  scheduler looks every 30 seconds. The history keeps 50 rows per job and repository.

Every command runs in the dev shell, `nix develop -c <command>`. No commit names an agent or a tool.

## Code read

- [`crates/core/src/settings.rs`](/crates/core/src/settings.rs), 478 lines of the 500 a Rust file
  may have ([`crates/cli/tests/structure.rs`](/crates/cli/tests/structure.rs)): `Settings`,
  `RunSettings`, `ContinueKey` and `set_continue`, `change_path`, which writes one table under the
  folder's lock, and `set`, which keeps a value's comment. `file::parse` reads `[server]`, `[runs]`,
  and `[keyboard]` only, and one bad value makes the whole file `unreadable`. Jobs must not: they
  read apart, as extensions do.
- [`crates/core/src/extensions.rs`](/crates/core/src/extensions.rs): `BUILT_INS`, nine names, each
  with a manifest in `crates/core/extensions/<name>.toml`, and `read`, the lenient reader with a
  problem per extension: the model for jobs. Its tests are
  [`crates/core/tests/extensions.rs`](/crates/core/tests/extensions.rs), which list the built-ins.
- [`crates/core/src/settings/runs_write.rs`](/crates/core/src/settings/runs_write.rs):
  `write_reviewers` writes `[[runs.reviewers]]`, an array of tables kept in place: the model for
  writing `[[jobs]]`.
- [`crates/core/tests/settings_writes.rs`](/crates/core/tests/settings_writes.rs): the helpers
  `tempdir`, `write`, and `text`, and tests that compare the file's text after a write.
- [`crates/binding/src/settings.rs`](/crates/binding/src/settings.rs) and
  [`extensions.rs`](/crates/binding/src/extensions.rs): each core function as an `AsyncTask`, and
  `set_continue` mapping `"catch-up"`, `"limit"`, and `"restart"`.
  [`packages/binding/contracts.test.ts`](/packages/binding/contracts.test.ts) tests the binding over
  a real `config.toml`.
- [`packages/server/src/catch-ups.ts`](/packages/server/src/catch-ups.ts): the catcher, started in
  [`server.ts`](/packages/server/src/server.ts) `startOpened` after `startContinues`, stopped with
  the server. Its tests,
  [`__tests__/catch-ups.test.ts`](/packages/server/src/__tests__/catch-ups.test.ts), build a
  `RepoContext` over `testServer` and the fake agent.
- [`packages/server/src/settings.ts`](/packages/server/src/settings.ts),
  [`env.ts`](/packages/server/src/env.ts), and [`options.ts`](/packages/server/src/options.ts): a
  switch's flag, variable, and value in force, as `catchUpPullRequests` has them.
  [`fate/settings-mutations.ts`](/packages/server/src/fate/settings-mutations.ts):
  `settings.setContinue`.
- [`packages/server/src/runner/sessions.ts`](/packages/server/src/runner/sessions.ts):
  `newChat(repo, pick)`, `send(repo, session, input)`, `sessionWorking`, `working`. In
  [`send.ts`](/packages/server/src/runner/send.ts), a chat's message has the origin `human`, and
  only a workflow's message carries a system `line`. A chat is titled by its first message when its
  title is null.
- [`packages/server/src/runner/cache.ts`](/packages/server/src/runner/cache.ts), 495 lines of 500,
  and [`migrations.ts`](/packages/server/src/runner/migrations.ts): the schema's steps, in order.
- [`packages/server/src/fate/session-moves.ts`](/packages/server/src/fate/session-moves.ts):
  `toChange(ctx, { session, slug?, text })`, private today, starts the change, moves the session,
  and sends its first run. Without a slug, the core derives it.
- [`packages/server/src/runner/status.ts`](/packages/server/src/runner/status.ts): `StatusReason`,
  and the one rule of a session's status. The web UI's banners are
  [`SessionAttention.tsx`](/packages/web/src/SessionAttention.tsx).
- [`packages/web/src/offers.ts`](/packages/web/src/offers.ts): `lastOffer` and `proposalTitle`, the
  offer's grammar.
- [`packages/server/src/fate/extensions.ts`](/packages/server/src/fate/extensions.ts) and
  [`extension-mutations.ts`](/packages/server/src/fate/extension-mutations.ts): a record read on
  every endpoint, announced when it changes, with its mutations: the model for the `Jobs` record.
  [`fate/sources.ts`](/packages/server/src/fate/sources.ts) has 490 lines.
- [`packages/web/src/extensions/builtins/`](/packages/web/src/extensions/builtins/): a built-in's
  place, as `decisions.tsx` registers it, with `order.ts`, `places.ts`, and `index.ts`.
  [`settings/RunSettings.tsx`](/packages/web/src/settings/RunSettings.tsx) draws the switches.
- The mockups, [`JobsMockups.stories.tsx`](/packages/web/src/jobs/JobsMockups.stories.tsx) and
  [`JobPageMockups.stories.tsx`](/packages/web/src/jobs/JobPageMockups.stories.tsx).
- [`packages/web/sandbox/seed.ts`](/packages/web/sandbox/seed.ts): the sandbox's config folder and
  `sandboxEnv`.
- [`skills/uraeda/SKILL.md`](/skills/uraeda/SKILL.md): 19,996 characters of the 20,000 its test
  allows.
- Validation: `vp run fast` after each task, `vp run ready` before the push. Rust tests run with
  `cargo nextest run -p <crate> --test <file>`, TypeScript tests with `vp test run <file>`.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ⚠️                   | ✅             | ✅         | ✅                | ✅                |

- I. A job lets an agent open a change no human read, as the approved spec says. No exception is
  added by the plan.

## Complexity tracking

| Abstraction or exception                                   | Why it is needed                                                              | Simpler alternative rejected because                                      |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| The core's `jobs` module, apart from `Settings`            | A job with a problem must not make the settings file unreadable               | A `jobs` field of `Settings` would turn one bad schedule into no settings |
| `Schedule`, shared by the core, the server, and the web UI | One parsed form for the times, the words, and the form's controls             | Parsing the text in three places would be three grammars                  |
| `JobRuns`, in `runner/cache-jobs.ts`                       | One record the scheduler, the history, the acceptance, and the status read    | Methods on `SessionCache` would take `cache.ts` past 500 lines            |
| The server's `jobs/` folder: times, scheduler, run, accept | Time, starting, and accepting each have one owner, tested alone               | One file would pass the limits, and mix the clock with the sessions       |
| `runner/offers.ts`, read by the server and the web UI      | The offer's grammar has one home ([ruling R4](rulings.md))                    | A second parser in the server would drift from the card's                 |
| `refusal` and `refused_turn`, beyond the data model        | The banner's reason, decided in the one status rule ([ruling R1](rulings.md)) | A `done` turn's `reason` would read as a failure's                        |
| The `Jobs` record of fate                                  | The place and the page read jobs, their next run, and their history live      | Reading `Settings` would not carry runs, and would be wrong on a problem  |

No unit is left over a limit, and no marker is added.

## Test map

The Rust tests write a real `config.toml` in a temporary folder. The server's tests run the real
session manager on an in-memory cache and the fake agent, over the fixture repository, with the
clock and the waits given by the test. The binding's test crosses the real native binding. No test
drives a browser: the web UI is reviewed in the sandbox, as the testing decision asks at the `early`
stage.

| Spec                                                                          | Task | Test                                                                                    |
| ----------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------- |
| US4 3, US5 3, more 1, 2; edge case: two jobs with one name                    | 1    | `crates/core/tests/jobs.rs`, `a job with a problem is listed, and the others read`      |
| US5 1, 2; SC-006; review focus: a prompt TOML could break                     | 1    | `crates/core/tests/jobs.rs`, `a write changes its job alone`                            |
| Review focus: `jobs` that is not a list of tables                             | 1    | a row of `a job with a problem is listed, and the others read`                          |
| The contract of jobs between the core and the server                          | 1    | `packages/binding/contracts.test.ts`, `jobs read and write through the binding`         |
| Edge cases: the clock moves forward, moves back; US2 more 3                   | 3    | `packages/server/src/jobs/__tests__/times.test.ts`, one table                           |
| The record of runs: 50 rows, a rename                                         | 3    | `packages/server/src/runner/__tests__/cache-jobs.test.ts`                               |
| US1 1, 2, more 1, 3; SC-001                                                   | 4    | `packages/server/src/jobs/__tests__/scheduler.test.ts`, `a job runs at its time`        |
| US1 3; US2 1, 2; SC-002; review focus: added just after its time              | 4    | `scheduler.test.ts`, `a time nobody saw arrive is never started`                        |
| US2 3, more 1, 2; SC-003; review focus: a time started twice                  | 4    | `scheduler.test.ts`, `a time is skipped while the last run works or its change is open` |
| Edge cases: the agent off, a repository not listed, the extension off         | 4    | rows of `a job runs at its time`                                                        |
| US1 more 2; edge cases: a restart during a run, a stopped run                 | none | the continuer's and the turns' existing tests own them: a run is a plain session        |
| US3 1, 2; SC-004; edge case: a page talks a run into a change                 | 5    | `packages/server/src/jobs/__tests__/accept.test.ts`, `a run's offer starts its change`  |
| US3 3, more 2, 3; SC-005; review focus: not the last word, another repository | 5    | `accept.test.ts`, `an offer waits where the job or the human says so`                   |
| US3 more 1                                                                    | 5    | `accept.test.ts`, `a change that cannot start asks, with its reason`                    |
| Review focus: a human message racing the acceptance                           | none | `toChange` holds the session, which `runner/__tests__/moves.test.ts` owns               |
| US4 1, 2, more 2, 3; edge case: `config.toml` cannot be read                  | 6    | `packages/server/src/__tests__/jobs-fate.test.ts`, `the jobs' record and its writes`    |
| Edge case: a job edited while its run works                                   | none | the prompt is sent when the run starts: nothing reads it again                          |
| Edge cases: the system clock set back, a job renamed by hand                  | 3, 4 | rows of `cache-jobs.test.ts` and of `a time is skipped…`                                |
| Edge case: uncommitted edits when a change starts                             | none | the core's start tests own it                                                           |
| US4 more 1; US5 more 3; SC-007; every mockup                                  | 7, 8 | none: reviewed in the sandbox, in both themes, at 390 px and on a desktop               |

## Waves

- **Wave 1**: tasks 1 and 2. The core and the skill share no file.
- **Wave 2**: task 3.
- **Wave 3**: task 4.
- **Wave 4**: tasks 5 and 6. Task 5 changes `jobs/start.ts`, the status, and the session's banner;
  task 6 adds the fate record. Both add one export line to `packages/server/package.json`.
- **Wave 5**: task 7.
- **Wave 6**: tasks 8 and 9. The job's page and the documentation share no file.

---

## Task 1: Jobs in the settings file

**Risky:** it adds a stored format, and writes the human's settings file.

**Files:**

- Create: `crates/core/src/jobs.rs`, `crates/core/src/jobs/schedule.rs`,
  `crates/core/src/jobs/write.rs`, `crates/core/extensions/jobs.toml`, `crates/binding/src/jobs.rs`
- Modify: `crates/core/src/lib.rs`, `crates/core/src/settings.rs` (`RunSettings`, `ContinueKey`, and
  `change_document`, which `change_path` now calls), `crates/core/src/settings/file.rs`
  (`parse_runs`), `crates/core/src/extensions.rs` (`BUILT_INS`), `crates/binding/src/lib.rs`,
  `crates/binding/src/settings.rs` (`set_continue`), `crates/core/tests/extensions.rs` (the
  built-ins' list), `crates/core/tests/settings.rs` (the new switch),
  `packages/server/src/__tests__/settings-fate.test.ts` (the refusal's new text),
  `packages/web/src/settings/sampleExtensions.ts`
- Test: `crates/core/tests/jobs.rs`, `packages/binding/contracts.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces, in the core, each with `napi(object)` as `Settings` has:

```rust
pub struct Schedule { pub kind: String, pub day: Option<u32>, pub hour: u32, pub minute: u32 }
// kind: "hourly" | "daily" | "weekdays" | "weekly"; day: 1 Monday to 7 Sunday, weekly only;
// hourly has hour 0 and minute 0.
pub struct Job {
    pub name: String, pub repositories: Vec<String>, pub schedule_text: String,
    pub schedule: Option<Schedule>, pub prompt: String, pub on: bool, pub report_only: bool,
    pub agent: Option<String>, pub model: Option<String>, pub effort: Option<String>,
    pub problem: Option<String>,
}
pub struct Jobs { pub jobs: Vec<Job>, pub problem: Option<String> }
pub struct JobInput {
    pub name: String, pub repositories: Vec<String>, pub schedule: String, pub prompt: String,
    pub report_only: bool, pub agent: Option<String>, pub model: Option<String>,
    pub effort: Option<String>,
}
pub fn read(config_dir: &Path) -> Jobs;
pub fn schedule(text: &str) -> Result<Schedule, String>;
pub fn add(config_dir: &Path, job: &JobInput) -> Result<(), ApiError>;
pub fn update(config_dir: &Path, name: &str, job: &JobInput) -> Result<(), ApiError>;
pub fn set_on(config_dir: &Path, name: &str, on: bool) -> Result<(), ApiError>;
pub fn remove(config_dir: &Path, name: &str) -> Result<(), ApiError>;
```

- Produces, in the binding: `readJobs(configDir): Promise<Jobs>`, `checkedSchedule(text): Schedule`,
  `addJob(configDir, job)`, `updateJob(configDir, name, job)`, `setJobOn(configDir, name, on)`,
  `removeJob(configDir, name)`, each a `Promise<void>` but the first two;
  `setContinue(dir, "jobs", on)`; and `Settings.runs.scheduledJobs?: boolean`.
- Produces: the built-in extension `jobs`, tenth of `BUILT_INS`, after `git`.

- [x] **Step 1: Write the failing tests**

In `crates/core/tests/jobs.rs`, with the helpers of `settings_writes.rs` copied as that file has
them:

```rust
#[test]
fn a_job_with_a_problem_is_listed_and_the_others_read() {
    // One config.toml holding: a valid "Dependencies" (daily 03:00, two repositories, a prompt of
    // three lines); "Code quality" with `schedule = "dayly 06:00"`; a second "Dependencies"; a job
    // with `repositories = []`; a job with `schedule = "daily 25:00"`.
    let jobs = jobs::read(dir.path());
    assert_eq!(jobs.problem, None);
    assert_eq!(by_name(&jobs, "Dependencies", 0).problem, None);
    assert_eq!(problem(&jobs, "Code quality"), "the schedule “dayly 06:00” is not understood");
    assert_eq!(by_name(&jobs, "Dependencies", 1).problem.as_deref(), Some("Two jobs are named “Dependencies”."));
    // "A job runs in one repository at least." and "A time is from 00:00 to 23:59." for the last two.
    // settings::read on the same file is Ok: jobs never make the settings unreadable.
}

#[test]
fn a_write_changes_its_job_alone() {
    // A file with a comment above each of two jobs, an unknown key `owner = "me"` in the first,
    // and a `[server]` table between them.
    jobs::update(dir.path(), "Dependencies", &weekly_monday_four()).unwrap();
    // The text differs from before only in the first job's `schedule` line: `"monday 04:00"`.
    jobs::set_on(dir.path(), "Dependencies", false).unwrap();   // adds `on = false` there alone
    jobs::add(dir.path(), &with_prompt("a \"\"\" b\\\nc\\")).unwrap();
    // The added job is last, and reads back with the same prompt, byte for byte.
    // add of a taken name: refused, "A job named “Dependencies” exists already."
    jobs::remove(dir.path(), "Dependencies").unwrap();          // its table and its comment go
}
```

The first test also has rows for the four schedule forms, `hourly`, `daily 03:00`, `weekdays 03:00`,
and `monday 04:00` to `sunday 04:00`, each to its `Schedule`; for `jobs = 3`, whose `Jobs.problem`
is `jobs is a list of [[jobs]] tables.` with no job; and for an inline `jobs = [{ … }]`, which reads
as a job. In `packages/binding/contracts.test.ts`, one test, "jobs read and write through the
binding": `addJob`, then `readJobs` gives the job with its `schedule` parsed, and
`setContinue(dir, "jobs", false)` gives `runs.scheduledJobs === false`.

The break each test catches:

- Listed with its problem: a bad schedule that fails the whole file, or hides the job.
- Changes its job alone: a write that rewrites the file's other tables, drops a comment, or escapes
  the prompt so it reads back changed.
- Through the binding: a field the server reads under another name.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo nextest run -p uraeda-core --test jobs`
- Expected: FAIL to compile, `unresolved import uraeda_core::jobs`

- [x] **Step 3: Implement the jobs module, the switch, and the built-in**

- `jobs.rs` reads the file's text with the settings' loader and walks the top-level `jobs` item. It
  never goes through `Settings`. A file that cannot be read or parsed gives `Jobs.problem`, the
  settings' own message, and no job.
- A job's problems, first one kept, in this order: a missing or empty `name`; a second job of a
  name, compared as written; no repository; a schedule not understood, or its time outside 00:00 to
  23:59; an empty prompt. The texts are the plan's global constraints.
- `schedule.rs` owns the four forms of the [data model](data-model.md), in lower case, hours and
  minutes on two digits.
- `write.rs` writes under the folder's lock, as `change_path` does, and refuses while the settings
  file is unreadable. `update` changes only the keys whose value differs, each keeping its comment,
  and removes `report_only`, `agent`, `model`, or `effort` when they return to their default. `add`
  appends a `[[jobs]]` table. A prompt of several lines is written as a multi-line string, and every
  prompt reads back unchanged. Writes validate as the reader does, and refuse with the same texts,
  `A job named “<name>” exists already.` for a taken name.
- `scheduled_jobs` joins `RunSettings` and its parser, and `ContinueKey` gains `Jobs`, key
  `scheduled_jobs`, named `"jobs"` in the binding.
- The manifest of `jobs`, `crates/core/extensions/jobs.toml`: title "Jobs", icon `uraeda:history`,
  scope `repository`, no server or page entry, no setting. Add it to `BUILT_INS` after `git`, and to
  the lists of `crates/core/tests/extensions.rs` and `sampleExtensions.ts`.
- Keep `settings.rs` under 500 lines: the new code lives in the new files.

- [x] **Step 4: Run the task's validation, and make the risky breaks**

- Run: `cargo nextest run -p uraeda-core`, then `vp run --filter uraeda-binding build` and
  `vp test run packages/binding/contracts.test.ts`, then `vp run fast`
- Expected: PASS
- Breaks to make once, see fail, and revert, reported in the commit's body: write the prompt as a
  one-line string without escaping; let `update` rewrite the whole table.

- [x] **Step 5: Commit**

```bash
git add crates/core crates/binding packages/binding packages/web/src/settings/sampleExtensions.ts
git commit -m "feat(scheduled-jobs): jobs in the settings file"
```

## Task 2: The skill says a job is the human's yes

**Files:**

- Modify: `skills/uraeda/references/change.md` ("Starting a change"),
  `skills/uraeda/references/projects.md` ("Starting, postponing, and dropping a feature")

**Interfaces:**

- Consumes: nothing.
- Produces: nothing code reads.

- [x] **Step 1: Write the two passages**

In `change.md`, after "Only when a human asks.": a job the human scheduled in Uraeda's settings is
their yes, given in advance, for the change its run offers. The run's message says so, and says when
the job is report only, where the offer waits as any offer. In `projects.md`, under "Do these only
when a human asks.", one sentence saying the same and linking that passage. Name no page of the web
UI: the skill holds the workflow for any agent. Leave `SKILL.md` as it is, as
[ruling R3](rulings.md) says. The templates and the example do not change: no file's format does.

- [x] **Step 2: Run the task's validation**

- Run: `cargo nextest run -p uraeda-cli --test skill`, then `vp run fast`
- Expected: PASS, `SKILL.md` still under 20,000 characters

- [x] **Step 3: Commit**

```bash
git add skills/uraeda/references/change.md skills/uraeda/references/projects.md
git commit -m "docs(scheduled-jobs): a scheduled job is the human's yes to its change"
```

## Task 3: The switch, the times, and the record of runs

**Risky:** it adds a table to the cache of sessions, through a migration.

**Files:**

- Create: `packages/server/src/jobs/times.ts`, `packages/server/src/runner/cache-jobs.ts`
- Modify: `packages/server/src/runner/migrations.ts` (a new last step),
  `packages/server/src/runner/cache.ts` (one property), `packages/server/src/settings.ts`,
  `packages/server/src/env.ts`, `packages/server/src/options.ts`,
  `packages/server/src/fate/settings-mutations.ts` (`settings.setContinue`),
  `packages/web/src/settings/settingsViews.ts` and `SettingsView.stories.tsx` (the record's
  `scheduledJobs`, [ruling R7](rulings.md))
- Test: `packages/server/src/jobs/__tests__/times.test.ts`,
  `packages/server/src/runner/__tests__/cache-jobs.test.ts`, and one row each in
  `packages/server/src/__tests__/settings.test.ts`, `env.test.ts`, and `settings-fate.test.ts`

**Interfaces:**

- Consumes: `Schedule` and `Settings.runs.scheduledJobs` from task 1.
- Produces:

```ts
// jobs/times.ts
export const MISSED_AFTER_MS = 5 * 60_000;
/** The latest scheduled time at or before `now`, in the process's local time. */
export function dueAt(schedule: Schedule, now: Date): Date;
/** The first scheduled time after `now`. */
export function nextAfter(schedule: Schedule, now: Date): Date;

// runner/cache-jobs.ts
export type JobRunRow = {
  at: number;
  due: number | null;
  id: number;
  job: string;
  outcome: "skipped" | "started";
  reason: "change-open" | "working" | null;
  refusal: string | null;
  refusedTurn: number | null;
  repository: string;
  session: string | null;
  trigger: "manual" | "schedule";
};
export class JobRuns {
  add(row: Omit<JobRunRow, "id" | "refusal" | "refusedTurn">): JobRunRow | undefined; // undefined: its `due` is recorded already
  history(job: string, repository: string): Array<JobRunRow>; // newest first, 50 at most
  latestStarted(job: string, repository: string): JobRunRow | undefined;
  ofSession(session: string): JobRunRow | undefined;
  remove(id: number): void; // a run whose session did not start
  rename(from: string, to: string): void;
  setRefusal(id: number, refusal: { text: string; turn: number } | null): void;
  setSession(id: number, session: string): void; // the session the run started
}
// SessionCache gains `readonly jobs: JobRuns`.
// ServerSettings.runs() gains `scheduledJobs: Setting<boolean>`, true by default.
// settings.setContinue takes key "jobs".
```

- [x] **Step 1: Write the failing tests**

```ts
// jobs/__tests__/times.test.ts: one table, the zone set to Europe/Paris for the file and put back
test.each([
  ["daily 03:00, at 03:00:20", daily(3, 0), "2026-11-11T03:00:20", "2026-11-11T03:00:00"],
  ["daily 03:00, at 02:59", daily(3, 0), "2026-11-11T02:59:00", "2026-11-10T03:00:00"],
  ["weekdays, on a Sunday", weekdays(3, 0), "2026-11-15T12:00:00", "2026-11-13T03:00:00"],
  ["monday 04:00", weekly(1, 4, 0), "2026-11-11T12:00:00", "2026-11-09T04:00:00"],
  ["hourly", hourly(), "2026-11-11T14:20:00", "2026-11-11T14:00:00"],
  [
    "02:30 the night the clock moves forward",
    daily(2, 30),
    "2026-03-29T12:00:00",
    "2026-03-29T03:00:00",
  ],
  [
    "02:30 the night it moves back: the first",
    daily(2, 30),
    "2026-10-25T12:00:00",
    "2026-10-25T02:30:00+02:00",
  ],
])("%s", (_name, schedule, now, due) => {
  expect(dueAt(schedule, local(now)).getTime()).toBe(local(due).getTime());
});
// nextAfter: daily 03:00 at 2026-11-10T10:00 is 2026-11-11T03:00; weekly Monday 04:00 then is 2026-11-16T04:00.

// runner/__tests__/cache-jobs.test.ts, on SessionCache.open(":memory:")
test("a time is recorded once, and the history keeps its 50 latest rows", () => {
  expect(jobs.add(run({ due: 1000 }))).toBeDefined();
  expect(jobs.add(run({ due: 1000 }))).toBeUndefined();
  for (let due = 2000; due < 2060; due += 1) jobs.add(run({ due }));
  expect(jobs.history("Dependencies", ROOT)).toHaveLength(50);
  jobs.rename("Dependencies", "Upgrades");
  expect(jobs.history("Upgrades", ROOT)[0]?.due).toBe(2059);
  expect(jobs.history("Dependencies", "/another/root")).toEqual([]);
});
```

The break each test catches:

- The times: a spring night that runs at 3:30, as JavaScript's `Date` turns 2:30 into; a weekday
  rule off by a day; the latest time taken as the next.
- The record: a time written twice, which starts two runs; a history that grows without end; rows of
  another repository.

- [x] **Step 2: Run them to check they fail**

- Run:
  `vp test run packages/server/src/jobs/__tests__/times.test.ts packages/server/src/runner/__tests__/cache-jobs.test.ts`
- Expected: FAIL, `Cannot find module '../times.ts'`

- [x] **Step 3: Implement the times, the record, and the switch**

- `times.ts` computes in local time from the schedule's fields, with `Date` alone. A local time that
  does not exist that night becomes the first minute that does: 2:30 becomes 3:00, never 3:30. A
  local time that happens twice is its first, but an hourly schedule runs in each real hour
  ([ruling R10](rulings.md)).
- The migration adds `job_runs` with the columns of the [data model](data-model.md) and of
  [ruling R1](rulings.md), `refusal` and `refused_turn`, unique on `(job, repository, due)`, an
  index with no condition: SQLite counts each null `due` as distinct, and the reads of a job and
  repository use it. `add` prunes its job and repository to the 50 latest rows, the latest started
  one with a session, and each started one whose session is in a change or a feature
  ([rulings R8 and R15](rulings.md)).
- `cache.ts` has 5 lines left: add the `jobs` property and nothing else there.
- The switch follows `catchUpPullRequests` through `options.ts`, `env.ts`, and `settings.ts`, but on
  by default: `--no-scheduled-jobs` turns it off, as `--no-continue-after-restart` does, and
  `URAEDA_SCHEDULED_JOBS` reads `true` or `false`, any other value stopping the start.

- [x] **Step 4: Run the task's validation, and make the risky break**

- Run: `vp test run packages/server/src`, then `vp run fast`
- Expected: PASS
- Break to make once, see fail, and revert, reported in the commit's body: drop the unique index.
  Done: `a time is recorded once, …` failed, as `add` returned a second row for one `due`.

- [x] **Step 5: Commit**

```bash
git add packages/server/src
git commit -m "feat(scheduled-jobs): the schedule's times, the record of runs, and their switch"
```

## Task 4: The scheduler starts runs

**Risky:** it starts agents with nobody watching, and several triggers can race.

**Files:**

- Create: `packages/server/src/jobs/scheduler.ts`, `packages/server/src/jobs/run.ts`,
  `packages/server/src/jobs/start.ts`
- Create also: `packages/server/src/serially.ts`, the catcher's `serially` moved out of
  `catch-ups.ts` so the scheduler's ticks join as its runs do ([ruling R11](rulings.md))
- Modify: `packages/server/src/runner/send-input.ts` (`SendInput`),
  `packages/server/src/runner/send.ts` (`deliver`), `packages/server/src/runner/message.ts` (the two
  lines, the note), `packages/server/src/fate/context.ts` and `packages/server/src/app.ts` (`jobs`,
  which the app's contexts carry), `packages/server/src/catch-ups.ts` (imports `serially`),
  `packages/server/src/server.ts` (`startOpened`, its stop)
- Test: `packages/server/src/jobs/__tests__/scheduler.test.ts`

**Interfaces:**

- Consumes: `readJobs` (task 1); `dueAt`, `nextAfter`, `MISSED_AFTER_MS`, `JobRuns`, and
  `settings.runs().scheduledJobs` (task 3).
- Produces:

```ts
// runner/send-input.ts: two optional fields of SendInput, for a message Uraeda sends in a chat
//   line?: string             a system line before the message, as a workflow's `line`
//   origin?: "workflow"       the item's origin; "human" when left out
// runner/message.ts
export function scheduleLine(job: string): string; // Started by the schedule “<job>”.
export function runNowLine(job: string): string; // Started by “Run now” of the job “<job>”.
export function jobMessage(job: Pick<Job, "name" | "prompt" | "reportOnly">): string;

// jobs/run.ts
export async function startRun(
  ctx: RepoContext,
  job: Job,
  run: { at: number; due: number | null; trigger: "manual" | "schedule" },
): Promise<{ session: string } | undefined>; // undefined: that time is recorded already

// jobs/scheduler.ts
export type NextRun =
  { at: Date } | { why: "agent-off" | "change-open" | "off" | "paused" | "problem" };
export type Scheduler = {
  nextRun(job: Job, repo: string, open?: ReadonlySet<string>): Promise<NextRun>; // open: R21
  runNow(repo: string, name: string): Promise<{ session: string }>; // refused: “<name>” still runs here.
  settled(): Promise<void>; // the times queued are started, skipped, or dropped
  stop(): Promise<void>;
  tick(): Promise<void>; // looks for the times due, and queues them
};
export function startScheduler(options: {
  context: (repo: string) => RepoContext;
  enabled: () => boolean; // the switch for all jobs
  every?: number | null; // ms between ticks; null: the test ticks
  isOn: (repository: string) => boolean; // the `jobs` extension, by repository name
  jobs: () => Promise<Jobs>;
  now?: () => Date;
  repos: () => Array<{ name: string; path: string }>;
  wait?: (ms: number) => Promise<void>; // the minute between runs
}): Scheduler;
// jobs/start.ts
export function startJobs(shared: Omit<RepoContext, "repo">): Scheduler; // wired in server.ts
// RepoContext gains `jobs?: Scheduler`.
```

- [x] **Step 1: Write the failing tests**

In `scheduler.test.ts`, over `testServer` and the fake agent as `catch-ups.test.ts` builds them,
with a `clock` the test moves, `every: null`, and a `wait` that records its calls:

```ts
test("a job runs at its time", async () => {
  // Dependencies, daily 03:00, in the fixture repository, agent "fake", model "fake-small".
  clock.set("2026-11-11T02:59:00");
  await scheduler.tick();
  clock.set("2026-11-11T03:00:20");
  await scheduler.tick();
  const [session] = chats(server);
  expect(session.title).toBe("Dependencies");
  expect(session.model).toBe("fake-small");
  expect(systemLines(session)).toContain("Started by the schedule “Dependencies”.");
  expect(firstMessage(session).text.startsWith(PROMPT)).toBe(true);
  expect(firstMessage(session).origin).toBe("workflow");
  // Rows: a second repository's run starts after one wait of 60_000; with the agent off there, a
  // repository not in the list, or the jobs extension off there, no session and no row.
});

test("a time nobody saw arrive is never started", async () => {
  // A scheduler first ticked at 03:02 starts nothing for 03:00, and nothing at 09:00.
  // A job added at 03:02 starts nothing before the next 03:00.
  // The switch off at 03:00 and on at 09:00: nothing; the next day at 03:00: one run.
  // A tick at 03:06 after one at 02:59: nothing, more than 5 minutes past.
  // A tick at 03:03 after one at 02:59: one run.
});

test("a time is skipped while the last run works or its change is open", async () => {
  // Monday's run still at work on Tuesday 03:00: no session, and the history's first row is
  // { outcome: "skipped", reason: "working" }.
  // Its session moved into a change still open: reason "change-open". Once merged: a run.
  // Two ticks at 03:00:10 and 03:00:40: one session. The clock set back to 02:59 then 03:00: one.
  // runNow while its run works: refused, "“Dependencies” still runs here."; with an open change: starts.
});
```

The break each test catches:

- At its time: a run on the default agent, without its line, or with the prompt as the human's own
  message, which would block the acceptance of task 5.
- Never started: a server that makes up for the times it missed, which the human refused.
- Skipped: two runs of one job at once, or a second pull request on the same files.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test run packages/server/src/jobs/__tests__/scheduler.test.ts`
- Expected: FAIL, `Cannot find module '../scheduler.ts'`

- [x] **Step 3: Implement the run's start**

`startRun` records the run's row first, with `JobRuns.add`, and stops when the time is recorded
already. It then opens a chat with `newChat` on the job's agent, model, and effort, titles it with
the job's name, sends `jobMessage` with its line and the origin `workflow`, and sets the row's
session with `JobRuns.setSession`, before the first turn starts, so the turn's end finds the row by
its session ([ruling R11](rulings.md)). When the chat does not start, it removes the row with
`JobRuns.remove`, removes the chat it made through the session manager, which reports it to the
clients, and rethrows, so the time is not marked run ([rulings R9 and R14](rulings.md)).
`jobMessage` is the prompt, then a rule, then Uraeda's note. The note says the session was started
by the scheduled job, by name, and that nobody follows it. For a job that is not report only, it
says to offer a needed code change once, as a change, then stop, since Uraeda starts it and the next
message continues in its worktree. For a report-only job, it says to change no file, and that an
offer waits for the human. Both say to answer in one line when nothing needs doing.

- [x] **Step 4: Implement the scheduler and wire it**

- A tick reads the jobs, and for each job that is on and has no problem, each repository it names
  that is listed, where the `jobs` extension is on and the job's agent is available: take
  `dueAt(schedule, now)`. Start it only when it is later than the moment this scheduler first saw
  the job on with its schedule, in memory, and at most `MISSED_AFTER_MS` past
  ([ruling R2](rulings.md)). Turning the job on, editing its schedule, or turning on the switch for
  all jobs, sets that moment to now.
- A job's start in a repository is reserved first, by the names, before anything is awaited, and
  held until the start ends, but not through the minute's wait before it, which releases it and
  takes it again as the wait ends: a tick and a "Run now" never start two, and a "Run now" during
  another job's wait starts at once ([rulings R14 and R31](rulings.md)).
- Before a start: when the latest started run's session works, record a skip, `working`. When any
  started run of the job has a session in a change or a feature the workspace still lists as not
  merged, record a skip, `change-open` ([ruling R15](rulings.md)). Both are read again right before
  each start, holding the reservation, after the minute's wait, as the run may work again or a
  change may open meanwhile. An acceptance in flight for a run of the job in the repository (task 5)
  is the job `working`, for a time and for "Run now" ([ruling R18](rulings.md)). A skip is recorded
  once per time, by the same unique row.
- A tick only queues the times due, none twice, and the queue starts them one after another: the
  first at once, each next after `wait(60_000)` from the last start, while the ticks go on; a time
  skipped or recorded waits for nothing. Right before a start the job is read again, and the time is
  dropped, recording nothing, when it no longer holds, or when the clock jumped during the minute's
  wait, as the machine sleeping does, which drops every time queued before the jump
  ([ruling R31](rulings.md)); a time a tick saw in time stays valid in the queue, however many
  minutes it waits ([rulings R14 and R17](rulings.md)). Ticks never overlap: one asked while another
  runs joins it, as `serially` does in `catch-ups.ts`.
- `runNow` starts with `due: null`, whatever the pause, the switch, or an open change, and is
  refused only while the job's latest run works there, an acceptance is opening its change, or the
  run is impossible: no prompt, no name, or a name two jobs share, in the card's words; a schedule
  that is not understood is not a reason ([ruling R23](rulings.md)).
- `nextRun` gives `nextAfter` for a job that will run, else why not, in the order of `NextRun`.
- `startJobs` builds the scheduler on the server's settings, hosts, extensions, and binding, ticking
  every 30 seconds, with an unref'd timer. `server.ts` starts it after the catcher, puts it in the
  context, and stops it with the server.

- [x] **Step 5: Run the task's validation, and make the risky breaks**

- Run: `vp test run packages/server/src`, then `vp run fast`
- Expected: PASS
- Breaks to make once, see fail, and revert, reported in the commit's body: start the session before
  recording the row; drop the "saw it arrive" check.

- [x] **Step 6: Commit**

```bash
git add packages/server/src
git commit -m "feat(scheduled-jobs): the scheduler starts each job's run at its time"
```

## Task 5: A run starts the change it offers

**Risky:** it relaxes the guard on starting a change: an agent's offer is accepted with no human.

**Files:**

- Create: `packages/server/src/runner/offers.ts`, `packages/server/src/jobs/accept.ts`
- Modify: `packages/server/package.json` (the export `./offers`), `packages/web/src/offers.ts`
  (imports the grammar), `packages/server/src/fate/session-moves.ts` (exports `toChange`),
  `packages/server/src/jobs/start.ts`, `packages/server/src/runner/status.ts`,
  `packages/server/src/runner/message.ts` (the line), the session's view in
  `packages/server/src/fate/` (`changeRefusal`: `views.ts`, `sessions.ts`, `session-reads.ts`),
  `packages/server/src/runner/sessions.ts` (`announce`) and `cache-turns.ts` (the dismissal of a
  refused turn, [ruling R12](rulings.md)), `packages/web/src/SessionAttention.tsx`, `useDismiss.ts`,
  and `views.ts`
- Test: `packages/server/src/jobs/__tests__/accept.test.ts`

**Interfaces:**

- Consumes: `JobRuns.ofSession` and `setRefusal` (task 3); `startJobs` and a run's session, whose
  first message has the origin `workflow` (task 4); `readJobs` (task 1).
- Produces:

```ts
// runner/offers.ts: moved from the web UI, unchanged
export type OfferKind = "change" | "feature";
export type Offer = { body: string; kind: OfferKind };
export function lastOffer(text: string): Offer | undefined;
export function proposalTitle(proposal: string): string;
// runner/message.ts
export function jobChangeLine(job: string, title: string): string; // The job “<job>” started the change “<title>”.
// jobs/accept.ts
export function acceptOffers(shared: Omit<RepoContext, "repo">): Accepting; // its stop, and `settled()`
export type Accepting = (() => void) & { settled(): Promise<void> };
// fate/session-moves.ts
export async function toChange(
  ctx: RepoContext,
  input: { session: string; slug?: string; text: string },
): Promise<string>;
// runner/status.ts: StatusReason gains "change-refused"; the session's view gains
//   changeRefusal: string | null
```

- [x] **Step 1: Write the failing tests**

In `accept.test.ts`, each run started by `startRun` on a fake agent scripted to end its turn on a
given text:

````ts
test("a run's offer starts its change", async () => {
  const { session } = await runEndingOn(server, DEPENDENCIES, OFFER); // ```uraeda-offer change … # Upgrade three dependencies
  await settled(server);
  const moved = server.sessions.cache.session(session);
  expect(moved?.folder).toMatch(/^\d{4}-\d{2}-\d{2}-/);
  expect(systemLines(moved)).toContain(
    "The job “Dependencies” started the change “Upgrade three dependencies”.",
  );
  // A run ending on "Nothing to upgrade.": the session keeps no folder, and `git log` and
  // `git branch` of the repository read as before the run.
});

test("an offer waits where the job or the human says so", async () => {
  // Each leaves the session without a folder, and the repository's branches unchanged:
  // a job with report_only; a human message sent to the session before the turn ends; a turn that
  // ends stopped or failed; a `feature` offer; a block left open; an offer in an earlier text of the
  // turn, its last text plain; a job deleted meanwhile; a run row of another repository.
});

test("a change that cannot start asks, with its reason", async () => {
  // The change's folder name taken: the session reads attention, reason "change-refused", and
  // changeRefusal holds the core's refusal. Dismissing the turn puts it back to idle.
});
````

The break each test catches:

- Starts its change: a job whose offer waits until morning, the proposal's whole point.
- Waits: a change started for a report-only job, after the human wrote, or from text that was not
  the run's last word, the relaxed guard's edges.
- Asks with its reason: a refused start that leaves the session reading as a plain new reply.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test run packages/server/src/jobs/__tests__/accept.test.ts`
- Expected: FAIL, `Cannot find module '../accept.ts'`

- [x] **Step 3: Move the offer's grammar to the server**

`runner/offers.ts` takes `lastOffer`, `proposalTitle`, their types, and the block's grammar from the
web UI's `offers.ts`, which imports them from `uraeda-server/offers` and keeps its page state. It
reads fences as markdown does, so a block inside an outer fence is no offer, and `endingOffer` gives
the offer a text ends on, from a fence at column 0 only ([rulings R24 and R32](rulings.md)). The web
UI's existing tests of offers keep passing, but for the one of the instructions' sample, which
unwraps the sample's own fence first.

- [x] **Step 4: Implement the acceptance and the refusal's status**

- `acceptOffers` listens to the sessions' changes, as `onSessionChange` gives them. It acts on a
  turn that ended `done`, in a session without a folder, that a run's row names for the same
  repository. The job, read now by its name, must exist, have no problem, and not be report only.
  The session must hold no message of the origin `human`, the turn must be its latest, and the run's
  row must hold no refusal: a run's offer is accepted at most once ([ruling R19](rulings.md)). The
  turn's last text, after its last call, must end on a `change` offer, by `endingOffer`: nothing but
  whitespace after its closing fence. Every check of what the human may have done meanwhile comes
  after the one wait, the read of the jobs, and acceptances go one after another
  ([ruling R12](rulings.md)).
- It then calls `toChange` with the offer's body and no slug, and, once the change started, appends
  `jobChangeLine` to the turn. A refusal is kept with `setRefusal`, its text without the `refused: `
  prefix, and the turn, and announced with `Sessions.announce`; a refusal that says the agent works,
  or one after the human wrote, is the human's path winning: nothing is kept.
- It holds the run's job busy in the repository from the turn's end until its acceptance ends
  (`jobs/busy.ts`, shared with the scheduler, [ruling R18](rulings.md)).
- `startJobs` starts it, and its stop joins the scheduler's and awaits the acceptance in flight
  (`settled()`).
- The status rule gains one case, before "waits on the human": the session's latest turn is the
  refused turn, `done`, and not dismissed, in a session without a folder. It reads "Needs
  attention", reason `change-refused`. The session's view carries the refusal's text. `toChange`
  clears the refusal once the session moved ([ruling R20](rulings.md)).
- `SessionAttention.tsx` gains its entry: a warning, the title "The change could not start by
  itself.", and the text of the refusal, then "Start it from the offer's card above, or dismiss
  this.", with Dismiss.

- [x] **Step 5: Run the task's validation, and make the risky breaks**

- Run: `vp test run packages/server/src packages/web/src`, then `vp run fast`
- Expected: PASS
- Breaks to make once, see fail, and revert, reported in the commit's body: skip the report-only
  check; skip the human-message check; read the offer from any text of the turn.

- [x] **Step 6: Commit**

```bash
git add packages/server packages/web/src
git commit -m "feat(scheduled-jobs): a job's run starts the change it offers"
```

## Task 6: The jobs' record and its writes

**Files:**

- Create: `packages/server/src/fate/jobs.ts`, `packages/server/src/fate/job-mutations.ts`,
  `packages/server/src/jobs/announce.ts`
- Modify: `packages/server/src/fate.ts`, `packages/server/src/fate/mutations.ts`,
  `packages/server/src/fate/sources.ts` (the record's source, a few lines: it has 490),
  `packages/server/src/jobs/start.ts` (announces the record),
  `packages/server/src/runner/cache-jobs.ts` (`JobRuns.onChange`),
  `packages/server/src/fate/errors.ts` and `extension-mutations.ts` (the settings write they share);
  `package.json` needs no export: the types leave through `uraeda-server/fate`
- Test: `packages/server/src/__tests__/jobs-fate.test.ts`

**Interfaces:**

- Consumes: the binding's jobs functions (task 1); `JobRuns.history` and `rename` (task 3);
  `ctx.jobs`, `Scheduler.nextRun` and `runNow` (task 4).
- Produces the record `Jobs`, id `jobs`, read on a repository's endpoint:

```ts
export type JobRunView = {
  at: string;
  due: string | null;
  folder: string | null;
  id: string;
  outcome: "skipped" | "started";
  reason: "change-open" | "working" | null;
  session: string | null;
  title: string | null;
  trigger: "manual" | "schedule";
};
export type JobRow = {
  agent: string | null;
  effort: string | null;
  history: Array<JobRunView>;
  index: number; // the job's place in the file: two jobs may share a name (R30)
  last: JobRunView | null; // the latest started run, beyond the 50 rows of `history` (R28)
  model: string | null;
  name: string;
  next: { at: string | null; text: string | null; why: string | null }; // `text`: the server's words for `agent-off` (R27)
  on: boolean;
  problem: string | null;
  prompt: string;
  reportOnly: boolean;
  repositories: Array<string>;
  schedule: Schedule | null;
  scheduleText: string;
};
export type JobsRecord = {
  enabled: boolean;
  id: string;
  jobs: Array<JobRow>;
  problem: string | null;
  timeZone: string; // the server's IANA zone, which the card's times read in (R26)
};
```

- Produces the mutations, each answering the record: `jobs.add { job: JobInput }`,
  `jobs.update { job: JobInput; name: string }`, `jobs.setOn { name: string; on: boolean }`,
  `jobs.remove { name: string }`, and `jobs.runNow { name: string }`, whose answer, the record
  `JobsRun` (a `JobsRecord` and its `session`), is a type of its own, as `ExtensionAction` is.

- [x] **Step 1: Write the failing test**

```ts
test("the jobs' record and its writes", async () => {
  // config.toml: "Dependencies" in the fixture repository and in "notes", not listed; "Elsewhere"
  // in another repository only; "Code quality" with a bad schedule.
  const record = await jobsRecord(app);
  expect(names(record)).toEqual(["Dependencies", "Code quality"]);
  expect(job(record, "Dependencies").problem).toBe("“notes” is not in Uraeda's list.");
  expect(job(record, "Code quality").problem).toBe(
    "Not running: the schedule “dayly 06:00” is not understood",
  );
  await mutate(app, "jobs.setOn", { name: "Dependencies", on: false }, ["jobs"]);
  expect(configText()).toContain("on = false");
  const ran = await mutate(app, "jobs.runNow", { name: "Dependencies" }, ["session", "jobs"]);
  expect(systemLines(ran.session)).toContain("Started by “Run now” of the job “Dependencies”.");
  // A second runNow while it works: refused, "“Dependencies” still runs here."
  // With config.toml unreadable: `problem` is the settings' message, and `jobs` is empty.
});
```

The break it catches: a job shown in a repository it does not name, a pause that never reaches the
file, or "Run now" held by the pause.

- [x] **Step 2: Run it to check it fails**

- Run: `vp test run packages/server/src/__tests__/jobs-fate.test.ts`
- Expected: FAIL, the record `Jobs` is unknown

- [x] **Step 3: Implement the record and the mutations**

- The record lists the jobs that name the endpoint's repository, in the file's order. A job's
  `problem` is the core's, a fragment (the schedule's) prefixed "Not running: " and a sentence ("Two
  jobs are named “…”.") as it is ([ruling R13](rulings.md)), else the first repository it names that
  is not listed, in the text of the global constraints. An agent that does not run the job here is
  `next.why = "agent-off"` with `next.text`, the server's words ([ruling R27](rulings.md)). `next`
  comes from `Scheduler.nextRun`, given the workspace's open folders, read once for the whole record
  ([ruling R21](rulings.md)), its `why` the code it answers (`problem`, `paused`, `off`,
  `agent-off`, `change-open`), and `history` from `JobRuns.history`, each run with its session's
  folder and title when it has them. `enabled` is the switch for all jobs.
- The mutations write through the binding, as `extension-mutations.ts` does, a file that cannot be
  read refused with its problem. A `jobs.update` that changes the name also renames the runs.
- The record is announced, on every repository's endpoint, when the settings file is read (a hand
  edit of a job changes no value), when a run's row is added, changed, or removed
  (`JobRuns.onChange`), when a run's session changes state, and after each write; also when the
  repository list changes (`Hosts.onChange`), an agent is turned on or off or found available, and a
  feature or a branch of a repository changed, as a change merged or dropped (`onWorkspaceChange`,
  [ruling R22](rulings.md)), on that repository's bus only, and only when a feature or a branch
  appeared or went, or a change some job's run started changed ([ruling R33](rulings.md)).
- Keep `sources.ts` under 500 lines: the read lives in `fate/jobs.ts`.

- [x] **Step 4: Run the task's validation**

- Run: `vp test run packages/server/src`, then `vp run fast`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/server
git commit -m "feat(scheduled-jobs): the jobs' record, their writes, and Run now"
```

## Task 7: The Jobs place

**Files:**

- Create: `packages/web/src/jobs/JobsPage.tsx`, `packages/web/src/jobs/JobCard.tsx`,
  `packages/web/src/jobs/useJobs.ts`, `packages/web/src/jobs/words.ts`,
  `packages/web/src/jobs/facts.ts`, `packages/web/src/extensions/builtins/jobs.tsx`
- Test: `packages/web/src/__tests__/job-words.test.ts`, `job-facts.test.ts`, `jobs-place.test.tsx`,
  and `routes.test.ts`, `keys-go.test.tsx` (the go key `g j`)
- Start from: `packages/web/src/jobs/JobsMockups.stories.tsx`, the stories `JobsList`,
  `JobsListPhone`, `JobsEmpty`, `JobsOff`, and `RunsSection`
- Modify: `packages/web/src/extensions/builtins/order.ts`, `places.ts`, `index.ts`,
  `packages/web/src/pages.ts`, `packages/web/src/routeTable.ts`, `packages/web/src/App.tsx`,
  `packages/web/src/extensions/routes.tsx` (the place's routes),
  `packages/web/src/settings/RunSettings.tsx`, `categories.ts`, `optimistic.ts` (the runs' switch),
  `packages/web/src/theme/icons.ts` (a clock), `packages/web/src/jobs/JobsMockups.stories.tsx` (the
  stories draw the real components)

**Interfaces:**

- Consumes: the record `Jobs` and its mutations (task 6); `settings.setContinue` with `"jobs"` (task
  3).
- Produces:

```ts
// jobs/useJobs.ts
export function useJobs(): JobsRecord; // live, as useExtensionsRecord is
export function useJobActions(): {
  add(job: JobInput): Promise<string | undefined>; // each gives the refusal, or nothing
  remove(name: string): Promise<string | undefined>;
  runNow(name: string): Promise<{ refused: string } | { session: string }>;
  setOn(name: string, on: boolean): Promise<string | undefined>;
  update(name: string, job: JobInput): Promise<string | undefined>;
};
// jobs/words.ts
export function scheduleWords(schedule: Schedule): string; // "Every day at 3:00", "Every Monday at 4:00", "Weekdays at 5:00", "Every hour"
export function whenWords(at: Date, now: Date, timeZone: string): string; // "Today at 3:00", "Tomorrow at 3:00", "Monday 16 November at 4:00", in the server's zone (R26)
// The place: id "jobs", path "/jobs", key "j", goKey "j", phoneTab "more"; a job's page at "/jobs/<name>" (any name, encoded, R29), a new one at "/jobs/new".
```

- [x] **Step 1: Build the place from the mockup**

- `JobCard.tsx` and `JobsPage.tsx` take the mockup's `JobCard` and `JobsPlace` as they are drawn,
  fed by `useJobs`: the head with the job's mark, name, "Report only", schedule in words, and
  switch; then "Next run" and "Last run" under their labels, each with its icon in its role's
  colour. The stories then import the real components (`JobsPlace`, which the story `JobsFrame`
  draws in the app's frame), over fixed `JobRow`s, so the spec's links hold.
- Next run reads, from `next`, in the scheduler's order ([ruling R27](rulings.md)): the job's
  problem, in the error colour; `Paused`; "Scheduled jobs are off"; the server's words for an agent
  that does not run it (`next.text`); "Waits for that change to close"; else the time in words
  (`jobs/facts.ts`). A problem of the job that is not the reason shows beneath, in the error colour.
  Last run reads the record's `last`, the latest started run ([ruling R16](rulings.md),
  [R28](rulings.md)): its time, then what its session or its change asks, as the sidebar's card
  names it, or "Never ran".
- The keys, in the registry, each also on the selected card's bar and by tap: Enter opens the job's
  page, `r` runs it now and opens its session, `p` pauses or resumes it, `d` deletes it after the
  shared confirmation, with the text of the global constraints, and `a` opens `/jobs/new`. A job's
  switch shows its value at once and a refusal puts it back, as the UI's optimistic writes ask
  (`specs/ui/space-and-motion.md`), so `p` twice pauses and then resumes. `j` and `k` move the
  selection. A refusal shows under its card until dealt with, never in a toast.
- The banner "Scheduled jobs are off." shows while `enabled` is false, and the file's problem shows
  in its place when the settings cannot be read.
- Register the built-in `jobs` after `git` in `order.ts`, with its place in the phone's `…`. Its
  icon is a clock, added to the app's icons.
- The Runs settings gain the switch "Run scheduled jobs", with the help text of the `RunsSection`
  story, under the catch-up's.

- [x] **Step 2: Review it in the sandbox**

- Run: `vp run sandbox`, and open Jobs with `Space j`
- Expected: the list draws as the stories do, in both themes, on a desktop and at 390 px. Every key
  of step 1 acts, and each has its tap.

- [x] **Step 3: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS, the Storybook build included in `vp run ready` later

- [x] **Step 4: Commit**

```bash
git add packages/web
git commit -m "feat(scheduled-jobs): the Jobs place"
```

## Task 8: A job's page

**Files:**

- Create: `packages/web/src/jobs/JobPage.tsx`, `packages/web/src/jobs/JobForm.tsx`,
  `packages/web/src/jobs/useJobForm.ts` (the form's values and saves),
  `packages/web/src/jobs/JobHistory.tsx`
- Start from: `packages/web/src/jobs/JobPageMockups.stories.tsx`, the stories `JobOpen`,
  `JobOpenPhone`, and `JobNew`
- Modify: `packages/web/src/App.tsx` and `pages.ts` (the two routes, `job` and `job-new`, which
  `routeTable.ts` and the extension's `OWNERS` named already), `packages/web/src/jobs/JobsPage.tsx`
  (the list opens on the job a page names), `packages/web/src/jobs/JobCard.tsx` (its `Refusal`,
  shared), `packages/web/src/jobs/JobPageMockups.stories.tsx` (the stories draw the real components)
- Test: `packages/web/src/__tests__/job-page.test.tsx`

**Interfaces:**

- Consumes: `useJobs`, `useJobActions`, `scheduleWords`, `whenWords`, and the place's routes (task
  7); `checkedSchedule` is the core's, reached through the mutations' refusals.
- Produces: nothing later tasks use.

- [x] **Step 1: Build the page from the mockup**

- The form's rows are the mockup's: Name, Prompt, Schedule, Repositories, Agent, and Report only.
  The schedule's control writes one of the data model's four forms, its time padded to two digits
  for the hour ("9:30" is sent as "09:30"). The agent's row opens the picker a new session uses, and
  "Default" removes the job's three keys.
- An existing job saves each field as it is left, or on Enter for a line, through `update`. A
  refusal shows under its field, with the server's text, and the file keeps its value. The controls
  move at once and go back on a refusal, and a change made while a save is in flight is queued as a
  patch on the latest accepted job, under the name it has then ([ruling R34](rulings.md)). A new job
  is added by "Add the job", enabled once its name and prompt are filled, with Daily at 03:00 and
  the current repository ticked. The human then lands on the list, the new job selected.
- "Run now" sits by the title, and is the phone's bottom bar's one action. It opens the run's
  session.
- The history lists this repository's rows, newest first: each run's time, then its session's or its
  change's card, as the sidebar draws it, or the line of a skipped time, in the texts of the global
  constraints, or "Its session is gone." for a started run whose change and session are in neither
  list (`jobs/runCards.ts` decides it before the card's element is made). A run by "Run now" says so
  under its card.
- A name that no job has reads as the app's page for a missing item.
- Built as: `JobPageView` and `NewJobPageView` take the job, the repositories, the agents on here,
  and their writes, so the stories and the tests draw them over fixed jobs; `JobPage` and
  `NewJobPage` read the `Jobs` record and send the writes. A rename moves the page to the new name's
  address. A refusal of the core shows under its row by its words (a name, a repository, a time, the
  schedule), and a new job's other refusal over its button. On the phone the schedule's kind and day
  are selectors, not segments ([ruling R25](rulings.md#r25-the-phones-schedule-is-two-selectors)).
  Its tests are `__tests__/job-page.test.tsx`: the form over fixed jobs, with no server.

- [x] **Step 2: Review it in the sandbox**

- Run: `vp run sandbox`, open a job, and add one
- Expected: the page draws as the stories do, in both themes, on a desktop and at 390 px, with no
  sideways scroll and every target 44 px at least on the phone. A hand edit of the sandbox's
  `config.toml` shows on the page within a second.

- [x] **Step 3: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS

- [x] **Step 4: Commit**

```bash
git add packages/web
git commit -m "feat(scheduled-jobs): a job's page, its form and its history"
```

## Task 9: The documentation and the sandbox's jobs

**Files:**

- Modify: `docs/web-ui.md` ("Settings", "Extensions", "Sessions with Claude Code and Codex", "The
  data folder"), `docs/extensions.md` (the built-ins' names), `packages/web/sandbox/seed.ts`
  (`sandboxEnv`, the config folder)
- Test: `packages/web/sandbox/__tests__/` (the row of the sandbox's environment, where it has one)

**Interfaces:**

- Consumes: the job's format (task 1), the switch's variable (task 3), the place (tasks 7 and 8).
- Produces: nothing code reads.

- [x] **Step 1: Write the documentation**

`docs/web-ui.md` gains the `[[jobs]]` table with its keys and the four schedule forms, the
`scheduled_jobs` switch with its flag and variable, and a section on jobs. The section covers the
Jobs place and its keys, what a run is, and that a time passed while Uraeda is not running is
missed. It also covers skipped times, the change a run starts and "Report only", and "Run now". The
data folder's section names the runs' record. `docs/extensions.md` adds `jobs` to the built-ins'
names, which an extension of yours cannot take.

- [x] **Step 2: Give the sandbox its jobs**

The sandbox's config folder gets a `config.toml` with two jobs naming its sample project, one of
them report only, and `sandboxEnv` sets `URAEDA_SCHEDULED_JOBS=false`, as [ruling R5](rulings.md)
says. A sandbox built before keeps working: the file is written when the folder is built, and on a
reset.

- [ ] **Step 3: Run the complete validation**

- Run: `vp run ready`
- Expected: PASS, the Storybook build included

- [ ] **Step 4: Commit**

```bash
git add docs packages/web/sandbox
git commit -m "docs(scheduled-jobs): jobs in the web UI's page, and the sandbox's sample jobs"
```
