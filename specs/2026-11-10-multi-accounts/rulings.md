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
