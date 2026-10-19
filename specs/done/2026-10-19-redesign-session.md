---
kind: feature
finished: 2026-10-19
pull-request: https://github.com/mrtolkien/uraeda/pull/45
---

# Record: Redesign session

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-19, finished on
> 2026-10-19, in [its pull request](https://github.com/mrtolkien/uraeda/pull/45). Its full files are
> in git: `git log -- specs/2026-10-19-redesign-session/`.

## What and why

A functional pass on the session page, where the human follows and talks to an agent: it opens fast
on a long session, reads well on a phone, tells the human's messages from the agent's, allows
blocked actions together, keeps its actions by the composer, and tells the human when a chat is
blocked. The chat's right column was split off as its own draft, in the priorities' Next list.

## Behaviour

- **Opening a big session:** a session opens on its latest 20 messages (the human's messages and the
  agent's texts, with the tool calls between them). "Show earlier messages" adds 20 and keeps the
  reader's place. A link `#turn-<id>` extends the window back to that turn. The count shown is kept
  with the history entry, and grows with messages that arrive while the page is open, so Back and a
  reload draw the same messages. Find in the browser sees only what is drawn.
- **The phone:** the page's inset is 8 px. The human's messages are a tinted bubble on the right
  (the theme's blue background token); the agent's are flat text across the page, with no bubble and
  no border, at every width. The composer's field is 3 rows (66 px) growing to 9 on a phone, and 7
  rows (154 px) growing to 20 on wide screens.
- **Allow all:** "Allow all (N)" shows beside Send from two actions the agent was refused in the
  session's latest turn that have an allow rule, and is disabled while the session works. One press
  reopens the agent's process once with every rule, as separate `--allowedTools` arguments, and
  starts one turn asking the agent to retry each action. Rules end with the process, after 15
  minutes idle. An action with no rule (a command with a `*` or a line break) stays blocked, with
  its note; each action's own "Allow and retry" stays.
- **Actions by the composer:** a chat's Archive or Unarchive moved to the composer's footer; the
  header keeps the title (renamed in place), status, and agent. "Jump to the latest" floats centred
  above the composer.
- **Blocked chats notify:** a chat with an action auto mode refused, not archived, is a row of the
  list of what needs the human, so a background tab is notified once and the tab's title counts it.
  The row changes with the blocked turn, so a new block notifies again. A finished reply never does.

## Design

The server owns which actions can be allowed together:
[`runner/allow.ts`](/packages/server/src/runner/allow.ts) picks the covered denials of the latest
turn, and both the session record's `allowable` count and `Sessions.allowAll` read it. The process,
its adapter, and the turn's stored `allowed` take a list of rules (a turn's column holds them one
per line). Chat rows come from the same session statuses as a feature's, in
[`fate/needs-you.ts`](/packages/server/src/fate/needs-you.ts).

The web UI owns the tail in [`tail.tsx`](/packages/web/src/tail.tsx): it walks the turns from the
latest, one page after another, and draws the latest messages, keeping its start while the page is
open. The message components moved to
[`TranscriptMessages.tsx`](/packages/web/src/TranscriptMessages.tsx), the composer's buttons to
[`ComposerSend.tsx`](/packages/web/src/ComposerSend.tsx), and the transcript's activity and ending
lines to [`TurnLines.tsx`](/packages/web/src/TurnLines.tsx). A keystroke already redrew no message
of the transcript, so the typing needed no change; a test guards it.

## Questions

### Round 01

#### Q1: How should the seven asks be split into features?

**Answer:** A: this feature does speed, the phone look, the bottom buttons, "Allow all", and chat
alerts; the chat's right column becomes a draft in "Next".

#### Q1.B: What should a chat's right column hold?

**Answer:** Closed by the answer to Q1: the column is its own draft.

#### Q2: How should a big session open fast?

**Answer:** A: load and draw only the latest messages, with a "Show earlier messages" button.

#### Q2.A: How many messages should the page open with, and add at each "Show earlier"?

**Answer:** A: 20 messages, and 20 more at each press.

#### Q3: How tall should the composer be on a phone?

**Answer:** A: "The issue is width, not height. Let's do 3 rows on phone growing up to 9."

#### Q4: What should messages look like on a phone?

**Answer:** A: the human's messages in a tinted bubble on the right, the agent's as flat text.

#### Q5: Which buttons should move to the bottom, next to the composer?

**Answer:** A: a bar above the composer for the session's state, with Archive in the composer's
footer.

#### Q6: Which blocked actions should "Allow all" cover?

**Answer:** A: every blocked action with a rule in the latest turn; each action's own button stays.

#### Q7: Should a blocked chat notify you like a blocked feature?

**Answer:** A: yes, a blocked chat notifies and counts in the tab's title, and a click opens it.

## Decisions

- [Notifications](../decisions/notifications.md): a chat counts as needing the human only while an
  action auto mode blocked waits for their allowance, never for a finished reply.

## Changes after approval

- "Allow all" moved beside Send with no text on its left, "Jump to the latest" is centred, and the
  phone's inset is 8 px (the spec's second revision, before approval).
- The window of messages keeps its start while the page is open and grows with arrivals, instead of
  sliding by one; Back and a reload keep the grown count.
- The phone transcript's list reaches the page's edges, and each sender gives back the list's
  padding, so nothing is wider than the screen.
- On the phone, a markdown list's items are as tall as their text, not 44 px rows.
- The retry message after "Allow all" names every covered action, even two sharing one rule.
- "Show earlier messages" shows only when an earlier message exists.
- The test that caps a decision's words went from 9,400 to 9,500 for the approved notifications
  text.

## Follow-ups

- The chat's right column is [its own draft](../drafts/chat-right-column.md).
- Three web tests (`home.test.tsx` twice, `shell.test.tsx` "US3.2") and the desktop sidebar test
  "the sidebar with sessions, searched for “”" fail on the default branch too.
- `SessionPane` is 99 lines: the next feature to touch it extracts first.
