# Data model: Session and New in the terminal look

The stored data that [the spec](spec.md) adds or changes. Internal types are the plan's.

## Thought item

A line of a turn in the runner's cache, beside its messages, texts, and tool calls
([`Item`](/packages/server/src/runner/events.ts)). The cache is not workflow state: a reset loses
nothing durable.

| Field        | Type    | Meaning                                                               | Change |
| ------------ | ------- | --------------------------------------------------------------------- | ------ |
| `kind`       | text    | `thought`                                                             | New    |
| `durationMs` | integer | How long the agent thought, from its block's start to its next event  | New    |
| `text`       | text    | The thinking text, when the harness gives one; absent for Claude Code | New    |
| `parent`     | text    | The sub-agent that thought it, as a tool call has                     | New    |
