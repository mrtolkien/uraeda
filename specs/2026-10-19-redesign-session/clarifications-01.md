---
status: answered
---

# Clarifications, round 01: Redesign session

> [!NOTE]
>
> Answered on 2026-10-19.
>
> - Verdict: worth building, with changes: seven asks are too many for one spec, and "the last X
>   messages" and the typing lag are not measured yet.
> - The split of the work comes first, and decides whether the chat's right column is in this
>   feature.
> - How big sessions open, and how the phone looks, are the two choices every later session screen
>   follows.
> - "Allow all" lets the agent run every listed blocked command in one press: read what it covers.
> - A blocked chat does not notify you today, unlike a feature: this may change the Notifications
>   decision.
> - Settled without you: no copy, regenerate, or search is added, and the typing lag gets profiled
>   before it is fixed.

## Context

### Goal

The [proposal](proposal.md) asks for a functional pass on the session page, where you follow and
talk to an agent. It should open instantly on a big session, type without lag, read well on a phone,
tell your messages from the agent's, allow all blocked actions at once, and keep its buttons by the
composer. A chat should also get a useful right column.

### Today

- The page draws every turn of a session and every page of each turn, at any length.
  [`Transcript.tsx`](/packages/web/src/Transcript.tsx)
- Your messages and the agent's share one bubble fill in Astryx, the design system.
- The composer's field is 154 px tall when empty, 7 rows.
  [`Composer.tsx`](/packages/web/src/Composer.tsx)
- "Allow and retry" allows one blocked action per press, each press reopening the agent's process.
- A feature's session has a right column, with its tasks and its branch's changes. A chat has none.
  [`SessionAside.tsx`](/packages/web/src/SessionAside.tsx)
- You asked me to check that a blocked agent notifies you. A feature does, from a background browser
  tab. A chat does not: only the sidebar and the page show it.

| Product                | What its side panel holds                                | On a phone                   |
| ---------------------- | -------------------------------------------------------- | ---------------------------- |
| Claude Code desktop    | diff with counts, tasks and sub-agents, files, terminal  | buttons collapse into a menu |
| Claude Code on the web | a "+42 -18" diff indicator that opens the diff           | the indicator opens a view   |
| Codex app              | the repository's changes by scope, with per-hunk actions | not documented               |

### Scope

This round covers all seven asks, to choose how they split. It leaves out per-message copy,
regenerate, search in a chat, and sharing. Phone and closed-tab notifications stay with a later Web
Push feature.

### Sources

- The session page's code: the page, transcript, composer, column, and the server's runner and live
  updates, linked in the discovery.
- Claude Code's, Codex's, and Claude's help pages, and MDN on `content-visibility` and
  `field-sizing`.
- The Claude Code CLI's own `--help`.
- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: How should the seven asks be split into features?

The seven asks reach different layers. Speed changes what the page draws. "Allow all" changes the
server's process handling. The chat's right column needs a new server record that lists files and
sources from tool calls. Past six stories, a spec is too big to approve in one sitting. This
proposal reaches about seven. More in [discovery](discovery-01.md#splitting-the-work).

Why it matters: it sets how long you spend reviewing one spec, and how many times the page is
reworked.

- **A (recommended). This feature does speed, the phone look and colours, the bottom buttons, "Allow
  all", and chat alerts. The chat's right column becomes its own feature.**
  - [pro] about five stories, which one spec holds.
  - [pro] the column is the costliest ask, and nothing else waits on it.
  - [con] the chat keeps its empty column for one more feature.
  - Why recommended: the column needs its own questions about storage and content.
- **B. One feature for all seven asks, the column included.**
  - [pro] one review, and the page is reworked once.
  - [con] about seven stories, past the split rule.
  - [con] adds a new server record to a feature about speed.
- **C. Three features: speed, then the look and buttons, then "Allow all" and alerts.**
  - [pro] each review is short.
  - [con] the page's files are touched three times, and the column still waits.

**Answer:** A: Ok, create a draft in "Next" for the sidebar

### Q1.B: What should a chat's right column hold?

Only if you picked B in Q1. Products show changed files with diff counts, and background tasks.
Uraeda stores each tool call's name, its target, and the start of its output. It drops the raw
input, which holds an edit's text. So a list of files edited and sources read is cheap, and a diff
needs stored inputs. A chat on the main checkout makes git show every change, not only the chat's.
More in [discovery](discovery-01.md#the-chats-right-column).

Why it matters: keeping tool inputs grows the database for every session, and the choice sets what
the column can ever show.

- **A (recommended). Files edited and sources read or fetched in this chat, from its tool calls, as
  paths and links, plus running sub-agents.**
  - [pro] nothing new is stored, and it is only this chat's work.
  - [con] no diffs, and shell edits like `sed -i` are missed.
  - Why recommended: it answers "what did this chat touch" at the lowest cost.
- **B. As A, and each edited file's diff, which needs the server to keep tool inputs.**
  - [pro] you see what changed, like Claude Code's diff viewer.
  - [con] the database grows, and long inputs need a size limit.
- **C. The checkout's uncommitted changes from git, as Codex's review pane shows.**
  - [pro] it catches shell edits and your own.
  - [con] on the main checkout it mixes in changes the chat did not make.

**Answer:**

## Q2: How should a big session open fast?

The page loads and draws the whole session. Products that handle long conversations either draw only
the tail, or virtualize. A virtualization library unmounts off-screen rows. It still loads every
turn, breaks find in page for unmounted rows, and is weakest on the iPhone's Safari. The CSS
`content-visibility: auto` only skips painting: the loading and the nodes remain. More in
[discovery](discovery-01.md#showing-only-the-latest).

Why it matters: it decides whether opening a session stays instant at any length, and whether Ctrl+F
finds text in old messages.

- **A (recommended). Load and draw only the latest messages, with a "Show earlier messages" button
  that adds more.**
  - [pro] opens fast whatever the length, and a long streaming turn stays cheap.
  - [con] Ctrl+F finds only what is loaded.
  - Why recommended: it is the only option that removes the loading cost, not only the painting.
- **B. Keep drawing everything, with `content-visibility: auto` on each turn.**
  - [pro] small change, and Ctrl+F finds everything.
  - [con] still fetches and subscribes to the whole session.
- **C. Draw everything through a virtualization library, virtua or TanStack Virtual.**
  - [pro] draws few nodes at once.
  - [con] a new dependency, a stack decision, and streaming and iPhone scroll pitfalls.

**Answer:** A

### Q2.A: How many messages should the page open with, and add at each "Show earlier"?

Only if you picked A in Q2. A message here is yours or an agent's written text, with the tool calls
between them shown in their groups. A session that passes the count shows the button at the top.
More in [discovery](discovery-01.md#the-number-of-messages).

Why it matters: too few makes you press the button often, and too many keeps the page slow.

- **A (recommended). 20 messages, and 20 more at each press.**
  - [pro] fastest, and 20 messages cover the latest exchange.
  - [con] more presses to go back far.
  - Why recommended: you can always go further, and you cannot make an opening faster.
- **B. 50 messages, and 50 more at each press.**
  - [pro] fewer presses.
  - [con] slower on a phone with long agent texts.
- **C. 100 messages, and 100 more at each press.**
  - [pro] almost never needs the button.
  - [con] close to today's cost on a mid-sized session.

**Answer:** A

## Q3: How tall should the composer be on a phone?

The composer's field is 7 rows when empty, 154 px, which fills a quarter of a phone's height under
the transcript. It grows to 20 rows. A taller page and a larger field both raise the cost of a
keystroke, and the typing lag is not profiled yet. On a wide screen 7 rows stay as they are. More in
[discovery](discovery-01.md#the-composers-height).

Why it matters: it decides how much of the conversation you see while you type on a phone.

- **A (recommended). 2 rows empty on the phone, growing to 8 with the text, and 7 rows on wide
  screens as today.**
  - [pro] about 100 px more of the conversation on a phone.
  - [con] a small field invites shorter messages.
  - Why recommended: the phone is where reading is hardest.
- **B. Keep 7 rows empty on every screen.**
  - [pro] nothing changes for typing long messages.
  - [con] the phone keeps losing a quarter of its height.

**Answer:** A: The issue is width, not height. Let's do 3 rows on phone growing up to 9.

## Q4: What should messages look like on a phone?

Today every message has a filled bubble, the page has a 16 px inset, and each tool group and blocked
action has its own border. Your messages and the agent's share one fill. Chat apps give the agent
the full width as flat text, and your message a tinted bubble. I could not read an official page for
ChatGPT's, Claude's, or Gemini's phone layouts, so this is my judgement. The spec ships mockups at
both widths, as the UI layout decision asks, once you pick. More in
[discovery](discovery-01.md#the-phones-look).

Why it matters: it sets how every message of every session reads on a phone, and its colours.

- **A (recommended). Your messages in a tinted bubble on the right, the agent's as flat text across
  the page with no bubble and no border, and a 12 px page inset, with compact tool groups.**
  - [pro] keeps most of the width, and the two senders differ by fill and side.
  - [con] needs Astryx's `ghost` bubble and a theme override for your tint.
  - Why recommended: reading the agent's long answers is the page's main job.
- **B. Both keep bubbles with less padding, and yours gets a tinted fill.**
  - [pro] the smallest change, and bubbles stay familiar.
  - [con] still loses width to padding and corners.
- **C. Both flat, yours marked by a left accent line.**
  - [pro] most width.
  - [con] the line is easy to miss, and Astryx has no component for it.

**Answer:** A

## Q5: Which buttons should move to the bottom, next to the composer?

The page's controls today are spread out. Archive and the title's rename are in the header. "Allow
and retry" is inside the transcript. Stop and Send are in the composer, with the paperclip and the
recommended message in its footer. "Jump to the latest" floats above it. The column's toggle is at
the top right. More in [discovery](discovery-01.md#where-the-buttons-go).

Why it matters: it sets what your thumb reaches on a phone, and what the header stops showing.

- **A (recommended). A bar above the composer for the session's state: "Allow all" while actions are
  blocked, and "Jump to the latest". Archive moves into the composer's footer. Rename stays on the
  title.**
  - [pro] every action on the session is by the thumb.
  - [con] the header's Archive button moves, so it takes a moment to find.
  - Why recommended: it moves what you act on, and keeps the title where you read it.
- **B. As A, and the column's show or hide toggle moves to the bottom too, on the phone.**
  - [pro] everything at the bottom.
  - [con] touches the column's layout and its tests.
- **C. Only "Allow all" moves to the bottom. Archive stays in the header.**
  - [pro] the smallest change.
  - [con] leaves Archive away from the composer.

**Answer:** A

## Q6: Which blocked actions should "Allow all" cover?

When auto mode blocks actions, each gets "Allow and retry". Each press closes the agent's process,
reopens it with that one rule, and asks the agent to retry. A second press reopens it with only its
own rule, so the first is lost. "Allow all" would reopen it once with every rule, then ask the agent
to retry them together. A Bash command containing `*` has no rule, and stays blocked either way. The
Claude Code CLI takes several rules in one start. More in
[discovery](discovery-01.md#what-allow-all-covers).

Why it matters: it lets the agent run every covered command in the project's checkout, including
ones auto mode judged risky, until the session's process closes after 15 minutes idle.

- **A (recommended). Every blocked action with a rule in the latest turn, and the per-action button
  stays.**
  - [pro] it covers what you just saw, and nothing older.
  - [con] older blocked actions need their own button.
  - Why recommended: the grant matches what you reviewed.
- **B. Every blocked action with a rule in the whole session.**
  - [pro] one press clears everything.
  - [con] allows actions from old turns you may no longer remember.

**Answer:** A

## Q7: Should a blocked chat notify you like a blocked feature?

A feature blocked by auto mode notifies you from a background tab, once, and counts in the tab's
title. A chat never does: the notification list is built from features only, and its links only open
features. The Notifications decision says a notification shows when "an item" needs you. A chat
counts as an item only if that line says so. More in
[discovery](discovery-01.md#chat-notifications).

Why it matters: without it, you learn that a chat is blocked only by opening the page, which is what
your note describes.

- **A (recommended). Yes: a blocked chat notifies and counts in the tab's title like a feature, and
  a click opens the chat. The Notifications decision changes by one line, so a chat counts as an
  item.**
  - [pro] fixes the gap you noticed, with the existing notifier.
  - [con] a decision edit, approved with the spec.
  - Why recommended: it follows the decision's intent: a notification always means an ask.
- **B. No: the sidebar shows it, and phones and closed tabs wait for the Web Push feature.**
  - [pro] no decision change.
  - [con] a blocked chat stays invisible until you open it.

**Answer:** A

## Settled without the human

### Check these

- **No copy, regenerate, edit, search, or sharing** is added: products have them, the proposal does
  not ask, and the page's job here is speed and reading. See
  [discovery](discovery-01.md#needs-no-choice).
- **The typing lag is profiled first**: the plan's first task measures a long session, and the draft
  moves into the composer's own state if that is the cause. See
  [discovery](discovery-01.md#text-input-still-feels-laggy-has-no-measured-cause).
- **The per-action "Allow and retry" button stays** next to "Allow all", for an action you want to
  allow alone. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).

### Behaviour

- **A turn's address opens its turn**: a `#turn-<id>` link draws enough earlier messages to include
  that turn. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Body text stays 17 px** on the phone, as the UI layout decision sets, whatever the padding. See
  [discovery](discovery-01.md#the-code).
- **A blocked action without a rule** stays blocked, and keeps its note that no allow rule can match
  only this action.
- **Mockups at both widths** come with the spec, as the UI layout decision asks: the phone look is
  drawn from your pick, not before.

### Under the hood

- **Allowing several rules** passes each rule as its own argument to `--allowedTools`, since a Bash
  rule may hold a comma. The plan's first task runs it on a real blocked action. See
  [discovery](discovery-01.md#the-claude-code-clis-permission-flag).
- **The tail's logic** goes in a module of its own, since `Transcript.tsx` is over 400 lines. See
  [discovery](discovery-01.md#likely-changes).
- **Reading older messages** uses the server's existing 100-item pages, walked backward from the
  latest, with no query across turns unless the plan finds one needed.

**Notes:**
