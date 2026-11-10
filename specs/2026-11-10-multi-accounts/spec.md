---
status: approved
revision: 2
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Multi-accounts management

> [!NOTE]
>
> Approved on 2026-11-10.
>
> - You approve new Claude Code sessions starting on the listed account with the most of its five
>   hours left, each session keeping its account. Home shows each account's five hours and week, and
>   the sidebar its five hours.
> - Since your review: the week leaves the sidebar, the recipe is the script from our chat, and your
>   three folders are named for smoke tests.
> - The week leaves the sidebar for Codex too, and when no account is listed: your comment pointed
>   at Codex's line. Say so if you meant Claude's accounts only.
> - In the sidebar, an account whose week is used up reads as any other, though no session starts on
>   it. Home shows why.
> - Reading usage without a turn is now checked on your three folders: each answered, at no cost.
>   They are Team seats, so a Max login stays unchecked.
> - The models decision still gains one rule: a session keeps its account.
> - Risk tier `medium`, as before: the sessions' cache gets one column, and the plan does not wait.

You list the configuration folders of your Claude Code accounts in the settings. Each new session
then starts on the account with the most of its five-hour window left, and keeps it. Home and the
sidebar show each account's usage, and the settings say when an account needs you. See the
[proposal](proposal.md), [discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## Your review

- **C1** (the week in the sidebar): done. The sidebar shows each login's five hours only, for Codex
  too and when no account is listed. The week shows on Home.
- **C2** (the recipe as the script, and your folders): done. The first story holds the script from
  our chat. The assumptions name `~/.claude-gary`, `~/.claude-leo`, and `~/.claude-tato` for smoke
  tests by hand.
- **C3** (the week only on Home): done. In the sidebar, an account whose week is used up reads as
  any other. Home shows its week at 0%.

## Decisions

- **Changed: [Models](../decisions/models.md)**. A session keeps the account it started on, as it
  keeps its agent and its model, even when a limit refuses its run.

Relied on:

| Decision                                       | What it means for this spec                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| [Agents](../decisions/agents.md)               | Uraeda reads no credential: you make and sign in each folder, and tests use a fake |
| [Run lifecycle](../decisions/run-lifecycle.md) | unchanged: a run a limit refused waits for the reset, then continues               |
| [Run options](../decisions/run-options.md)     | each sub-agent is a session, so each picks its own account                         |
| [Settings](../decisions/settings.md)           | the accounts are a list of folders in `config.toml`, which holds no secret         |
| [Extensions](../decisions/extensions.md)       | the list is a setting of the built-in Claude extension, with its banner            |
| [Preview](../decisions/preview.md)             | the mockups are stories of the real components                                     |
| [Documentation](../decisions/documentation.md) | the script goes to the web UI's page, beside the sessions' requirements            |

## User stories

### US1: New sessions start on the account with the most left (P1)

You make a folder per extra account, sign it in, and list the folders in Settings, Extensions, under
Claude Code. Each new session then picks an account as its first turn starts, and its header names
it.

For each extra account, once, save this script and run it from any shell, as
`bash claude-account.sh b`. It asks for the name when none is given, and is safe to run again:

```bash
#!/usr/bin/env bash
# Makes a Claude Code configuration folder for one more account, ~/.claude-<name>, linked to the
# settings, skills, plugins, hooks, memory, and conversations of ~/.claude, then signs it in.
# Usage: bash claude-account.sh [name]
set -euo pipefail

name="${1:-}"
if [ -z "$name" ]; then
  read -r -p "Account name (letters, digits, - or _): " name
fi
if ! [[ "$name" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "Not a name: '$name'. Use letters, digits, - or _." >&2
  exit 1
fi

source_dir="$HOME/.claude"
account_dir="$HOME/.claude-$name"
if [ ! -d "$source_dir" ]; then
  echo "No $source_dir: sign in to Claude Code once first." >&2
  exit 1
fi

mkdir -p "$account_dir"
for item in settings.json CLAUDE.md skills plugins commands agents hooks statusline.sh projects; do
  if [ ! -e "$source_dir/$item" ]; then
    continue
  fi
  if [ -e "$account_dir/$item" ] || [ -L "$account_dir/$item" ]; then
    echo "kept    $account_dir/$item"
  else
    ln -s "$source_dir/$item" "$account_dir/$item"
    echo "linked  $account_dir/$item"
  fi
done

echo
echo "Signing in $account_dir: pick the account for '$name' in the browser."
CLAUDE_CONFIG_DIR="$account_dir" claude auth login
echo
CLAUDE_CONFIG_DIR="$account_dir" claude auth status --text
echo
echo "Done. The folder to list in Uraeda's settings: ~/.claude-$name"
```

The links share your settings, skills, plugins, hooks, memory, and conversations with `~/.claude`.
MCP servers added for your user live in each folder's own `.claude.json`: add them again with
`CLAUDE_CONFIG_DIR` set. Then list the folders, in the order they should show:

```toml
[extensions.claude]
accounts = ["~/.claude", "~/.claude-b", "~/.claude-c"]
```

[Claude Code's Accounts setting](/packages/web/src/settings/SettingsView.stories.tsx#ExtensionsAccounts)

[A session's header, on account b](/packages/web/src/AccountsMockups.stories.tsx#SessionOnAccount)

The pick, among the listed accounts that are signed in and whose week is not used up:

1. the one with the most of its five hours left;
2. on a tie, the one whose five hours reset first;
3. then the first one listed.

When every signed-in account's week is used up, the first signed-in one listed is picked.

Key scenarios:

1. **Given** the accounts `default`, `b`, and `c`, with 42%, 0%, and 88% of their five hours used,
   **When** a new session's first turn starts, **Then** it runs on `b`, and its header reads "Claude
   Code · b · Opus 5.5 · High".
2. **Given** that session, with `b` now at 95% and `default` at 42%, **When** its next turn starts,
   **Then** it still runs on `b`.
3. **Given** that session refused by `b`'s five-hour limit until 17:10, while `c` has room, **When**
   its turn fails, **Then** its run waits, and continues on `b` at 17:11.

More scenarios:

1. **Given** `default` at 42%, `b` signed out, and `c` at 20% with its week used up, **When** a new
   session's first turn starts, **Then** it runs on `default`.
2. **Given** `default` and `b` both unused, **When** a new session's first turn starts, **Then** it
   runs on `default`, the first listed.
3. **Given** every account's five hours used up, resetting at 15:08, 17:38, and 13:38, **When** a
   new session's first turn starts, **Then** it runs on `c`, which resets first.
4. **Given** no account listed, **When** a session starts, **Then** it runs on the server's own
   login, as today, and its header names no account.
5. **Given** a build that starts two sub-agents, **When** each one's first turn starts, **Then**
   each picks its own account, from the usage known then.
6. **Given** a session on `b` and a server restart, **When** its run continues, **Then** it runs on
   `b`.

### US2: See each account's usage (P2)

Home's Usage pane lists each account under Claude Code's mark, by its name, with its five hours and
its week. The sidebar's pane shows one line per login, its five hours: the week shows on Home only,
for every agent. An account's name is its folder's name without its dot and its `claude-`:
`~/.claude-b` reads "b", and `~/.claude` reads "default".

[Home's Usage pane, three accounts](/packages/web/src/AccountsMockups.stories.tsx#HomeThreeAccounts)

[The sidebar's Usage pane, three accounts](/packages/web/src/AccountsMockups.stories.tsx#SidebarThreeAccounts)

Uraeda asks Claude Code for each account's usage, which spends nothing. It asks when the server
starts, when the list changes, before a pick, and when Home or the settings open, at most once a
minute. A running session's own reports keep its account fresh.

Key scenarios:

1. **Given** the three accounts, **When** Home shows, **Then** its Usage pane lists `default`, `b`,
   and `c` in that order, `default` with "5h 58% left - reset 15:08" and its week, then Codex's
   windows.
2. **Given** the three accounts, **When** the sidebar shows, **Then** its pane has one line per
   account, like "default 5h 58% · 15:08", then Codex's five hours, and no week.
3. **Given** the sidebar closed to its rail, and a session on `b` in view, **When** the rail shows,
   **Then** its bar is `b`'s five hours. With no session in view, it is the account a new session
   would start on.

More scenarios:

1. **Given** `b` with no five-hour window open, **When** the panes show, **Then** `b` reads "5h 100%
   left" on Home and "b 5h 100%" in the sidebar, with no reset time.
2. **Given** no account listed, **When** the panes show, **Then** Home reads as today, and the
   sidebar shows each agent's five hours, without its week.

### US3: Know when an account needs you (P3)

An account that is signed out, or whose folder is missing, is never picked. A banner of Settings,
Extensions names it, and the usage panes say so. An account whose week is used up shows it on Home,
at 0%. In the sidebar it reads as any other account.

[Home's Usage pane, b signed out and c's week used up](/packages/web/src/AccountsMockups.stories.tsx#HomeNeedingYou)

[The sidebar's Usage pane, b signed out and c's week used up](/packages/web/src/AccountsMockups.stories.tsx#SidebarNeedingYou)

Key scenarios:

1. **Given** `b` signed out, **When** the settings' Extensions section shows, **Then** a banner
   reads "Claude Code: account b is signed out, in ~/.claude-b", Home reads "b · signed out", and
   the sidebar "b signed out".
2. **Given** `~/.claude-c` listed and missing, **When** the section shows, **Then** a banner reads
   "Claude Code: account c has no folder at ~/.claude-c".
3. **Given** `c`'s week used up, resetting Wednesday at 18:38, and 20% of its five hours used,
   **When** the panes show, **Then** Home reads "Week 0% left - reset Wed 18:38" in the error
   colour, and the sidebar reads "c 5h 80% · 16:38".

More scenarios:

1. **Given** `b` signed in again from a terminal, **When** Home or the settings open a minute later,
   **Then** the banner and "signed out" are gone.
2. **Given** a line `docs` in the list, **When** the section shows, **Then** a banner reads "Claude
   Code: account folder docs is not an absolute path", and the line is left out.

## Replaced behaviour

- **A session's transcript is looked for in one configuration folder.** Guarded by
  `packages/server/src/runner/__tests__/claude.test.ts`, "a session exists when its transcript is
  found". It is looked for in the session's account's folder.
- **A runtime's usage is one list of windows, gone when its processes exit.** Guarded by
  `packages/server/src/runner/__tests__/usage.test.ts`, "the newest live report wins across
  repositories and falls back when its process exits" and "each window keeps the newest live report
  of its own, and a report without the week keeps it". With accounts, usage is kept per account, and
  an asked usage stays when a process exits.

- **The sidebar's Usage pane lists every window of an agent, its week included.** No test guards it.
  It lists each login's five hours only.

## Architecture

An account is a Claude Code configuration folder, given to a session's process as
`CLAUDE_CONFIG_DIR`, the way
[Claude Code documents](discovery-01.md#claude-codes-configuration-folder). Accounts join the
contract every runtime is reached through, so the pick stays agent-neutral and the tests run on the
fake agent. Usage comes from Claude Code's own
[usage request](discovery-01.md#claude-codes-usage-reports), in a short process per account, as the
model list is read today.

- **The runtime's accounts** are an optional part of the runtime's contract: the accounts a runtime
  offers, each with its name, its state, and its usage windows, and the account a process opens on.
- **Claude's accounts** turn the setting into accounts. They own what an account is, a folder, its
  name, its state from `claude auth status`, and Claude Code's usage request and its format.
- **The account pick** chooses a new session's account as its first turn starts, and stores it with
  the session. It owns the pick's rule and how fresh usage must be: at most a minute old, waiting at
  most 10 seconds for the answers.
- **Usage per account** replaces the runtime's one list of windows where a runtime has accounts. It
  owns which report wins: the freshest, of a running process or of an ask.
- **The usage views**, Home's pane, the sidebar's, and the rail's bar, draw accounts from one shared
  component.
- **The account's problems** reach the settings as the Claude extension's own, through the banner
  that names an extension running with a problem.

Tradeoffs:

- A session's first turn may start up to 10 seconds later, while usage is asked.
- The usage request is undocumented, as the model list's is: a Claude Code update can break it.
- Sub-agents that start together pick from the same usage, so they may share one account.

## Edge cases

| Importance | Situation                                             | What happens                                                                                                                   |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| High       | A session's account is signed out since it started    | its turn fails in Claude Code's own words, as today; the banner and the panes name the account; the session keeps it           |
| High       | An account's usage cannot be read                     | it is picked after every account whose usage is known; the panes keep its last windows                                         |
| Normal     | No listed account is signed in                        | a new session's turn is refused: "No Claude Code account is signed in: sign one in, or empty Accounts in Settings, Extensions" |
| Normal     | An account leaves the list while a session runs on it | the session keeps it: the list only decides new sessions                                                                       |
| Normal     | The list changes while sessions work                  | the runtime reloads once their turns end, as for any of its settings                                                           |
| Normal     | A session started before the feature, or with no list | it stays on the server's own login                                                                                             |
| Normal     | You use an account in a terminal                      | the next ask sees it, since Claude Code answers for the whole account                                                          |
| Niche      | A folder is listed twice                              | it is one account                                                                                                              |
| Niche      | Two folders have the same name                        | the second shows its path as its name                                                                                          |
| Niche      | Two folders are signed in to the same account         | they are two accounts with the same usage                                                                                      |
| Niche      | An API key is set in the server's environment         | Claude Code uses the key on every account; the documentation says so                                                           |
| Niche      | An account has usage credits on                       | it is never refused, so it pays past its limit; the documentation says to turn them off                                        |
| Niche      | An account's plan lists other models than the first's | the model list is the first account's; a model the account lacks fails the turn in Claude Code's words                         |

## Success criteria

- **SC-001** (the pick): With three accounts at 42%, 0%, and 88% of their five hours used, a new
  session runs on the second.
- **SC-002** (no credential): Uraeda gives a process its account only as `CLAUDE_CONFIG_DIR`, and
  opens no file of an account's folder but its transcripts' names.
- **SC-003** (off by default): With no account listed, a session starts with no extra process, and
  stores no account.
- **SC-004** (10 seconds): A pick delays a session's first turn by at most 10 seconds.
- **SC-005** (one ask a minute): Each account's usage is asked at most once a minute.

## Assumptions

The points settled in the clarifications, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there, but
where your answers changed them. A session keeps its account and waits for its own reset, so nothing
continues on another account. You said the three accounts are yours. Settled while writing this
spec:

- The pick happens at a session's first turn, not when the session is made, so it uses the usage of
  that moment.
- A tie on the five hours left goes to the account that resets first, before the first listed. See
  [the pick rule](discovery-01.md#the-pick-rule).
- An account with no five-hour window open counts as unused. Claude Code answers 0% and no reset
  time for it, as checked on one of your folders.
- `~/.claude-gary`, `~/.claude-leo`, and `~/.claude-tato` may be used for smoke tests by hand during
  the build, as you said. Automated tests stay on the fake agent.
- The script lives in the documentation, as written in the first story.
- Only the five hours and the week are read. A model's own weekly limit is not: a run it refuses
  asks for you, as today.
- You cannot pick a session's account yourself: no picker is added.
- The list holds for every repository. A repository's own value is not read, as for Command.
- The documentation says in one sentence that Anthropic's terms forbid using someone else's account,
  and that limits "assume ordinary, individual usage". See
  [Anthropic's terms](discovery-01.md#anthropics-terms).
- Reviewers' and benchmarks' sessions pick an account like any other session.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Risk tier

**Medium**: one new column in the sessions' cache and one setting, a small UI change, and no change
to how a run continues.

## History

> [!NOTE]
>
> Changes requested on 2026-11-10: 3 comments in spec-review.md.
>
> - You approve new Claude Code sessions starting on the listed account with the most of its five
>   hours left, each session keeping its account, and each account's usage on Home and the sidebar.
> - The models decision gains one rule: a session keeps its account. The round said your answer
>   changed no decision. Say so if the rule should stay in this spec only.
> - The recipe you asked for is in the first story. It was checked here up to the sign-in: a linked
>   folder reads your settings, and stays signed out until its own login.
> - Reading usage without a turn is unverified on a Max login: only a Team login was in reach. The
>   plan's first task checks it with yours. If it fails, the pick only knows running sessions'
>   usage.
> - A refused run waits for its own account's reset, even while another account has room, as you
>   chose.
> - The sidebar shows one line per account, its five hours. The week shows on Home.
> - Risk tier `medium`: the sessions' cache gets one column. The plan does not wait for a review.
