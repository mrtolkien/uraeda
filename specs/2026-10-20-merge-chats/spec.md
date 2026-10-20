---
status: changes-requested
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Merge chats and changes

> [!NOTE]
>
> Changes requested on 2026-10-20: 9 comments in spec-review.md.
>
> - You approve one kind of thing, the session, which can grow into a change and then a feature, in
>   place. The agent offers each move, you accept it in one click, and one "＋ New" starts anything.
> - Changed: Agents. Every conversation is a session, it keeps its conversation as it grows, and the
>   agent offers a move but never makes one alone.
> - My reading of your sidebar answer: one Sessions list, oldest started first, so rows never jump
>   while agents work.
> - My reading of your later message: "a new session" for a change or a feature is the build's
>   fresh-session switch, now offered on every message, in the same session page.
> - A session moving to a change takes along the files it edited on your checkout, and leaves every
>   other uncommitted file where it is.
> - A session's agent may still make branches or worktrees on its own, as plain Claude Code does:
>   Uraeda does not follow those.
> - Risk tier medium: a session's folder becomes settable, and a branch is renamed in place.

Chats and changes become one thing, the session, with a workflow that can grow around it: none, a
change, then a feature. Moving up keeps the conversation and the branch, and one "＋ New" starts any
of the three. It serves the human who starts talking to an agent and finds the work bigger than a
chat. See the [proposal](proposal.md), [discovery](discovery-01.md), and
[clarifications](clarifications-01.md).

## Decisions

- **Changed: [Agents](../decisions/agents.md)**. Every conversation is a session, and keeps its
  conversation when it becomes a change or a feature; the agent offers those moves, never makes them
  alone.

Relied on:

| Decision                                       | What it means for this spec                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| [Git](../decisions/git.md)                     | the human's checkout is never switched; the move renames a branch, not a checkout |
| [Notifications](../decisions/notifications.md) | a blocked session still notifies, with or without a workflow                      |
| [UI layout](../decisions/ui-layout.md)         | the New page's kind is in its address, and every view has both widths             |
| [Preview](../decisions/preview.md)             | the mockups below are stories with the real components                            |
| [CLI](../decisions/cli.md)                     | the in-place move gets a command, and the skill keeps its steps by hand           |

## User stories

### US1: One list of sessions (P1)

The sidebar lists every session, with or without a workflow, in one Sessions section, and the latest
done ones at the bottom. The word "chat" leaves the UI: a chat is a session without a workflow.

[Merged sidebar](/packages/web/src/sidebar/Sessions.stories.tsx#Merged)

[Nothing in flight](/packages/web/src/sidebar/Sessions.stories.tsx#Empty)

Key scenarios:

1. **Given** a session "Why is CI slow?" started on 2026-10-19, the change `flaky-tests` started on
   2026-10-18, and the feature `look-and-feel` started on 2026-10-17, **When** the sidebar draws,
   **Then** the Sessions section lists `look-and-feel`, `flaky-tests`, then "Why is CI slow?", and
   there is no Changes, Features, or Chats section.
2. **Given** the session "What does ura clean keep?" archived at 10:00 and the change `ctrl-enter`
   finished at 09:00, **When** the sidebar draws, **Then** Done lists the session first, then
   `ctrl-enter`, 5 rows at most.
3. **Given** a link to `/chats/<id>` from before this feature, **When** it opens, **Then** the page
   is `/sessions/<id>`, the same session.

More scenarios:

1. **Given** a session without a workflow that is blocked, **When** the sidebar draws, **Then** it
   shows under Needs you, as today.
2. **Given** the search "redirect", **When** it runs, **Then** it finds sessions, changes, and
   features alike, as today.

### US2: A session grows into a change (P1)

When a session's work should not land on the default branch directly, the agent offers a change in
the session. You edit its proposal and slug, start it, and the same session goes on in the change's
worktree.

[The offer](/packages/web/src/NewSession.stories.tsx#ChangeOffer)

[Once started](/packages/web/src/NewSession.stories.tsx#ChangeStarted)

Key scenarios:

1. **Given** a session in the main checkout whose agent offered the change "Login redirects twice",
   slug `login-redirect`, on 2026-10-20, **When** you press "Start the change", **Then** the branch
   `change/2026-10-20-login-redirect` and its worktree exist, and its proposal holds the card's
   text. The entry tops **Now**, and the session's next turn runs the change in that worktree.
2. **Given** the session edited `src/auth/guard.ts` in the main checkout, and you edited
   `README.md`, **When** the change starts, **Then** the edit to `guard.ts` is in the change's
   worktree and gone from the main checkout, and your `README.md` edit stays.
3. **Given** a session without a workflow, **When** you press "Make it a change" in its header,
   **Then** the same card opens at the session's end, its first message as the proposal, and a slug
   proposed for it.

More scenarios:

1. **Given** the offer card, **When** you press "Not now", **Then** the card closes and nothing is
   written.
2. **Given** the agent is working, **When** the card shows, **Then** "Start the change" waits until
   its turn ends, saying "The agent is working".
3. **Given** the session became a change, **When** the sidebar draws, **Then** its row keeps its
   place, now as the change's card, without rename or archive.

### US3: One "＋ New" starts anything (P2)

One "＋ New" row opens the New page, where you pick a session, a change, or a feature. A change can
start from typed text, an inbox note, or a priority line. A feature starts from a new title, an
inbox note, or a priority line, as a draft opened in the editor.

[New, Session](/packages/web/src/NewSession.stories.tsx#NewSessionPage)

[New, Change](/packages/web/src/NewSession.stories.tsx#NewChangePage)

[New, Feature](/packages/web/src/NewSession.stories.tsx#NewFeaturePage)

Key scenarios:

1. **Given** the sidebar, **When** you press "＋ New", **Then** `/new` opens with Session picked and
   the composer, and sending starts a session in the main checkout.
2. **Given** Change picked, **When** you press "Start the change" on the inbox note "The PR texts
   lack context: start with what was done", **Then** the note leaves `INBOX.md`, and a change starts
   with the note's text as its proposal. Its session opens.
3. **Given** Feature picked, **When** you type "Keyboard navigation" and press "Write the proposal",
   **Then** the line tops **Now**'s unstarted entries, and the draft
   `specs/drafts/keyboard-navigation.md` opens in the editor, with "Start the feature".

More scenarios:

1. **Given** Feature picked, **When** you press "Open the draft" on the priority line "Empty inbox",
   **Then** the line becomes a draft, as drafting a priority does today, and the editor opens it.
2. **Given** a link to `/changes/new`, **When** it opens, **Then** it is `/new?kind=change`.

### US4: A change grows into a feature, in place (P2)

When the agent finds a change needs an approved spec, before or after its round of questions, it
offers to make it a feature. On your yes, the branch and folder become a feature's, the code stays,
and the same session goes on with the feature's discovery.

[The offer](/packages/web/src/NewSession.stories.tsx#FeatureOffer)

Key scenarios:

1. **Given** the change `priorities-sections` at its change step, whose agent offered a feature
   because it changes the format of `PRIORITIES.md`, **When** you press "Make it a feature",
   **Then** the branch is `2026-10-20-priorities-sections` and the folder
   `specs/2026-10-20-priorities-sections/`. **Now** links it, and the session's next run starts its
   discovery.
2. **Given** an unattended change run that finds the change feature-sized, **When** it stops,
   **Then** a round asks "Make this change a feature?", and answering "A" makes the same move at the
   next run.
3. **Given** the change already committed `src/priorities/sections.ts`, **When** it becomes a
   feature, **Then** that commit stays on the branch, and the feature's spec describes it as built.

More scenarios:

1. **Given** the change applied a change to the inbox decision, **When** it becomes a feature,
   **Then** that decision is `proposed` again, and the feature's spec lists it.
2. **Given** a change with a pull request, **When** you press "Make it a feature", **Then** nothing
   moves, and the session says "This change has a pull request: close it first, since its branch
   would be renamed".

### US5: A new agent session in a change or a feature (P3)

In a change's or a feature's session, a switch under the composer sends the next message to a new
agent session in the same worktree. The page stays one session, with a line where the new one
starts.

[In a new session](/packages/web/src/NewSession.stories.tsx#NewSessionOn)

Key scenarios:

1. **Given** a feature's session at its implementation, **When** you turn on "In a new session" and
   send "Go on with task 4", **Then** the agent starts with none of the turns above. The page shows
   "Started a new session: the agent reads the repository, not the turns above."
2. **Given** a spec just approved, **When** its run's message shows, **Then** the switch is on, as
   the setting for building in a new session says today.

## Architecture

The session cache already holds chats and workflow sessions in one table, its folder empty for a
chat. So a move up sets that folder, and the change's start and the feature's in-place move reuse
the core's start and branch rules. The agent proposes, through a block the page draws as a card, and
the server performs the move on your click. See
[keeping the session](discovery-01.md#keeping-the-session) and
[change to feature](discovery-01.md#change-to-feature).

- **The session store** sets a session's folder once, from none to a change's. It owns "a session
  belongs to at most one change or feature, for good".
- **The session move** starts the change from the card's proposal and slug, attaches the session,
  and sends the change's run in it. Its opening line tells the agent the new worktree and branch,
  and to carry over the files it edited on the main checkout. It owns that line.
- **The offer block** is the agent's fenced `uraeda-offer change` or `uraeda-offer feature` block,
  which the transcript draws as the card and every other reader sees as text. It owns the offer's
  format ([data model](data-model.md#offer-block)).
- **The in-place move**, in the core, renames the branch, moves the folder, relinks **Now**, and
  sets the change's applied decisions back to `proposed`. `ura start <change> --feature` runs it,
  and the skill describes it by hand. It owns the move's refusals.
- **The sidebar's list** draws one Sessions section, and the Done area adds archived sessions.
- **The New page** holds the kind selector, the composer and slug of today's New change, and the
  inbox and priority pickers. It reuses drafting a note or a priority, and the editor's start.
- **The session header** shows "Make it a change" or "Make it a feature", and the composer's new
  session switch, generalised from the build's.
- **The skill** replaces rule 8 and the change's upgrade with the offer and the in-place move. It
  says "session" where it said "chat".

Tradeoffs:

- A long session carries its history into the change's runs, until you turn on a new session.
- A file the session changed through a shell command, not its edit tools, is not carried over.
- `/chats` and `/changes/new` stay as redirects, so links in old transcripts still open.

## Edge cases

| Importance | Situation                                                     | What happens                                                                                                 |
| ---------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| High       | A file the session edited was also edited by you since        | it stays on the main checkout, and the opening line names it for the agent to merge by hand                  |
| High       | The slug's branch or folder exists                            | nothing starts; the card says "A branch or folder named 2026-10-20-login-redirect exists: pick another slug" |
| High       | A change with a pull request is made a feature                | refused, as US4 says                                                                                         |
| Normal     | The server restarts between the change's start and the attach | the change exists with its own new session; the old session stays without a workflow                         |
| Normal     | The agent offers twice in one session                         | only the latest card has buttons; earlier ones read as text                                                  |
| Normal     | An offer block in a feature's session asks for a change       | drawn as text: a session only moves up                                                                       |
| Niche      | The change's branch was pushed                                | the move renames it locally; the old remote branch stays until you delete it                                 |

## Success criteria

- **SC-001** (one click): a session becomes a change with one click on its card, its text and slug
  as proposed.
- **SC-002** (one session): after either move, the sidebar shows one row for the work, and its
  session page holds every earlier turn.
- **SC-003** (no lost edits): no file you edited on the main checkout is moved or reverted by a
  move.
- **SC-004** (two clicks): starting a change from an inbox note takes two clicks from "＋ New".

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written. "The CLI gets the change-to-feature move" is now `ura start <change> --feature`.

Settled while writing this spec:

- **Sessions oldest started first**: rows keep their place while agents work. A session that becomes
  a change keeps its start.
- **An archived session is done**: it shows in Done with finished changes and features.
- **A session starts in the main checkout**: its agent may make branches and worktrees on its own,
  as you answered, and Uraeda reopens it there.
- **The new feature's line** goes first among **Now**'s unstarted entries, as starting puts started
  ones above.
- **A note started as a change leaves the inbox**, as turning a note into a draft does today.
- **The upgraded feature's first step** is a discovery round at its proposal's effort, as an
  upgraded change's is today.
- **"In a new session"** shows its line for any message, without "for this run".

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ✅               |

## Risk tier

Medium: a session's folder becomes settable after its creation, and a branch with work is renamed in
place; no data users have changes format.
