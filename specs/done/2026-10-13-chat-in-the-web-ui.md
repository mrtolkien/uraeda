---
kind: feature
finished: 2026-10-13
pull-request: https://github.com/mrtolkien/uraeda/pull/10
---

# Record: Chat in the web UI

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-13, finished on
> 2026-10-13, in [its pull request](https://github.com/mrtolkien/uraeda/pull/10). Its full files are
> in git: `git log -- specs/2026-10-13-chat-in-the-web-ui/`.

## What and why

The web UI already ran Claude Code at each workflow step. This feature adds the last thing the human
still used the terminal for: back-and-forth chats. They can ask about a step without committing, ask
about a spec or plan, read the message that goes to the agent before handing over, and chat with no
feature attached, "like a normal coding agent". Sessions are listed and searchable in the sidebar
with a status inspired by [herdr](https://herdr.dev/). The concepts stay generic, since Codex and
pi-durable are to join soon.

## Behaviour

- **One conversation per feature.** A feature's session holds both the workflow's runs and the
  human's chat, in order. "Open the session" on the feature page opens it, whatever the step:
  - it opens beside the feature page on wide screens, and as its own page on the phone, at
    `/f/<folder>/session`;
  - old run links, `/f/<folder>/runs/<id>`, open it at their turn.

  A chat message that starts a turn after a workflow turn, or opens the session, carries a muted
  opening line. It says a human is chatting, and that the agent changes files, commits, or moves the
  workflow only when asked. The agent may still do so in `auto` mode when asked.

- **The transcript and the composer.**
  - Replies stream, published every 250 ms, with tool calls folded into one-line rows and each
    sub-agent as a group of its own. Each workflow turn opens with "Run: <step>".
  - The transcript loads its last pages first, 100 items each. Back returns to the same scroll
    position.
  - Enter sends on wide screens; on the phone, Return adds a line and the button sends.
  - Refusals stay under the composer, which keeps the text.
- **Messages during a turn.** A human message sent while the agent works is steered into the turn:
  the agent reads it once its current tool ends, and no second turn starts. Until it is read, it
  shows greyed with a ✕ that takes it back, its text returning to the composer. A message already
  read, or of an ended turn, is refused with "The agent already read it.". A workflow message sent
  during a chat turn queues after it.
- **Stop.** Stop replaces Send in the composer during a turn: it interrupts the turn and keeps the
  session. It ends the queued turns and takes back the unread steered messages. Without an answer to
  the interrupt, the process gets SIGINT after 10 seconds, then SIGTERM. A turn that ends on its
  own, as a failed one, also takes back the unread steered messages, which leave the transcript.
- **One process per session.** A session keeps at most one agent process and one turn. The process
  closes after 15 idle minutes, and the next message resumes the same session with `--resume`. A
  session whose transcript is gone starts a new one, which the transcript says. A turn silent for 30
  minutes fails.
- **Handing over.** Every button that commits and leads to the agent names it:
  - "Commit and start the agent", "Approve and start the agent", "Request changes and start the
    agent", and "Start the feature and the agent";
  - "Start the agent" and "Try again" on the feature page.

  Each commits, then opens the session with the workflow's message in the composer, after any text
  already typed. Nothing is sent until the human, who can edit or add to it, presses "Start the
  agent". When the feature has moved to a step that waits on the human, the button stays, disabled,
  with "The feature waits on you now: there is nothing to continue." The message no longer says "No
  chat session is attached", and a run ends with the agent's own closing words.

- **The sidebar.** Each feature row shows its session's status dot. The statuses, from the first
  rule that matches:
  - Working: a turn running or queued;
  - Needs you: a blocked action not allowed, or a step that waits on the human;
  - Failed: the latest turn failed;
  - New reply: the latest turn ended after the human last saw the session;
  - Idle, or Stopped.

  Within a group, needs you sorts first, then failed, new reply, working, and idle. A session viewed
  is recorded as seen on the server, so every open sidebar follows within a second. A step changed
  through git updates the status without a reload. Running sub-agents show as indented rows under
  their session.

- **Search.** A search field filters features and chats by title and by message text. It looks in
  the cache, 200 ms after typing stops, and matches the text literally. "No session matches
  “<text>”." shows when nothing matches.
- **Chats without a feature.** "New chat", in the sidebar's Chats section, opens a chat at
  `/chats/new`:
  - its first message starts a session in the main checkout, with the Uraeda skill and no opening
    line;
  - its first non-blank line, cut at 80 characters, is the title, renamed in place by the same rule;
  - Archive moves it under "Archived", at the end of the section, and sending to it brings it back.
- **Blocked actions.** An action `auto` mode blocks shows as "Blocked by auto mode: <tool>
  <target>", with "Allow and retry", disabled while a turn works. Allowing reopens the session's
  process with that one rule, which lasts until the process closes, and sends "Try the blocked
  action again, now allowed: <tool> <target>" as an `allow` turn.
- **Ask the agent.** On a spec's, plan's, or assessment's review page, a selected block offers "Ask
  the agent" beside "Comment"; each question of a round offers it too. It opens the session with the
  composer holding "About specs/<folder>/<file>, lines <start>–<end>:" or "About Q3 of
  specs/<folder>/<file>:", and the quote.
- **Writes wait.** Saves and commits on a feature are refused while its session has a turn running,
  a chat turn as a run: "An agent is working on this feature. Stop it first, or wait for it." Drafts
  and priorities stay writable.
- **After a crash,** the turns left running or queued end as "Stopped: the server stopped while it
  ran."

## Design

The runner became a session manager over an agent-neutral adapter. The adapter opens one process per
session and writes the messages to it as they come, Claude Code taking them on its open stdin as
stream-json. The cache stores sessions, turns, and items in ACP's vocabulary for tool kinds and
statuses. fate serves them to a session view with a composer, and to a sidebar with statuses and
search. A workflow run is one turn of its feature's session, started by a message like any other.

**The runner** ([`packages/server/src/runner/`](/packages/server/src/runner/)):

- **The adapter interface,** [`adapter.ts`](/packages/server/src/runner/adapter.ts), with the items
  in [`events.ts`](/packages/server/src/runner/events.ts):
  - `Adapter` declares its `capabilities`, `steer`, `queue`, `takeBack`, `approvals`, and
    `subagents`, and the UI offers only those;
  - `AgentProcess` has `send` (steer or queue), `takeBack`, `interrupt`, `close`, and `kill`.

  The [fake](/packages/server/src/runner/fake.ts) scripts several turns and declares other
  capabilities, so tests prove the generic paths.

- **The Claude Code adapter,** [`claude.ts`](/packages/server/src/runner/claude.ts), with its line
  parser in [`claude-events.ts`](/packages/server/src/runner/claude-events.ts):
  - it runs `claude -p` with stream-json in and out, `--include-partial-messages`,
    `--permission-mode auto`, and `--plugin-dir`, then `--session-id` or `--resume`, and
    `--allowedTools` for an allowed rule;
  - it sends a steered message with the priority `next` and a queued one with `later`, Stop as an
    `interrupt` control request, and a take-back as `cancel_async_message`;
  - it reads text deltas from `stream_event`, sub-agents from `parent_tool_use_id`, and read or
    taken-back messages from `command_lifecycle`.

  None of these control messages are in Claude Code's public docs.
  [`scripts/validate-claude.ts`](/packages/server/scripts/validate-claude.ts), run by hand, checks
  them on the installed version: 2.1.296 passed every check.

- **The cache,** [`cache.ts`](/packages/server/src/runner/cache.ts): migration 3 replaced runs with
  `sessions`, `turns`, and `items`. Each feature's runs became `workflow` turns of one session,
  keeping their IDs, and converted sessions count as seen. A session is claimed by its server's pid,
  so one process per session holds across servers sharing the cache.
- **The session manager,** [`sessions.ts`](/packages/server/src/runner/sessions.ts), replacing
  `runner.ts`. It opens, sends, steers, queues, takes back, stops, allows, and closes, with the
  idle, watchdog, and terminate timers, and its refusals. A feature's session works in its worktree,
  a chat in the main checkout, from the core's [`main_root`](/crates/core/src/api.rs), bound as
  `mainRoot` in [`lib.rs`](/crates/binding/src/lib.rs).
- **Statuses,** [`status.ts`](/packages/server/src/runner/status.ts): the pure function behind the
  sidebar, the session's header, and the feature page. **Messages,**
  [`message.ts`](/packages/server/src/runner/message.ts): the workflow's message, the opening line,
  and the retry message.

**fate and live updates:**

- [`fate/sessions.ts`](/packages/server/src/fate/sessions.ts) serves `Agents`, `Session` with its
  item pages, `SessionList`, live, `SessionSearch`, keyed by its query and not live, and
  `WorkflowMessage`.
- The mutations, in [`mutations.ts`](/packages/server/src/fate/mutations.ts), are `session.send`,
  `takeBack`, `stop`, `allow`, `rename`, `archive`, and `seen`; `run.*` are gone.
- [`live.ts`](/packages/server/src/live.ts) publishes a session every 250 ms during a turn, and the
  list on each status change, a step changed through git included.

**The web UI** ([`packages/web/src/`](/packages/web/src/)):

- [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx): a feature's session, a chat, and a new
  chat, filled from `?continue=<trigger>` or `?ask=<quote>`. Its parts are
  [`Transcript.tsx`](/packages/web/src/Transcript.tsx), a `ChatMessageList` named "Conversation"
  with a status region, and [`Composer.tsx`](/packages/web/src/Composer.tsx), on Astryx's
  `ChatComposer`.
- [`SessionNav.tsx`](/packages/web/src/SessionNav.tsx) in
  [`Shell.tsx`](/packages/web/src/Shell.tsx): search, status dots through
  [`StatusMark.tsx`](/packages/web/src/StatusMark.tsx), sub-agent rows, and Chats with Archived.
- [`sessions.ts`](/packages/web/src/sessions.ts) sends from every page. The hand-over goes through
  [`CommitActions.tsx`](/packages/web/src/CommitActions.tsx) and
  [`AgentPanel.tsx`](/packages/web/src/AgentPanel.tsx), and Ask the agent through
  [`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx) and
  [`Question.tsx`](/packages/web/src/Question.tsx).
- [`scripts/screenshots.ts`](/packages/web/scripts/screenshots.ts) takes the views at both sizes and
  in both themes, for review.

## Questions

### Round 01

#### Q1: How do chats about a feature relate to the session its workflow runs use?

**Answer:** A: each feature has one conversation, the workflow's runs and the human's messages
following each other in the same session; sessions without a feature are separate.

#### Q2: What may the agent change during a chat?

**Answer:** A: what a run may do, in `auto` mode, with a message telling it to change files, commit,
or move the workflow only when asked.

#### Q3: What is "the final message before handoff"?

**Answer:** A and C: the message to the agent is shown before it is sent, and runs end with the
agent's own closing words, "we should see the full context in the session view". The "say nothing
else" caveat goes: "the coding agent doesn't even need to know it's running in headless mode".

#### Q4: Where do sessions appear in the sidebar?

**Answer:** A: the features keep their groups, each with a status dot, plus a Chats section and a
search field, and "we should also see if there are sub-agents, if that's possible".

#### Q5: Where does a session without a feature work?

**Answer:** A: in the main checkout, on its current branch; "the web UI running inside uraeda and
editing itself is a very niche use-case".

#### Q6: How does the server keep a conversation going with Claude Code?

**Answer:** A: one process per open session, Stop interrupting the turn, closed after 15 idle
minutes; "Claude Code integration will always be flaky [...] It's life."

#### Q6.A: What happens to a message you send while the agent works?

**Answer:** A: the agent reads it once its current tool ends, and it shows greyed with a ✕ until
then.

#### Q7: How far does the generic agent design go now?

**Answer:** A: a generic model of sessions, turns, and items with ACP's vocabulary and declared
capabilities, with Claude as the only adapter.

#### Q8: What happens when `auto` mode blocks an action during a chat?

**Answer:** A: as for runs, the action is skipped, shown as blocked, and "Allow and retry" reopens
the process with that one rule.

#### Q9: What else ships with the chat?

**Answer:** A: the session view, the sidebar's statuses and search, chats without a feature, rename
and archive, and Ask the agent; notifications, model pickers, forking, and a diff view left for
later.

## Decisions

- [Agents](../decisions/agents.md), changed: one process per open session, taking messages as they
  come; one session per feature, holding its runs and the human's chat; chats in the main checkout;
  an agent-neutral session, turn, and item shape with declared capabilities; rows keyed by session;
  Stop as an interrupt that keeps the session; idle processes closed after 15 minutes.

## Changes after approval

The spec review's comments, applied in the plan:

- **C1:** a process closed after 15 idle minutes is reopened with Claude Code's own `--resume`, for
  cache hits.
- **C2:** the buttons say they start the agent, not "continue": "Commit and start the agent" and its
  siblings (ruling R4).

Rulings that change behaviour:

- **Take-back** works on Claude Code 2.1.296 through `cancel_async_message`, so the ✕ shows (R5).
- **Converted sessions** count as seen, so an upgrade shows no "New reply" (R6).
- **The opening line** goes on a chat message that starts a turn, not on one steered into a workflow
  turn (R10).
- **Stop** ends the queued turns and takes back the unread steered messages. A turn's own first
  message cannot be taken back (R11).
- **A steered message** keeps its turn running until the agent reads it (R12).
- **The sidebar** lists every session, archived chats included, and search also matches features'
  titles (R13).
- **Stop is in the composer only,** and taken-back messages leave the transcript (R14).
- **"Open the session"** shows on every feature with a branch, and a filled composer keeps what was
  typed before the message (R15).
- **The session views** take main's wider reading column (R16).
- **A turn that ends on its own** takes back the steered messages the agent has not read (R17).
- **A refused hand-over** keeps "Start the agent", disabled, with no chat Send (R18).

From the final review, each fixed with tests:

- turns left queued by a crash end as stopped, and no longer read as working;
- a step changed through git updates its session's status live;
- a message steered into a failed turn is taken back, never run unrecorded (R17);
- a session viewed at a gate is recorded as seen;
- the README describes sessions as built.

The minor fixes: Allow and retry shows disabled during a turn, a failed Stop says why, a renamed
chat keeps one line of 80 characters, and the server forgets the messages of ended turns. A queued
turn stopped while its process reopens stays stopped, and every link to a session encodes its
folder. A refused hand-over can no longer be sent as a chat (R18), and a take-back of an ended
turn's message is refused as read.

## Follow-ups

- **A feature with no branch:** its composer is not disabled, and the refusal shows only after a
  send. It is reachable only by typing `/f/<draft>/session`.
- **Pid reuse after a crash** can leave a session unclaimable, as for runs (R1): store the server's
  start time with its pid.
- **A new chat re-reads its session 1 second after mount,** a timer workaround: fate cannot tell
  when a subscription has reached the server.
- **From the screenshot review:**
  - the "＋" glyph renders as a box in headless WebKit;
  - the sub-agent tool group is collapsed by default;
  - a taken-over session with no turns puts its composer under the header, with no hint line;
  - the feature page still offers "Start the agent" while a chat turn works, and pressing it is
    refused;
  - on the phone, Stop and "Open the session" sit on separate rows.
- **PRIORITIES' scratchpad** keeps two items this feature did: "Tools path … stripped" and "Rename
  'Start and continue'", left to the human.
- **Left for later, from Q9:** notifications, model and effort pickers, forking, editing past
  messages, a diff view, a context gauge, an agent picker and icons with the second agent.
