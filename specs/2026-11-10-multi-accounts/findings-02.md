---
reviewed: wave 2
commits: 31a531c41e50a804241b99ef7e58d16149c17d78..1e24b9069b52c03e114ff353b7b44ecc7df8aa40
---

# Findings: Multi-accounts management: auto rotation between multiple claude logins, wave 2

## Claude Code · Fable 5.2

10 findings, most severe first:

1. `packages/server/src/runner/claude-accounts.ts:251`: An account never asked starts as `ready`, so
   a pick that times out, or whose ask rejects, can pin a new session forever to a signed-out or
   missing folder.

   Failure scenario: Server just started, accounts = [~/.claude-gone (missing), ~/.claude-b (signed
   out), ~/.claude-c (fine)]. The first session's turn starts; the `claude auth status` and
   `get_usage` processes take over 10 s on a loaded machine (or `signedOut` rejects on its own
   timeout, which `#refreshOne` swallows). `accountFor` gives up at PICK_WAIT_MS, `pickAccount` sees
   three `ready` accounts with `askedAt: null` and returns the first listed. `#pick` stores
   `~/.claude-gone` on the session, which keeps it forever, so every turn fails. This breaks US3 'An
   account that is signed out, or whose folder is missing, is never picked', and the 'No Claude Code
   account is signed in' refusal is never produced in that case. The `existsSync` check is cheap and
   synchronous but only runs inside the slow ask.

2. `packages/server/src/runner/processes.ts:200`: The pick is stored before the process opens and
   before the turn starts, so a first turn that never starts still fixes the account.

   Failure scenario: A queued first message reaches `#prepare`, `open` picks `b` and writes it; the
   user takes the message back during the wait (the `live.queue[0] !== queued` branch in turns.ts),
   or `adapter.open` throws. No turn has `startedAt`, yet `row.account` is `b`. Hours later the real
   first turn starts with `b` at 95% and `c` at 0%: `row.account ?? ...` short-circuits and it runs
   on `b`. The spec assumption says the pick happens at the first turn 'so it uses the usage of that
   moment'.

3. `packages/server/src/runner/claude.ts:361`: `models()` always runs in `folders[0]`, even when
   that first listed folder is missing or signed out.

   Failure scenario: accounts = [~/.claude-old (deleted or signed out), ~~/.claude-b (fine)].
   Sessions correctly pick `b`, but `models()` spawns `claude -p` with
   CLAUDE_CONFIG_DIR=~~/.claude-old. Claude Code creates a config in the missing folder (discovery:
   an empty folder 'gets its own .claude.json') and `list_models` fails or answers for no login. The
   runtime's model list is then empty or errored for every session although a usable account exists.
   The first `ready` account should be used, falling back to the first listed.

4. `packages/server/src/runner/claude-accounts.ts:206`: Each ask runs `claude auth status` and then
   the `get_usage` process one after the other, each with its own 10 s timeout, against a 10 s pick
   budget.

   Failure scenario: A cold `claude` start of 3–5 s per process makes one account's ask take 6–10 s
   (worst case 20 s), and all accounts are asked at once. The pick's wait then regularly expires
   before any usage arrives, so the first session after a start picks on unknown usage (the first
   listed) instead of the account with the most left, breaking SC-001 in practice. Running the two
   concurrently would halve this; discovery also notes `get_usage` itself says when a folder is
   signed out (`rate_limits_available: false`).

5. `packages/server/src/runner/claude-accounts.ts:173`: `signedOut` runs `claude auth status` with a
   bare `execFile` in the server's cwd, unlike every other short process, which goes through
   `spawnGrouped` from `homedir()`.

   Failure scenario: The server is started from inside a repository, so `claude auth status` runs
   there and loads that project's `.claude` settings and hooks, while `get_usage` and `models()` run
   from home. On timeout, `execFile` sends SIGTERM to the direct child only, so helpers spawned by a
   wrapper `command` are left running, once per account per minute. `spawnGrouped` and
   `endShortProcess` already exist in child.ts for this.

6. `packages/server/src/runner/claude-accounts.ts:303`: A rejected ask keeps the account's previous
   state, so a stale `missing` or `signed-out` survives, and the failed attempt still counts against
   the one-ask-a-minute throttle.

   Failure scenario: `b` is signed out; the user signs it in from a terminal. The next ask's
   `claude auth status` times out or prints non-JSON (for example an update notice), so `signedOut`
   rejects, the handler `() => {}` leaves `state: 'signed-out'`, and `tried` blocks a retry for 60
   s. A new session in that minute is refused with 'No Claude Code account is signed in', or `b` is
   skipped, and the banner stays. This is distinct from the known stale-`askedAt` finding: here the
   state is what goes stale.

7. `packages/server/src/runner/claude-accounts.ts:113`: Only a leading `~/` is expanded, and
   `existsSync` accepts any path, so `~` alone is rejected and a regular file counts as an account
   folder.

   Failure scenario: A line `~` gives the banner 'account folder ~ is not an absolute path', which
   is confusing. A line `~/.claude.json` (a file) passes `existsSync`, is never `missing`, and is
   handed to Claude Code as CLAUDE_CONFIG_DIR. If `auth status` then errors without JSON, the
   account stays `ready` and can be picked. A directory check (`statSync(...).isDirectory()`) still
   opens no file, so SC-002 holds.

8. `packages/server/src/runner/claude-accounts.ts:123`: Name de-duplication only compares rule names
   against names already taken, so a path-named duplicate and the `default` name can still be
   ambiguous.

   Failure scenario: accounts = ['/a/.claude-b', '/b/.claude-b', '/srv/default']. The second becomes
   '/b/.claude-b' as specified, but `/srv/default` is named 'default', the same label `~/.claude`
   gets. If both are listed, the second 'default' flips to its path, so which one reads 'default'
   depends on list order. Problem texts and the header ('Claude Code · default · ...') then point at
   a folder that is not `~/.claude`.

9. `packages/server/src/runner/claude-accounts.ts:233`: `ClaudeAccounts` holds the folders twice
   (public `folders` and `#entries[].folder`), and the adapter builds one, with its `claudeAsk`
   closure, only to discard it when the list is empty.

   Failure scenario: Maintenance cost: `nameOf` searches `folders` while `problems` and `list` walk
   `#entries`, two sources to keep in step. claude.ts line 298 constructs `new ClaudeAccounts(...)`
   on every adapter build just to test `folders.length > 0`. Calling `claudeFolders(lines, home)`
   first and constructing only when it is non-empty is simpler; `#pick`'s
   `!adapter.accounts?.list().length` then repeats the same emptiness check a third time.

10. `packages/server/src/runner/processes.ts:137`: `open` now loads and maps every turn of the
    session on each process open only to compute `ran`, which `#pick` needs just when `row.account`
    is null.

    Failure scenario: The `SELECT * FROM turns WHERE session_id = ?` with `toTurn` on every row was
    already there for `replaced`, but it now also runs before the pick on every open
    (allow-and-retry, effort reopen, continue) of long sessions with hundreds of turns. An
    `EXISTS (... started_at IS NOT NULL)` query, or evaluating `ran` lazily, avoids the full scan on
    the hot path.

## Codex · GPT-6.1-Sol

No additional actionable defects were identified within Tasks 2 and 3, excluding the known findings
listed in the request. Targeted tests could not run because the sandbox prevents Nix from writing
its fetcher lock.
