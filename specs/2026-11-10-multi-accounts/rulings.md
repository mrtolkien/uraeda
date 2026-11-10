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
