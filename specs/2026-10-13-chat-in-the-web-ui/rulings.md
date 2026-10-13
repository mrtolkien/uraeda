# Rulings: Chat in the web UI

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: `sessions.pid` is the server that holds the session's process

- **Decision**: the `pid` column of `sessions` holds the pid of the server process that keeps the
  session's agent process open, not the agent's own pid. A server claims a session before opening
  its process, and releases it when the process closes.
- **Rationale**: the claim must keep one live process per session across servers sharing the cache,
  as the runs' claim did by the server's pid (commit `6f6cebb`). The adapter does not expose a pid,
  and pi-durable has none.
- **Alternatives considered**: the agent's pid, which an in-process agent cannot give; a `pid` on
  each turn, as runs had, which cannot guard the idle process between turns.
- **If wrong**: a second server could open a second process on one session; the column is renamed in
  a later migration.
- **Where**: task 3, `cache.ts`; task 6, `sessions.ts`.

## R2: Search is a record keyed by its query, not live

- **Decision**: the sidebar reads `SessionList` (`all`), kept live, and a search reads
  `SessionSearch` with the query as its ID, read again as the query changes, 200 ms after typing
  stops, and not live.
- **Rationale**: fate's sources read records by ID; message text is only in the cache, so the server
  must search it. Live updates cannot know which queries are open.
- **Alternatives considered**: filtering `SessionList` in the browser, which cannot see message
  text; a live search record per query, which the publisher cannot address.
- **If wrong**: a search result's status can lag until the query changes; the list without a query
  stays live.
- **Where**: task 7, `fate/sessions.ts`; task 9, `SessionNav.tsx`.

## R3: Allowing an action is a turn of its own kind

- **Decision**: "Allow and retry" adds a turn of kind `allow`, holding the rule in `allowed`, whose
  message is the retry message, after reopening the process with the rule.
- **Rationale**: the transcript shows why the process was reopened, and the rule is kept with the
  turn that used it, as runs kept `allowed`.
- **Alternatives considered**: a chat turn with the rule on the session, which would outlive its
  process in the cache.
- **If wrong**: the transcript marks it "Allowed: <rule>" instead of a chat message; nothing else
  depends on the kind.
- **Where**: task 6.

## R4: The buttons that hand over say they start the agent

- **Decision**: "Commit and start the agent", "Approve and start the agent", "Request changes and
  start the agent", and "Start the feature and the agent"; the composer's Send reads "Start the
  agent" while it holds the workflow's message.
- **Rationale**: the spec review's C2 asked to drop "continue", and the priorities' scratchpad asks
  every button starting an agent to be extremely clear. "Start the agent" is already the feature
  page's button.
- **Alternatives considered**: "… and open the session", which hides that the agent will run; "… and
  continue the session", which keeps "continue".
- **If wrong**: the labels are props of `CommitActions`' callers, changed in one place each.
- **Where**: task 10.

## R5: Claude Code 2.1.296 takes the session's messages on stdin, and takes one back

- **Decision**: Claude sessions declare `takeBack: true`. A queued message is taken back with
  `{"type":"control_request","request_id":<id>,"request":{"subtype":"cancel_async_message","message_uuid":<uuid>}}`,
  which answers `{"cancelled":true}` in a `control_response` and prints a `command_lifecycle`
  `cancelled` for that uuid, while the running turn goes on.
- **Rationale**: `validate-claude.ts` ran against Claude Code 2.1.296, with `--model haiku` in an
  empty temporary folder, and every check passed:

  | Check          | Result | Seen                                                                                                                                                                                |
  | -------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `two turns`    | PASS   | two messages 3 s apart, one process, each ends with a `result` of the same `session_id`                                                                                             |
  | `partial text` | PASS   | `stream_event` lines whose `event.type` is `content_block_delta` and `event.delta.type` is `text_delta`, the text in `event.delta.text`                                             |
  | `steer`        | PASS   | a `"priority":"next"` message, written during `sleep 5`, is `started` once the tool ends, answered in the same turn, and one `result` ends both                                     |
  | `queue`        | PASS   | a `"priority":"later"` message gets a turn and a `result` of its own after the first                                                                                                |
  | `lifecycle`    | PASS   | `command_lifecycle` lines, `{"command_uuid","state"}`, go `queued`, `started`, `completed`, or `cancelled`                                                                          |
  | `take back`    | PASS   | `cancel_queued_message` is refused, "Unsupported control request subtype"; `cancel_async_message` works                                                                             |
  | `interrupt`    | PASS   | `{"subtype":"interrupt"}` ends the turn within 15 ms with a `result`; the process answers the next message                                                                          |
  | `sub-agent`    | PASS   | the sub-agent's `assistant` and `user` lines carry `parent_tool_use_id`, equal to the `Task` tool call's id (`init` lists `Task`, not `Agent`); the main agent's lines carry `null` |
  | `resume`       | PASS   | after stdin closes, `-p --resume <id>` answers with a word given in the first turn, under the same `session_id`                                                                     |

  The lines seen: `assistant`, `user`, `result` (`success`, `error_during_execution`),
  `stream_event` (`message_start`, `content_block_start`, `content_block_delta`,
  `content_block_stop`, `message_delta`, `message_stop`), `command_lifecycle`, `control_response`,
  `rate_limit_event`, and `system` (`init`, `status`, `hook_started`, `hook_response`,
  `task_started`, `task_progress`, `task_updated`, `task_notification`, `thinking_tokens`,
  `background_tasks_changed`). The six earlier checks of the script passed too.

  What the adapter must know:
  - An interrupted turn's `result` has `subtype` `error_during_execution`, `is_error: true`,
    `terminal_reason` `aborted_streaming`, an `errors` entry starting with `[ede_diagnostic]`, and
    no `result` field: it is a stop, not an error.
  - A `result` lists the uuids it answered in `user_message_uuids`. Two `later` messages queued
    during one turn were answered together, in one turn with one `result`.
  - `system` `init` is printed again at the start of every turn, not only once per process.
  - `total_cost_usd` on a `result` is the process's total so far, not the turn's.
  - `{"subtype":"interrupt","cancel_queued":true}` also cancels the queued message, answering
    `{"still_queued":[],"cancelled":[<uuid>]}`, but stops the running turn: it is a Stop, not a
    take-back. It was tried by hand only, since the script stops at the first request that works.

- **Alternatives considered**: `cancel_queued_message`, which this version refuses; `interrupt` with
  `cancel_queued`, which stops the turn too; `takeBack: false`, which no failed check called for.
- **If wrong**: `cancel_async_message` is not in Claude Code's public docs, and a later version may
  drop it: the script's `take back` check then fails, and Claude sessions declare `takeBack: false`.
- **Where**: task 1, `validate-claude.ts`; task 5, `claude.ts`.
