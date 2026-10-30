# Data model: Feature state pass

The stored data that [the spec](spec.md) changes: one column of the runner's cache, the SQLite
database in Uraeda's data folder that keeps sessions, their turns, and their items. Nothing in the
repository's files changes format.

## Turn

A run of an agent in a session, in the cache's `turns` table. Only the new column and the columns it
works with are listed.

| Field          | Type            | Meaning                                                                              | Change |
| -------------- | --------------- | ------------------------------------------------------------------------------------ | ------ |
| `state`        | text            | `queued`, `running`, `done`, `failed`, or `stopped`                                  |        |
| `reason`       | text, optional  | why it ended: a failure's message, or "Stopped: the server stopped while it ran."    |        |
| `ended_at`     | ISO time, empty | when it ended                                                                        |        |
| `dismissed_at` | ISO time, empty | when the human dismissed its failure or its stop; empty while it still asks for them | New    |

A cache an older server made gains the column, empty, when the new server opens it: a past run that
asks for the human today still does, until dismissed. An older server opening a newer cache ignores
the column.
