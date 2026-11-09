# Data model: Agents catch up open pull requests with main

The stored data and file formats that [the spec](spec.md) adds or changes. Internal types are the
plan's.

## The settings file's `[runs]` table

The one TOML settings file, in the config folder, as the [settings](/specs/decisions/settings.md)
decision keeps it.

| Field                    | Type    | Meaning                                                                                          | Change |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------ | ------ |
| `catch_up_pull_requests` | boolean | Whether Uraeda starts a catch-up by itself when an open pull request falls behind; `false` unset | New    |

A file without the key reads as `false`, so nothing changes for an existing file. A flag,
`--catch-up-pull-requests`, and an environment variable, `URAEDA_CATCH_UP_PULL_REQUESTS`, set to
`true` or `false`, override it for one run, as its neighbours' do.

## A turn of the session cache

The `turns` table of the session cache, in Uraeda's data folder: a cache, never in a repository, as
the [agents](/specs/decisions/agents.md) decision asks.

| Field          | Type | Meaning                                                                                  | Change  |
| -------------- | ---- | ---------------------------------------------------------------------------------------- | ------- |
| `trigger`      | text | What sent the turn's message; gains `catch-up`                                           | Changed |
| `caught_up_to` | text | For a catch-up, the commit of the default branch it started for; null for any other turn | New     |

A migration adds the column, null on every existing turn. A cache without it, or emptied, only means
a pull request behind may be caught up once more for the same commit.
