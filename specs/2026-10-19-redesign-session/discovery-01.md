# Discovery, round 01: Redesign session

## Summary

The proposal is a functional pass on the session page, the page where the human follows and talks to
an agent. It lists seven asks: a fast first paint for big sessions, a composer that types without
lag, a readable phone layout, a different colour for the human's messages, "Allow all" for actions
auto mode blocked, buttons at the bottom next to the composer, and a right column for chats.

Today the page loads and draws every turn of a session, and every page of every turn, each with its
own live subscription. A chat has no right column at all, which is the "empty" sidebar. A feature's
session has one, with its own changes read from git. Astryx paints both senders' bubbles with the
same fill. An "Allow and retry" button allows one blocked action at a time, because the agent's
process is reopened with a single permitted rule. A feature blocked by auto mode notifies a
background browser tab. A chat blocked by auto mode does not.

Established products agree on what a side panel holds: changed files with diff counts, and
background tasks. Nothing I could read documents their phone layouts, or any "allow all" button.

## How other products do it

### Claude Code desktop

- Panes for chat, diff, browser, terminal, file, plan, tasks, and subagents. Title-bar buttons open
  Terminal, Changes, and Browser, and an overflow menu holds Files and Background tasks. A narrow
  window collapses the buttons into that menu.
  [Desktop docs](https://code.claude.com/docs/en/desktop)
- The Tasks pane lists subagents, background shell commands, and workflows, and each can be stopped
  from it. The diff viewer opens from a "+12 -1" indicator, lists files on the left, and takes a
  comment on a line. All comments go with the next message. Same page.
- The mode selector sits next to the send button. Ctrl+O cycles the transcript between Normal, with
  tool calls collapsed, Thinking, and Verbose. Same page.

### Claude Code on the web and on the phone

- Each session shows a diff indicator such as "+42 -18" that opens the diff view, against the base
  branch by default, with line comments sent with the next message. A queued message can be taken
  back with an X. [Web docs](https://code.claude.com/docs/en/claude-code-on-the-web)
- On the phone, the Code tab is a client of cloud sessions. Permission mode changes with "+" in the
  prompt box, and a push notification arrives when a task needs a decision.
  [Mobile docs](https://code.claude.com/docs/en/mobile)

### Codex app

- Its review pane shows the repository's state, not only the agent's edits. Scopes are Unstaged,
  Staged, Commit, Branch, and Last turn. Stage, unstage, and revert work per file and per hunk, and
  inline comments become guidance for the next message.
  [Codex review](https://learn.chatgpt.com/docs/code-review?surface=app)
- A task sidebar for plans, sources, artifacts, and summaries appears only in a search snippet, not
  in a page I read.

### Claude artifacts

- An artifact opens in its own window beside the conversation, and all of them are listed under an
  Artifacts tab.
  [Artifacts help](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them)

### What they have in common

- A side panel holds changed files with diff counts, generated files, and background tasks or
  sub-agents. It opens and closes on demand, and on a narrow window it becomes a sheet or a menu
  entry, not a column.
- Bulk approval is a mode switch for the whole session, never an "approve all pending" button. A
  single prompt offers a scope: once, for the session, or always. Claude Code's modes are default,
  acceptEdits, plan, auto, dontAsk, and bypassPermissions, and bypass is unavailable in cloud
  sessions and on the phone. [Permission modes](https://code.claude.com/docs/en/permission-modes),
  the sections I read. Codex's modes are Ask for approval, Approve for me, Full access, and Custom.
  [Codex sandboxing](https://learn.chatgpt.com/docs/sandboxing)
- A notification reaches the human when a session needs a decision, including on the phone.
- Capabilities users expect that the proposal does not name: stop, scroll to the latest, collapse
  tool calls, take back a queued message, and timestamps are already in Uraeda. Per-message copy,
  regenerate, edit of an earlier message, search inside a chat, and sharing are not. They come from
  my general knowledge, not from a source.

## Standards and libraries

### content-visibility

- `content-visibility: auto` skips layout and paint of off-screen content, and keeps it in find in
  page, tab order, selection, and the accessibility tree. It needs
  `contain-intrinsic-size: auto <size>` so a skipped item keeps its last height and the scrollbar
  does not jump. It saves rendering cost only: the DOM nodes and their memory stay. Support: Chrome
  and Edge 85, Firefox 125, Safari 18.
  [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility),
  [web.dev](https://web.dev/articles/content-visibility)

### field-sizing

- `field-sizing: content` makes a textarea grow and shrink with its text without script, bounded by
  min and max height. MDN shows it as newly available in 2026.
  [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/field-sizing)

### Virtualization libraries

- virtua supports reverse scroll and measures sizes from the DOM. Reverse scroll is partly supported
  on iOS Safari, and async content makes rows jump unless its space is reserved.
  [virtua](https://github.com/inokawa/virtua)
- TanStack Virtual needs `estimateSize` and `measureElement`, and does not correct the scroll for
  size changes above the viewport while scrolling backward.
  [TanStack Virtual](https://tanstack.com/virtual/latest/docs/api/virtualizer)
- Virtuoso Message List is a commercial component that needs a license key.
  [Virtuoso](https://virtuoso.dev/message-list)
- Common pitfalls, from those pages: a streaming message changes height at every token, find in page
  finds nothing in unmounted rows, and a stream that follows the end fights a scroll up.
- Native scroll anchoring keeps the visible content steady when content is inserted above it, and
  `overflow-anchor: none` opts out.
  [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-anchor)

### The Claude Code CLI's permission flag

- `claude --help` on this machine says `--allowedTools` takes a "comma or space-separated list", so
  several rules fit in one reopen. A Bash rule may contain a comma, so each rule is better passed as
  its own argument.
- Rules are evaluated deny, then ask, then allow. Seen only in a search snippet of the
  [permissions page](https://code.claude.com/docs/en/permissions).

### Astryx 0.6.8

- `ChatMessageBubble` paints a filled bubble for user and assistant with the same token,
  `--color-neutral`. It has a `ghost` variant with no background but the same padding, a `width`
  prop, and `group` corners. The bubble's padding is 12 px by 16 px at the compact density. The
  theme can override a component's styles. See the bubble's source under
  `node_modules/@astryxdesign/core/src/Chat/ChatMessageBubble.tsx`.
- `ChatMessageList` does not virtualize: the code has no windowing.

## The code

### Important reads

- [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx): the page. The composer sticks to the
  bottom of the window, the transcript scrolls with the window, and the header holds Archive for a
  chat. The header and the composer are in one file with the feature session's hand-over logic, 438
  lines.
- [`Transcript.tsx`](/packages/web/src/Transcript.tsx): `Transcript` maps over every turn id of the
  session. Each `Turn` draws `turn.pages` pages, each its own `TurnPage`. The `actions` object and
  the Markdown of each agent message are not memoised: unverified guess that a streaming token
  redraws the whole list. 470 lines.
- [`sessionData.ts`](/packages/web/src/sessionData.ts): three hooks, a session, a turn, and a page
  of 100 items. Each subscribes live, and the latest page is read again once on mount and after one
  second.
- [`live.ts`](/packages/server/src/live.ts): item changes are throttled to one update every 250 ms
  per session, which re-reads the last two pages of each changed turn.
- [`fate/sessions.ts`](/packages/server/src/fate/sessions.ts) and
  [`runner/cache.ts`](/packages/server/src/runner/cache.ts): items are stored in SQLite,
  `items(turn_id, seq, at, kind, data)`, and read by `LIMIT` and `OFFSET` of one turn. There is no
  query across turns.
- [`Composer.tsx`](/packages/web/src/Composer.tsx): the field is at least 7 rows,
  `--size-composer-input` at 154 px, and grows to 20. Its text is the page's state, passed down
  through `SessionPane`, so a keystroke redraws the page's component tree, not only the field:
  unverified guess, to profile. 483 lines.
- [`following.ts`](/packages/web/src/following.ts) and
  [`useKeepPlace.ts`](/packages/web/src/useKeepPlace.ts): scrolling is the window's. They assume the
  whole transcript is in the page, open at its end, and keep the place across widths.
- [`SessionAside.tsx`](/packages/web/src/SessionAside.tsx): a feature's column, "Progress": step,
  tasks, running sub-agents, "Changed on the branch" from git, and the feature's pages. A chat gets
  no column: `WithAside` draws it only for a feature's folder.
- [`ToolGroups.tsx`](/packages/web/src/ToolGroups.tsx): a run of tool calls is one collapsible
  group.
- [`SessionAttention.tsx`](/packages/web/src/SessionAttention.tsx): the banner for failed, halted,
  and stopped sessions. It has no case for blocked actions: those are banners inside the transcript.
- [`Page.tsx`](/packages/web/src/layout/Page.tsx): a page has a 16 px inset on the phone, and a
  `tight` 12 px one. The session page uses the default. Each denial is an Astryx `Banner`.

### The proposal's path and existing actions

- **Opening a big session.** The page asks for the session, every turn, and every page of every
  turn, then draws them all and scrolls to the end. Cost grows with the session's whole length. The
  server pages by 100 items of one turn, and a turn mixes messages, text, tool calls, denials, and
  system lines.
- **Typing.** Each keystroke changes the draft held by the page. With thousands of nodes above it,
  style and layout cost scales with the page. Nothing is profiled yet.
- **Reading on the phone.** The page's inset, the bubble's padding, the group's borders, and each
  denial's banner all take width. The body text is 17 px by the UI layout decision.
- **Telling senders apart.** Both bubbles use the same fill today.
- **A blocked action.** `Denial` shows a banner with "Allow and retry", disabled while the session
  works. `allow` finds the denial, refuses one without a rule, closes the agent's process, and
  reopens it with `--allowedTools <rule>`, then starts a turn that asks the agent to try again, and
  marks that denial allowed. The next `allow` reopens the process with only its own rule, so the
  first rule is lost. Only a Bash command containing `*` has no rule.
  [`runner/sessions.ts`](/packages/server/src/runner/sessions.ts),
  [`claude-events.ts`](/packages/server/src/runner/claude-events.ts),
  [`claude.ts`](/packages/server/src/runner/claude.ts). A rule lasts as long as the process, which
  closes after 15 minutes idle.
- **The status of a blocked session.** A denial in the latest turn gives "Needs you". A normal
  message makes a new turn the latest, which clears it, while older denials keep their button.
- **Notifications, as your note asks.** `Notifier` reads a global list of what needs the human,
  built from `featureStatuses`, which covers features only. A feature blocked by auto mode notifies
  from a background tab, once per reason, and counts in the tab title. A chat has no feature, so it
  never appears: the sidebar and the page show it, the browser does not.
  [`fate/needs-you.ts`](/packages/server/src/fate/needs-you.ts),
  [`notify/useNotifier.ts`](/packages/web/src/notify/useNotifier.ts). The row's address builder only
  makes `/f/<folder>/...` links.
- **Changed files in a chat.** The stored tool call keeps `name`, kind, `target`, status, and its
  first 4,000 characters of output. The raw input, which holds an edit's text, is dropped before the
  database. `target` is the first string among `command`, `file_path`, `url`, `pattern`, `path`.
  Edit, Write, MultiEdit, Read, and WebFetch give a path or a URL. NotebookEdit and WebSearch give
  none: their inputs use other keys (my reading of the code). Shell edits like `sed -i` cannot be
  derived. [`runner/transcript.ts`](/packages/server/src/runner/transcript.ts),
  [`message.ts`](/packages/server/src/runner/message.ts).
- **Existing actions that meet the page's changes.** Take back, Stop, steering a message into a
  running turn, the `#turn-<id>` address, Back restoring the scroll, "Jump to the latest", the
  announcer, and the images in messages all assume every turn is in the page.

### Rules and their owners

- **What needs the human** is owned by `needsYouList` in the server. The web notifier follows it, as
  the notifications decision asks.
- **Which action can be allowed**, and its rule, is owned by `allowRule` in the server. The button's
  rule check in `Transcript.tsx` only reads the result.
- **A path made relative to the working directory** is owned by the server's `target` code. A
  sidebar would reuse it, not recompute it in the browser.
- **The 100-item page size** is the server's. The web reads `turn.pages`.

### Likely changes

- [`Transcript.tsx`](/packages/web/src/Transcript.tsx),
  [`sessionData.ts`](/packages/web/src/sessionData.ts): draw only a tail, under every option of
  [the tail](#showing-only-the-latest). It is over 400 lines already: the tail logic goes in a
  module of its own.
- [`fate/sessions.ts`](/packages/server/src/fate/sessions.ts),
  [`runner/cache.ts`](/packages/server/src/runner/cache.ts): with option A of
  [the tail](#showing-only-the-latest), a way to read the latest items across turns.
- [`Composer.tsx`](/packages/web/src/Composer.tsx),
  [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx): the draft and the field's height, under
  [the composer's height](#the-composers-height).
- [`Transcript.tsx`](/packages/web/src/Transcript.tsx),
  [`theme.ts`](/packages/web/src/theme/theme.ts), [`Page.tsx`](/packages/web/src/layout/Page.tsx):
  the look, under [the phone's look](#the-phones-look).
- [`runner/sessions.ts`](/packages/server/src/runner/sessions.ts),
  [`processes.ts`](/packages/server/src/runner/processes.ts),
  [`adapter.ts`](/packages/server/src/runner/adapter.ts),
  [`claude.ts`](/packages/server/src/runner/claude.ts), `fate/mutations.ts`: `allowed` becomes a
  list, and a mutation allows several denials with one reopen. The `turns.allowed` column holds one
  rule today.
- [`fate/needs-you.ts`](/packages/server/src/fate/needs-you.ts) and the notifier: with option A of
  [chat notifications](#chat-notifications), rows for chats.
- With the sidebar in this feature: a new server record for a session's activity, and a column for
  chats in [`SessionAside.tsx`](/packages/web/src/SessionAside.tsx), which has a section per file
  already.

## The proposal

### "The last X messages" has no unit

The proposal does not say what X is, or what a message is. The server stores items, and a turn of
one human message can hold hundreds of tool calls and many agent texts. A cut at X turns can leave a
huge last turn, and a cut at X items can show only tool calls. A count of messages, human or agent
text, with the tool runs between them, is the unit a reader sees.

### "Text input still feels laggy" has no measured cause

The proposal guesses the page height. The code also keeps the draft in the page's state, and the
composer's field is 154 px tall when empty, which is a quarter of a phone's height. Nobody has
profiled it. The plan's first task profiles a long session before choosing a fix.

### "All relevant buttons at the bottom" does not say which

The page's controls today: Archive and the title's rename in the header, "Allow and retry" in the
transcript, Stop and Send in the composer, the paperclip and the recommended message in its footer,
"Jump to the latest" above it, and the column's toggle at the top right. Which are "relevant" is the
human's call.

### Allowing all has a safety edge

"Allow all" lets the agent run every blocked command, including ones auto mode judged risky, until
the session's process closes. That is the same grant as pressing each button, in one press. The
proposal does not say whether it covers old turns, or only the latest.

### The right column mixes two jobs

"File changes made in this chat" and "sources checked" are session history, drawn from tool calls. A
feature's column is about the feature: its step, tasks, and branch. The proposal asks for one column
for chats, and "good content" for it, which is a separate subsystem with its own server data.

### Notifications: the check fails for chats

The proposal's note asks to check that a blocked agent notifies. It does for a feature in a
background tab, and does not for a chat. See the path above.

## Worth it and feasibility

The performance and phone asks give the most for the least: every user of the page feels them, and
they change what the page draws, not what the server stores. "Allow all" gives a real gain, as
several blocked actions today cost one reopen and one retry turn each, and it is small once the
process takes a list. The chat column is the costliest ask: it needs a server record, a new column,
and either paths only or kept tool inputs.

Together the asks reach about seven user stories, past the split rule of six. The discovery proposes
a split.

Outside behaviour relied on:

- Several `--allowedTools` rules in one start: the CLI's help says it takes a comma or space
  separated list. Not run against a real blocked action: the plan's first task for allowing all runs
  it.
- `content-visibility: auto` in the browsers the project tests: documented for Safari 18, which the
  project's WebKit tests may not match. Unverified: the plan checks it.
- The cause of the typing lag and of the slow open: unverified, see above.

Guards relaxed: **Allow all** lets the agent run every listed blocked action, including shell
commands auto mode refused, in the project's checkout. It lasts until the session's process closes
after 15 minutes idle. Allowing only the latest turn's actions keeps the human's review to what they
just saw.

## Approaches

Criteria come from the proposal, the [UI layout](/specs/decisions/ui-layout.md) decision, the
[UI behaviour](/specs/decisions/ui-behaviour.md) decision, the
[UI components](/specs/decisions/ui-components.md) decision, the
[Notifications](/specs/decisions/notifications.md) decision, the [stack](/specs/decisions/stack.md)
decision, and the [constitution](/specs/CONSTITUTION.md).

### Splitting the work

The seven asks are one page, but they reach different layers. See
[the proposal](#the-right-column-mixes-two-jobs) and [worth it](#worth-it-and-feasibility).

| Option                                                                                                                   | Stories      | Server work                      | Review in one sitting                    |
| ------------------------------------------------------------------------------------------------------------------------ | ------------ | -------------------------------- | ---------------------------------------- |
| A. This feature: speed, phone look, colours, bottom buttons, allow all, chat alerts. The chat column is its own feature. | about 5      | allow list, tail read, chat rows | yes                                      |
| B. One feature for all seven asks, the column included.                                                                  | about 7      | adds a session activity record   | past the split rule                      |
| C. Three features: speed, look and buttons, then allow all and alerts.                                                   | about 2 each | spread                           | yes, but the page is touched three times |

### Showing only the latest

The page must open fast on a big session. See [the code](#important-reads) and
[the unit](#the-last-x-messages-has-no-unit).

| Option                                                                                      | Opens fast                                              | Find in page       | New dependency                   | Work                                   |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------ | -------------------------------- | -------------------------------------- |
| A. Read and draw the latest messages, with a "Show earlier messages" button that adds more. | yes, at any length                                      | only what is shown | no                               | a server tail read, a client module    |
| B. Keep drawing everything, with `content-visibility: auto` on each turn.                   | no: it still fetches, subscribes, and builds every node | whole session      | no                               | small                                  |
| C. Draw everything through a virtualization library.                                        | draws few nodes, still fetches all                      | only mounted rows  | yes: virtua, or TanStack Virtual | large, with streaming and iOS pitfalls |

### The number of messages

Only with option A of [showing only the latest](#showing-only-the-latest). The first load size, and
the size of each "Show earlier". Candidate sizes: 20, 50, 100 messages.

### The composer's height

See [the proposal's lag](#text-input-still-feels-laggy-has-no-measured-cause) and
[field-sizing](#field-sizing).

| Option                                                                           | Phone height empty | Lag fix                             | Rule broken |
| -------------------------------------------------------------------------------- | ------------------ | ----------------------------------- | ----------- |
| A. 2 rows empty on the phone, growing to 8, and 7 rows on wide screens as today. | about 56 px        | fewer pixels, plus the draft's move | none        |
| B. Keep 7 rows everywhere.                                                       | 154 px             | the draft's move only               | none        |

### The phone's look

See [Astryx](#astryx-068) and [the code](#important-reads).

| Option                                                                                                                                                                    | Width kept | Senders apart | Fits Astryx                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------- | ------------------------------------ |
| A. The human's messages in a tinted bubble on the right; the agent's as flat text across the page, no bubble, no border, with a 12 px page inset and compact tool groups. | most       | fill and side | `ghost` variant and a theme override |
| B. Both keep bubbles, with smaller padding, and the human's gets a tinted fill.                                                                                           | less       | fill          | theme override only                  |
| C. Both flat, the human's marked by a left accent line.                                                                                                                   | most       | line          | custom wrapper, an Astryx gap        |

Colours come from the theme's tokens. Mockups of the picked option are the spec's, at both widths,
as the UI layout decision asks.

### Where the buttons go

See [the proposal's gap](#all-relevant-buttons-at-the-bottom-does-not-say-which).

| Option                                                                                                                                                                                     | Header                 | Near the thumb    | Change                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ----------------- | -------------------------- |
| A. A bar above the composer for the session's state: "Allow all" while actions are blocked, and "Jump to the latest". Archive moves into the composer's footer. Rename stays on the title. | title, status          | all state actions | moderate                   |
| B. As A, and the column's show or hide toggle moves to the bottom too, on the phone.                                                                                                       | title, status          | everything        | larger, touches the column |
| C. Only "Allow all" is at the bottom. Archive stays in the header.                                                                                                                         | title, status, Archive | blocked actions   | small                      |

### What Allow all covers

See [the safety edge](#allowing-all-has-a-safety-edge).

| Option                                                                                   | Reopens | Review burden           | Risk                                 |
| ---------------------------------------------------------------------------------------- | ------- | ----------------------- | ------------------------------------ |
| A. Every blocked action with a rule in the latest turn, and the per-action button stays. | 1       | what the human just saw | lowest                               |
| B. Every blocked action with a rule in the whole session.                                | 1       | old actions too         | allows what the human no longer sees |

### Chat notifications

Only matters for alerts. See [the notification gap](#notifications-the-check-fails-for-chats).

| Option                                                                                          | Closes the gap | Decision change                    |
| ----------------------------------------------------------------------------------------------- | -------------- | ---------------------------------- |
| A. A blocked chat notifies and counts in the tab title like a feature, opening the chat.        | yes            | one line: a chat counts as an item |
| B. Leave it: the sidebar shows it, and the phone and closed tabs wait for the Web Push feature. | no             | none                               |

### The chat's right column

Only with option B of [splitting the work](#splitting-the-work).

| Option                                                                                                                      | Content                           | Storage                                  | Server work                              |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------- | ---------------------------------------- |
| A. Files edited and sources read or fetched in this chat, from its tool calls, as paths and links, plus running sub-agents. | paths, counts, links              | none new                                 | a record scanning tool items             |
| B. As A, with each edited file's diff, from the tool inputs.                                                                | paths and diffs                   | keeps tool inputs, so the database grows | a record, and a change to what is stored |
| C. The checkout's uncommitted changes from git, like Codex's review pane.                                                   | all changes, not only this chat's | none                                     | a git read, as a feature's column has    |

### Needs no choice

- **Stop, scroll to the latest, take back, collapse tool calls, timestamps**: they exist, and keep
  working under the tail.
- **Per-message copy, regenerate, edit an earlier message, search in a chat, sharing**: products
  have them, the proposal does not ask. Left out, said under the questions' settled points.
- **Accessibility**: the transcript stays a labelled log with `aria-live="off"`, announced by the
  announcer. Nothing to choose.
- **Locales and time zones**: message times already use the browser's locale.
- **Removal**: nothing here stores data a feature turns off, except option B of the column.

## Not checked

- How ChatGPT, Claude.ai, and Gemini lay out messages on the phone. I found no official page: a
  search returned only stock mockups. The phone options are my judgement from the problem, not from
  those apps.
- Perplexity, Gemini, Copilot Workspace, Devin, Jules, and ChatGPT canvas side panels.
- Claude Cowork's progress panel: only a search snippet.
- Virtuoso's tutorials on loading older messages.
- Codex's "Agent approvals" pages, read only through the sandboxing page.
- Whether a typed draft or the transcript's redraw causes the lag: needs a profile, not run.
