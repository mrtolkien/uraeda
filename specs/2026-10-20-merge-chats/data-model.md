# Data model: Merge chats and changes

The stored data and file formats that [the spec](spec.md) adds or changes. Internal types are the
plan's.

## Session

A row of the server's session cache, `runner.sqlite` in Uraeda's data folder. Sessions stay a cache,
never workflow state ([agents decision](../decisions/agents.md)).

| Field         | Type          | Meaning                                                                | Change                                                                           |
| ------------- | ------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `folder`      | text, or null | The change's or feature's dated folder; null for a session without one | Changed: several sessions may share one; set once, from null, on a move up       |
| `native_id`   | text          | The agent's own session id, which `--resume` reopens                   | Changed: no longer replaced for a fresh step, which starts a new session instead |
| `title`       | text          | Its name, from its first message, or the one you gave it               | Changed: renamable for every session                                             |
| `seen_at`     | time, or null | When you last read its page                                            | Changed: a session is done once it is later than its last message                |
| `archived_at` | time, or null | When you archived it                                                   |                                                                                  |

A change's folder name does not change when it becomes a feature, so its sessions' `folder` stays.

## Offer block

A fenced code block in an agent's message, which the session page draws as a card, and any other
reader reads as text.

| Part        | Type     | Meaning                                                                            | Change |
| ----------- | -------- | ---------------------------------------------------------------------------------- | ------ |
| info string | text     | `uraeda-offer change` or `uraeda-offer feature`                                    | New    |
| body        | Markdown | For a change, its proposal, `# Title` first; for a feature, the reason, a sentence | New    |

## A change that becomes a feature

| Item              | Before                                      | After                               | Change  |
| ----------------- | ------------------------------------------- | ----------------------------------- | ------- |
| Branch            | `change/YYYY-MM-DD-<slug>`                  | `YYYY-MM-DD-<slug>`                 | Changed |
| Folder            | `specs/changes/YYYY-MM-DD-<slug>/`          | `specs/YYYY-MM-DD-<slug>/`          | Changed |
| Worktree          | `.worktrees/YYYY-MM-DD-<slug>/`             | the same                            |         |
| **Now** entry     | links `/specs/changes/<folder>/proposal.md` | links `/specs/<folder>/proposal.md` | Changed |
| Decisions applied | `active`, approved for the change           | `proposed`, for the feature's spec  | Changed |

## Item settings

Per repository, in Uraeda's data folder, the name and colour given to a change's or a feature's
card.

| Field   | Type          | Meaning                        | Change                                                |
| ------- | ------------- | ------------------------------ | ----------------------------------------------------- |
| `label` | text, or null | The card's name                |                                                       |
| `color` | text, or null | The stripe at the card's start | Removed: ignored once read, dropped at the next write |
