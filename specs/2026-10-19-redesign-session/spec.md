---
status: approved
revision: 2
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Redesign session

> [!NOTE]
>
> Approved on 2026-10-19.
>
> - You approve a session page that opens on its latest 20 messages, reads flat on a phone, allows
>   all blocked actions in one press, and notifies you of a blocked chat.
> - Since your review: "Allow all" moved beside Send, the text on its left is gone, "Jump to the
>   latest" is centred, the phone inset is 8 px, and the mockups' composer matches the page.
> - Since your review: the CLI takes several rules in one start, checked by running it. If it ever
>   refuses, the work stops and comes back to you, with no rule-by-rule fallback.
> - Changed decision: Notifications now counts a chat, only while an action auto mode blocked waits
>   for you, never for a finished reply.
> - "Allow all" lets the agent run every listed blocked command, including ones auto mode refused,
>   in your checkout, until its process closes after 15 minutes idle. It covers the latest turn
>   only.
> - Unverified: that opening a big session is slow because of its whole length, and that typing lags
>   because of the page. The plan's first task profiles both, and the draft moves into the composer
>   if that is the cause.
> - Read one way among several: "3 rows on phone, growing up to 9" leaves wide screens at 7 rows,
>   and the flat agent text and tinted bubble also apply on wide screens. Risk tier `medium`.

The session page opens fast on a long session, reads well on a phone, tells your messages from the
agent's, allows blocked actions together, and keeps its actions by the composer. A blocked chat now
notifies you like a blocked feature. The chat's right column is its own feature, in the priorities'
Next list. See the [proposal](proposal.md), [discovery](discovery-01.md), and
[clarifications](clarifications-01.md).

## Your review

- **C1** (stop if several rules fail): done. I ran the CLI with two `--allowedTools` rules, as
  separate arguments, and both commands ran without a prompt. The fallback is gone: if the CLI ever
  refuses, the work stops and a new round asks you.
- **C2** (composer colour in the mockup): done. The story's page now has the surface colour the
  app's shell gives, so the composer no longer differs from it.
- **C3** (inset below 12 px): done. The session page's inset is 8 px on a phone, from a new `Page`
  option.
- **C4** (Allow all far from its button): done. The text is gone, and "Allow all (N)" sits in the
  composer's send row, beside Send.
- **C5** (Jump to the latest centred): done. It floats centred above the composer, as it does today.

## Decisions

- **Changed: [Notifications](../decisions/notifications.md)**. A chat counts as needing you only
  while an action auto mode blocked waits for your allowance.

Relied on:

| Decision                                       | What it means for this spec                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| [UI layout](../decisions/ui-layout.md)         | each view says why it reads best at both widths, with mockups, and text stays 17 px   |
| [UI behaviour](../decisions/ui-behaviour.md)   | Back restores the place, and the composer keeps what you typed while the page changes |
| [UI components](../decisions/ui-components.md) | Astryx components and theme tokens only, with the new composer height a token         |
| [UI checks](../decisions/ui-checks.md)         | tests guard the scenarios below, and screenshots at both sizes and themes             |
| [Preview](../decisions/preview.md)             | the mockups are stories, one per state                                                |
| [Agents](../decisions/agents.md)               | each allowed action stays one narrow rule, kept until the process closes              |
| [Stack](../decisions/stack.md)                 | the page reads only through fate, and the tail logic stays in the web UI              |

## User stories

### US1: Open a big session fast (P1)

A session opens on its latest 20 messages, with the tool calls between them. A message is one of
yours, or one text of the agent's. "Show earlier messages" at the top adds 20 more, and the page
stays where you were reading.

[The button above a session's first shown message](/packages/web/src/SessionMockups.stories.tsx#Reading)

Why this priority: opening is the page's first moment, and the cost today grows with every session's
length.

Key scenarios:

1. **Given** a chat of 120 messages, **When** you open it, **Then** the page draws the latest 20
   messages, at its end, with "Show earlier messages" at the top.
2. **Given** that chat showing 20 messages, **When** you press "Show earlier messages", **Then** the
   20 messages before them appear above, the message you were reading stays at the same place on
   screen, and 40 show.
3. **Given** a chat of 15 messages, **When** you open it, **Then** all 15 show, and there is no
   button.

More scenarios:

1. **Given** a chat of 120 messages, **When** you open the link `#turn-<id>` of a turn 80 messages
   back, **Then** the page draws every message from that turn to the end, and scrolls to the turn.
2. **Given** you pressed "Show earlier messages" twice, **When** you go to another page and press
   Back, **Then** 60 messages show, and the page is where you left it.
3. **Given** you are reading above the end while the agent replies, **When** its reply grows,
   **Then** nothing moves, and the button count is unchanged.
4. **Given** a feature's session of 50 messages, **When** you open it, **Then** it shows the latest
   20 as a chat does, and its column is unchanged.

### US2: Read on a phone (P1)

On a phone, your messages are a tinted bubble on the right, and the agent's are flat text across the
page, with no bubble and no border. The page's inset is 8 px, and the composer's field is 3 rows
empty, growing to 9 with its text. The two senders also differ on wide screens.

[A reply on a phone](/packages/web/src/SessionMockups.stories.tsx#Reading)

Why this layout reads best: the agent's long answers are what you read, and a bubble's padding and
corners cost width a phone has little of. A wide screen keeps its 32 px inset and 7-row composer: it
has the width, and the flat text only adds the colour difference you asked for.

Key scenarios:

1. **Given** a chat open at 390 px wide, with one message of yours and one reply, **When** it draws,
   **Then** yours is a tinted bubble aligned right, and the reply runs flat from the 8 px inset to
   the other 8 px, with no bubble.
2. **Given** that chat in the dark theme, **When** it draws, **Then** your bubble is still tinted,
   from a theme token, and the text reads at WCAG AA contrast.
3. **Given** an empty composer at 390 px wide, **When** you type 12 lines, **Then** its field starts
   at 3 rows, grows to 9, and scrolls inside past 9.

More scenarios:

1. **Given** an empty composer at 1440 px wide, **When** it draws, **Then** its field is 7 rows, and
   grows to 20 as today.
2. **Given** a reply with a code block wider than the screen at 390 px, **When** it draws, **Then**
   the block scrolls sideways inside itself, and the page does not.

### US3: Allow all blocked actions (P2)

When two or more actions the agent was refused wait in the latest turn, "Allow all (N)", beside Send
in the composer, allows every one of them at once. Each action's own "Allow and retry" stays.

[Two actions blocked, with "Allow all (2)" beside Send](/packages/web/src/SessionMockups.stories.tsx#Blocking)

Key scenarios:

1. **Given** the latest turn holds two blocked actions with rules, "Bash rm -rf dist" and "Edit
   src/store/tasks.ts", and the session is idle, **When** you press "Allow all (2)", **Then** the
   agent's process reopens once with both rules, a turn starts that asks it to try both again, and
   both banners read "Allowed for the session's process."
2. **Given** those two actions and a session that is working, **When** the page draws, **Then**
   "Allow all (2)" is disabled, as each "Allow and retry" is.
3. **Given** three blocked actions, two with rules and `Bash find . -name '*'` without, **When** you
   press "Allow all (2)", **Then** the two are allowed, and the third stays blocked, with its note
   that no allow rule can match only that action.

More scenarios:

1. **Given** one blocked action with a rule, **When** the page draws, **Then** there is no "Allow
   all", and its own "Allow and retry" is the only button.
2. **Given** two blocked actions in a turn, **When** you send a normal message, **Then** the new
   turn is the latest, "Allow all" is gone, and the old banners keep their own buttons.
3. **Given** you pressed "Allow all (2)", **When** the process closes after 15 minutes idle,
   **Then** both rules end, as one allowed action's rule does today.

### US4: Actions by the composer (P2)

The session's actions sit by the thumb. "Allow all" is beside Send, "Jump to the latest" floats
centred above the composer while you read above the end, and a chat's Archive moves to the
composer's footer. Its title still renames in place.

[Reading above the end](/packages/web/src/SessionMockups.stories.tsx#Scrolled)

Key scenarios:

1. **Given** an open chat, **When** it draws, **Then** "Archive" is in the composer's footer, the
   header holds the title, its status, and its agent, and the title renames in place.
2. **Given** an archived chat, **When** it draws, **Then** the footer button reads "Unarchive".
3. **Given** you read above the end with two blocked actions, **When** the page draws, **Then**
   "Jump to the latest" floats centred above the composer, and "Allow all (2)" is beside Send.

More scenarios:

1. **Given** a feature's session, **When** it draws, **Then** it has no Archive button, as today,
   and its column's toggle stays at the top right.

### US5: A blocked chat notifies you (P3)

A chat blocked by auto mode notifies you from a background tab, once, and counts in the tab's title,
like a blocked feature. A click opens the chat.

Key scenarios:

1. **Given** a chat the agent was refused an action in, a background tab, and granted permission,
   **When** the turn ends, **Then** one notification says the agent was refused an action, names the
   chat by its title, and opens the chat on a click.
2. **Given** that blocked chat and one blocked feature, **When** the tab is in the background,
   **Then** its title starts with "(2)".
3. **Given** that blocked chat, **When** you allow its action, **Then** the count drops to 0 and no
   second notification shows for it.

More scenarios:

1. **Given** a chat whose reply just finished, **When** the tab is in the background, **Then** no
   notification shows and the count does not change.

## Architecture

The page keeps its structure. The slowness is cut where it starts, the page drawing the whole
session, by drawing a tail of it. The look, composer, and bar are changes of existing components.
The server changes in two places: allowing several rules, and chat rows in the list of what needs
you. This follows [one home per rule](/skills/uraeda/references/code-quality.md#one-home-per-rule):
the server owns which action can be allowed, and the web UI only reads it.

- **The tail** decides which messages draw. It walks the session's turns from the latest, and each
  turn's pages from its last, with the pages the server already serves, until 20 messages are in. It
  owns the count of messages shown, kept with the history entry, and the "Show earlier messages"
  button. It lives in a module of its own, since `Transcript.tsx` is over 400 lines.
- **The message look** is `Transcript.tsx`'s two message components and the theme's tint token. It
  owns the senders' styles at both widths.
- **The page's inset and the composer's height** are `Page` and `Composer`. The phone's field height
  is a new theme token, next to the wide one.
- **The composer's send row** holds "Allow all (N)" beside Send, from two covered actions, disabled
  while the session works. "Jump to the latest" stays the floating button it is.
- **The chat's Archive** moves from the header to the composer's footer, with its handler unchanged.
- **Allowing together** is the server's: one reopen of the agent's process with every rule, one turn
  that asks the agent to retry them all, and every covered denial marked allowed. It owns which
  denials count: those of the latest turn, not yet allowed, that have a rule. A rule is refused when
  it holds a line break. The process, the adapter, and the turn's stored `allowed` take a list: see
  the [data model](data-model.md).
- **The chat rows** of the list of what needs you come from the same session statuses as a
  feature's. They add a chat's title, an address to the chat, and a key that changes with the
  blocked turn, so a new block notifies again. The notifier only reads the list.

Tradeoffs:

- Walking pages backward takes one request per page, one after another, since the page of messages
  is known only once read. A typical session needs one or two.
- The tail counts messages, not tool calls: a turn of 300 tool calls and 3 messages still draws its
  300 calls, collapsed in groups. If the profile shows that costs too much, a new round asks for a
  limit.
- Find in the browser sees only the messages drawn. "Show earlier messages" is the way back.
- A grant of several rules is wider than one, and ends together when the process closes.
- Allowing together needs the CLI to take several rules in one start. It does today: if a later
  version refuses, the work stops and asks you, since a rule-by-rule fallback keeps the problem it
  fixes.

## Edge cases

| Importance | Situation                                                         | What happens                                                                        |
| ---------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| High       | Back after pressing "Show earlier messages" twice                 | the count shown is kept with the history entry, so 60 messages and the place return |
| High       | "Allow all" while a rule is refused for a line break              | that action stays blocked, with the note for an action no rule can match            |
| High       | The CLI refuses several rules in one start                        | nothing is allowed, the error shows, and the work stops for a new round with you    |
| High       | The reopen fails with several rules                               | no denial is marked allowed, and the error shows under the transcript, as today     |
| High       | A blocked chat is allowed from another tab                        | the count and the bar update from the server's live update, with no second alert    |
| Normal     | A link `#turn-<id>` names a turn older than the tail              | the tail extends back to that turn                                                  |
| Normal     | The agent's reply streams while you press "Show earlier messages" | the reply keeps growing at the end, and the older messages add above                |
| Normal     | A message of yours taken back before it is read                   | it leaves the list and the count, as today                                          |
| Normal     | Two blocked actions with the same rule                            | one rule is passed, and both denials are marked allowed                             |
| Niche      | A session of fewer than 20 messages                               | all show, and the button is absent                                                  |
| Niche      | Archive pressed while the session works                           | it archives, as the header's button does today                                      |

## Success criteria

- **SC-001** (opening cost): A session of 500 messages draws the same number of messages as one of
  20, within the tail, when opened.
- **SC-002** (one reopen): "Allow all" with N covered actions reopens the agent's process once.
- **SC-003** (phone width): At 390 px, the agent's reply text spans the full width between two 8 px
  insets.
- **SC-004** (colour): The two senders' fills differ in the light and dark themes, and both pass
  WCAG AA contrast.
- **SC-005** (composer): At 390 px an empty composer is 66 px tall, and at 1440 px 154 px.
- **SC-006** (chat alert): A blocked chat counts in the tab's title within 2 seconds of its turn
  ending.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there. Your answers changed three things, which the spec follows: the chat's right column is
its own draft, the composer is 3 rows on a phone and grows to 9, and a blocked chat notifies.
Settled while writing this spec:

- **"Allow all" shows from two covered actions.** One blocked action has its own button, and a
  second one for it repeats it.
- **The 8 px inset is a new `Page` option**, used by the session page, so no other page changes.
- **The session's status line stays in the header.** Only actions move: the title, status, and agent
  stay where you read them.
- **Only blocked chats notify, not a failed or stopped one.** You asked about blocked actions, and a
  stopped run is one you caused. A failed chat run stays in the sidebar.
- **The tinted bubble's colour is the theme's blue background token**, which has a dark value, and
  the plan checks its contrast.
- **Previously allowed rules still end at the next reopen.** "Allow all" grants exactly the rules it
  lists, as one "Allow and retry" does today.
- **The mockups show the phone's state and the wide width.** Uraeda draws each story at both, and
  they are built from Astryx's chat components over fixed text: the page's data is the real page's.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ✅               |

## Risk tier

**Medium**: no new table, and the one stored change is a text column holding a list, but the page's
every message look changes, and "Allow all" widens one grant of a permission.

## History

> [!NOTE]
>
> Changes requested on 2026-10-19: the CLI's several rules must stop the work if refused, the
> mockup's composer colour, an 8 px inset, "Allow all" beside Send without its text, and a centred
> "Jump to the latest".
>
> - You approve a session page that opens on its latest 20 messages, reads flat on a phone, allows
>   all blocked actions in one press, and notifies you of a blocked chat.
> - Changed decision: Notifications now counts a chat, only while an action auto mode blocked waits
>   for you, never for a finished reply.
> - "Allow all" lets the agent run every listed blocked command, including ones auto mode refused,
>   in your checkout, until its process closes after 15 minutes idle. It covers the latest turn
>   only.
> - Unverified: that opening a big session is slow because of its whole length, and that typing lags
>   because of the page. The plan's first task profiles both, and the draft moves into the composer
>   if that is the cause.
> - Unverified: that the agent's CLI takes several rules in one start. Its help says so. If it does
>   not, "Allow all" reopens the process once per rule.
> - Read one way among several: your "3 rows on phone, growing up to 9" leaves wide screens at 7
>   rows, and the flat agent text and tinted bubble also apply on wide screens.
> - Risk tier `medium`, and the plan does not wait for your review.
