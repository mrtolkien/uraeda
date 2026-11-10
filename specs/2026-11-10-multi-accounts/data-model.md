# Data model: Multi-accounts management

The stored data and file formats that [the spec](spec.md) adds or changes. Internal types are the
plan's.

## The Claude extension's settings

The `[extensions.claude]` table of `config.toml`, in Uraeda's config folder.

| Field      | Type            | Meaning                                                                                                                                                        | Change |
| ---------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `command`  | string          | The command sessions run.                                                                                                                                      |        |
| `accounts` | list of strings | The Claude Code configuration folders new sessions pick between, in the order they show. Each is an absolute path, or starts with `~/`. Empty by default: off. | New    |

```toml
[extensions.claude]
accounts = ["~/.claude", "~/.claude-b", "~/.claude-c"]
```

## A session

A row of the `sessions` table, in the sessions' cache of Uraeda's data folder.

| Field     | Type           | Meaning                                                                                                                                                                  | Change |
| --------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| `agent`   | text           | The runtime the session runs on.                                                                                                                                         |        |
| `model`   | text, or empty | The model picked for it.                                                                                                                                                 |        |
| `account` | text, or empty | The folder of the account it runs on, as an absolute path, set at its first turn. Empty for a session started with no account listed: it runs on the server's own login. | New    |
