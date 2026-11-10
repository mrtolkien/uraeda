# Rulings: Multi-accounts management

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: A setting of invalid lines still shows its banner

- **Decision**: `ClaudeAdapter.accounts` is always a `ClaudeAccounts`. With no valid folder, even
  with no line at all, its `list()` is empty, so the runner's pick, which only picks when `list()`
  is not empty, leaves sessions on the server's login, and asks nothing: the records give the
  runtime's own usage, as for a runtime with no accounts (SC-003). Its `nameOf` always gives the
  naming rule's name for a folder, so a session that keeps an account after the setting was emptied
  reads "b" or "default" in its header. (Amended by wave 3's fix: it was undefined when the setting
  had no non-blank line, and the header read the folder's raw last segment.)
- **Rationale**: spec US3 (more 2) shows a banner for a line that is no absolute path, which needs
  `problems()` to be reachable from the adapter. Task 3's first reading, "a `ClaudeAccounts` when
  the lines give a folder", hid it behind `undefined` for a setting of only invalid lines. Review
  finding 8 of wave 3: with `accounts` undefined, `nameOf` was not reached and the fallback in
  `fate/sessions.ts` duplicated the rule wrongly. A runtime that is unregistered, as while the
  Claude extension is off, still has no `nameOf`: the header then reads the folder's last segment.
- **Alternatives considered**: a separate `problems` on the adapter: a second path to the same list,
  beside `Accounts.problems()`; exporting the naming rule to `fate/sessions.ts`, a second place that
  knows Claude's folders.
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
- **If wrong**: a session picked on an account that was in fact signed out fails its turn in Claude
  Code's words, and keeps that account: the turn started, so R3 pins it, as the spec's edge "a
  session's account is signed out since it started" says. A new session picks again, on the answers
  that have come since. The window is the first seconds after a server's start: the start asks usage
  (Task 4), so every later pick finds the answers, or a wait of 10 seconds that ended with `claude`
  still silent. (Amended by the branch review, finding 2: it promised that the session's next
  message picks again, which R3 prevents once a turn started.)
- **Where**: task 3 of the plan, `ClaudeAccounts` in `runner/claude-accounts.ts`.

## R3: A session picks again until a turn of it starts

- **Decision**: `Processes.open` picks whenever no turn of the session ever started and its runtime
  lists accounts, even with an account already stored: the session keeps its account from its first
  started turn on. A session whose turns all started before accounts existed stays on the server's
  login, as before. The stored account is then a last pick, not a promise. A session with no started
  turn, on a runtime that lists no account, opens with none and stores none: the last pick is
  cleared. (Amended by wave 3's fix, finding 10: it kept the stored pick, so a first turn ran on an
  account the setting no longer lists, and the session header named it.)
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

## R11: The model list waits for the accounts' ask

- **Decision**: `ClaudeAdapter.models()` awaits the accounts' `refresh(USAGE_MAX_AGE_MS)`, at most
  `MODELS_ACCOUNTS_WAIT_MS` (4 seconds: `MODELS_REFRESH_TIMEOUT_MS` less the 10 seconds of its own
  short process, less a second, in `runner/runtimes.ts`; the helper `refreshedWithin` the pick uses
  takes the wait), then runs in the first listed `ready` account, else the first listed. (Amended by
  the branch review, finding 4: the wait was the pick's 10 seconds, so a slow account let the whole
  call take up to 20, past the runtime's 15-second refresh, which then dropped the list.)
- **Rationale**: finding 9 of wave 3: the list is asked at registration, when every existing folder
  is still `ready` by default, so a signed-out first folder ran `list_models` and kept a bad list.
  At registration `Sessions` asks the accounts first, and `models()` shares that ask.
- **Alternatives considered**: asking the models again when an account's state changes: a second
  path from the accounts to the runtimes, for a list that is asked again at each start and each
  opening of the picker.
- **If wrong**: an ask that `models()` starts itself, when it comes before any page's read, answers
  its accounts with no announce until the next one (R23). A slow account whose status has not come
  in 4 seconds leaves the list asked in a folder that looks ready by default.
- **Where**: task 3 of the plan, `ClaudeAdapter.models` in `runner/claude.ts`.

## R12: A missing folder reads "no folder", a signed-out account "signed out"

- **Decision**: Home reads "c · no folder" and the sidebar "c no folder" for an account whose folder
  is `missing`; "b · signed out" and "b signed out" stay for a `signed-out` one. Neither shows a
  window.
- **Rationale**: finding 2 of wave 4: the settings banner says "account c has no folder at
  ~/.claude-c", and the panes read "signed out", which sends the human to `claude auth login` for a
  folder that does not exist. US3 only says the panes "say so" for both problems.
- **Alternatives considered**: one text for both, "needs you": it hides which of the two to fix.
- **Where**: task 5 of the plan, `UsageWindow.tsx`.

## R13: The rail's bar follows the session in view, and shows nothing for one it cannot place

- **Decision**: with accounts listed, the closed rail's bar falls back to the account a new session
  would start on only when no session (and no feature's latest session) is in view. A session in
  view whose account is not among the listed ones, or has none, shows no bar. With the account, the
  bar's label and title name it: "b 5h: 58% left".
- **Rationale**: findings 3 and 6 of wave 4 and Codex's finding 2: the bar showed another account's
  five hours for a session that keeps its own account (US2: the bar follows the session in view),
  and two pages' bars read alike while naming different accounts.
- **Alternatives considered**: showing the runtime's server login for a session with no account: it
  has no usage of its own to show while accounts are listed.
- **Where**: task 5 of the plan, `sidebar/Allowance.tsx`.

## R14: Without accounts, the sidebar finds the five hours by their ID

- **Decision**: the sidebar's line and the rail's bar of a runtime with no account list take the
  window whose ID is `five_hour` (`FIVE_HOUR_WINDOW` in `limits.ts`, which Claude Code's adapter and
  Codex's both report the five hours by), and show nothing for that runtime while it is not
  reported, never its week. The accounts' first window stays the five hours by construction: the ask
  gives it first (`claudeWindows` rejects a usage whose first window is another), and a report never
  adds a window (R8).
- **Rationale**: finding 1 of wave 4 and Codex's finding 1: a runtime without accounts orders its
  `usage` by report order and drops expired windows, so its first window can be the week.
- **Alternatives considered**: ordering `usage` shortest first on the server: Home lists the windows
  in report order today, and "shortest" would still need a rule for IDs no adapter shares; a field
  on the record saying which window is the short one: a second source for what the ID already says.
- **If wrong**: an extension runtime that reports its five hours under another ID shows no sidebar
  line; it names the window `five_hour`.
- **Where**: task 5 of the plan, `UsageWindow.tsx` and `sidebar/Allowance.tsx`.

## R15: A sidebar line wraps before its share, never before its reset

- **Decision**: in the sidebar's line, what is left and the reset form one unbreakable unit: a name
  too long for the column, "default 5h 58% · 19:27" at the column's 240 px, wraps as "default 5h"
  and "58% · 19:27", never leaving "· 19:27" alone on a line.
- **Rationale**: the sandbox review of wave 4: only the reset was kept whole, so the separator
  opened the second line. The sandbox's samples gain a missing folder (`d`) and an unused account
  (`e`, five hours with no reset), which no sample showed.
- **Where**: task 5 of the plan, `UsageWindow.tsx` and `sandbox/accounts.ts`.

## R16: Claude Code's default folder runs without `CLAUDE_CONFIG_DIR`

- **Decision**: an account whose folder is `<home>/.claude`, Claude Code's default, keeps its id and
  its name ("default") but runs with no `CLAUDE_CONFIG_DIR`: `claudeEnv` for a session's process,
  `models()`, and the ask's `claude auth status` and `get_usage` processes all go through
  `folderEnv` in `runner/claude-accounts.ts`, which gives no variable for it. Any other folder is
  given as before.
- **Rationale**: finding 1 of the branch review. With the variable set, Claude Code reads
  `.claude.json` inside the folder rather than `~/.claude.json`, so the folder given explicitly is
  not the login context of a process started with none: user-scope MCP servers and project trust are
  missing, and where the credentials are keyed to the folder, the default reads as signed out. The
  spec's own example lists `~/.claude`.
- **Alternatives considered**: telling the human to list the default folder under another name: the
  spec's example lists it. Leaving it explicit: it is a different login context from the one the
  human uses outside Uraeda.
- **If wrong**: a server started with its own `CLAUDE_CONFIG_DIR` runs the default account in that
  folder, as every process with none does; the account then names a folder the process does not
  read. Unset the variable for the server.
- **Where**: `folderEnv` in `runner/claude-accounts.ts`, `claudeEnv` and `ClaudeAdapter` in
  `runner/claude.ts` (the adapter takes the `home` its accounts do).

## R17: A process opened for a first turn that never started is reused only on the pick's account

- **Decision**: while no turn of a session ever started, `Processes.open` picks even when the
  session has an open process, and reuses that process only when the pick gives its own account;
  else it closes it and opens a new one on the pick. A session that ran a turn reuses its process as
  before. The pick made for the check is the one the new process opens on: it is asked once.
- **Rationale**: Codex's finding 1 of the branch review. A first message taken back while its
  process opened (Turns' `#startQueued` finds the queue changed) leaves the process idle, opened on
  that pick. The next message within the 15-minute idle timeout took `open`'s reuse shortcut and
  never reached the re-pick R3 promises, so it ran on the old pick whatever the usage had become.
- **Alternatives considered**: closing the process in `#startQueued` when its turn was taken back: a
  second place to keep in step, and a process opened for a turn that failed to start would still
  stay.
- **Where**: `Processes.open` and `#pickWhileIdle` in `runner/processes.ts`.

## R18: Any runtime's account problems reach its extension's settings

- **Decision**: `ExtensionsHost.#state` adds `accounts.problems()` of the runtime registered under
  the extension's name for every extension, one of yours as a built-in, as plain problems with no
  file. The extension's state does not follow them.
- **Rationale**: finding 5 of the branch review. Only the built-in branch read them, though
  `docs/extensions.md` documents `problems()` for any runtime's `Accounts`: an extension's runtime
  announced a change and no banner ever showed.
- **Alternatives considered**: none: the read was one branch short.
- **Where**: `#state` in `extensions/server.ts`.

## R19: The session's record carries its account's id, and the rail's bar matches the id

- **Decision**: `SessionRecord` gains `accountId`, the id the session stored (for Claude Code, its
  folder), beside `account`, the name for people. The web's `SessionAgentView` reads it, and the
  rail's bar finds the session's account among the runtime's by `id`, never by name.
- **Rationale**: finding 6 and Codex's finding 2 of the branch review. A session on `/z/.claude-b`,
  whose folder left the list while `/a/.claude-b` is listed, got the name "b" from the naming rule,
  and the bar showed the other account's five hours, where R13 says a session on an account that is
  not listed shows none. Two accounts may share a name; the naming rule gives the second its path,
  but only among the listed ones.
- **Alternatives considered**: giving the second folder's name a suffix whatever the list says: a
  name that changes as the list does.
- **Where**: `SessionRecord` in `fate/views.ts`, `sessionRecord` in `fate/sessions.ts`,
  `SessionAgentView` in `web/src/views.ts`, `barWindow` in `sidebar/Allowance.tsx`.

## R20: An extension's `list()` that throws reads as no account

- **Decision**: the server reads a runtime's `accounts.list()` through `listed()` in
  `runner/account-pick.ts`, which gives an empty list when it throws, in the accounts' records, in
  the pick, and in `Processes`' check of whether to pick. The reports of an account are kept, not
  pruned, while `list()` throws, as it may list again. `refresh` and `problems()` were guarded
  already (R10).
- **Rationale**: finding 7 of the branch review. `AccountRefresh.refresh` read the records
  synchronously, so an extension's `list()` that threw once broke every page's read of the agent's
  record, and made `accountFor` reject with a raw error through `refreshedWithin`, which promises
  never to reject, so the turn failed with the extension's error.
- **Alternatives considered**: reporting the throw as a problem in the settings: the extension's own
  errors already show in its state; the session should go on, on the agent's own login, as with no
  account.
- **Where**: `listed` in `runner/account-pick.ts`; `accountRecords`, `Processes.reports`, and
  `Processes.#pick`.

## R21: The sidebar's Usage pane shows only when its compact body draws a line

- **Decision**: the sidebar's Usage pane, and so its rail's bar, take only the runtimes for which
  `hasSidebarLine` holds: one that lists an account, or reported a window whose ID is `five_hour`
  (R14). With none, there is no pane. Home's pane is unchanged: it lists every window.
- **Rationale**: finding 8 of the branch review. The pane showed whenever a runtime reported any
  window, but its compact body draws only the five hours: Codex reporting only its week, or a window
  of unknown length, drew a titled "Usage" pane with nothing in it.
- **Alternatives considered**: drawing the week in the sidebar for such a runtime: R14 keeps the
  sidebar to the five hours, which the week never stands in for.
- **Where**: `hasSidebarLine` in `UsageWindow.tsx`, `Bar` in `sidebar/Allowance.tsx`.

## R22: Reading the agent's record asks stale usage, whichever page reads it

- **Decision**: no change. `refreshAccounts()` stays where `fate/sessions.ts` reads the agent's
  record, so any page reading it asks the stale accounts, at most once a minute per account
  (SC-005). The spec's "when Home or the settings open" is met, and every page also meets it.
- **Rationale**: finding 3 of the branch review, dropped. Every page reads the agent's record (the
  sidebar's usage pane and the rail's bar are on all of them), so asking for Home and the settings
  alone needs a request from the web that the plan did not have: a field or a mutation those two
  views send, and the sidebar's usage would then wait for one of them. The cost is bounded: one ask
  per account in a minute, two short processes each, while a page is open.
- **Alternatives considered**: a mutation the web calls when Home or the settings open: a second
  path to the same ask, and a stale sidebar elsewhere.
- **If wrong**: raise `USAGE_MAX_AGE_MS`, which the pick shares, or add that request then.
- **Where**: `fate/sessions.ts`, `AccountRefresh` in `runner/account-records.ts`.

## R23: `models()` asks the accounts outside the refresher

- **Decision**: no change. `ClaudeAdapter.models()` asks its accounts directly, as R11 says, and its
  answers are not announced.
- **Rationale**: finding 9 of the branch review, dropped. `AccountRefresh` lives in `Sessions`,
  which knows the runtimes; the adapter does not know it, and a callback from an adapter to the
  refresher is the "second path from the accounts" R11 refused. The ask is the same
  `refresh(USAGE_MAX_AGE_MS)` the refresher calls, shared per account while in flight and kept a
  minute, so a pick or a page right after finds the answers; the next announce, the server's start
  asks before registration does, shows them.
- **Alternatives considered**: giving `models()` a refresher passed to the adapter at registration:
  the Extensions host would then need it for every extension's runtime.
- **If wrong**: a page that read the agent's record before `models()` ran keeps its old accounts
  until the next announce, a minute at most once a page asks again.
- **Where**: `ClaudeAdapter.models` in `runner/claude.ts`.

## R24: The Vim settings test presses the Save of the field it edited

- **Decision**: the test "saved commands lose their blank lines in the field" in
  `packages/web/src/__tests__/vim.test.tsx` presses the one enabled Save of the Settings page, not
  the only Save by name.
- **Rationale**: the Accounts setting of Claude Code is a list setting with its own Save, so the
  page has two, and `getByRole("button", { name: "Save" })` found both. The test failed on the
  branch before this round of fixes (the review ran no web tests); what it guards, the blank lines a
  saved command drops, is unchanged.
- **Alternatives considered**: scoping to the Vim row's container: it relies on markup the test does
  not otherwise know.
- **Where**: `packages/web/src/__tests__/vim.test.tsx`.
