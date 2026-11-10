# Rulings: Multi-accounts management

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: A setting of invalid lines still shows its banner

- **Decision**: `ClaudeAdapter.accounts` is a `ClaudeAccounts` when the `accounts` setting has any
  non-blank line, and undefined when it has none. With no valid folder, its `list()` is empty, so
  the runner's pick, which only picks when `list()` is not empty, leaves sessions on the server's
  login and asks nothing.
- **Rationale**: spec US3 (more 2) shows a banner for a line that is no absolute path, which needs
  `problems()` to be reachable from the adapter. Task 3's first reading, "a `ClaudeAccounts` when
  the lines give a folder", hid it behind `undefined` for a setting of only invalid lines.
- **Alternatives considered**: a separate `problems` on the adapter: a second path to the same list,
  beside `Accounts.problems()`.
- **Where**: task 3 of the plan, `ClaudeAdapter` in `runner/claude.ts`.

## R2: A pick that stops waiting may pick an account not known to be signed out

- **Decision**: a folder that is not a directory is `missing` as soon as the accounts are built and
  at each refresh, before any ask. Whether an account is signed out needs its `claude auth status`,
  so when the pick's 10-second wait expires before any answer, an account not known to be signed out
  is `ready` and may be picked: the spec's "picks on what is known" says as much. The server's start
  asks usage (Task 4), so a first session usually finds answers.
- **Rationale**: review finding 1 of wave 2: a pick that timed out pinned a session to a missing
  folder. The stat of the folder itself opens no file, so SC-002 holds; the signed-out state cannot
  be known without Claude Code, and refusing a session for want of an answer would break "continue
  by itself" when `claude` is slow.
- **Alternatives considered**: treating an account never asked as unusable, and refusing the pick
  when no answer came: a slow `claude` would then refuse every first session after a start.
- **If wrong**: a session picked on a signed-out account fails its first turn in Claude Code's
  words, and keeps no account until a turn starts (R3), so its next message picks again.
- **Where**: task 3 of the plan, `ClaudeAccounts` in `runner/claude-accounts.ts`.

## R3: A session picks again until a turn of it starts

- **Decision**: `Processes.open` picks whenever no turn of the session ever started and its runtime
  lists accounts, even with an account already stored: the session keeps its account from its first
  started turn on. A session whose turns all started before accounts existed stays on the server's
  login, as before. The stored account is then a last pick, not a promise.
- **Rationale**: the spec's assumption says the pick happens at the first turn "so it uses the usage
  of that moment". A first message taken back during the pick's wait, or a process that failed to
  open, left the pick stored: hours later the real first turn ran on an account that may be used up
  (review finding 2 of wave 2). "A session MUST keep the account it started on" holds, as a session
  that never started has none yet.
- **Alternatives considered**: clearing the stored account in the take-back and the failure paths:
  two more places to keep in step, and a crash between the pick and the clear would still leave it.
- **Where**: task 2 of the plan, `Processes.open` in `runner/processes.ts`.

## R4: A usage that read windows makes the account ready, whatever the status said

- **Decision**: an ask combines its `claude auth status` and its `get_usage` request: signed out
  wins; else the account is `ready`, with the windows when the usage gave a five-hour window, even
  when the status said nothing (a non-JSON line, a timeout). It rejects, keeping the account as it
  was, only when the status said nothing and the usage gave no windows.
- **Rationale**: only a signed-in account's `get_usage` gives a five-hour window (discovery), so the
  windows prove it, and dropping them for a status line that failed to parse, such as an update
  notice, would unknow an account whose usage was read. Review finding 4 of wave 2 runs the two at
  once, which needs this rule where the old order had none.
- **Where**: task 3 of the plan, `claudeAsk` in `runner/claude-accounts.ts`.

## R5: The accounts' records and their refresh live in `account-records.ts`

- **Decision**: `Sessions.accounts` and `Sessions.refreshAccounts` stay the plan's names, and
  delegate to `accountRecords` and `AccountRefresh` in `runner/account-records.ts`. A refresh is not
  started while one of the same accounts is in flight, and announces only when the runtime's records
  differ from before its ask.
- **Rationale**: `sessions.ts` was at 473 lines, and the plan's methods would pass 500. One ask in
  flight per runtime means an answer is announced once, however many pages read meanwhile.
- **Alternatives considered**: comparing against the last announced records, which a report's own
  announce makes stale.
- **Where**: task 4 of the plan.

## R6: The session's data view carries `account`; a used-up window's words are red

- **Decision**: `sessionDataView` in `packages/server/src/fate/views.ts` gains `account: true`,
  which Task 4 left off its record's type, so the web's `Session` had no `account` to read. A usage
  window with nothing left draws its words in the error colour, besides its bar's error variant.
- **Rationale**: the web views read `Session` through the data view, so the header and the rail's
  bar need the field there. A used-up week has a zero-width fill, so the bar's error colour shows
  nothing, while US3 says Home shows it "at 0% in the error colour".
- **Alternatives considered**: a minimum fill on an empty bar, which would read as some left.
- **Where**: task 5 of the plan, `fate/views.ts` and `UsageWindow.tsx`.

## R7: `askedAt` says when, `known` says whether

- **Decision**: `Account.askedAt` is when the account's windows were last read, null while never,
  and stays after an ask that could not read them. `Account.known` is false while the usage was
  never read and while its last ask could not read it. The pick ranks `!known` last; the merge with
  the running processes' reports (R8) reads `askedAt` as the age of the windows it keeps.
- **Rationale**: `askedAt` meant both "when the windows were read" and "the usage is known", and
  findings 1 and 2 of wave 3 (and the same family in waves 1 and 2) came back from that: a failed
  ask nulled the time, so an older report beat a newer successful read, and a report's time made a
  stale account look known.
- **Alternatives considered**: a second field `lastAskFailed`: the same two facts, with the name of
  the one the pick wants least.
- **Where**: task 1 of the plan, `Account` in `runner/adapter.ts`; `ClaudeAccounts`, `FakeAccounts`,
  `pickAccount`, `docs/extensions.md`.

## R8: The merge works window by window, on the ask's windows, and a closed process's report stays

- **Decision**: `accountUsage` takes, for each window the ask gave, the freshest of the ask (at the
  account's `askedAt`, even after a failed ask) and the account's reports (at their `at`; a tie goes
  to the ask). A report never adds a window: the first window is always the five hours, and an
  account whose ask never read windows stays unknown, its reports set aside. The account is `known`
  when its ask's usage is, or when a report of its first window is newer than its windows. The
  expiry (`{ used: 0, resetsAt: null }`) is applied in the merge, so `Processes` keeps an account's
  report once expired, and keeps each account's latest report of each window after its process
  closed, until an ask newer than it makes it moot, dropped as `reports()` reads (also when the
  account is no longer listed). Reports of no account keep today's rules: unexpired, dropped as
  their process closes.
- **Rationale**: findings 1, 2, 3 of wave 3 and the Codex findings 1 and 2: a report-only account's
  week sat at the first index and was read as its five hours; a failed ask lost the time of its
  windows, so any older report overrode it; an exiting process dropped the usage its turn had just
  burned, and nothing asked again within the minute; an expired report was deleted before it could
  count as read.
- **Alternatives considered**: reports adding windows to an account never read, which was the
  report-only index bug's source, and a report-only usage is no basis for a pick that must know the
  week.
- **Where**: tasks 1 and 4 of the plan, `accountUsage` in `runner/account-usage.ts` and
  `Processes.reports` in `runner/processes.ts`.

## R9: One timer announces the next reset of an account's window

- **Decision**: `AccountRefresh` arms one timer at the earliest future `resetsAt` among every
  runtime's account windows, as the records give them (an expired window's reset is already null).
  It announces the records when it fires, and is armed again at each announce (the agent's record,
  or a process's report) and at each read of `refreshAccounts`. It is cleared when the sessions
  close. A process's report keeps its own timer in `Processes`, for the usage of no account.
- **Rationale**: finding 4 of wave 3: an asked window's expiry applied only when something read the
  records, so Home and the sidebar kept "0% left" and the old next account until an unrelated read.
- **Alternatives considered**: one timer per window: many timers, and each needs clearing when an
  ask moves its reset.
- **Where**: task 4 of the plan, `AccountRefresh` in `runner/account-records.ts`.

## R10: Every ask goes through one refresher, and announces through a narrow path

- **Decision**: the pick's ask and the pages' both go through `AccountRefresh.refresh(runtime)`: it
  shares the ask in flight, and when the runtime's account records or problems differ after it,
  announces the agent's record (`options.onChange({ agent: true })`) and calls
  `runtimes.accountsChanged()`, which the Extensions host listens to through `runtimes.onAccounts`.
  It does not call `runtimes.changed()`, whose listener in `Sessions` asks every runtime's version
  and the continuer's `agentBack`. An ask not settled within `PICK_WAIT_MS` stops blocking its
  runtime, and still announces its answer if it comes. A refresh that asked nothing announces
  nothing. Every announce of the agent's record, a process's report included, arms the next reset
  timer (R9).
- **Rationale**: findings 5, 6, 7 of wave 3: the pick's own ask changed records with no announce;
  each usage change ran the versions of every runtime; and one hanging `refresh` froze its runtime's
  usage until a reload.
- **Alternatives considered**: announcing each account as its own answer lands, which needs a
  callback in the `Accounts` contract that every extension runtime would implement: finding 7's
  second scenario (default and b answer in a second, c times out at ten, the announce comes at ten)
  is bounded by the wait, not removed. Claude Code's own asks time out at 10 seconds as well.
- **If wrong**: a slow account delays the whole runtime's announce by at most `PICK_WAIT_MS`; add
  `onChange` to `Accounts` then.
- **Where**: task 4 of the plan; `AccountRefresh` in `runner/account-records.ts`,
  `Runtimes.onAccounts` in `runner/runtimes.ts`, `ExtensionsHost.start` in `extensions/server.ts`,
  `Processes.#pick`.
