---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: high
plan-review: true
---

# Spec: Chat in the web UI

> [!IMPORTANT]
>
> Spec to review, about 35 minutes.
>
> - **The agents decision changes**, in its [proposed change](../decisions/agents.md):
>   - one process per open session, taking messages as they come;
>   - one session per feature, holding both its runs and your chat;
>   - the main checkout for sessions without a feature;
>   - a line opening chat messages;
>   - cache rows keyed by session;
>   - Stop as an interrupt that keeps the session. Every rule is written out as it would read.
> - **How I read your Q3 answer:** the "continue" buttons no longer hand over at once. They commit,
>   then open the session with the workflow's message in the composer, where you read it, add a note
>   or edit it, and press Send. That is one more tap than today. Say so if you want the preview on
>   the buttons themselves.
> - **The riskiest assumption:** steering a message into a turn, interrupting it, and taking a
>   message back use Claude Code messages that its public docs do not describe. The plan's first
>   task checks them on the installed version. If Claude Code cannot take back a single message, the
>   ✕ is hidden for Claude sessions.
> - **Sub-agents, as your Q4 answer asked:** while they work, they show under their session in the
>   sidebar, and as a group of their own in the transcript.
> - **The run cache is converted:** each feature's runs become the turns of its session, and nothing
>   is lost.
> - **Risk tier `high`**, for the new process lifecycle, the cache's conversion, and the decision
>   change: the plan waits for your review.

Each feature gets one conversation with its agent, where the workflow's runs and your messages
follow each other, and the project gets chats of its own, without a feature. You read every message
sent to the agent before it goes, write to it while it works, stop it without losing the session,
and find every session in the sidebar, with its status and its running sub-agents. The design keeps
agents generic, so Codex and pi-durable can join as adapters. See the [proposal](proposal.md),
[discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## User stories

### US1: Chat with a feature's session (P1)

On a feature page, "Open the session" opens the feature's session view: beside the feature page on
wide screens, as its own page on the phone. It shows every turn so far, the workflow's runs and the
chat, and a composer at the bottom.

- **Sending.** You type a message and press Send. The reply streams in as the agent writes it, with
  its tool calls folded into one-line rows.
- **While the agent works.** Send steers your message into the turn: the agent reads it as soon as
  its current tool finishes. Until then it shows greyed, with a ✕ to take it back.
- **Stop.** It ends the turn and keeps the session.

The agent may change files and commit, as in a run, and the chat's opening line tells it to do so
only when you ask ([Q2](clarifications-01.md#q2-what-may-the-agent-change-during-a-chat)).

Why this priority: it is the proposal's back-and-forth, and every other story builds on the session
view
([Q1](clarifications-01.md#q1-how-do-chats-about-a-feature-relate-to-the-session-its-workflow-runs-use)).

Acceptance scenarios:

1. **Given** the feature `2026-10-13-chat` waiting on you at its questions, with an idle session,
   **When** you send "Why did you recommend A in Q6?", **Then**:
   - your message shows as your turn, under the line "A human is chatting with you about the feature
     specs/2026-10-13-chat/, on branch 2026-10-13-chat: answer, and change files, commit, or move
     the workflow only when they ask.";
   - the agent's reply streams below it;
   - the feature still waits on you.
2. **Given** the same session, whose last turn was that chat, **When** you send a second message,
   **Then** it goes without the opening line, and the agent's process is the same one, with no new
   process started.
3. **Given** a turn in which the agent is running a tool, **When** you send "Use the existing
   helper", **Then**:
   - the message shows greyed with a ✕;
   - when the agent reads it, it turns into a normal message within the same turn;
   - no second turn starts.
4. **Given** a greyed message the agent has not read, **When** you press its ✕, **Then** it leaves
   the transcript, and its text returns to the composer.
5. **Given** a working turn, **When** you press Stop, **Then**:
   - the turn ends as "Stopped" within 10 seconds;
   - the session stays open;
   - your next message is answered by the same session, with what it knew.
6. **Given** a working turn on a feature, **When** you save an answer on that feature, **Then** the
   save is refused with "An agent is working on this feature. Stop it first, or wait for it."
7. **Given** a session whose last turn ended 15 minutes ago, **When** the 15 minutes pass, **Then**
   its process is closed. **When** you send a message afterwards, **Then** the agent answers with
   the session's earlier context.

### US2: Read the workflow's message before handing over (P1)

"Approve and continue", "Start and continue", and the other "continue" buttons commit, then open the
feature's session with the workflow's message in the composer. So do "Start the agent" and "Try
again" on the feature page. You read it, add a note or edit it, and Send hands the feature to the
agent. Every message sent shows in the session as your turn, the workflow's included. A run ends
with the agent's own closing words: what it did, and what waits for you
([Q3](clarifications-01.md#q3-what-is-the-final-message-before-handoff)).

Why this priority: it is the proposal's "see the final message before handoff", and the human's
answer, "we should see the full context in the session view".

Acceptance scenarios:

1. **Given** a round of questions you answered, **When** you press "Commit and continue" on its
   page, **Then**:
   - the answers are committed;
   - the feature's session opens with the composer holding these three lines: "/uraeda:uraeda
     Continue the feature specs/2026-10-13-chat/, on branch 2026-10-13-chat.", "The human answered
     clarifications-01.md of the questions.", and "Its next step is spec: follow
     skills/uraeda/references/spec.md.";
   - nothing is sent yet.
2. **Given** that composer, **When** you add "Keep the spec short." on a new line and press Send,
   **Then**:
   - the whole text shows as your turn, marked "Run: Spec";
   - the agent starts the step;
   - the message no longer says "No chat session is attached".
3. **Given** a run that ends at a human gate, **When** it ends, **Then** its last item is the
   agent's closing text, and the sidebar shows the feature as "Needs you".
4. **Given** the composer holding the workflow's message, and another tab having moved the feature
   to a step that waits on you, **When** you press Send, **Then**:
   - nothing is sent;
   - the composer shows "The feature waits on you now: there is nothing to continue.";
   - your text stays.
5. **Given** a chat turn working on the feature, **When** you send the workflow's message, **Then**
   it shows as queued below the turn, and starts when that turn ends.

### US3: See every session in the sidebar (P1)

The sidebar keeps the features in their groups:

- each feature row shows its session's status dot;
- a Chats section below lists the sessions without a feature;
- while a session's sub-agents work, each shows as an indented row under it;
- a search field at the top filters features and chats by title and by message text.

On the phone, the same sidebar opens from the menu
([Q4](clarifications-01.md#q4-where-do-sessions-appear-in-the-sidebar)).

Why this priority: it is how you see, from anywhere in the UI, what needs you.

Acceptance scenarios:

1. **Given** a feature whose step waits on you, **Then** its row shows a warning dot labelled "Needs
   you".
2. **Given** a working turn, **Then** its feature's row shows a pulsing accent dot labelled
   "Working". **When** the turn ends with the feature waiting on the agent, and you have not opened
   the session since, **Then** the dot becomes a success dot labelled "New reply".
3. **Given** a "New reply" session, **When** you open it on the phone, **Then** the desktop's
   sidebar shows it as "Idle" within a second.
4. **Given** a turn in which the agent started a sub-agent "Map the runner code", **Then** an
   indented row "Map the runner code" with a pulsing dot shows under the session's row. **When** the
   sub-agent ends, **Then** the row leaves.
5. **Given** a chat whose agent said "the cache uses WAL mode", **When** you type "wal" in the
   search field, **Then** the chat is listed, and features and chats without a match are hidden.
   **When** nothing matches "zzz", **Then** the sidebar says "No session matches “zzz”."
6. **Given** a feature at "Waiting on you" and another failed, both in the same group, **Then** the
   one needing you is listed first.

### US4: Chat without a feature (P2)

"New chat", in the sidebar's Chats section, opens an empty chat. The first message creates the
session, in the main checkout, with the Uraeda skill loaded, and its first line, up to 80
characters, becomes the title. The title can be renamed in place. Archive hides the chat from the
sidebar; archived chats show under "Archived" at the end of the section, and sending to one brings
it back ([Q5](clarifications-01.md#q5-where-does-a-session-without-a-feature-work)).

Why this priority: the proposal asks for it, but features' sessions come first.

Acceptance scenarios:

1. **Given** no chat, **When** you press "New chat" and send "List the open draft files", **Then**:
   - a session starts in the main checkout;
   - the message goes without an opening line;
   - "List the open draft files" heads the Chats section, with a "Working" dot.
2. **Given** that chat, **When** you rename it to "Drafts", **Then** the sidebar and the session's
   header both say "Drafts".
3. **Given** that chat, **When** you archive it, **Then** it leaves the Chats section and shows
   under "Archived". **When** you send a message to it from there, **Then** it is back in the Chats
   section.
4. **Given** Claude Code missing from the machine, **When** you open "New chat", **Then** the
   composer is disabled with "Claude Code is not available on this machine."

### US5: Allow a blocked action from the chat (P2)

When `auto` mode blocks an action during a turn, it shows in the transcript as blocked, with "Allow
and retry". The session counts as needing you until its next turn starts. Pressing the button
reopens the session's process with that one rule, and asks the agent to try again
([Q8](clarifications-01.md#q8-what-happens-when-auto-mode-blocks-an-action-during-a-chat)).

Why this priority: today's "Allow and continue" restarts a workflow run, which is wrong in a chat.

Acceptance scenarios:

1. **Given** a turn in which `auto` mode blocked `Bash` running `git push origin HEAD`, **When** the
   turn ends, **Then**:
   - the transcript shows "Blocked by auto mode: Bash git push origin HEAD" with "Allow and retry";
   - the sidebar shows "Needs you".
2. **Given** that blocked action, **When** you press "Allow and retry", **Then**:
   - the process is reopened with the rule `Bash(git push origin HEAD)`;
   - the message "Try the blocked action again, now allowed: Bash git push origin HEAD" is sent and
     shown as your turn.
3. **Given** that process, **When** it closes after 15 idle minutes and a later message reopens it,
   **Then** the rule is no longer passed.

### US6: Ask the agent about a block (P3)

On the review page of a spec, plan, or assessment, a selected block offers "Ask the agent" beside
"Comment". On a round's page, each question offers it too. It opens the feature's session with the
composer holding a quote of the block, ready for your question
([Q9](clarifications-01.md#q9-what-else-ships-with-the-chat)).

Why this priority: a shortcut over US1, which works without it.

Acceptance scenarios:

1. **Given** the spec's review page with lines 50 to 52 selected, **When** you press "Ask the
   agent", **Then** the session opens with the composer holding "About
   specs/2026-10-13-chat/spec.md, lines 50–52:", the quoted lines, and an empty line for your
   question.
2. **Given** a round's page, **When** you press "Ask the agent" on Q3, **Then** the composer holds
   "About Q3 of specs/2026-10-13-chat/clarifications-01.md:" and the question's title, quoted.

## Edge cases

- **Two tabs sending at once:** the server takes them in order. The second steers into the turn the
  first started.
- **A session whose transcript Claude Code deleted:** after 30 days by default, the next message
  starts a new session, and the transcript says "Started a new session: the previous one is gone."
  The history shown stays.
- **The process exits between turns,** a crash or a kill: the session is idle, and the next message
  resumes it.
- **The process exits during a turn:** the turn fails with the last lines of its error output, as
  runs do today.
- **An interrupt whose result has no text,** a known Claude Code issue: the turn ends as "Stopped".
- **The agent's session ID changes inside a process,** as `/clear` does: the session keeps following
  the ID of the latest event.
- **An empty or blank message:** Send is disabled.
- **A feature with no branch yet,** its proposal not committed: the composer is disabled with "This
  feature has no branch yet: commit its proposal first."
- **"Allow and retry" during a turn:** it is disabled until the turn ends, since it reopens the
  process.
- **A feature finished into its record:** it leaves the sidebar as today. Its session stays in the
  cache, unlisted.
- **A long transcript:** it loads its last pages first, 100 items per page, as run logs do today.
- **Stop during a sub-agent:** it ends with its parent's turn, and its sidebar row leaves.
- **A server stopped while processes run:** the server closes them as it stops. After a crash, the
  turns left running show "Stopped: the server stopped while it ran.", as runs do today.
- **Back from a session view:** it returns to the same scroll position, following the end only when
  you were at the end.

## Success criteria

- **SC-001**: A message sent to a session whose process is open starts no new process.
- **SC-002**: A session's status change shows in every open sidebar within 1 second.
- **SC-003**: Searching 500 sessions holding 100,000 items answers in under 200 ms.
- **SC-004**: The session view, the chat view, and the sidebar pass the UI checks at 402 × 874 and
  1440 × 900, in both themes.
- **SC-005**: A session's process left idle 15 minutes is closed, and its next message resumes the
  same agent session.

## Design

### Approach

The runner becomes a session manager. Each session holds at most one agent process, opened for its
first message, kept while it is used, and closed after 15 idle minutes, as the
[agents decision's proposed change](../decisions/agents.md) says. Claude Code takes the messages on
its open stdin ([driving Claude Code](discovery-01.md#driving-claude-code-across-turns)):

- a steered message carries the priority `next`, and a queued one the priority `later`;
- Stop writes an interrupt control request.

A workflow run is one turn of the feature's session, started by a message like any other. The
session, turn, and item shape is agent-neutral, with ACP's tool kinds and statuses
([common ground](discovery-01.md#common-ground-between-agents)). Each adapter declares its
capabilities, and the UI offers only those. The statuses are herdr's, computed on the server from
the session, its latest turn, and its feature's step.

### Data

**The cache, migration 3** ([`cache.ts`](/packages/server/src/runner/cache.ts)) replaces the
`sessions` and `runs` tables, and renames `events` to `items`:

```sql
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,   -- Uraeda's own, a UUID
  repo        TEXT NOT NULL,      -- the main checkout's path
  folder      TEXT,               -- the feature's folder, NULL for a chat
  agent       TEXT NOT NULL,      -- 'claude'
  native_id   TEXT NOT NULL,      -- the agent's own session ID
  title       TEXT,               -- NULL for a feature's session: its feature's name shows
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,      -- the last turn's start or end
  seen_at     TEXT,               -- when the human last saw it ended
  archived_at TEXT,
  pid         INTEGER             -- the live process, NULL when closed
);
CREATE UNIQUE INDEX one_session_per_feature ON sessions (repo, folder) WHERE folder IS NOT NULL;
CREATE TABLE turns (
  id         INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions (id),
  kind       TEXT NOT NULL,       -- 'workflow' | 'chat' | 'allow'
  trigger    TEXT,                -- workflow turns: 'answers', 'approval', ...
  step       TEXT,                -- workflow turns: the step's name
  allowed    TEXT,                -- allow turns: the rule
  state      TEXT NOT NULL,       -- 'queued' | 'running' | 'done' | 'failed' | 'stopped'
  reason     TEXT,
  cost_usd   REAL,                -- the agent's running total for the session, at the turn's end
  started_at TEXT,
  ended_at   TEXT
);
CREATE INDEX turns_by_session ON turns (session_id, id);
-- items: (turn_id, seq, at, kind, data JSON), PRIMARY KEY (turn_id, seq), the former events.
```

The conversion:

- Each former `(repo, folder)` session row becomes a session with a new ID, its `session_id` as
  `native_id`, and agent `claude`.
- Each run becomes a `workflow` turn of its feature's session, keeping its ID, so old links still
  resolve, and its events become its items.
- A run whose session was replaced also joins its feature's one session.

**Items**, in [`events.ts`](/packages/server/src/runner/events.ts), are what the UI draws:

```ts
type Item =
  | {
      kind: "message";
      id: string;
      text: string;
      origin: "human" | "workflow";
      opening?: string;
      state: "pending" | "read" | "taken-back";
    }
  | { kind: "text"; text: string; streaming: boolean }
  | {
      kind: "tool";
      id: string;
      name: string;
      toolKind: ToolKind;
      target?: string;
      status: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
      durationMs?: number;
      output?: string;
      parent?: string;
      subagent?: { description: string };
    }
  | { kind: "system"; text: string }
  | { kind: "denial"; tool: string; target?: string; rule: string; allowed: boolean };
type ToolKind =
  "read" | "edit" | "delete" | "move" | "search" | "execute" | "think" | "fetch" | "other";
```

- `opening` is the chat's opening line, shown muted above the human's text.
- A `text` item is written once per delta batch, and stays `streaming` until its block ends.
- A tool's `target` is a path relative to the session's directory.
- A tool with `subagent` is a sub-agent, and the tools it runs carry its ID as `parent`.
- The agent's thinking is neither stored nor shown.

**Statuses** (`runner/status.ts`), from the first rule that matches:

| Status      | When                                                                       | Dot               |
| ----------- | -------------------------------------------------------------------------- | ----------------- |
| `working`   | a turn is running or queued                                                | accent, pulsing   |
| `needs-you` | the latest turn has a blocked action not allowed, or the step waits on you | warning, "!" icon |
| `failed`    | the latest turn failed                                                     | error, "×" icon   |
| `unread`    | the latest turn ended after `seen_at`                                      | success, "✓" icon |
| `idle`      | otherwise, labelled "Stopped" when the latest turn was stopped             | neutral           |

- **Labels:** "Working", "Needs you", "Failed", "New reply", "Idle", and "Stopped".
- **Sort order** within a group: needs you, failed, new reply, working, idle.
- **Seen:** the session view records it when it shows a session whose latest turn has ended.

**The flow:**

1. The web UI sends `session.send`.
2. The session manager opens the process if needed, writes the message, and records items from the
   adapter's events.
3. The live publisher sends `Session` updates every 250 ms during a turn, and `SessionList` updates
   on each status change.

### Components

**Server, the runner** ([`runner/`](/packages/server/src/runner/)):

- **Adapter interface** (`adapter.ts`):
  - `Adapter`:
    - `kind`, `name`, and `capabilities: { steer, queue, takeBack, approvals, subagents }`;
    - `version()` and `hasSession(nativeId)`;
    - `allowRule(denial)`, the narrow rule in the agent's own syntax;
    - `open({ cwd, nativeId, resume, allowed })`, returning an `AgentProcess`.
  - `AgentProcess`:
    - `events`;
    - `send({ id, text, when: "steer" | "queue" })` and `takeBack(id)`;
    - `interrupt()`, `close()`, and `kill()`.
  - Nothing in it names Claude.
- **Claude adapter** (`claude.ts`, with its line parser moved to `claude-events.ts`):
  - It runs
    `claude -p --input-format stream-json --output-format stream-json --verbose --include-partial-messages --permission-mode auto --plugin-dir <skill>`,
    then `--session-id` or `--resume`, and `--allowedTools` when a rule is allowed.
  - `send` writes a user message with its `uuid` and priority.
  - `interrupt` writes the interrupt control request, and `close` ends stdin.
  - It reads `stream_event` text deltas, `parent_tool_use_id` for sub-agents, and
    `command_lifecycle` for read and taken-back messages.
  - `takeBack` is declared only once the validation script shows a single queued message can be
    cancelled.
- **Status** (`status.ts`): the pure function of the table above.
- **Messages** (`message.ts`):
  - The workflow's message, without its "No chat session is attached" sentence.
  - The chat's opening line, and the retry message of an allowed action.
  - Tool targets relative to the session's directory.
- **Cache** (`cache.ts`):
  - Migration 3, and sessions, turns, and items by session.
  - The atomic claim of a turn, which keeps one turn per session across servers.
  - The repository's sessions, with search, limited to 50 results.
- **Session manager** (`sessions.ts`, replacing `runner.ts`): it opens, sends, stops, closes, and
  allows, at most one process and one turn per session.
  - **Queue:** workflow messages queue behind a working turn; human messages steer into it.
  - **Timers:** a 15-minute idle timer per process, and the 30-minute watchdog during a turn only.
  - **Refusals:** a workflow message is refused unless the feature waits on the agent.
  - **Directory:** the feature's worktree from the core's `workDir`, or the main checkout.
  - **Shutdown:** `closeAll`.
- **Fake adapter** (`fake.ts`): multi-turn scripts and declared capabilities, so tests prove the
  generic paths, steer and queue, take-back, and approvals, that Claude may not declare.
- **Validation script** (`scripts/validate-claude.ts`), run by hand on the installed Claude Code. It
  covers two turns in one process, a steered message, a queued one, a single take-back, the
  interrupt, partial text, sub-agent events, and closing then resuming.

**Server, data and live** ([`fate/`](/packages/server/src/fate/),
[`live.ts`](/packages/server/src/live.ts)):

- **Views:**
  - `Session`: ID, folder, agent, title, status and reason, directory label, cost, item pages,
    pending messages, and running sub-agents.
  - `SessionList`: the sidebar's rows, filtered by the search text.
  - `WorkflowMessage`: the message for a feature and a trigger, which the composer is filled with.
  - `Agents`: each adapter's availability, version, and capabilities, replacing `Runner`.
- **Mutations:** `session.send` (with an optional workflow trigger), `session.takeBack`,
  `session.stop`, `session.allow`, `session.rename`, `session.archive`, and `session.seen`.
- `writable` refuses a feature's writes while its session has a turn running.
- `run.start`, `run.allow`, and `run.stop` are removed.

**Core and binding:** `mainRoot(repo)` in [`api.rs`](/crates/core/src/api.rs) and the binding, so
TypeScript gets the main checkout's path without a feature.

**Web UI** ([`packages/web/src/`](/packages/web/src/)):

- **Session view** (`SessionPage.tsx`):
  - Routes: the feature's session at `/f/<folder>/session`, a pane beside the feature page on wide
    screens and a page on the phone; a chat at `/chats/<id>`; an empty chat at `/chats/new`.
  - A header with the title (renamed in place for a chat), the agent's name, the directory or
    branch, the cost, and the status.
  - The transcript, and the composer.
  - `/f/<folder>/runs/<id>` opens the session at that turn.
- **Transcript** (`Transcript.tsx`, from `RunLog.tsx`), a `ChatMessageList` named "Conversation":
  - Each workflow turn opens with "Run: <step>".
  - Your messages are on the right, with their opening line muted, and pending ones greyed with ✕.
  - The agent's text is in `Markdown`.
  - Tools are grouped in `ChatToolCalls`, and a sub-agent is a group of its own.
  - Blocked actions show with "Allow and retry".
  - A status region announces "Claude Code is replying" and "Reply complete".
- **Composer** (`Composer.tsx`):
  - Built on Astryx's `ChatComposer` and `ChatSendButton`, which turns into Stop during a turn.
  - Enter sends on wide screens, and the button sends on the phone, where Return adds a line.
  - Filled from a workflow message or a quote, through the URL (`?continue=<trigger>`,
    `?ask=<path>:<lines>`).
  - Errors stay under it until the next send.
- **Sidebar** (`Shell.tsx`, with `SessionNav.tsx`):
  - A search field, then Home, Priorities, and the feature groups, each row with its `StatusDot`.
  - Rows of running sub-agents under their session.
  - The Chats section, with "New chat", and "Archived" at its end.
- **Feature page** (`AgentPanel.tsx`):
  - The session's status, its last turn, and Stop.
  - "Open the session", plus "Start the agent" or "Try again", which open it with the workflow's
    message.
  - The runs list goes: runs are in the session.
- **"Continue" buttons:** the callers of [`CommitActions.tsx`](/packages/web/src/CommitActions.tsx)
  commit, then open the session with the message.
- **Ask the agent:** in [`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx), beside Comment, and in
  [`RoundPage.tsx`](/packages/web/src/RoundPage.tsx), on each question.

### Mockups

- [Chat](mockups/chat.html):
  - On the desktop, light: the sidebar with statuses, a sub-agent, and Chats, beside a feature page
    and its session. The session shows a run with its message, a sub-agent's tools, a greyed steered
    message, a streaming reply, and Stop.
  - On the desktop, dark, two states side by side: a chat without a feature with a blocked action,
    and a feature's session right after "Commit and continue", its workflow message in the composer.
  - On the phone, light: the sidebar searched, with no match.
  - On the phone, dark: a feature's session with a chat, its opening line muted, and the composer.

### Error handling

- **Claude Code is missing or signed out:** the composer is disabled with "Claude Code is not
  available on this machine." When the process fails to start, its error shows on the turn.
- **The plugin does not load:** the turn fails with "The Uraeda skill did not load: <error>", and
  the process closes.
- **A send refused by the server:** the composer keeps the text, and shows the reason under it:
  - "An agent is working on this feature. Stop it first, or wait for it." for a write;
  - "The feature waits on you now: there is nothing to continue.";
  - "This feature has no branch yet: commit its proposal first."
- **A take-back after the agent read the message:** it is refused with "The agent already read it.",
  and the message stays.
- **Stop with no answer to the interrupt:** SIGINT after 10 seconds, then SIGTERM 10 seconds later.
  The turn ends as "Stopped".
- **No output for 30 minutes during a turn:** the watchdog fails it with "No output for 30
  minutes.", as runs do today.

### Testing

Server tests open the session manager and fate on a temporary SQLite file, with the fake adapter and
a test clock for the idle and watchdog timers. They drive it through fate's mutations and read its
views. Web tests render the app on the server's test harness with the fake adapter, and act like a
user through roles, labels, and text. Browser tests check the new pages in WebKit at both sizes.

| What                                                    | Test                                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------- |
| US1 to US6, every scenario                              | One integration test per scenario, web or server by where it shows         |
| Statuses and their order                                | Table-driven test of `status()`: one row per rule and tie                  |
| Edge cases                                              | One server test each; Back's scroll position in the browser tests          |
| Migration 3, with a replaced session                    | Server test opening a cache written by migration 2                         |
| Claude's events: deltas, sub-agents, lifecycle, results | Table-driven test of the line parser, on recorded lines                    |
| SC-001, SC-005                                          | Server tests counting the fake adapter's opens                             |
| SC-002                                                  | Server test on the live publisher, with the test clock                     |
| SC-003                                                  | Benchmark of the search on a generated cache                               |
| SC-004                                                  | The browser layout tests, extended to the session, chat, and sidebar pages |
| Claude Code's real behaviour                            | `validate-claude.ts`, run by hand                                          |

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- The statuses are herdr's: working, needs you, new reply (unread), idle, and failed or stopped.
  Needs you sorts first, and being seen is recorded on the server.
- Titles are the feature's name, or a chat's first line, and can be renamed. No titles are
  generated.
- Search looks at titles and message text in the cache, for this repository only.
- The history is Uraeda's own log in the cache. A gone transcript starts a new session, which says
  so.
- Existing runs become turns of their feature's session.
- Every message sent to the agent is stored and shown as your turn.
- Replies stream, published every 250 ms.
- The session view is a pane beside the feature page on wide screens, and a page on the phone, with
  its address in the URL.
- Your saves on a feature wait while the agent works on it.
- A workflow message sent during a chat turn waits for the turn to end.
- Sessions without a feature load the Uraeda skill.
- The transcript is a named log, a status region announces replies, and the focus stays in the
  composer. Enter sends on wide screens, and the button on the phone.

Settled while writing this spec:

- The workflow's message is read and edited in the session's composer, after the commit, rather than
  on the commit buttons. It is exactly the message that will be sent, and your note is a line you
  add to it. Your Q3 answer asked for the full context in the session view.
- The workflow's message drops "No chat session is attached: work until the next human gate, and
  commit every step. The commit is the message.", as your Q3 answer asked. The agent's closing words
  then follow the skill's chat rule: one or two sentences, with the file's path.
- Chats without a feature carry no opening line, and nothing tells the agent not to switch branches.
  Your Q5 answer set aside the UI editing its own repository.
- Sub-agents show while they work: as rows under their session in the sidebar, and as a group in the
  transcript. Claude Code marks a sub-agent's messages with the `parent_tool_use_id` of the tool
  call that started it ([headless](https://code.claude.com/docs/en/headless)).
- A blocked action needs you until the next turn of its session starts.
- Archive is for chats only, with no delete. A feature's session ends with its feature.
- The take-back ✕ shows only when the agent declares it. For Claude Code, it depends on the
  validation script.
- Tool paths show relative to the session's directory, from your priorities' scratchpad, since the
  transcript is rebuilt anyway.
- A grant from "Allow and retry" lasts until the session's process closes.
- The cost shown is Claude Code's running total for the session, as today.
- The feature page's runs list is replaced by the session, and old run links open the session at
  their turn.

## Decisions

Changed, applied when this spec is approved:

- [Agents](../decisions/agents.md): one process per open session, taking messages as they come; one
  session per feature, holding its runs and your chat; chats without a feature in the main checkout;
  an agent-neutral session, turn, and item shape with declared capabilities; rows keyed by session;
  Stop as an interrupt; idle processes closed after 15 minutes. See its
  `## Proposed change (2026-10-13-chat-in-the-web-ui)` section, at the end of the file.

Relied on:

- [Stack](../decisions/stack.md):
  - The logic stays in the session manager and the core, with the main checkout's path from the
    binding.
  - The UI gets its data from fate, and draws the agent's messages with Astryx's `Markdown`.
- [Git](../decisions/git.md): no tool switches a checkout, and commits go through `git` with hooks.
- [UI layout](../decisions/ui-layout.md): the session is a pane or a page by width, and its address
  is in the URL. The mockups show both widths.
- [UI behaviour](../decisions/ui-behaviour.md):
  - Rows are tapped whole, and renaming happens in place.
  - Errors stay next to the composer.
  - Enter is the composer's own action, not a shortcut.
- [UI components](../decisions/ui-components.md): Astryx's chat components, `StatusDot`, and
  `SideNav`, with StyleX for the rest.
- [UI checks](../decisions/ui-checks.md): tests through roles and text, both sizes, and screenshots.
- [Toolchain](../decisions/toolchain.md): every new test runs in `vp run ready`, except the
  validation script.

## Constitution check

| Principle                            | Complies | Notes                                                                                                                  |
| ------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| I. Humans stay in control            | yes      | Chats act only when asked, the workflow's message is sent only by you, and the decision change waits for your approval |
| II. Git and plain text first         | yes      | Workflow state stays in git; chat history is a cache                                                                   |
| III. Asynchronous by default         | yes      | No step needs a chat: chat state is a cache, which principle III allows                                                |
| IV. Review effort matches impact     | yes      | Statuses put what needs you first; the spec settles the details                                                        |
| V. Tools are optional                | yes      | The chat adds a way to talk to the agent; every step still works by hand                                               |
| VI. Code is checked against the spec | yes      | Every scenario has a test. The generic adapter is justified by Q7, in the plan's complexity tracking                   |

## Risk tier

**High**: a new process lifecycle on undocumented Claude Code messages, a conversion of the run
cache, and a changed decision.
