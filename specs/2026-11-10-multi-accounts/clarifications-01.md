---
status: answered
---

# Clarifications, round 01: Multi-accounts management

> [!NOTE]
>
> Answered on 2026-11-10.
>
> - Verdict: worth building, with changes: no rotation can promise "never stopped", and signing in
>   stays in Claude Code, not in Uraeda.
> - Anthropic's terms are a risk only you can weigh. Rotating to pass a limit may not be "ordinary,
>   individual usage". Accounts that are not yours may not be used at all.
> - When Uraeda changes accounts lasts beyond this feature: it changes the run lifecycle decision.
> - Who makes each account's folder decides whether the agents decision changes.
> - Continuing a conversation under another account is not verified: it needs two logins, which only
>   you have.
> - Four points are settled under "Check these", usage credits and the public release among them.

## Context

### Goal

The [proposal](proposal.md) asks for several Claude Code logins, which Uraeda rotates by itself. The
rule is simple: the login with the most of its five-hour window left. You have three Max accounts,
and want runs that a five-hour limit never stops.

### Today

Uraeda runs Claude Code on the one login of `~/.claude`
([`claude.ts`](/packages/server/src/runner/claude.ts)). A run refused by the five-hour limit waits
for the reset, then continues by itself, at most 3 times in a row
([`continuer.ts`](/packages/server/src/runner/continuer.ts)). A run refused by a weekly limit asks
for you. The usage pane shows the windows that running sessions report.

| Product     | Accounts kept apart by             | Rotates                                | Conversation after a switch    |
| ----------- | ---------------------------------- | -------------------------------------- | ------------------------------ |
| Claude Code | a configuration folder per account | no                                     | per folder                     |
| claude-swap | swapping the login, or a folder    | at 90% used, to the most quota left    | shared history, cache rebuilt  |
| clauth      | swapping the login, or a folder    | at a threshold, down a chain you order | resumes under any account      |
| Maestro     | a folder per agent                 | no                                     | shared through a linked folder |
| Enjoy       | saved sign-ins                     | when an account runs out               | history copied, continues      |

### Scope

Several Claude Code logins, the pick between them, each one's usage, and what a session shows.
Codex's logins, API keys, and usage credits are left out.

### Sources

- The Claude runtime, its limits, and the automatic continues, linked above.
- Claude Code's documentation on authentication, environment variables, and its legal page.
- Anthropic's Consumer Terms, and its prompt caching documentation.
- The pages of claude-swap, clauth, Maestro, and Enjoy.
- Two experiments on Claude Code 2.1.322: a folder is a login, and usage is read without a turn.
- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Check these

- **Anthropic's terms** do not settle whether this is allowed. One of its staff said several Max
  accounts are fine. Its legal page says limits "assume ordinary, individual usage", enforced
  "without prior notice". Bans of holders of several Max accounts were reported in February 2026.
  The Consumer Terms forbid using an account that someone else made available to you. See
  [discovery](discovery-01.md#anthropics-terms).
- **An account is a Claude Code configuration folder**, picked with `CLAUDE_CONFIG_DIR`, the way
  Claude Code documents. Uraeda never reads, copies, or swaps a credential, so each sign-in goes
  through Claude Code. See [discovery](discovery-01.md#telling-accounts-apart).
- **Usage credits** defeat the rotation on an account that has them on: Claude Code pays past the
  limit instead of refusing. Uraeda leaves them alone, and its documentation says to turn them off.
  See [discovery](discovery-01.md#usage-credits).
- **The feature ships to everyone**, off until a second account is listed. It is built into the
  Claude runtime: the continue on a limit lives in Uraeda's core, where no extension reaches. See
  [discovery](discovery-01.md#worth-it-and-feasibility).

## Q1: When does Uraeda change accounts?

Example: a plan's build runs on account "main". At 14:00, main's five-hour limit refuses it, until
17:10. Accounts "b" and "c" have room.

Every session starts on the account with the most left, under every option. The options differ on a
session that already runs. Changing its account has two costs. The new account reads the whole
conversation again uncached, since Anthropic's caches "are isolated between organizations". The tool
call under way is redone, as after a restart.

Continuing a conversation under another account is not verified. Maestro and claude-swap say it
works when accounts share their conversations folder. The plan's first task checks it with your
logins. If it fails, a refused run starts a new session on the other account.

The more Uraeda rotates by itself, the more it looks like a loop built to pass limits, the use the
terms are least clear on. Who makes the shared conversations folder is Q2. More in
[discovery](discovery-01.md#when-to-rotate).

Why it matters: it decides whether a limit still stops a run at night. A and C change the
[run lifecycle](/specs/decisions/run-lifecycle.md) decision, which every later runtime follows.

- **A (recommended). A new session starts on the account with the most left. A run refused by a
  limit continues at once on another account, in the same session.**
  - Example: at 14:00 the build goes on under b, with a line saying why. It waits only when all
    three are out, for the first reset.
  - [pro] the proposal's goal: a five-hour limit stops a run only when every account is out.
  - [pro] a weekly limit also moves the run to another account, instead of asking for you.
  - [con] each switch spends the new account's usage on re-reading the conversation.
  - [con] the run lifecycle decision changes: a limit continues on another account before waiting.
  - Why recommended: it is the only option that meets the goal without stopping work that runs.
- **B. A new session starts on the account with the most left, and a session keeps its account. A
  refused run waits for its reset, as today.**
  - Example: the build waits until 17:11 on main. A session started at 14:05 runs on b.
  - [pro] no cache rebuilt, no decision changed, and the least like a rotation loop.
  - [con] a long run is still stopped for up to five hours.
- **C. As A, and a session also moves between two turns once its account passes 90% used.**
  - Example: the build is one long turn, so it is still refused at 14:00, then goes on under b. A
    chat on main at 91% sends its next message under b.
  - [pro] an account with usage credits is left before it pays.
  - [con] a workflow run is mostly one turn, so the threshold rarely acts before the refusal.
  - [con] more switches, each rebuilding the cache, and one more setting.

**Answer:** B: Let's just wait on limits actually hit. It should come up pretty rarely with the
rotation on session start.

## Q2: Who makes each account's folder?

Each account needs a configuration folder of its own, signed in once with `claude auth login`. A new
folder is empty: no settings, skills, plugins, `CLAUDE.md`, or conversations. For sessions to behave
alike on every account, the folder links those back to `~/.claude`, as Maestro's setup does.
Continuing a run on another account (A or C in Q1) needs the conversations folder, `projects/`,
shared.

The [agents](/specs/decisions/agents.md) decision says Uraeda "never touches their credentials or
settings". A folder of links to your settings, made by Uraeda, touches them. More in
[discovery](discovery-01.md#making-the-account-folders).

Why it matters: it decides how much you do per account, and whether the agents decision changes.

- **A (recommended). You make each folder and sign it in, from a recipe in Uraeda's documentation,
  and list the folders in the Claude extension's settings. Uraeda checks each one.**
  - Example: three commands per account, once. The settings page says "b is signed out", or "b does
    not share its conversations with main", until it is right.
  - [pro] the agents decision stands: Uraeda only reads which folders to use.
  - [pro] you choose what each account shares.
  - [con] a few commands by hand per account, and a link you forget shows as a problem.
  - Why recommended: three accounts are set up once, and the decision protects your logins.
- **B. A `ura` command makes the folder in Uraeda's data folder, links it to `~/.claude`, and starts
  Claude Code's sign-in in your terminal.**
  - Example: `ura claude account add b` opens Anthropic's sign-in page, and b shows in the usage
    pane.
  - [pro] one command per account, and every account is linked the same way.
  - [con] the agents decision changes: Uraeda makes and links agent configuration folders.
  - [con] Maestro warns that such links "may break after a Claude Code update", which Uraeda must
    then repair.

**Answer:** A: Give me the recipe at the spec step, I'll run it directly.

## Settled without the human

### Behaviour

- **The pick** is the proposal's rule: the account with the most of its five-hour window left. An
  account signed out, or with its week used up, is skipped. A tie goes to the first one listed. See
  [discovery](discovery-01.md#the-pick-rule).
- **A session's account** stays the same from turn to turn, so its cache is kept, until an answer to
  Q1 moves it. Sub-sessions each pick their own. See [discovery](discovery-01.md#the-prompt-cache).
- **Every account out** makes a run wait for the first reset among them, then continue on that
  account. See [discovery](discovery-01.md#never-stopped-cannot-be-promised).
- **A continue on another account** counts toward the cap of automatic continues, and says why in
  the session. A setting turns it off, as the run lifecycle decision asks of each kind. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The usage pane** shows each account's five hours and week under Claude Code's mark, by the
  account's name, and a session's header names its account. The spec shows mockups. See
  [discovery](discovery-01.md#showing-accounts).
- **An account's name** is its folder's name, as in Maestro: `~/.claude-work` reads "work". See
  [discovery](discovery-01.md#maestro).
- **A signed-out account** is skipped, and the usage pane and the settings page say so. See
  [discovery](discovery-01.md#claude-codes-configuration-folder).
- **Codex** stays on one login. The proposal asks for Claude logins. See
  [discovery](discovery-01.md#which-runtimes).

### Under the hood

- **Each account's usage** is asked from Claude Code itself, by its `get_usage` request, in a short
  process that spends nothing. Running sessions' reports keep it fresh. The request is undocumented,
  as the model list's is. See [discovery](discovery-01.md#knowing-each-accounts-usage).
- **Accounts in the runtime's contract** let any runtime offer them, and the tests use the fake
  agent's. See [discovery](discovery-01.md#which-runtimes).
- **The accounts setting** is a list of folders in `[extensions.claude]`, which holds no secret. See
  [discovery](discovery-01.md#important-reads).
- **The model list** is read from the first account. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).

**Notes:**

- **Anthropic's terms**: They are all my accounts.
