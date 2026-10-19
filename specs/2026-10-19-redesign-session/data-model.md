# Data model: Redesign session

The stored data and file formats that [the spec](spec.md) adds or changes. Internal types are the
plan's.

## Turn

A row of the `turns` table in the server's cache, `runner.sqlite`, and the `Turn` record fate
serves. Allowing blocked actions together makes one turn hold several rules.

| Field     | Type          | Meaning                                                                                                                         | Change                                                                                  |
| --------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `allowed` | text or empty | The allow rules the agent's process was reopened with for this turn, one per line. A turn of one allowed action holds one line. | Changed: several lines. Rows written before keep their one rule, which reads unchanged. |

No migration: the column stays text. A command that holds a line break has no rule, as one with a
`*` has none today, so every stored line is one rule.
