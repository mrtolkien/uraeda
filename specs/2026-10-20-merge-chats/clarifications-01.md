---
status: answered
---

# Clarifications, round 01: Merge chats and changes

> [!NOTE]
>
> Answered on 2026-10-20.
>
> - Verdict: worth building, with changes: a chat cannot become a change today. A change becomes a
>   feature only through a merge and a fresh start, so both moves must be built in place.
> - Who may upgrade lasts beyond this feature. An agent starting a change alone could create a
>   branch, and commit on your default branch, without your yes.
> - Where a chat works, and what it may change there, work together: they decide what happens to a
>   chat's edits on your main checkout.
> - Keeping the chat's conversation through the upgrade changes the agents decision's session rule.
> - Two gaps in the proposal: what the features' `+` opens, and whether a feature can go back down.
> - Check the settled point on the change's proposal, written from the chat in your words.

## Context

### Goal

The [proposal](proposal.md) asks for chats and changes to become one thing that grows: a chat, then
a change on its own branch, then a feature. Moving up should be smooth, and the agent should offer
it, or do it. Features get a `+` like the one next to Changes and Chats.

### Today

- A **chat** is a row in the server's session cache, run in the main checkout, with nothing in git
  ([sessions](/packages/server/src/runner/sessions.ts)). It can be renamed and archived.
- A **change** starts from the "New change" page or a draft, with its own branch `change/<folder>`,
  worktree, and session ([New change](/packages/web/src/NewChangePage.tsx)). It runs the light flow:
  tests, review, a pull request ([change.md](/skills/uraeda/references/change.md)).
- When a chat asks for code, the skill's rule 8 has the agent offer a change in plain text. On yes,
  it starts the change as a new session, and "the chat stays a chat"
  ([SKILL.md](/skills/uraeda/SKILL.md)). Nothing in the UI supports the offer.
- A change becomes a feature through a round of questions. Then its code is reverted, its folder
  moved to `drafts/`, the branch merged, and the draft started again with a new session
  ([upgrading](/skills/uraeda/references/change.md#upgrading)).
- The sidebar has Changes with "＋ New change", Features with no `+`, then Chats with "＋ New chat"
  ([sidebar](/packages/web/src/sidebar/Sidebar.tsx)).

| Product     | Unit                      | How work moves to a branch                                     | Conversation kept |
| ----------- | ------------------------- | -------------------------------------------------------------- | ----------------- |
| Codex       | a chat, local or worktree | a Hand off button, uncommitted changes moved                   | whole             |
| Copilot     | a chat                    | a Delegate button, "Include changes" or "Ignore changes"       | whole             |
| Claude Code | a session                 | asked to "work in a worktree", uncommitted changes not carried | whole             |
| Cursor      | an agent                  | moved into a worktree; suggests Plan Mode itself               | not documented    |
| Kiro        | a session                 | switch to Spec mode, no branch                                 | whole             |

### Scope

Starting and listing chats and changes, the move from a chat to a change, the move from a change to
a feature, and the features' `+`. The change flow's steps stay as they are. A chat's right column
stays in its [own draft](/specs/drafts/chat-right-column.md).

### Sources

- The server's runner and fate mutations, the sidebar, and the New change page, linked above.
- The core's branch rules, and the skill's rule 8 and change reference, linked above.
- Codex, Copilot, Claude Code, Cursor, Kiro, Conductor, Spec Kit, and superpowers documentation.
- Two checks: a Claude Code session resumes from another folder, and a worktree's branch can be
  renamed in place.
- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: Who may move a chat up to a change, or a change up to a feature?

Starting a change or a feature is a human action today. Rule 8 lets the agent offer a change, and
start it only on your yes. Your proposal says the agent "should be able to upgrade it itself too if
necessary, or at least offer it". Every product read leaves the move to a human's button. Cursor
suggests Plan Mode by itself, and superpowers tells the agent to "stop, say so, and step up a size".
More in [discovery](discovery-01.md#who-upgrades).

During an unattended run, nobody is there to click: the change-to-feature offer stays a round of
questions, as today, under every option.

Why it matters: this becomes a rule of the [agents decision](/specs/decisions/agents.md), which
every later agent follows. An agent upgrading alone creates a branch and a worktree. It also commits
the **Now** entry on your default branch, without asking.

- **A (recommended). The agent offers the upgrade in the session, as a card with a button. The card
  shows the title, the text, and the slug, which you can edit. An upgrade button sits in the
  session's header too.**
  - [pro] one click, and nothing starts without you.
  - [con] the agent waits for your click before it goes on.
  - Why recommended: it keeps principle I, "humans stay in control", at the cost of one click.
- **B. The agent upgrades by itself when the work calls for it, and says so in the session. You can
  undo the upgrade from there.**
  - [pro] no wait at all: the work goes on.
  - [con] branches, worktrees, and default-branch commits appear without your yes.
- **C. A button in the session's header only, with no offer from the agent.**
  - [pro] the agent never interrupts.
  - [con] you must notice yourself that a chat has outgrown itself.

**Answer:** A

## Q2: Where does a new chat work?

A chat runs in your main checkout today, so its edits mix with yours. Codex and Claude Code start
there by default too, with a worktree as a toggle. Conductor gives every workspace its own worktree
and branch from the start. Inbox triage and the decisions check run as chats that must write on the
default branch ([git decision](/specs/decisions/git.md)). More in
[discovery](discovery-01.md#where-a-chat-works).

What a chat may change on the main checkout is the follow-up, only with A.

Why it matters: it decides whether an upgrade has to move edits off your checkout, and how much disk
and setup each chat costs.

- **A (recommended). In the main checkout, as today. The chat moves to the change's worktree when it
  is upgraded.**
  - [pro] instant start, and chit chat sees your checkout as it is.
  - [con] the upgrade must move the chat's edits off your checkout.
  - Why recommended: most chats never grow, and they should cost nothing.
- **B. In a worktree of its own, from a detached `HEAD`, from the first message. The upgrade names
  its branch.**
  - [pro] nothing to move: a chat's edits never touch your checkout.
  - [con] a worktree per chat, to set up and clean up. Inbox triage would still need the main
    checkout.

**Answer:** Anywhere? A chat is an agent running, it could create a branch or a worktree. It's just
not structured with a workflow. So yeah it starts in main but could decide to move.

Changes and features are workflows. Chats are unstructured, like a "normal" agent.

### Q2.A: What may a chat change on your main checkout?

Only if you picked the main checkout, A in Q2. Rule 8 lets a chat on the main checkout fix typos,
formatting, and comments, and offer a change for any other code. Your proposal describes a chat as
"chit chat or targeted change", like plain Claude Code, which edits freely. Chats never commit code
to the default branch under any option below. More in
[discovery](discovery-01.md#what-a-chat-may-change).

Why it matters: it sets where a chat stops and a change starts, and what an upgrade must carry.

- **A (recommended). Targeted edits you ask for, left uncommitted for you to review. Larger work
  gets the upgrade offer first. On an upgrade, the files the chat edited move to the change's
  worktree and leave your checkout. Any other uncommitted file stays where it is.**
  - [pro] works like plain Claude Code for small things, and your own edits are never moved.
  - [con] a file the chat changed through a shell command, not its edit tools, is not moved.
  - Why recommended: it matches your "targeted change", and leaves your own work untouched.
- **B. Today's rule: typos, formatting, and comments only. Any other code is offered as a change
  before a line is written.**
  - [pro] your checkout stays clean, and an upgrade moves nothing.
  - [con] the short iteration loop of plain Claude Code is gone from chats.
- **C. Targeted edits you ask for, and on an upgrade every uncommitted change moves, after a list
  you confirm.**
  - [pro] nothing the chat did is left behind.
  - [con] your own unrelated edits move too, unless you untick them.

**Answer:**

## Q3: Does the chat's conversation become the change's session?

Today a change from a chat starts a new session: the agent starts over from the proposal. Codex,
Copilot, and Claude Code keep the whole conversation when work moves. Claude Code's desktop keeps a
summary when moving to the cloud. A Claude Code session resumes from another folder: checked in this
round. More in [discovery](discovery-01.md#keeping-the-session).

Why it matters: the [agents decision](/specs/decisions/agents.md) says "a feature must have one
session, in its worktree". Option A rewords it so a chat's session may become that session.

- **A (recommended). The chat's session becomes the change's session, in its worktree. The agent is
  told it now works on the change's branch, and the chat leaves the Chats list for the change.**
  - [pro] nothing to repeat: the agent keeps all it learned.
  - [con] a long chat carries its whole history into the change's runs.
  - Why recommended: smooth switching is the point of the proposal.
- **B. A new session for the change, whose first message links the chat. The chat stays in the Chats
  list.**
  - [pro] the change's runs start clean, and the decision stays as it is.
  - [con] the agent rereads what the chat already settled, and you follow two sessions.

**Answer:** A: Well I'm again a "Chats list" that's the thing.

We need to align session everywhere: an agent run is a session, whether it's a chat, a change, or a
feature.

What changes is the workflow around.

## Q4: How does a change become a feature?

Today, after you answer yes in a round, the change's code is reverted and its folder moved to
`drafts/`. The branch is merged into the default branch, removed, and you start the draft again, as
a new feature with a new session. A change and a feature share the same dated folder name and
worktree. Only the branch's `change/` prefix and the folder's place differ, so the move can happen
on the same branch: checked in this round. More in [discovery](discovery-01.md#change-to-feature).

A feature's plan builds its code test by test, from an approved spec. Code written before the spec
would skip that.

Why it matters: it decides whether the upgrade is one step or a restart, and what happens to code
the change already wrote.

- **A (recommended). On the same branch: the branch loses its `change/` prefix, and the folder moves
  to `specs/`. The code is reverted, kept in the history for the discovery to read, and the session
  goes on with the feature's discovery.**
  - [pro] one move, no merge and no restart, and the conversation stays.
  - [con] the code is written again, test by test, by the plan.
  - Why recommended: it is smooth, and keeps the feature's tests-first plan intact.
- **B. On the same branch, keeping the code. The spec and plan describe it as already built.**
  - [pro] nothing is written twice.
  - [con] code reaches the feature before any approved spec or test-first plan.
- **C. As today: postpone, merge, and start again from the draft.**
  - [pro] nothing new to build.
  - [con] a merge, a fresh start, and a new session: not smooth.

**Answer:** B: Well if it upgrades to a feature it should mean that the scope of the code changes is
too big, so there would have been no code changes.

The upgrade from change to feature should be before or after clarification, if the agent decides
that this is a big change requiring specs approval

## Q5: How do chats and changes show and start in the sidebar?

Today Changes and Chats are two sections, each with its "＋ New" row. Every product read starts work
from one composer, with a mode or an environment picked before the first message. None has a
separate "new change" screen. With an upgrade from a chat, a change can also start from a chat. More
in [discovery](discovery-01.md#the-sidebar).

Why it matters: it sets how you start any work with the agent, and whether "change" stays a word you
see.

- **A (recommended). One section, Chats, holding chats and changes, newest first. A change's row
  shows its step, like a feature's. One "＋ New chat" row; the New change page goes, and a change
  starts from a chat or a draft.**
  - [pro] one place to start, and a chat's row simply gains a step when it grows.
  - [con] starting a change directly takes a chat message and a click.
  - Why recommended: it is the merge the proposal asks for, with the least to learn.
- **B. One section, as in A, and the New chat page has a "Start as a change" toggle with a slug
  field.**
  - [pro] a change still starts in one step when you know it is one.
  - [con] one more control on every new chat.
- **C. Two sections as today, with only the upgrade moves added.**
  - [pro] nothing changes in the sidebar.
  - [con] the two concepts stay apart, against the proposal.

**Answer:** Let's use the "Session" word everywhere. As I said above, we have raw sessions (chat
today) that can also be attached to a workflow (change or feature)

This way it's more coherent and there are less concepts to learn. And that's how people use agents.

Imo we should make it a single thing:

- A sidebar with ongoing sessions, changes, and features
- A "done" part with the 5 last finished sessions/changes/features
- A single button to start any of those, with a selector to select which we want to start (session =
  opens the composer, change = opens the composer and offers to pick a line from inbox/priorities,
  feature = offers to open a line from inbox/priorities/write a proposal from scratch)

## Q6: What does the `+` next to Features open?

Features start only from a draft today, in the editor or the priorities pane. The New change page
starts a change from a typed request and a slug. Kiro's `+` under Specs starts a spec at once. More
in [discovery](discovery-01.md#the-features-).

Why it matters: it decides whether a feature can start without writing a draft first.

- **A (recommended). A New feature page: you type the proposal, pick a slug and the discovery
  effort, and "Start the feature" starts it and its discovery.**
  - [pro] a feature in one step, like a change today.
  - [con] a proposal typed in a composer has no images unless pasted.
  - Why recommended: it mirrors the page changes have today, and reuses it.
- **B. A new draft, opened in the editor, not started.**
  - [pro] room to write a long proposal first.
  - [con] starting is a second step.
- **C. A chat whose agent helps you write the proposal, then offers to start it as a feature.**
  - [pro] the proposal comes out sharper.
  - [con] the proposal is no longer purely in your words.

**Answer:** Answered above

## Q7: Can a feature go back down to a change, or a change to a chat?

Your proposal speaks of switching "between flows smoothly", without naming a direction. No product
read documents a move down. Today a feature that turns out small can be postponed or dropped. More
in [discovery](discovery-01.md#going-down).

Why it matters: a move down needs its own path in the skill and the code.

- **A (recommended). Upward moves only. A feature that turns out small is postponed or dropped, as
  today.**
  - [pro] less to build and explain.
  - [con] a small feature keeps its full flow, or is restarted.
  - Why recommended: no one has asked for it yet, and it can come later.
- **B. A feature before its spec is approved can become a change, on the same branch.**
  - [pro] a feature that turns out small loses no time.
  - [con] a reverse move to build, test, and document.

**Answer:** A: A feature that turns out small is just finished fast?

## Settled without the human

### Check these

- **The change's proposal** is the chat's request in your words, as rule 8 does today. The agent
  proposes a title and a slug, which you edit before starting. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The light flow stays.** A change keeps its steps, tests, review, and pull request; only how it
  starts and shows changes. See [discovery](discovery-01.md#what-merge-means).

### Behaviour

- **Inbox triage and the decisions check** stay chats on the main checkout, since they write on the
  default branch. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **A chat that becomes a change** loses rename and archive, like every change: its name is its
  proposal's title, and it ends with its record. See [discovery](discovery-01.md#important-reads).
- **The upgraded change's entry** goes to the top of **Now**, committed on the default branch, as
  starting a change does today. See [discovery](discovery-01.md#rules-and-their-owners).

### Under the hood

- **The session's link to its change** lives in the server's cache only, set once on the upgrade.
  Losing it loses the chat's history, never workflow state, which stays in git. See
  [discovery](discovery-01.md#rules-and-their-owners).
- **The branch** is named from the slug, as `ura start` names it. See
  [discovery](discovery-01.md#needs-no-choice).
- **The CLI** gets the change-to-feature move, with the skill describing the same steps by hand, as
  the [CLI decision](/specs/decisions/cli.md) asks. See [discovery](discovery-01.md#likely-changes).

**Notes:**
