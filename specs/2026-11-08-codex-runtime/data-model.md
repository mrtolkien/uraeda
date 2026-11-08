# Data model: Codex runtime + model settings

The stored data and file formats that [the spec](spec.md) adds or changes. Internal types are the
plan's.

## Session

A row of the `sessions` table in Uraeda's session cache, `<data folder>/sessions.db`. Rows written
before the feature read as sessions on the agent's defaults: their new fields are null.

| Field        | Type          | Meaning                                                                                                       | Change  |
| ------------ | ------------- | ------------------------------------------------------------------------------------------------------------- | ------- |
| `agent`      | text          | The runtime the session runs on, by its registered name: `claude`, `codex`                                    |         |
| `native_id`  | text          | The agent's own session ID; for Codex, the thread ID Codex gave at the session's first start                  | Changed |
| `model`      | text, or null | The model picked when the session started, by the agent's ID for it; null for the agent's default             | New     |
| `effort`     | text, or null | The effort picked when the session started, or changed since, by the agent's ID; null for the agent's default | New     |
| `ran_model`  | text, or null | The model the agent last reported running on, by its name for people; null before the agent reports one       | New     |
| `ran_effort` | text, or null | The effort the agent last reported running on, by its name for people; null when it reports none              | New     |

## The `codex` built-in extension

Its manifest, `crates/core/extensions/codex.toml`, beside Claude Code's, and its table in
`config.toml`, which the settings page writes as for any extension.

| Field                 | Type              | Meaning                                                                        | Change |
| --------------------- | ----------------- | ------------------------------------------------------------------------------ | ------ |
| `name`                | text              | `codex`, the name its sessions store as their `agent`                          | New    |
| `title`               | text              | "Codex"                                                                        | New    |
| `icon`                | text              | `uraeda:harness-openai`, the mark Codex already has                            | New    |
| `settings.command`    | text              | The command sessions run, `codex` by default                                   | New    |
| `on` in `config.toml` | `"all"` or a list | Where it is on: every repository when the table is absent, as for any built-in | New    |

## A runtime's model list

What a runtime gives the server, through the extension API's runtime contract, and the server keeps
in memory for the picker: never stored.

| Field                  | Type                   | Meaning                                                     | Change |
| ---------------------- | ---------------------- | ----------------------------------------------------------- | ------ |
| `models`               | list of models         | The models the agent lists for the account, in its order    | New    |
| `models[].id`          | text                   | The agent's ID, which a session stores as `model`           | New    |
| `models[].name`        | text                   | Its name for people                                         | New    |
| `models[].description` | text, optional         | The agent's line about it                                   | New    |
| `models[].efforts`     | list of `{ id, name }` | The efforts it takes, in the agent's order; empty for none  | New    |
| `defaults.model`       | text, optional         | The model the agent runs on when none is picked, by its ID  | New    |
| `defaults.effort`      | text, optional         | The effort the agent runs on when none is picked, by its ID | New    |
