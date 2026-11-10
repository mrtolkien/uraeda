---
kind: feature
finished: 2026-11-10
pull-request: https://github.com/mrtolkien/uraeda/pull/121
supersedes:
  - 2026-11-08-codex-runtime
---

# Record: Multi-accounts management

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-11-10, finished on
> 2026-11-10, in [its pull request](https://github.com/mrtolkien/uraeda/pull/121). Its full files
> are in git: `git log -- specs/2026-11-10-multi-accounts/`.

## What and why

The human has three Claude Code Max accounts and wanted Uraeda to use them all, so a five-hour limit
rarely stops their work. Each new Claude Code session starts on the listed account with the most of
its five hours left, and keeps that account. Home and the sidebar show each account's usage, and the
settings say when an account needs the human. Uraeda never touches a credential: the human makes and
signs in each account's configuration folder, from a script in the documentation.

## Behaviour

- **The setting**: `accounts`, a list of Claude Code configuration folders in `[extensions.claude]`
  of `config.toml`, in the order they show, such as `["~/.claude", "~/.claude-b", "~/.claude-c"]`.
  Empty by default: then sessions run on the server's own login, as before, with no extra process
  and no account stored. A line that is not an absolute path once `~` is expanded is left out, with
  a problem. A folder listed twice is one account.
- **Names**: an account is named after its folder without its dot and its `claude-`: `~/.claude-b`
  reads "b", `~/.claude` reads "default". A second folder of a name already taken reads its path.
- **The pick**: as a session's first turn starts, among the listed accounts that are signed in and
  whose week is not used up: the most of its five hours left; on a tie, the one whose five hours
  reset first, a window not open last; then the first listed. An account whose usage is not known
  ranks after every known one. When every signed-in account's week is used up, the first signed-in
  one listed. With none signed in, the turn is refused: "No Claude Code account is signed in: sign
  one in, or empty Accounts in Settings, Extensions". The pick waits at most 10 seconds for the
  usage it asks, then picks on what is known.
- **A session keeps its account** from its first started turn on, across restarts, after its account
  leaves the list, and when a limit refuses its run: the run waits for that account's reset, as the
  run lifecycle decision says. Until a turn starts, each open picks again, and an idle process
  opened on an older pick is replaced. A session that ran before the feature, or with no list, stays
  on the server's login. Each sub-agent is a session, and picks its own.
- **The process**: an account reaches Claude Code only as `CLAUDE_CONFIG_DIR`, never for the default
  folder `~/.claude`, which runs with no variable, as the server's own login. A session's transcript
  is looked for in its account's folder. The model list is read in the first listed account known to
  be signed in.
- **Usage**: Uraeda asks Claude Code for each account's usage in short processes,
  `claude auth status` and a `get_usage` request at once, which spend nothing: at the server's
  start, when the list changes, before a pick, and on each read of the agent's record, at most once
  a minute per account. A running session's reports keep its account fresh, window by window, and
  stay after its process exits until a newer ask. A window whose reset has passed reads as unused,
  and its reset is announced when it comes.
- **Home's Usage pane** lists each account under Claude Code's mark, by name, with its five hours
  and its week: "5h 58% left - reset 15:08", "5h 100% left" with no reset for a window not open, a
  used-up week "Week 0% left" in the error colour. A signed-out account reads "b · signed out", a
  missing folder "c · no folder", with no bar.
- **The sidebar's Usage pane** shows one line per login, its five hours only, for every agent and
  with no account listed: "default 5h 58% · 15:08", "b 5h 100%", "b signed out", "c no folder". A
  runtime without accounts shows the window whose ID is `five_hour`, else no line; with no line to
  draw, there is no pane. An account whose week is used up reads as any other there.
- **The closed rail's bar** shows the five hours of the account of the session in view, or of a
  feature's latest session, matched by the account's ID; for a session on an account not listed, no
  bar; with no session in view, the account a new session would start on. Its label names the
  account: "b 5h: 58% left".
- **A session's header** names its account after the agent: "Claude Code · b · Opus 5.5 · High".
- **Settings, Extensions** shows a banner per problem of an account, for the built-in and for any
  extension's runtime: "Claude Code: account b is signed out, in ~/.claude-b", "Claude Code: account
  c has no folder at ~/.claude-c", "Claude Code: account folder docs is not an absolute path".
- **The documentation**, in [`docs/web-ui.md`](/docs/web-ui.md), holds the script that makes and
  signs in one account's folder linked to `~/.claude`, the setting, the pick, and the limits: MCP
  servers added for the user are per folder, usage credits make an account pay past its limit, an
  API key in the server's environment outranks every account, and Anthropic's terms forbid using
  someone else's account, with limits that "assume ordinary, individual usage".

## Design

Accounts are an optional part of the runtime's contract, so the pick stays agent-neutral and its
tests run on the fake agent. Claude's adapter owns what an account is; the runner owns the pick, the
usage per account, and the session's account; the web UI draws the records.

- **The contract**: `Account`, with `askedAt`, when its windows were last read, and `known`, whether
  its last ask read them; `Accounts`, with `list`, `nameOf`, `problems`, and `refresh`, in
  [`runner/adapter.ts`](/packages/server/src/runner/adapter.ts), documented for extensions in
  [`docs/extensions.md`](/docs/extensions.md). `OpenOptions.account` and
  `hasSession(nativeId, account)` carry a session's account.
- **The pick**: `pickAccount`, `accountFor`, and `listed`, in
  [`runner/account-pick.ts`](/packages/server/src/runner/account-pick.ts), called from
  `Processes.open` in [`runner/processes.ts`](/packages/server/src/runner/processes.ts), which
  stores it in the sessions' cache's new `account` column
  ([`runner/migrations.ts`](/packages/server/src/runner/migrations.ts)).
- **Usage per account**: `accountUsage` merges each account's asked windows with its processes'
  reports, in [`runner/account-usage.ts`](/packages/server/src/runner/account-usage.ts);
  `AccountRefresh` and the records, with `isNext`, in
  [`runner/account-records.ts`](/packages/server/src/runner/account-records.ts): one refresher for
  the pick and the pages, which announces the agent's record and the extensions' problems only when
  a record changed, and arms one timer for the next reset.
- **Claude's accounts**: `claudeFolders`, `claudeAsk`, `claudeUsageWindows`, `folderEnv`, and
  `ClaudeAccounts`, at most one ask a minute per account and one at a time, in
  [`runner/claude-accounts.ts`](/packages/server/src/runner/claude-accounts.ts); the setting in
  [`crates/core/extensions/claude.toml`](/crates/core/extensions/claude.toml).
- **The views**: `UsageWindow.tsx`, shared by [`home/Usage.tsx`](/packages/web/src/home/Usage.tsx)
  and [`sidebar/Allowance.tsx`](/packages/web/src/sidebar/Allowance.tsx), and
  [`SessionHeader.tsx`](/packages/web/src/SessionHeader.tsx). The approved mockups are stories of
  these components, in
  [`AccountsMockups.stories.tsx`](/packages/web/src/AccountsMockups.stories.tsx). The sandbox's fake
  agent offers sample accounts, in [`sandbox/accounts.ts`](/packages/web/sandbox/accounts.ts).

## Replaced behaviour

- **A session's transcript was looked for in one configuration folder.** Guarded by "a session
  exists when its transcript is found", in `packages/server/src/runner/__tests__/claude.test.ts`,
  rewritten with an account's folder.
- **A runtime's usage was one list of windows, gone when its processes exit.** Guarded by "the
  newest live report wins across repositories and falls back when its process exits" and "each
  window keeps the newest live report of its own, and a report without the week keeps it", in
  `packages/server/src/runner/__tests__/usage.test.ts`: both kept, for a runtime without accounts.
- **The sidebar's Usage pane listed every window of an agent, its week included.** No test guarded
  it.
- No test was removed.

## Gotchas

- `askedAt` and `known` are two fields because one field, read both as "when" and "whether", let a
  failed ask make an older report win and a report make a stale account look known: three review
  rounds came back from it. See [`account-usage.ts`](/packages/server/src/runner/account-usage.ts).
- A report never adds a window to an account: Claude Code reports one window at a time, so a
  report-only account would have its week first, and the pick reads the five hours by position.
- The default folder runs without `CLAUDE_CONFIG_DIR`: with it set, Claude Code reads `.claude.json`
  inside the folder rather than `~/.claude.json`, so user-scope MCP servers and project trust would
  go missing. See `folderEnv` in
  [`claude-accounts.ts`](/packages/server/src/runner/claude-accounts.ts).
- Running `claude auth status` and `get_usage` makes Claude Code rewrite its own files in the
  folder, `.claude.json` and refreshed credentials among them, as any session does. Uraeda opens
  none of them.
- Announcing on every refresh loops: each announce makes the pages read the agent's record, which
  asks again. A refresh announces only when a record changed.
- `models()` waits at most 4 seconds for the accounts, so with its own 10-second process it stays
  within the runtimes' 15-second model refresh. See
  [`runtimes.ts`](/packages/server/src/runner/runtimes.ts).

## Questions

### Round 01

#### Q1: When does Uraeda change accounts?

**Answer:** B: a new session starts on the account with the most left and keeps it; a refused run
waits for its reset, "It should come up pretty rarely with the rotation on session start."

#### Q2: Who makes each account's folder?

**Answer:** A: the human makes and signs in each folder from a recipe, "I'll run it directly."

#### Notes

- Anthropic's terms: "They are all my accounts."

## Decisions

- [Models](../decisions/models.md): a session keeps the account it started on, a limit that refuses
  its run included.

## Changes after approval

- An account whose usage cannot be read keeps its last windows for the panes, and ranks after every
  known account.
- A missing folder is known at once, by a stat of the folder itself; a signed-out one needs its ask,
  so a pick whose 10-second wait ends with no answer may pick an account later found signed out. Its
  turn then fails in Claude Code's words, and the session keeps that account.
- A session picks again at every open until a turn of it starts, and an idle process opened on an
  older pick is replaced; with no account listed, a session that never started stores none.
- A session's record carries its account's ID beside its name, and the rail's bar matches the ID.
- The default folder `~/.claude` runs without `CLAUDE_CONFIG_DIR`.
- The model list waits at most 4 seconds for the accounts' ask, then runs in the first listed
  account known to be signed in.
- An extension's runtime's account problems reach its settings banner, and an `Accounts.list()` that
  throws reads as no account.
- A missing folder reads "no folder" in the panes, rather than "signed out".
- Without accounts, the sidebar shows the window whose ID is `five_hour`, else no line, and no pane
  when there is no line to draw.
- Usage is asked on each read of the agent's record, which every page makes, at most once a minute
  per account, not only when Home or the settings open: asking only there needed a request from the
  web the plan did not have.
- Usage answers arrive together: a slow account delays the announce of the others by at most 10
  seconds.
- The Vim settings test presses the enabled Save, since the Accounts setting adds a second one.
