# Data model: Scheduled jobs

The stored data and file formats that [the spec](spec.md) adds or changes: the jobs in
`config.toml`, a switch in its `[runs]` table, and the record of each job's runs in Uraeda's data
folder. Internal types are the plan's.

## A job, in `config.toml`

Each job is one `[[jobs]]` table of the settings file, written by hand or by the Jobs page, which
keeps comments, unknown keys, and order.

```toml
[[jobs]]
name = "Dependencies"
repositories = ["uraeda", "notes"]
schedule = "daily 03:00"
agent = "claude"
model = "opus"
effort = "high"
prompt = """
Upgrade the dependencies of the Rust and the pnpm workspaces to their latest versions.
Run `vp run ready`, and fix what the upgrade breaks.
"""
```

| Field          | Type                    | Meaning                                                     | Change |
| -------------- | ----------------------- | ----------------------------------------------------------- | ------ |
| `name`         | text, unique among jobs | the job's name, shown on its page and in its runs' sessions | New    |
| `repositories` | list of names           | the repositories of Uraeda's list it runs in, one at least  | New    |
| `schedule`     | text, see below         | when it runs, in the server's local time                    | New    |
| `prompt`       | text, not empty         | what each run is asked                                      | New    |
| `on`           | boolean, `true` unset   | whether it runs at its times                                | New    |
| `report_only`  | boolean, `false` unset  | whether a change its run offers waits for the human         | New    |
| `agent`        | text, optional          | the runtime its runs start on; unset, a new chat's          | New    |
| `model`        | text, optional          | a model the agent lists; unset, the agent's default         | New    |
| `effort`       | text, optional          | an effort the model takes; unset, the model's default       | New    |

A schedule is one of four forms, in lower case, its time on 24 hours:

| Form             | Example          | Runs                                         |
| ---------------- | ---------------- | -------------------------------------------- |
| `hourly`         | `hourly`         | at minute 0 of every hour                    |
| `daily HH:MM`    | `daily 03:00`    | every day at that time                       |
| `weekdays HH:MM` | `weekdays 03:00` | Monday to Friday at that time                |
| `<day> HH:MM`    | `monday 04:00`   | that day of every week, `monday` to `sunday` |

A table that fails a rule above is a job with a problem: it is listed with the problem, and does not
run. The first rule it fails is its problem, in this order: a name, a name of its own, a repository,
a prompt, a key of the wrong type, then the schedule. The schedule's problem comes last, so it hides
none of the others. Of two jobs with one name, the second has the problem, and no write by that name
is made: the write is refused with "Two jobs are named “<name>”. Rename one in config.toml." until
one is renamed by hand.

## The `[runs]` table

| Field            | Type                  | Meaning                                         | Change |
| ---------------- | --------------------- | ----------------------------------------------- | ------ |
| `scheduled_jobs` | boolean, `true` unset | whether jobs start at their times, for all jobs | New    |

It resolves as every setting does: `--no-scheduled-jobs`, else `URAEDA_SCHEDULED_JOBS` set to `true`
or `false`, else the file, else on.

## A job's runs, in the data folder

One row per time a job was due in a repository, or was run by hand, in `runner.sqlite`, the cache of
sessions. A cache that cannot be read starts empty: the history is lost.

| Field        | Type                              | Meaning                                                              | Change |
| ------------ | --------------------------------- | -------------------------------------------------------------------- | ------ |
| `job`        | text                              | the job's name                                                       | New    |
| `repository` | path                              | the repository's main checkout                                       | New    |
| `due`        | time, or null                     | the scheduled time it answers; null for "Run now"                    | New    |
| `at`         | time                              | when it started, was skipped, or failed to start                     | New    |
| `trigger`    | `schedule` or `manual`            | at its time, or by "Run now"                                         | New    |
| `outcome`    | `started`, `skipped`, or `failed` | whether a session started, the time was skipped, or its start failed | New    |
| `reason`     | `working`, `change-open`, or null | why it was skipped                                                   | New    |
| `error`      | text, or null                     | why a scheduled start failed, for `failed`                           | New    |
| `session`    | session ID, or null               | the session it started, which leads to the change it began           | New    |

- A scheduled time runs once: a server that restarts within its minute finds its row.
- A scheduled start that fails, because the agent or the model it names cannot open a session, is
  recorded once as `failed`, with its `error`, and is not tried again: the history lists it, and the
  card's last run says it while it is the newest run. A failed "Run now" records nothing.
- The history keeps the 50 latest rows of each job and repository, and besides them the latest
  `started` one that has a session, and every `started` one whose session is in a change or a
  feature, which the open-change check and the offer's acceptance read
  ([R8](rulings.md#r8-pruning-keeps-the-latest-started-run), [R15](rulings.md)), and the latest
  `failed` one while no `started` one with a session is newer, which the card's last run shows
  ([R55](rulings.md)).
- A job renamed on its page keeps its rows under the new name. Renamed by hand, it starts a new
  history.
