---
reviewed: wave 3
commits: 279daf0199098c9190bc878bef70657ab47001a2..83aadea429a21075eb693a8d67736db7369011ab
---

# Findings: Multi-accounts management: auto rotation between multiple claude logins, wave 3

## Claude Code · Fable 5.2

**Spec compliance.** Task 4's records match the plan: the merge by window id, the expired-window
rule on read, `RuntimeRecord.accounts` with `usage` empty while accounts are listed,
`sessionRecord.account`, and the account problems on the built-in. Review focus 5 holds for
`ClaudeAccounts`: a refresh that asked nothing announces nothing, and I found no read-announce loop.
Review focus 4 holds on read, in the pick and the records, but nothing announces an asked window's
expiry (finding 4). The fixes for findings-01 and findings-02 landed, with three residues: findings
1, 2 and 9. None of this was run; it is from reading the diff and the code around it.

**Quality.** Findings 5 to 7 are the refresh's concurrency and announce path.

10 findings, most severe first:

1. `packages/server/src/runner/account-usage.ts:50`: Spec compliance (edge case 'usage cannot be
   read', findings-01 #3 and #4 residue): `askedAt` becomes the newest report's time for the whole
   account, though a report may carry one window only, so a week-only report makes stale or missing
   five hours rank as known.

   Failure scenario: (1) Account b's last good ask read 5h at 10% yesterday; today's asks fail, so
   `askedAt` is null. A running session on b reports only `seven_day`. `accountUsage` sets `askedAt`
   to the report's time, and `pickAccount` ranks b as known on its stale 10%, ahead of `default`
   freshly read at 42%. The spec says an unreadable account is picked after every known one. (2) A
   never-asked account with a week-only report gets `windows = [seven_day]`: the week sits at index
   0, `shortUsed` reads it as the five hours, `eligible` skips it, and a used-up week no longer
   excludes the account. The test 'an ask that could not read keeps its windows, and a report is
   fresher than them' pins case 1.

2. `packages/server/src/runner/account-usage.ts:38`: A failed ask nulls `askedAt`, so the ask's
   windows count as read at -Infinity and any open process's older report overrides a newer
   successful read.

   Failure scenario: A long turn on b reports 5h 20% at 11:00 and then nothing more. The ask at
   12:00 reads 80%, since b is also used in a terminal. The ask at 12:01 times out, and
   `ClaudeAccounts` keeps the windows but sets `askedAt: null`. The merge now sees the ask at
   -Infinity, so the 11:00 report wins: the panes drop from 80% to 20%, the account is 'known' as of
   11:00, and the pick prefers it. The time of the last successful read needs keeping apart from
   'last ask failed'.

3. `packages/server/src/runner/processes.ts:305`: Closing a process drops its reports, so the
   account's usage falls back to the older asked value, and nothing asks again.

   Failure scenario: The ask at 12:00:00 reads b at 10%. A turn on b reports up to 60% by 12:00:40
   and ends. `close` calls `#dropLimits`, so the merge returns to the ask's 10%. The announce makes
   pages read `agentRecord`, but `refresh` is throttled for the rest of the minute, so nothing is
   asked, and no timer asks later. The panes and `isNext` show 10% until some unrelated read after
   the minute, and a pick inside the minute sends the next session to the account that just burned
   50%. The test line 'Its exit drops the report, and the ask's usage stays' pins this. Keeping a
   closed process's last report until a newer ask answers would avoid it.

4. `packages/server/src/runner/account-records.ts:18`: Review focus 4: an asked window's expiry is
   applied only when something reads the record; nothing announces at the reset time, unlike process
   reports, which have the `#expiry` timer.

   Failure scenario: Every account's five hours are used up, read by asks, with no process running.
   At 15:08 `default` resets. `unexpired` would now read it as `{ used: 0, resetsAt: null }` with
   `isNext` moved, but no announce fires, since `#usageChanged` only arms its timer for reports in
   `#limits`. Home and the sidebar keep showing '0% left - reset 15:08' and the old next account
   until an unrelated announce or a reload.

5. `packages/server/src/runner/account-records.ts:67`: Only asks started by `AccountRefresh.run` are
   announced: answers that arrive through a pick's own `accounts.refresh` in `accountFor` change the
   records and the problems with no announce.

   Failure scenario: Home has been open for two minutes with no announce. A new session's first turn
   starts, and `accountFor` calls `accounts.refresh` directly. The answers say b is now signed out
   and c is at 90%. No `run()` is in flight to compare before and after, so neither the agent record
   nor the Extensions record is announced. The panes, `isNext` and the 'account b is signed out'
   banner stay stale until an unrelated read. The pick should go through the same refresher, or
   announce on change.

6. `packages/server/src/runner/sessions.ts:122`: An account-usage change is announced with
   `runtimes.changed()`, whose listener in `Sessions` also runs `check({ continueCuts: true })`:
   every runtime's `version()` and `continuer.agentBack()` on each usage change.

   Failure scenario: While sessions work, usage changes on nearly every minute's ask. Each change
   calls `runtimes.changed()`, which asks the version of every registered runtime, scans the server
   cuts in `agentBack`, re-announces Extensions on every bus, and calls `refreshAccounts` again. A
   report landing during an ask also makes before and after differ and triggers the whole chain,
   though the report already announced itself. `context.agentChanged()` plus a narrow hook for the
   Extensions host would announce the same without the version checks.

7. `packages/server/src/runner/account-records.ts:62`: Refresh concurrency: a runtime's `Accounts`
   stays in `#asking` until its `refresh` settles, with no timeout, and the one announce waits for
   the slowest account.

   Failure scenario: (1) An extension runtime's `refresh` never settles, as `FakeAccounts.hangs`
   models. Its `Accounts` is never removed from `#asking`, so every later `run()` skips it and its
   usage is never refreshed or announced again until the runtime reloads. The pick guards this with
   `PICK_WAIT_MS`; the refresher has no guard. (2) With Claude, `default` and `b` answer in one
   second and `c` times out at ten: the single `.then` announces only after all settle, so open
   panes show the fresh usage of `default` and `b` ten seconds late.

8. `packages/server/src/fate/sessions.ts:81`: The fallback name for a session's account is the
   folder's raw last segment, not the naming rule, so the header reads '.claude-b' or '.claude' once
   the runtime has no accounts.

   Failure scenario: A session runs on `~/.claude-b`. The user empties the `accounts` setting, and
   per the spec the session keeps its account. `ClaudeAdapter.accounts` is now undefined, so
   `nameOf` is not reached and the fallback gives 'Claude Code · .claude-b · Opus 5.5 · High'. A
   session on `~/.claude` reads '.claude' instead of 'default'. The same happens while the Claude
   extension is off. The rule lives in `nameByRule` in claude-accounts.ts, and the fallback
   duplicates it wrongly.

9. `packages/server/src/runner/claude.ts:364`: Fix check, findings-02 #3: `models()` picks the first
   account 'last known ready', but the list is asked at registration, when every existing folder is
   still `ready` by default, and no account state change asks it again.

   Failure scenario: accounts = [~/.claude-old (signed out), ~/.claude-b (fine)]. `register` calls
   `refreshModels` at once, before any `claude auth status` has answered. `~/.claude-old` is `ready`
   by default, so `list_models` runs in the signed-out folder and the list is empty or errored. When
   the ask later marks it signed out, nothing re-asks the models, so the runtime keeps the bad list
   until some other refresh. The fix only covers a missing folder, which is known at construction.

10. `packages/server/src/runner/processes.ts:223`: R3 residue: when the runtime lists no account,
    `#pick` returns the stored last pick for a session that never started a turn, so it opens on an
    account that was never fixed.

    Failure scenario: A first message is taken back during the pick's wait, and `row.account` stays
    `/home/u/.claude-b`. The user empties Accounts. The real first turn then gets `row.account` back
    from `#pick` and runs with `CLAUDE_CONFIG_DIR=~/.claude-b`, though R3 says the stored account is
    'a last pick, not a promise' and the spec says a session with no list stays on the server's own
    login. `sessionRecord.account` likewise shows 'b' in the header of a session that has not
    started and may pick again.

## Codex · GPT-6.1-Sol

Task 4 still violates expiry, window-ordering, and freshest-wins requirements in account-report
merging. The ordinary no-op refresh path avoids unconditional announcements, but the usage defects
affect both records and picking. Targeted tests were blocked by the sandbox's read-only Nix cache.

Full review comments:

- [P2] Retain expired account reports for normalization —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-multi-accounts/packages/server/src/runner/processes.ts:75-77
  When an account's ask has never succeeded, its process report makes its usage known only until
  that report expires. This filter, together with deletion in `#usageChanged`, removes the report
  before `accountUsage` can normalize it to `{ used: 0, resetsAt: null }`. The account instead loses
  its window and becomes unknown again, so a known, partly used account can win the next pick.
  Retain expired account reports until their process closes and normalize them during merging; keep
  the existing expiry behavior for accountless usage.

- [P2] Preserve the shortest-window invariant for report-only accounts —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-multi-accounts/packages/server/src/runner/account-usage.ts:41-44
  If an account's ask fails and its process supplies only `seven_day`, this merge places the week at
  index zero. Claude's `usageEvents` explicitly permits such single-window reports. `pickAccount`
  then treats the week as the five-hour window and excludes it from the weekly eligibility check, so
  an account with an exhausted week can beat an unknown but eligible account. The parser fix for
  findings-01 only protects asked windows; report-only merges must also preserve the invariant or
  the picker must identify windows independently of position.

- [P2] Preserve successful-read timestamps separately from availability —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-multi-accounts/packages/server/src/runner/account-usage.ts:35-38
  After a failed refresh clears `askedAt`, retained asked windows receive a timestamp of `-Infinity`
  here. An older process report therefore overwrites a newer successful ask: for example, a 12:00
  report of 10%, a 12:05 ask of 80%, and a failed 12:06 ask produce 10% known usage. This violates
  the freshest-wins rule and can select the fuller account. Keep the last successful window
  timestamp separately from the latest ask's availability, so fixing unread-last ranking does not
  discard merge chronology.
