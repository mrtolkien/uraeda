# Data model: Redesign feature and change pages

The stored data that [the spec](spec.md) adds. No workflow file changes format: the stages and
figures are read from git and the existing files. Internal types are the plan's.

## Turn

A turn of a session, in the runner's cache, `runner.sqlite`, on the user's machine only. One
migration adds the token counts of the turn's own work, the agent's sub-agents included. A turn
recorded before the migration has none.

| Field                | Type            | Meaning                                                             | Change                    |
| -------------------- | --------------- | ------------------------------------------------------------------- | ------------------------- |
| `id`                 | integer         | the turn                                                            |                           |
| `session_id`         | text            | its session, one per feature                                        |                           |
| `kind`               | text            | `workflow`, `chat`, or `allow`                                      |                           |
| `trigger`            | text            | what started a workflow run: `answers`, `approval`, `comments`, ... | Changed: `comments` added |
| `step`               | text            | the feature's step when it started                                  |                           |
| `state`              | text            | `queued`, `running`, `done`, `failed`, or `stopped`                 |                           |
| `started_at`         | text            | when it started                                                     |                           |
| `ended_at`           | text            | when it ended                                                       |                           |
| `input_tokens`       | integer or null | fresh input the model read                                          | New                       |
| `cache_write_tokens` | integer or null | input the model read and wrote to its cache                         | New                       |
| `cache_read_tokens`  | integer or null | input read back from the cache                                      | New                       |
| `output_tokens`      | integer or null | what the model wrote                                                | New                       |

A null count means the agent reported none for this turn: a turn before the migration, a stopped
process, or an agent that reports no usage. The page counts "in" as `input_tokens` plus
`cache_write_tokens`, and leaves `cache_read_tokens` out. All four are kept, for the benchmarks to
come.
