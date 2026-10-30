---
kind: feature
finished: 2026-10-21
pull-request: https://github.com/mrtolkien/uraeda/pull/53
superseded-by: [2026-10-30-commits-shouldn, 2026-10-30-proposal-start]
---

# Record: Merge chats and changes

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-20, finished on
> 2026-10-21, in [its pull request](https://github.com/mrtolkien/uraeda/pull/53). Its full files are
> in git: `git log -- specs/2026-10-20-merge-chats/`.
>
> Superseded in part by [2026-10-30-commits-shouldn](2026-10-30-commits-shouldn.md).
>
> Superseded in part by [2026-10-30-proposal-start](2026-10-30-proposal-start.md).

## What and why

Chats and changes become one thing, the session: a conversation with the agent, with a workflow that
can grow around it, none, a change, then a feature. A chat was a change that had not grown yet, and
a change a feature that had not: the human wanted to move between them smoothly, the agent offering
each move, and one place to start any of them. "Chat" leaves the UI: every conversation is a
session.

## Behaviour

- **One list.** The sidebar lists every session in progress, with or without a workflow, in one
  Sessions section, oldest started first, so rows never jump while agents work. Every row is one
  card: its icon, name, status, and "…", the icon telling its kind, a speech bubble for a session, a
  wrench for a change, and a feature's step icon for a feature. A second line shows only a task's
  progress or the lines changed. Needs you sits above, and Done below.
- **Done.** A session is done once read to its last message, and idle; a change or a feature once
  its pull request is merged. Done lists the latest five. A reply brings a done session back at its
  place. An archived session leaves the list and Done, and search still finds it. The open session
  stays in the list until its page is left.
- **Addresses.** A session lives at `/sessions/<id>`; the old `/chats/<id>`, `/chats/new`, and
  `/changes/new` redirect, keeping their query and hash. A session of a change or a feature, opened
  at its own address, draws as that item's session page.
- **One "＋ New".** The New page picks a session, a change, or a feature, its kind in the address,
  `/new?kind=`, each with a sentence, and the steps that wait on the human for a change and a
  feature. A change starts from typed text, an inbox note, or a priority line, its first run sent at
  once; a note started as a change leaves the inbox in its own commit, and stays when the start is
  refused. A feature starts from a new title, put first among **Now**'s unstarted entries, or from a
  note or a line, as a draft opened in the editor.
- **A session becomes a change.** The agent offers it in a fenced `uraeda-offer change` block, which
  the session draws as a card, or the human picks "Make it a change" in the "…" beside Send. The
  human edits the proposal and slug, and the same session goes on in the change's worktree, told to
  carry over the files it edited in the main checkout. Only the latest offer has buttons; a block
  draws as a card only once its message has ended, whatever its line ends. A typed change starts
  over uncommitted changes in the main checkout, refusing only staged files. "Start the change"
  waits while the agent is unavailable, so the session's carry-over message is never lost.
- **A change becomes a feature, in place.** Offered in a `uraeda-offer feature` block, or asked in a
  round when nobody follows the run, before or after the change's round. On yes, one commit on the
  default branch relinks **Now** and moves the change's folder to `specs/`; the branch loses its
  `change/` prefix, with its upstream unset; the folder moves on the branch; decisions the change
  applied go back to `proposed`. The code stays. `ura start <change> --feature` does it. Refused for
  a change with a pull request, asked of `gh` first, or the last known ones without it; uncommitted
  or untracked changes in its worktree or its folder; a merged change; or a taken name. A refused
  first commit puts the priorities and the folder back as they were, and a move run again after a
  partial failure completes without a second entry.
- **Several sessions per change or feature.** A change's or a feature's page lists its sessions,
  latest first, with their status, start, and running sub-agents, and "New session", which opens a
  new session in its worktree on its own page. A step that started a fresh agent session now starts
  a new session. Only one session of a change or a feature works at a time: the others' messages
  wait or are refused with "Another session of this feature is working". Runs go to the latest
  session. A feature's status is its latest session's, raised only by an older one that works or is
  blocked.
- **The "…" beside Send.** A session's actions: "Make it a change", Rename, Archive for a session
  without a workflow; "Make it a feature", Rename, "Drop the change…" for a change; Rename and "Drop
  the feature…" for a feature. Every session can be renamed.
- **Drop.** Behind a confirmation, dropping removes the **Now** entry and the item's folder on the
  default branch in one commit, removes its worktree when it has no uncommitted changes, never
  forced, archives its sessions, and keeps its branch: the confirmation names
  `git branch -D <branch>`. The priorities are committed alone, only when they had no other change.
  A dropped item's sessions refuse new messages, runs, and New session with "This change or feature
  was dropped: its branch stays.", so nothing recreates its worktree. Until its branch is deleted,
  the dropped item still reads as in flight, listed in `ura status` and the sidebar.
- **Colours** of items are gone; a saved colour is ignored on read and dropped at the next write.

## Design

The session cache already held chats and workflow sessions in one table, its folder empty for a
chat. A move up sets that folder once; a change or a feature holds several rows. The agent proposes
through a fenced block the page draws as a card, and the server performs the move on the human's
click. The core owns every git and file move.

- The in-place move, [`actions/promote.rs`](/crates/core/src/actions/promote.rs), with
  [`git/branches.rs`](/crates/core/src/git/branches.rs), behind `ura start <change> --feature`
  ([`crates/cli/src/start.rs`](/crates/cli/src/start.rs)); the drop,
  [`actions/drop.rs`](/crates/core/src/actions/drop.rs), sharing `clean`'s never-forced worktree
  step.
- The session store, [`runner/cache.ts`](/packages/server/src/runner/cache.ts), with migration 6
  dropping the one-session-per-feature index, `folderSessions`, `latestSession`, and `attach`.
- One working session per folder, owned by
  [`LiveSessions`](/packages/server/src/runner/live-sessions.ts), called from
  [`send.ts`](/packages/server/src/runner/send.ts) and the queued turns; a move or a drop holds the
  folder through the core's call.
- The moves, [`fate/session-moves.ts`](/packages/server/src/fate/session-moves.ts), and the starts
  that send their first run, [`fate/change-starts.ts`](/packages/server/src/fate/change-starts.ts).
- Done and statuses, [`runner/status.ts`](/packages/server/src/runner/status.ts) and
  [`fate/sessions.ts`](/packages/server/src/fate/sessions.ts).
- The sidebar, [`sidebar/Sidebar.tsx`](/packages/web/src/sidebar/Sidebar.tsx) and
  [`ItemCard.tsx`](/packages/web/src/sidebar/ItemCard.tsx); the New page,
  [`NewPage.tsx`](/packages/web/src/NewPage.tsx) and
  [`useStartFrom.ts`](/packages/web/src/useStartFrom.ts); the session's actions,
  [`SessionActions.tsx`](/packages/web/src/SessionActions.tsx); the offer card,
  [`OfferCard.tsx`](/packages/web/src/OfferCard.tsx), drawn through a fence plugin of
  [`Prose.tsx`](/packages/web/src/Prose.tsx); a feature's sessions,
  [`feature/SessionsCard.tsx`](/packages/web/src/feature/SessionsCard.tsx).
- The skill: rule 8 offers a change in a session; [`change.md`](/skills/uraeda/references/change.md)
  holds the offer block and the in-place move,
  [`projects.md`](/skills/uraeda/references/projects.md) the drop.

## Questions

### Round 01

#### Q1: Who may move a chat up to a change, or a change up to a feature?

**Answer:** A: the agent offers the move as a card with a button, and a button sits in the session
too; nothing starts without the human.

#### Q2: Where does a new chat work?

**Answer:** In its own words: "A chat is an agent running, it could create a branch or a worktree.
It's just not structured with a workflow. So yeah it starts in main but could decide to move."

#### Q3: Does the chat's conversation become the change's session?

**Answer:** A: the chat's session becomes the change's. "We need to align session everywhere: an
agent run is a session, whether it's a chat, a change, or a feature. What changes is the workflow
around."

#### Q4: How does a change become a feature?

**Answer:** B: on the same branch, keeping the code, offered before or after the change's round when
the agent finds it needs an approved spec.

#### Q5: How do chats and changes show and start in the sidebar?

**Answer:** "Session" everywhere: one sidebar list of sessions, changes, and features, a Done part
with the latest five, and a single button to start any of them, with a selector.

#### Q6: What does the `+` next to Features open?

**Answer:** Answered by the previous one: the single New button, a feature starting from a line of
the inbox or the priorities, or a proposal written from scratch.

#### Q7: Can a feature go back down to a change, or a change to a chat?

**Answer:** A: upward moves only; "a feature that turns out small is just finished fast".

## Decisions

- [Agents](../decisions/agents.md): every conversation is a session; a change or a feature has one
  or more sessions, all in its worktree; the agent offers, never performs alone, a move up.

## Changes after approval

- In the spec's reviews: a change or a feature holds several sessions, each on its own page, rather
  than a fresh agent session inside one page; the kind badge became the row's icon; each kind is
  explained on the New page; dropping a change or a feature was added.
- A typed change, or one from an inbox note, starts over uncommitted changes in the main checkout,
  refusing only staged files, so a session that edited files can become a change.
- A fresh step's run, sent while its session works, waits behind it in the new session.
- A session is done only when idle, and archived sessions are never done.
- A feature's status is its latest session's, raised only by an older session that works or is
  blocked, and only the latest session halts.
- The menu's "Make it a change" and "Make it a feature" open their card, rather than moving at once.
- A drop whose priorities could not be committed says the entry's removal waits in `PRIORITIES.md`.
- Since the default branch now commits a started item's folder with its start, the in-place move and
  the drop also move or remove that folder on the default branch.
- A second `uraeda` start waits up to a minute for a server that is starting, once its host token
  exists.
- A dropped item's sessions refuse messages, runs, and New session, so its worktree is never
  recreated; the move up asks `gh` for pull requests before refusing on one.
- An untitled session is called "New session", and a run sent as a message says "Sent as a message".

## Follow-ups

- A dropped item keeps its branch, so it reads as in flight, listed in `ura status` and the sidebar,
  until the human deletes the branch: keeping the branch follows the git decision, and hiding the
  item needs a product choice.
- An item dropped before it ever had a session has no archived session to refuse a run, so a run
  sent to it still creates a session.
- The sandbox's sample projects have no feature with several sessions and no offer card, so those
  states are reviewed in Storybook only.
- Browser scroll tests of the session page (Show earlier messages, opening the line moves the place
  read, the link placed at the drop) fail now and then under load, on the default branch too.
