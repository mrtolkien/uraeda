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
