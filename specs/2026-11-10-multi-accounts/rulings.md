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
