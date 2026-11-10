# Discovery, round 01: Multi-accounts management

## Summary

Tools that rotate between several Claude Code logins have three parts: a way to keep the logins
apart, a way to know each login's usage, and a rule that picks one. They differ most on the first.
Some swap the credential file of the one global login, some give each login its own configuration
folder, and some hold a long-lived token per login. Claude Code documents the configuration folder,
`CLAUDE_CONFIG_DIR`, as its way to stay signed in to several accounts.

The proposal asks for several Claude Code logins, rotated by Uraeda, with a simple rule: the login
with the most of its five-hour window left. Its goal is never to be stopped by a five-hour limit.

Today Uraeda runs one login per runtime. The Claude runtime already takes a configuration folder,
only to find transcripts. A run refused by a five-hour limit waits for the reset, then continues by
itself. Usage is known only from the reports of open processes, per runtime. An experiment in this
round found that Claude Code answers a usage request for a login without spending anything.

## How other products do it

### Claude Code itself

- Claude Code documents one way to stay signed in to several accounts: "give each account its own
  configuration directory", picked by `CLAUDE_CONFIG_DIR` when `claude` starts. "Each directory has
  its own settings, session history, and claude.ai login or API key."
  ([Authentication, Log in with multiple accounts](https://code.claude.com/docs/en/authentication#log-in-with-multiple-accounts))
- It has no rotation of its own. `/login` swaps the one login of a folder.
  ([enjoy.dev's comparison](https://enjoy.dev/blog/multiple-claude-code-accounts/), a third-party
  guide)
- When a limit is reached, the human waits for the reset, or pays for usage credits at API rates.
  With credits on, Claude Code goes on past the limit instead of refusing.
  ([Using Claude Code with your Pro or Max plan](https://support.claude.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan))

### claude-swap

- A Python CLI, `cswap`. By default it swaps the stored login of the one global folder, so every
  session of the machine changes account together. `cswap run` starts one session in a folder of its
  own, with `CLAUDE_CONFIG_DIR`. ([claude-swap's README](https://github.com/realiti4/claude-swap))
- `cswap auto` polls each account's usage and switches when the five-hour or seven-day window
  reaches a threshold, 90% by default. Its default strategy, `best`, picks the account with the most
  quota left. Others pick the account whose week resets soonest. A five-minute cooldown and a margin
  stop two accounts near the threshold from trading places. (README)
- It reads usage from Claude Code's usage endpoint with each account's stored token. Long-lived
  setup tokens show "usage unavailable": "the usage endpoint does not answer them". (README)
- Sessions share their chat history by default, so "a conversation started under one account shows
  up in `--resume`" under another. (README)
- "The first message on the new account may use extra usage as its conversation cache rebuilds."
  (README)
- "Do not run `/logout` first: current Claude Code may revoke the refresh token stored for the
  account you are leaving." It holds Claude Code's own credential locks while it writes. (README)
- It depends on Claude Code internals, lock file names, Keychain naming, and the usage endpoint, so
  an update can break it. Its author calls an all-day rotation loop across many accounts the use
  "closest to 'limit evasion'".
  ([Notes on claude-swap](https://notes.nicolasdeville.com/github/claude-swap/), a third-party page)

### clauth

- A terminal UI in Rust. It keeps a snapshot of `~/.claude/.credentials.json` and of the `env` block
  of `settings.json` per profile, and a switch "swaps those two in place".
  ([clauth's README](https://docs.rs/crate/clauth/latest/source/README.md))
- `clauth start <profile>` "launches `claude` against a temporary `~/.claude` mirror, so several
  accounts run at once", each with its own `CLAUDE_CONFIG_DIR`. (README)
- Accounts sit in a fallback chain the human orders. When the active one crosses its threshold, it
  "switches to the next member with headroom". A weekly gate skips accounts whose week is used up.
  (README)
- It resumes a past session "under any account". The README does not say how. (README)

### Maestro

- A desktop app for agents. "One agent runs as one account", picked by a `CLAUDE_CONFIG_DIR` set on
  the agent. It does not rotate.
  ([Maestro, Multiple Claude accounts](https://docs.runmaestro.ai/multi-claude.md))
- The human makes each account's folder by hand. `projects/`, `settings.json`, `plugins/`,
  `commands/`, `skills/`, `CLAUDE.md`, and a few more are links back to `~/.claude`. Only
  `.claude.json` and `history.jsonl` are per account. (same page)
- "Session resume works cross-account because `projects/` is symlinked." (same page)
- "Symlinks may break after a Claude Code update", and two instances must not write the same session
  at once. (same page)
- Its usage dashboard shows one set of bars per account, and each agent's card names its account,
  from the folder's name: `.claude-work` reads "work". (same page)

### Enjoy

- A paid desktop app. Saved accounts stay signed in side by side, each signed in "through the agent
  itself, on Anthropic's sign-in page".
  ([enjoy.dev's comparison](https://enjoy.dev/blog/multiple-claude-code-accounts/), written by its
  maker)
- When an account runs out, it moves the project to the first signed-in account with usage left, and
  "the conversation continues there on its own". It copies Claude's history of the conversation to
  the new account. The human may choose to wait for the reset instead. (same page)

### What they have in common

- **Logins kept apart**, by a configuration folder per account wherever accounts run side by side.
  Swapping the one global login only suits one session at a time.
- **Usage per account**, read without running a turn, shown as one set of bars per account.
- **A pick rule**: the most quota left, or a chain in the human's order, with accounts whose week is
  used up skipped.
- **A switch on a limit**, at a threshold before it or once it refuses, with the conversation
  continued under the new account.
- **A shared conversation history**, so a session resumes under another account.
- **A name per account**, shown where a session runs.
- **A dead login noticed**: signed out, or a token that no longer refreshes.

## Standards and libraries

### Claude Code's configuration folder

- `CLAUDE_CONFIG_DIR`: "Override the configuration directory (default: `~/.claude`). All settings,
  session history, and plugins are stored under this path." It is "ignored in project and local
  settings", so a repository cannot pick the account.
  ([Environment variables](https://code.claude.com/docs/en/env-vars))
- Credentials follow the folder: on Linux and Windows `.credentials.json` is kept under it, and on
  macOS the Keychain entry is keyed to it, "so a session with a different `CLAUDE_CONFIG_DIR` reads
  a different entry".
  ([Authentication, Credential management](https://code.claude.com/docs/en/authentication#credential-management))
- A Console sign-in without an API key is stored outside the folder, so folders do not keep two of
  those apart.
  ([Authentication, Log in with multiple accounts](https://code.claude.com/docs/en/authentication#log-in-with-multiple-accounts))
- `claude auth login` signs a folder in, and `claude auth status` prints JSON: `loggedIn`,
  `loginExpiresAt`, `email`, `orgName`, `subscriptionType`, `configDirectory`. Checked here on
  Claude Code 2.1.322: an empty folder answers `"loggedIn": false`, and gets its own `.claude.json`.

### Claude Code's other credentials

- `claude setup-token` prints a one-year token for `CLAUDE_CODE_OAUTH_TOKEN`. "It does not save the
  token anywhere", and it "can only make model requests".
  ([Authentication, Generate a long-lived token](https://code.claude.com/docs/en/authentication#generate-a-long-lived-token))
- `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` in the environment outrank every login, whatever
  the folder.
  ([Authentication precedence](https://code.claude.com/docs/en/authentication#authentication-precedence))

### Claude Code's usage reports

- The `get_usage` control request, sent to a `claude -p` process over stream-json, answers the
  login's `five_hour` and `seven_day` windows, each with `utilization` in percent and `resets_at`.
  Checked here on 2.1.322, on a Team login: the answer came in under 5 seconds, with
  `total_cost_usd: 0` and no model request. A signed-out folder answers
  `"rate_limits_available": false`. The request is in no documentation found: it is undocumented, as
  `list_models` and `get_settings` are, which the runtime already uses
  ([`claude-control.ts`](/packages/server/src/runner/claude-control.ts)).
- The status line's input has `rate_limits.five_hour` and `rate_limits.seven_day`, but "only after
  the first API response in the session", and for Pro, Max, and Ultra only.
  ([Status line](https://code.claude.com/docs/en/statusline))
- A running process reports its windows in `rate_limit_event` lines, which the runtime reads today
  ([`claude-limits.ts`](/packages/server/src/runner/claude-limits.ts)).

### The plans' limits

- "Pro and Max plans have a five-hour session limit and a weekly limit", shared "across Claude and
  Claude Code". Max also has "a separate weekly limit for Fable".
  ([Using Claude Code with your Pro or Max plan](https://support.claude.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan))
- On Max, a response in progress when the five-hour limit is reached may finish, as "Usage limit
  reached · wrapping up". (same page)

### The prompt cache

- "Caches are isolated between organizations. Different organizations never share caches, even if
  they use identical prompts."
  ([Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching))
- A cache read costs 0.1 times the input price, and less on recent models. A cache write costs 1.25
  times it. (same page) A conversation continued under another account is written again in full.

### Anthropic's terms

- The Consumer Terms, effective 8 October 2025, apply to Pro and Max. "You may not share your
  Account login information, Anthropic API key, or Account credentials with anyone else." "You also
  may not make your Account available to anyone else." They name no rule on holding several
  accounts. ([Consumer Terms](https://www.anthropic.com/legal/consumer-terms))
- "Advertised usage limits for Pro, Max, and Ultra plans assume ordinary, individual usage of Claude
  Code and the Agent SDK." "Anthropic reserves the right to take measures to enforce these
  restrictions and may do so without prior notice."
  ([Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance))
- "Developers may not collect, store, or intermediate Claude.ai credentials or session tokens —
  sign-in to a Claude account must complete through Anthropic's own flow." An end user may sign in
  "to the unmodified Claude Code binary with their own Claude subscription". (same page)
- Thariq Shihipar, of the Claude Code team, on 18 February 2026: "it's not against terms of service
  to have multiple MAX accounts, though sometimes people are using multiple MAX accounts to do
  things like resell tokens which of course is against terms of service". Seen in a search result's
  snippet of [his post](https://x.com/trq212/status/2024230184287949207), not on the page.
- A third-party article reports bans, in February 2026, of people paying for several Max accounts,
  and an Anthropic statement that some accounts "were automatically banned for triggering abuse
  filters" and were being restored. Its suspected triggers, several accounts on one device and
  overnight agent loops, are the article's guesses.
  ([metricnexus.ai](https://metricnexus.ai/blog/anthropic-banning-multiple-claude-accounts))

### Codex

- Codex "stores its local state under `CODEX_HOME` (defaults to `~/.codex`)", with `auth.json`
  there.
  ([Codex, advanced configuration](https://learn.chatgpt.com/docs/config-file/config-advanced)) The
  same idea would work for Codex. The proposal asks for Claude logins only.

## The code

### Important reads

- [`runner/claude.ts`](/packages/server/src/runner/claude.ts): the Claude runtime. It takes a
  `configDir`, from `CLAUDE_CONFIG_DIR` or `~/.claude`, only for `hasSession`, which looks for
  `<configDir>/projects/*/<id>.jsonl`. `#spawn` passes an environment to `spawnGrouped` only for
  Uraeda's tools. `models()` asks a short process, in the server's own environment.
- [`runner/child.ts`](/packages/server/src/runner/child.ts): `spawnGrouped` already adds variables
  to the server's environment. Nothing is in the way of a folder per process.
- [`runner/adapter.ts`](/packages/server/src/runner/adapter.ts): the contract of every runtime.
  `OpenOptions` has no account, and `Adapter` has no way to list accounts or ask their usage.
- [`runner/processes.ts`](/packages/server/src/runner/processes.ts): opens a session's process as a
  turn starts, and keeps each runtime's usage windows, keyed by runtime and window, from the
  freshest report of an open process. An idle runtime has no usage. Accounts need a third key.
- [`runner/claude-limits.ts`](/packages/server/src/runner/claude-limits.ts): reads a refusal as a
  `Limit`, `session` for five hours, `other` for the week, a model's week, or a spend cap. A
  rejected request "let through on usage credits" is no limit.
- [`runner/continuer.ts`](/packages/server/src/runner/continuer.ts) and
  [`continue-reads.ts`](/packages/server/src/runner/continue-reads.ts): a turn failed by a `session`
  limit waits until a minute after its reset, then continues, at most 3 times in a row. An `other`
  limit asks for the human. The file is 497 lines, near the size where a task should extract first.
- [`runner/runtimes.ts`](/packages/server/src/runner/runtimes.ts): the registry. A session stores
  its runtime's name, and `RuntimeRecord.usage` is one list of windows per runtime.
- [`runner/cache.ts`](/packages/server/src/runner/cache.ts): the sessions' rows hold `agent`,
  `model`, `effort`, and `nativeId`, and no account.
- [`extensions/builtins.ts`](/packages/server/src/extensions/builtins.ts): the Claude runtime is the
  built-in `claude` extension, with one setting, `command`. Extension settings are a bool, an
  integer, a string, or a list of strings ([`docs/extensions.md`](/docs/extensions.md)).
- [`web/src/UsageWindow.tsx`](/packages/web/src/UsageWindow.tsx),
  [`home/Usage.tsx`](/packages/web/src/home/Usage.tsx), and
  [`sidebar/Allowance.tsx`](/packages/web/src/sidebar/Allowance.tsx): the usage pane draws each
  runtime's windows under its mark, and the closed rail one bar.

### The proposal's path and existing actions

- **Signing in to a second account**: nothing in Uraeda today. The human runs `claude` themselves.
- **Starting a session**: [`Processes.open`](/packages/server/src/runner/processes.ts) opens the
  runtime's one login. With accounts, it picks one.
- **A run refused by the five-hour limit**: it waits for the reset. With accounts, it could continue
  on another one.
- **A run refused by another limit**: it asks for the human. With accounts, another one may have
  room.
- **Stop, a message, or a dismiss during a wait**: they cancel the continue. Unchanged.
- **A server restart**: the pending continues are in the cache. An account picked for a session must
  be stored with it to survive.
- **Sub-sessions**: each is a session with its own process, so each would pick an account.
- **Listing models**: one list per runtime, from the server's login. Accounts of different plans may
  list different models.
- **The human's own `claude` in a terminal**: it spends the default login's usage outside Uraeda.
  `get_usage` sees it, and a process's reports do not until one runs.
- **Scheduled jobs**, in flight on `2026-11-10-scheduled-jobs`: it adds a scheduler and a switch to
  the `[runs]` table. It starts runs through the same sessions, and reads no limit. No conflict
  found beyond the `[runs]` table.

### Rules and their owners

- **Which limit continues, and when**: [`continuer.ts`](/packages/server/src/runner/continuer.ts)
  and `limitContinueAt`. No copy.
- **A runtime's usage**: [`Processes.usage`](/packages/server/src/runner/processes.ts). The web UI
  only draws it.
- **Claude Code's formats**: its adapter's files, `claude*.ts`. The account's folder and the usage
  request belong there.

### Likely changes

Under every option:

- [`runner/adapter.ts`](/packages/server/src/runner/adapter.ts): an account in `OpenOptions`, and
  the runtime's accounts with their usage.
- [`runner/claude.ts`](/packages/server/src/runner/claude.ts) and
  [`claude-control.ts`](/packages/server/src/runner/claude-control.ts): the folder in the process's
  environment, `hasSession` per folder, and the usage request.
- [`runner/processes.ts`](/packages/server/src/runner/processes.ts), with the pick extracted to a
  module of its own, and [`runner/cache.ts`](/packages/server/src/runner/cache.ts) with
  [`migrations.ts`](/packages/server/src/runner/migrations.ts): the session's account.
- [`runner/runtimes.ts`](/packages/server/src/runner/runtimes.ts) and the web UI's usage views:
  usage per account.
- [`extensions/builtins.ts`](/packages/server/src/extensions/builtins.ts): the accounts setting.
- [`runner/fake.ts`](/packages/server/src/runner/fake.ts): accounts for the tests.
- [`docs/`](/docs/): the page on the web UI or the settings.

With a continue on another account: [`continuer.ts`](/packages/server/src/runner/continuer.ts),
[`events.ts`](/packages/server/src/runner/events.ts) for a new continue reason,
[`message.ts`](/packages/server/src/runner/message.ts) for its line, a switch in the `[runs]`
settings of [`crates/core/`](/crates/core/), and the
[run lifecycle](/specs/decisions/run-lifecycle.md) decision.

With Uraeda making the folders: a command in [`crates/cli/`](/crates/cli/), and the
[agents](/specs/decisions/agents.md) decision.

Tests that guard behaviour the feature changes:

- [`continuer.test.ts`](/packages/server/src/runner/__tests__/continuer.test.ts): "a limit whose
  process exits publishes its run only waiting", and "US4.3: turning off the limit's continue ends
  its waits, and the runs ask".
- [`usage.test.ts`](/packages/server/src/runner/__tests__/usage.test.ts): "the newest live report
  wins across repositories and falls back when its process exits", and "each window keeps the newest
  live report of its own, and a report without the week keeps it".
- [`claude.test.ts`](/packages/server/src/runner/__tests__/claude.test.ts): "a session exists when
  its transcript is found".

## The proposal

### Never stopped cannot be promised

"Never be stopped by a 5h limit" holds only while one account has room. Three accounts can all be
out, and each has a weekly limit that no rotation lifts.

### Logging in from Uraeda

"I should be able to login into multiple claude code accounts" does not say where. Anthropic's
sign-in must run through Claude Code's own flow, which opens a browser on the machine that runs it.
The [agents](/specs/decisions/agents.md) decision says Uraeda "never touches their credentials or
settings".

### When the rotation happens

"Rotate them automatically" does not say when: as a session starts, when a limit refuses a run, or
before it does.

### Whose accounts

"I have access to 3 claude code max accounts" does not say they are the human's own. The Consumer
Terms forbid making an account available to anyone else.

### Usage credits

The proposal does not mention usage credits. An account with them on is never refused: Claude Code
pays past the limit, and the runtime reads no limit.

## Worth it and feasibility

**Gain**: with three accounts, a run refused at night goes on at once instead of waiting up to five
hours. The proposal calls the feature niche.

**Cost**: a pick in the runner, an account stored per session, usage per account in the runner and
the web UI, a setting, and a new kind of continue. It is one more behaviour resting on Claude Code's
undocumented protocol. It ships to every user, though only the owner asks for it.

**Outside behaviour it relies on**:

- A folder is a login: checked, as
  [Claude Code's configuration folder](#claude-codes-configuration-folder) says.
- Usage without a turn: checked, as [Claude Code's usage reports](#claude-codes-usage-reports) says,
  on a Team login. A Max login was not in reach: the answer's shape there is unverified.
- A session resumed under another account: unverified. It needs a second login, which this machine
  does not have, and copying the one login's credentials into a second folder could sign it out.
  Maestro and claude-swap both state it works with a shared `projects/` folder. The plan's first
  task must check it with two real logins.
- Model lists across accounts of different plans: unverified, for the same reason.

**Risk**: Anthropic's terms allow several accounts by one statement of its staff, and do not say
whether rotating between them to pass a limit is "ordinary, individual usage". Bans of holders of
several Max accounts were reported in February 2026, by a third party. See
[Anthropic's terms](#anthropics-terms).

**Guards relaxed**: none. Each account's folder is the human's own, outside any repository, and
`CLAUDE_CONFIG_DIR` is ignored in project settings.

## Approaches

Criteria come from the [proposal](proposal.md), the [agents](/specs/decisions/agents.md),
[settings](/specs/decisions/settings.md), [models](/specs/decisions/models.md), and
[run lifecycle](/specs/decisions/run-lifecycle.md) decisions, and
[Anthropic's terms](#anthropics-terms).

### Telling accounts apart

How one process runs as one account. Relies on
[Claude Code's configuration folder](#claude-codes-configuration-folder) and
[Claude Code's other credentials](#claude-codes-other-credentials).

| Option                                  | Credentials untouched by Uraeda | Accounts side by side | Usage readable | Sign-in through Anthropic's flow |
| --------------------------------------- | ------------------------------- | --------------------- | -------------- | -------------------------------- |
| A. A configuration folder per account   | yes                             | yes                   | yes            | yes                              |
| B. A setup token per account, in Uraeda | no: Uraeda stores them          | yes                   | no             | yes, then copied                 |
| C. Swapping the one login's credentials | no: Uraeda rewrites them        | no                    | yes            | yes, then copied                 |

### Making the account folders

Who creates each account's folder, and what it shares with `~/.claude`. Relies on
[Maestro](#maestro) and [claude-swap](#claude-swap).

| Option                                                   | Agents decision | Work for the human         | Sessions behave alike on every account | Breaks when                              |
| -------------------------------------------------------- | --------------- | -------------------------- | -------------------------------------- | ---------------------------------------- |
| A. The human makes them, and lists their paths           | unchanged       | a few commands per account | if they link settings and `projects/`  | a link is forgotten                      |
| B. Uraeda makes them, links them, and starts the sign-in | changed         | one command per account    | yes                                    | Claude Code recreates a linked folder    |
| C. Plain folders, nothing shared                         | unchanged       | sign in, then set each up  | no                                     | a session changes account: no transcript |

### When to rotate

When Uraeda picks an account. Relies on [What they have in common](#what-they-have-in-common),
[The prompt cache](#the-prompt-cache), and [The plans' limits](#the-plans-limits).

| Option                                   | Stopped by a five-hour limit   | Cache rebuilt   | Decisions changed | Looks like a rotation loop |
| ---------------------------------------- | ------------------------------ | --------------- | ----------------- | -------------------------- |
| A. As a session starts only              | yes, mid-run, until the reset  | never           | none              | least                      |
| B. Also when a limit refuses a run       | only when every account is out | once per switch | run lifecycle     | more                       |
| C. Also at a threshold, before the limit | only when every account is out | once per switch | run lifecycle     | most                       |

With C, a workflow run is mostly one long turn, so a switch between turns is rare, and a switch
during a turn stops it as a refusal does. C alone moves a run off an account with usage credits
before it pays.

### The pick rule

Which account is picked. The proposal gives it: the most of the five-hour window left. Relies on
[claude-swap](#claude-swap) and [clauth](#clauth).

| Option                            | The proposal's rule | Skips a used-up week | Switches of a session |
| --------------------------------- | ------------------- | -------------------- | --------------------- |
| A. The most five-hour window left | yes                 | with a gate          | spread over accounts  |
| B. A chain in the human's order   | no                  | with a gate          | fewest                |
| C. The week that resets soonest   | no                  | yes                  | spread                |

### Knowing each account's usage

How Uraeda learns the windows of an account no process runs on. Relies on
[Claude Code's usage reports](#claude-codes-usage-reports).

| Option                                           | Credentials untouched | Spends usage | Sees usage made outside Uraeda | Documented |
| ------------------------------------------------ | --------------------- | ------------ | ------------------------------ | ---------- |
| A. `get_usage`, from a short process per account | yes                   | no           | yes                            | no         |
| B. Only the reports of running processes         | yes                   | no           | no                             | no         |
| C. The usage endpoint, with the stored token     | no                    | no           | yes                            | no         |
| D. A one-token request per account               | yes                   | a little     | yes                            | yes        |

### Showing accounts

Where accounts show: the usage pane, a session, and the settings. Relies on [Maestro](#maestro).

| Option                                            | Each account's usage visible | Says where a session runs |
| ------------------------------------------------- | ---------------------------- | ------------------------- |
| A. Bars per account, and the account on a session | yes                          | yes                       |
| B. One set of bars, of the account with most left | no                           | no                        |

### Which runtimes

Whether accounts are Claude's alone. Relies on [Codex](#codex).

| Option                                                  | The proposal | Work  |
| ------------------------------------------------------- | ------------ | ----- |
| A. Claude only, in a contract any runtime may implement | yes          | least |
| B. Claude and Codex                                     | beyond it    | more  |

### Needs no choice

- **A dead login noticed**: `claude auth status` and `get_usage` both say when a folder is signed
  out. Such an account is skipped and shown as signed out.
- **A name per account**: the folder's name, as Maestro does.

## Not checked

- A session resumed under another account, and model lists across plans: no second login in reach.
- `get_usage` on a Max login: only a Team login was in reach.
- Thariq Shihipar's post: x.com was not read, only its snippet in a search result.
- [agentsroom.dev's guide](https://agentsroom.dev/blog/how-to-use-multiple-claude-code-accounts):
  the page returned HTTP 413.
- cx and ccas, two more rotation tools named in a search result: not read.
- Any documentation of `get_usage`: none found in the pages read.
