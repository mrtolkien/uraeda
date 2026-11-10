---
reviewed: branch
commits: e15482f6039caff1658015c9f249fb36c912fd9b..169a715212f7181c292c792c8de088c5a0cafab2
---

# Findings: Multi-accounts management: auto rotation between multiple claude logins, the branch

## Claude Code · Fable 5.2

**Spec compliance (read from the code; I ran no tests)**

- **Models decision (session keeps its account):** holds. `Processes.open` re-picks only while no
  turn has `started_at`; afterwards it uses `row.account`, listed or not. The restart path passes
  the account to `hasSession`. Exception: finding 2.
- **Agents decision / SC-002:** holds. The account reaches a process only as `CLAUDE_CONFIG_DIR`.
  The only filesystem calls on an account folder are a `statSync` of the folder itself and
  `readdirSync`/`existsSync` under `projects/`. Caveat: finding 1.
- **SC-003:** holds. An empty list makes `refresh` a no-op, `models()` passes no env, and `#pick`
  returns null and stores nothing.
- **SC-004:** holds. The pick waits through `refreshedWithin`, and `AccountRefresh.refresh` is
  itself bounded by `PICK_WAIT_MS`.
- **SC-005:** holds per `ClaudeAccounts` instance through `tried`. Two caveats: findings 3 and 9.
- **Cache migration:** one `ALTER TABLE sessions ADD COLUMN account TEXT`, appended last;
  `toSession` and `sessionColumns` carry it.
- **Read-announce loop:** none found. A refresh that asks nothing compares equal and does not
  announce.
- **Review focus 1–5:** each has a named test in `accounts.test.ts`, `claude-accounts.test.ts` or
  `account-usage.test.ts`. I did not open the test bodies to check each against its item.
- **Web views:** header, Home, sidebar and rail match the stories' wording, apart from findings 6
  and 8.

9 findings, most severe first:

1. `packages/server/src/runner/claude.ts:213`: The listed `~/.claude` ("default") is passed as an
   explicit CLAUDE_CONFIG_DIR, which is not the same login context as the server's own unset one.

   Failure scenario: accounts = ["~~/.claude", "~~/.claude-b"], as the spec's example. A session
   picked on default runs with CLAUDE_CONFIG_DIR=/home/u/.claude, so Claude Code reads
   /home/u/.claude/.claude.json instead of ~/.claude.json: user-scope MCP servers and project trust
   are missing. On macOS the Keychain entry is keyed to the folder (discovery-01.md line 114), so
   default reads as signed out. Discovery checked only the three extra folders, never ~/.claude with
   the variable set. Based on Claude Code's known behaviour, not reproduced here.

2. `packages/server/src/runner/processes.ts:194`: A pick that stops waiting can pin a session for
   good to a signed-out account, and R2's stated way out ("its next message picks again") is false.

   Failure scenario: Server just started, `claude auth status` for b is slow, and the 10 s wait
   expires with b still `ready` by default. b is picked, and `cache.startTurn` runs right after
   `open` returns. The turn fails in Claude Code's words, but `hasStartedTurn` is now true, so every
   later message reuses `row.account` = b. US3 says a signed-out account is never picked; R2's "If
   wrong" clause promises a re-pick that R3's rule prevents.

3. `packages/server/src/fate/sessions.ts:62`: Every read of the agent record asks stale accounts,
   not only Home or the settings opening as the spec says, so a working session with any page open
   spawns two `claude` processes per account every minute.

   Failure scenario: Three accounts, one session running, a browser on any page (the sidebar reads
   the agent record). Each usage report announces the agent, pages re-read, and `refreshAccounts()`
   runs. Once a minute this starts 3 `claude auth status` and 3 `claude -p` stream-json processes,
   each loading the linked settings, plugins and hooks, for hours.

4. `packages/server/src/runner/claude.ts:363`: `models()` can now take up to 20 s (10 s accounts
   wait plus the 10 s `askShort` timeout), past the 15 s `MODELS_REFRESH_TIMEOUT_MS`, so one slow
   account drops the model list.

   Failure scenario: At registration, account c's `claude auth status` hangs. `refreshedWithin`
   waits the full 10 s, then `list_models` starts a new `claude -p`. If that takes more than 5 s,
   `Runtimes` gives up and keeps its last list, which is none at start: the picker shows no Claude
   models until the next refresh.

5. `packages/server/src/extensions/server.ts:258`: Account problems are read only in the built-in
   branch of `#state`, so an extension runtime's `accounts.problems()` never reaches the settings,
   though docs/extensions.md documents it.

   Failure scenario: A user extension registers a runtime with `accounts` whose `problems()` returns
   "account x is signed out". `onAccounts` fires an announce, but the non-built-in branch returns
   only `loaded.problems` and page problems: no banner ever shows.

6. `packages/web/src/sidebar/Allowance.tsx:75`: The rail's bar matches the session's account by
   display name, not id, so a session on an unlisted folder can show another account's five hours.

   Failure scenario: A session runs on /z/.claude-b, later removed from the list, while /a/.claude-b
   is listed as "b". `nameOf` falls back to `nameByRule` and gives "b";
   `accounts.find(each.name === "b")` hits /a/.claude-b. The bar and its label show the wrong
   account, where R13 says a session whose account is not listed shows no bar.

7. `packages/server/src/runner/account-records.ts:212`: `refresh` guards `accounts.refresh()` and
   `problems()` against an extension that throws, but not `list()`, which
   `shown(this.#records(name))` calls synchronously.

   Failure scenario: An extension's `accounts.list()` throws once. `AccountRefresh.refresh` throws
   synchronously inside `agentRecord` via `run()`, so every page's agent read fails. In
   `refreshedWithin`, `refresh()` throws before `.catch` attaches, so `accountFor` rejects with a
   raw error despite its "never rejects" contract, and the turn fails.

8. `packages/web/src/sidebar/Allowance.tsx:99`: The sidebar pane is shown whenever a runtime
   reported any window, but its compact body draws only the `five_hour` id, so it can render an
   empty "Usage" pane.

   Failure scenario: No accounts listed; Codex reports only its week, or a window of unknown length
   (id `primary` or `<n>m` in codex-limits.ts). `useReportedRuntimes()` is non-empty,
   `fiveHours(runtime.usage)` is undefined: a titled "Usage" pane with nothing in it.

9. `packages/server/src/runner/claude.ts:363`: `models()` asks the accounts directly, bypassing
   `AccountRefresh`, so its answers are never announced and it marks the accounts as tried for the
   next minute.

   Failure scenario: The model picker opens and `models()` runs when accounts are stale. b turns out
   signed out, but no announce follows. A page that already read the agent record keeps showing b as
   ready with old windows, and the settings show no banner, until an unrelated announce. R11 accepts
   this; it remains a second ask path beside the one R10 set up.

**Sizes against the limits (500 lines a file, 100 a function), before → after**

| File                                            | Before | After                  |
| ----------------------------------------------- | ------ | ---------------------- |
| `packages/server/src/runner/sessions.ts`        | 473    | 500 (at the limit)     |
| `packages/server/src/runner/continuer.ts`       | 497    | 497 (one line changed) |
| `packages/web/sandbox/agent.ts`                 | 487    | 493                    |
| `packages/server/src/extensions/server.ts`      | 459    | 473                    |
| `packages/web/src/SessionView.tsx`              | 471    | 472                    |
| `packages/server/src/fate/views.ts`             | 463    | 469                    |
| `packages/web/src/views.ts`                     | 461    | 466                    |
| `packages/server/src/fate/sessions.ts`          | 446    | 465                    |
| `packages/server/src/runner/claude.ts`          | 464    | 452                    |
| `packages/server/src/runner/processes.ts`       | 330    | 413                    |
| `packages/server/src/runner/runtimes.ts`        | 359    | 400                    |
| `packages/server/src/runner/claude-accounts.ts` | new    | 382                    |

- **Functions:** `Processes.open` grew from 77 to 84 lines. No function the branch touched
  passes 100.
- **Test files already past 500 before the branch:** `claude.test.ts` 1689 → 1807,
  `sessions.test.ts` 1739 → 1740, `cache.test.ts` 908 → 928.
- **Other test files:** `usage.test.ts` 198 → 448, `runtimes.test.ts` 495 → 498.

**Tests removed or rewritten**

- No test title was removed anywhere in the range.
- The three tests the spec's Replaced behaviour names are still present by title: "a session exists
  when its transcript is found" in `claude.test.ts`, and both named tests in `usage.test.ts`.
- `usage.test.ts` and `claude.test.ts` grew; the only deleted line in `usage.test.ts` is an import.
  I did not diff the bodies of the kept tests for changed assertions.

## Codex · GPT-6.1-Sol

Spec compliance: two defects remain, reproduced through direct module calls; review focus 1 has the
hanging-pick timeout test, focus 2 has the concurrent-refresh gate test, focus 3 has
restart/empty-list assertions, focus 4 has expired-window and reset-announcement tests, and focus 5
has no-op-refresh assertions; static inspection otherwise supports account retention,
SC-002/003/005, the additive nullable cache migration, the narrow announcement path, and the
Home/sidebar/header stories, but the targeted test run was blocked by Nix's read-only fetcher lock
and browser appearance was not independently validated. Quality inventory (physical lines,
before→after; “near” means ≥80% of the limit): under packages/server/src, extensions/server.ts
459→473, fate/sessions.ts 446→465, fate/views.ts 463→469, runner/processes.ts 330→413,
runner/runtimes.ts 359→400, runner/sessions.ts 473→500; under packages/web, sandbox/agent.ts
487→493, src/SessionView.tsx 471→472, src/views.ts 461→466; growing near-limit functions are
Processes.open 77→84 and SessionLog 99→100, with no newly exceeded production limit; already-near
code includes runner/claude.ts 464→452, runner/continuer.ts 497→497, sessionsOfTurns 86→86, and
SessionPane 99→99; test files, exempt from file-length limits, are
server/src/**tests**/sessions.test.ts 1739→1740 and runner/**tests**/{cache.test.ts 908→928,
claude.test.ts 1689→1807, runtimes.test.ts 495→498, usage.test.ts 196→446}. Test audit: no tests
were removed and both existing accountless live-usage tests remain unchanged; existing tests
modified were server sessions' runtime-record assertion (empty accounts), cache's session-fields
test (account persistence), Claude's transcript-location test (the explicitly permitted replacement,
retaining its original assertions), and runner runtimes' model-refresh/model-list-absence tests (new
records-call signature); the fake control-process helper also records CLAUDE_CONFIG_DIR, while web
test changes only supply the new record fields.

Full review comments:

- [P2] Re-pick before reusing a process whose first turn was cancelled —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-multi-accounts/packages/server/src/runner/processes.ts:189-194
  If a queued first message is taken back during the usage wait, `Turns.#startQueued` leaves the
  newly opened process idle without starting a turn. A subsequent message within the 15-minute idle
  timeout returns through `open`'s existing-process shortcut, never reaching this re-pick: it starts
  on the old account even if another now has more allowance. This contradicts the first-started-turn
  rule in
  [R3](specs/2026-11-10-multi-accounts/rulings.md#r3-a-session-picks-again-until-a-turn-of-it-starts).
  Gate process reuse on a previously started turn, and cover cancellation during the pick rather
  than only an `adapter.open` exception.

- [P2] Match the session's account by its stored identity —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-multi-accounts/packages/web/src/sidebar/Allowance.tsx:72-75
  When a session's `/home/u/.claude-b` is removed and `/srv/.claude-b` remains listed, `accountName`
  gives the removed account its rule-derived name `b`, which also names the remaining account. This
  lookup consequently displays the other account's allowance for the session, despite the session
  retaining its original folder. That violates
  [R13](specs/2026-11-10-multi-accounts/rulings.md#r13-the-rails-bar-follows-the-session-in-view-and-shows-nothing-for-one-it-cannot-place),
  which requires no bar for an unlisted session account. Carry the stored account ID separately from
  its display name and match against `each.id`.
