# Discovery, round 01: Chat in the web UI

## Summary

Coding agents and chatbots share one shape for this feature. A **session list** shows each
conversation with a title, a recent time, and a status kept to a few states: working, needs you,
finished and unseen, idle, failed. "Needs you" always comes first. A **session view** shows the
streamed transcript, with tool calls folded into one-line rows. Below it sits a composer with Send
and Stop, and messages sent while the agent works are either steered into the current turn or queued
after it. Products differ on three points: steer or queue by default, whether "unseen" is a state,
and whether side questions get their own conversation (Claude Code's `/btw`, Codex's `/side`).

The proposal asks for back-and-forth chats with the agent in the web UI. It names four uses: asking
about a step without committing, seeing "the final message before handoff", asking about a spec or
plan, and starting a session with no feature. It also asks for a searchable session list in the
sidebar with a herdr-like status, and a data model generic enough for Codex and pi-durable.

Today the server runs Claude Code once per workflow step: one process, one message, stdin closed at
once ([`claude.ts`](/packages/server/src/runner/claude.ts)). The run is refused unless the feature
waits on the agent, and runs are stored by feature in a SQLite cache. The UI shows a run's log with
no composer, and never shows the message sent to the agent. The
[agents decision](../decisions/agents.md) blocks four of the proposal's uses as written: one message
per run, one session per feature, runs in the feature's worktree, and rows keyed by the feature's
folder. It already names this feature as the channel for follow-up messages it left out.

## How other products do it

### herdr

- herdr runs agents in terminals on a background server. A **workspace** (a repository or task)
  "rolls up" the state of the agents inside it, "so you can see which project needs attention"
  ([concepts](https://herdr.dev/docs/concepts/)).
- It has five states ([concepts](https://herdr.dev/docs/concepts/)):
  - `working`.
  - `blocked`: "needs input, approval, or a decision".
  - `done`: finished and not yet seen. Each client tracks its own seen state.
  - `idle`: finished and seen.
  - `unknown`.
- The state comes from reading the bottom of the agent's terminal, or from the agent itself through
  an integration, which wins ([agents](https://herdr.dev/docs/agents/)).
- Icons and colours, from `src/client/shell.rs` in
  [the repository](https://github.com/herdrdev/herdr):
  - Default dots: ● for working, blocked, and done; ○ for idle.
  - A "symbols" option for distinct shapes: blocked ×, working ◐, done ✓, idle ○.
  - Colours: working yellow, blocked red, done teal, idle green.
  - Sorting and rollup order: blocked > done > working > idle.
- Sidebar rows ([configuration](https://herdr.dev/docs/configuration/)): a workspace row shows its
  state icon, name, branch, and git status. Agents can be listed grouped by workspace or sorted by
  priority.
- A picker searches agents by name, branch, or path, and filters by state
  ([keyboard](https://herdr.dev/docs/keyboard/)).
- It notifies "when a background agent finishes or needs input", with separate sounds, and never for
  the tab you are looking at ([configuration](https://herdr.dev/docs/configuration/)).

### Claude Code

- **The `/resume` picker** ([sessions](https://code.claude.com/docs/en/sessions)):
  - A row shows the name you gave, or else an AI title summarising the first prompt, then time since
    activity, branch, and size.
  - Search by typing, filter by branch or worktree, rename, preview.
  - Sessions started with `-p`, like Uraeda's, get no generated title and are left out of this
    picker.
- **The agent view** ([agent view](https://code.claude.com/docs/en/agent-view)):
  - States: Working (animated), Needs input (yellow: "an answer, a permission decision, or a sandbox
    or MCP prompt"), Idle (dimmed), Completed (green), Failed (red), Stopped (grey).
  - Groups: Pinned, Ready for review, Needs input, Working, Completed.
  - A row shows a one-line summary of what the session is doing, or the question it is asking.
  - A peek panel shows the pending question or the result, and you can reply from it.
- **The desktop app and the web** ([desktop](https://code.claude.com/docs/en/desktop),
  [web](https://code.claude.com/docs/en/claude-code-on-the-web)):
  - The sidebar filters by status or project, and archives. Deleting is done from the archived view,
    with a confirmation.
  - The transcript folds tool calls into summaries by default, with Thinking and Verbose modes.
  - The model picker, the permission mode, and a context ring sit beside Send.
  - "If you send a message while Claude is working, the message queues until Claude reads it. To
    take a queued message back, click the ✕ on it."
  - Permission cards: Allow once, Always allow, Deny.
- **In the terminal** ([interactive mode](https://code.claude.com/docs/en/interactive-mode)):
  - Enter while working sends a message that is "passed to Claude as soon as those tool calls
    finish, within the same turn": a steer.
  - Esc interrupts.
  - `/btw` asks a side question while Claude works, with "No tool access", without interrupting.

### Codex

- **Chats** ([projects](https://learn.chatgpt.com/docs/projects)):
  - Pin, rename, archive.
  - "Search chats … when you remember a phrase or branch name but not the title".
  - A chat can be started without a project: "New chat beside Recents".
- **Attention** ([notifications](https://learn.chatgpt.com/docs/notifications), commands in
  [llms-full](https://learn.chatgpt.com/docs/llms-full.txt)):
  - An Activity view lists chats that are unread, running, or waiting for you.
  - "Mark chat as unread", and "Next chat needing attention".
  - The status priority is needs input > blocked (failed) > ready (finished, unread) > running.
- **Steer or queue** ([prompting](https://learn.chatgpt.com/docs/prompting)): "Steer adds the
  message to the current run … Queue saves the message for the next run."
  - A setting picks the default.
  - Queued messages sit above the composer, editable and reorderable.
  - In the terminal, Enter steers and Tab queues.
- `/side` is "an ephemeral fork from the current chat", with its own transcript.

### OpenCode, pi, Cursor, and Zed

- **OpenCode** ([TUI](https://opencode.ai/docs/tui/), [web](https://opencode.ai/docs/web/)):
  - A session list, share links, and undo and redo through git.
  - Subagents run in child sessions you can step into.
  - `opencode web` lists active sessions and starts new ones.
- **pi**, version 0.73.1
  ([README](https://unpkg.com/@mariozechner/pi-coding-agent@0.73.1/README.md),
  [sessions](https://unpkg.com/@mariozechner/pi-coding-agent@0.73.1/docs/sessions.md)):
  - The `/resume` picker searches, renames, and deletes.
  - Sessions are trees: `/tree` moves inside one, `/fork` copies one from an earlier message.
  - Enter queues a steering message, delivered after the current tool calls. Alt+Enter queues a
    follow-up, delivered when all work is done.
- **Cursor** ([agent](https://cursor.com/docs/agent/overview.md)):
  - Messages sent while the agent works queue below the task and can be dragged to reorder.
  - "Send now" steers at the next tool call.
  - `/side` opens a durable side chat that uses the parent as hidden context.
  - Cmd+K searches past transcripts.
- **Zed** ([agent panel](https://zed.dev/docs/ai/agent-panel)):
  - Threads are grouped by project, get auto-generated titles, and can be archived.
  - Messages sent while the agent works are queued by default, with a Steer toggle.

### Conductor, Vibe Kanban, and Nimbalyst

- **Conductor** ([docs](https://www.conductor.build/llms-full.txt)):
  - A sidebar row shows the pull request's title, or else the branch.
  - A workspace can hold several chat tabs on one branch. A session is idle, working, or errored.
  - "messages sent while it works are steered into the running turn".
- **Vibe Kanban** ([interface](https://vibekanban.com/docs/workspaces/interface.md),
  [chat](https://vibekanban.com/docs/workspaces/chat-interface.md)):
  - Sidebar statuses: Running, Idle, Needs Attention (a raised hand).
  - Search by name or branch, with a layout grouped by status.
  - An approval card appears in the chat. A context gauge goes grey, then orange, then red.
- **Nimbalyst**, Crystal's successor
  ([sessions](https://nimbalyst.com/docs/session-management/agent-window-and-session-management.md)):
  - Search covers titles and transcript contents.
  - An attention list: Awaiting input, Running, Unread.
  - A turn summary: "Finished in 6m 57s, 3 files +45 -12".
  - "Chat with Session" is a conversation about a session, kept apart from its transcript.

### Chatbots

- **Claude.ai**
  ([rename or delete](https://support.claude.com/en/articles/8230524-delete-or-rename-a-conversation)):
  rename, and delete with a confirmation, from a menu on each chat. Editing a message branches the
  conversation (search snippet only).
- **Gemini** ([chats](https://support.google.com/gemini/answer/13666746)):
  - Pinned and recent chats sit in a side panel that folds behind a menu.
  - Search, pin, rename, delete.
- **ChatGPT**, from search snippets only, since its help centre refused every request:
  - Sidebar search, pin, archive (archived chats stay searchable), delete with a confirmation.
  - "Branch in new chat".
- On desktop, Enter sends and Shift+Enter adds a line. On a phone, Return adds a line and the button
  sends (third-party snippet).

### What they have in common

- **The list:**
  - A status on every row, from a few states: working, needs you, finished and unseen, idle, failed.
    Needs you sorts first everywhere.
  - Colour with a shape, and an animation for working.
  - A title on every row: the one you gave, or one generated from the first message.
  - A relative time, and the branch or pull request.
  - Search by title, often by message text and branch too.
  - Rename and archive everywhere, pin in most. Delete sits behind archive or a confirmation.
- **Sessions:**
  - Sessions without a project are first-class: Codex, Claude.ai, ChatGPT, Gemini.
- **The view:**
  - A streamed transcript, with tool calls folded into one-line rows and thinking hidden.
  - Stop interrupts and keeps the work done so far.
  - Permission requests and questions appear as cards in the transcript.
  - Messages can be sent while the agent works. Queued ones show apart and can be taken back.
  - The model, the mode, and the context used sit beside Send.
- **Elsewhere:**
  - Notifications when an agent needs you or finishes.
  - Fork or branch a conversation. Side questions that leave the main conversation alone.

## Standards and libraries

### Claude Code's stream-json mode

Claude Code 2.1.296 is installed. Facts marked **tested** come from runs of that binary during this
discovery, through a small driver script.

- **Several turns in one process.** With `--input-format stream-json` and stdin left open, one
  process took two messages a few seconds apart, and the second answer remembered the first
  (**tested**). The docs call this mode "a persistent, interactive session" with "Queued messages:
  send multiple messages that process sequentially, with ability to interrupt"
  ([streaming input](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)).
  - Each turn ends with its own `result` message
    ([cost tracking](https://code.claude.com/docs/en/agent-sdk/cost-tracking)).
  - The process waits, idle, until stdin closes (**tested**).
- **Messages while it works.** A user message carries a `priority`: `next` is read in the same turn
  once running tools finish (a steer), `later` waits for the turn to end (a queue), and `now`
  interrupts ([TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript)). This
  comes from the SDK's types; it was not tested over raw stdin.
- **Interrupting a turn** (**tested**):
  - `{"type":"control_request","request_id":…,"request":{"subtype":"interrupt"}}` on stdin ends the
    turn. The process stays alive and takes the next message.
  - The wire format is not in the public docs.
  - The `result` it produces has no `result` field, an open issue
    ([#94741](https://github.com/anthropics/claude-code/issues/94741)).
  - SIGINT ends the turn the same way, then the process exits. SIGTERM records no result for the
    turn ([headless](https://code.claude.com/docs/en/headless)).
- **Sessions** ([CLI reference](https://code.claude.com/docs/en/cli-reference),
  [sessions](https://code.claude.com/docs/en/sessions)):
  - `--session-id` and `-p --resume <id>` keep the same ID (**tested**). Don't pass both
    ([#24934](https://github.com/anthropics/claude-code/issues/24934)).
  - `--fork-session` copies a session under a new ID (**tested**). Fork is how Claude Code branches
    a conversation.
  - `--plugin-dir` and other launch flags are not restored on resume: pass them again.
  - Two processes resuming one session "interleave into one transcript".
  - Transcripts live in `~/.claude/projects/<project>/<id>.jsonl`, whose format "changes between
    versions", and are deleted silently after `cleanupPeriodDays`, 30 by default
    ([settings](https://code.claude.com/docs/en/settings-reference)).
  - `--name` sets a session's name with `-p` (**tested**). `-p` sessions get no generated title.
- **Prompt cache.** A resumed session "sends the whole conversation again"
  ([prompt caching](https://code.claude.com/docs/en/prompt-caching)). With one process per turn, any
  change to `git status` between turns invalidates the whole prompt cache, since git status is part
  of the system prompt: an open issue
  ([#78720](https://github.com/anthropics/claude-code/issues/78720)). Every Uraeda step commits.
- **Streaming text.** `--include-partial-messages` adds `stream_event` lines whose `text_delta`s
  carry the reply as it is written ([headless](https://code.claude.com/docs/en/headless)).
  - stdout must be read promptly: an open issue reports the last lines lost when the reader stalls
    ([#101641](https://github.com/anthropics/claude-code/issues/101641)).
- **Permissions:**
  - In `auto` mode under `-p`, blocked actions are denied and Claude keeps working
    ([permission modes](https://code.claude.com/docs/en/permission-modes)).
  - **Asking instead of denying** (**tested**): `--permission-prompt-tool stdio`, a value the docs
    do not list, makes the CLI send a `can_use_tool` request on stdout and wait for an allow or deny
    on stdin. "Permission prompts don't time out"
    ([TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript)). Its behaviour
    together with `auto` mode was not checked.
  - **Read-only sessions:**
    - `plan` mode blocks edits (**tested**), but Bash still runs, so a commit is still possible.
    - `--disallowedTools` removes named tools
      ([CLI reference](https://code.claude.com/docs/en/cli-reference)).
- **Commands.** Over stdin, `/model`, `/context`, and `/compact` work and end with their own
  `result` (**tested**).
- **Remote Control.** It is ignored in print mode, an open issue
  ([#99364](https://github.com/anthropics/claude-code/issues/99364)): a Uraeda session cannot also
  show on claude.ai/code.
- **Terms.** They still allow "an end user signing in to the unmodified Claude Code binary with
  their own Claude subscription", and add that "Advertised usage limits for Pro and Max plans assume
  ordinary, individual usage" ([legal](https://code.claude.com/docs/en/legal-and-compliance)). A
  chat typed by its human fits that better than unattended loops.

### Codex

- **`codex exec --json`** emits `thread.started`, `turn.started`, `turn.completed` with usage, and
  `item.started|updated|completed`
  ([non-interactive](https://learn.chatgpt.com/docs/non-interactive-mode)).
  - Item types: `agent_message`, `reasoning`, `command_execution`, `file_change`, `mcp_tool_call`,
    `web_search`, `todo_list`.
  - `codex exec resume <id>` resumes a session.
- **`codex app-server`** speaks JSON-RPC over stdio
  ([app-server](https://learn.chatgpt.com/docs/app-server)). Its model is Thread, Turn, Item:
  - Threads: `thread/start`, `resume`, `fork`, `list`, `read`, `archive`, `name/set`.
  - Turns: `turn/start`, `turn/steer` ("append more user input to the active in-flight turn"),
    `turn/interrupt`.
  - Approval requests come from the server, answered with accept, accept for the session, decline,
    or cancel.
- **Statuses**, from the
  [protocol's source](https://github.com/openai/codex/tree/main/codex-rs/app-server-protocol/src/protocol/v2):
  - Thread: `notLoaded | idle | systemError | active{waitingOnApproval | waitingOnUserInput}`.
  - Turn: `inProgress | completed | interrupted | failed`.

### pi and pi-durable

- **pi** has an RPC mode, `pi --mode rpc`: JSON lines over stdio
  ([RPC](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/rpc.md),
  [commands](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc-commands.md)).
  - Commands: `prompt` with `streamingBehavior: steer | followUp`, `abort`, `fork`,
    `set_session_name`.
  - Events: per message, per tool, and `agent_settled` at the end
    ([events](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/json.md)).
  - pi "does not ask for approval before every tool call".
- **pi-durable is a library, not a command-line tool.**
  - It is `@earendil-works/pi-durable` 1.2.0, "Experimental. The API changes without notice between
    releases" ([package](https://github.com/earendil-works/pi/tree/main/packages/durable)).
  - It runs inside the server's process:
    `root.submit({content, whenBusy: steer | followUp | reject})`, `root.abort()`, `root.fork()`,
    and `watchEvents()` for pi-style events.
  - It stores conversations in SQLite, JSON lines, or memory.
  - Approvals go only through a `beforeTool` hook that can block a call.
  - So an adapter for it has no process, exit code, or signal.

### Agent Client Protocol

- ACP, from Zed, is JSON-RPC between an editor and an agent
  ([overview](https://agentclientprotocol.com/protocol/overview),
  [prompt turn](https://agentclientprotocol.com/protocol/prompt-turn)):
  - Session methods: `session/new {cwd}`, `session/prompt`, `session/cancel`, `session/load`,
    `session/request_permission`.
  - Updates stream as `agent_message_chunk`, `tool_call` and `tool_call_update`, `plan`, and
    `usage_update`.
- Tool calls have a `kind`
  (`read | edit | delete | move | search | execute | think | fetch | other`) and a status
  (`pending | in_progress | completed | failed`)
  ([tool calls](https://agentclientprotocol.com/protocol/tool-calls)).
- A turn ends with `end_turn`, `max_tokens`, `refusal`, or `cancelled`. There is no steer.
  `session/list` is still a proposal ([RFD](https://agentclientprotocol.com/rfds/session-list)).
- **Adapters** ([agents](https://agentclientprotocol.com/get-started/agents)):
  - About 40 agents speak it. Zed, JetBrains, Neovim, and VS Code are clients.
  - Claude's adapter "implements an ACP agent by using the official Claude Agent SDK"
    ([claude-agent-acp](https://github.com/zed-industries/claude-agent-acp)), which the agents
    decision forbids.
  - Codex's adapter bundles its own Codex
    ([codex-acp](https://github.com/agentclientprotocol/codex-acp)).
  - pi's adapter runs `pi --mode rpc` without thinking or MCP
    ([pi-acp](https://github.com/svkozak/pi-acp)).

### OpenCode's session model

- **Server:** OpenCode exposes sessions over HTTP with server-sent events
  ([server](https://opencode.ai/docs/server/)).
  - Child sessions, fork from a message, abort, revert.
  - Permission responses, and a prompt sent without waiting for the answer.
- **States**, from its
  [source](https://github.com/anomalyco/opencode/blob/dev/packages/schema/src/session-status-event.ts):
  - A session is `idle | busy | retry`.
  - A finished turn's outcome is `succeeded | failed | interrupted`.
  - Messages sent while it works are delivered by `steer` or `queue`.

### Common ground between agents

From the sections above:

- **Three levels everywhere:**
  - A session (Claude's session, Codex's thread, pi's session, pi-durable's conversation).
  - A turn: one input until the agent settles.
  - Items: the human's message, streamed text, reasoning, tool calls with a status, plans,
    permission requests, retries and errors, usage.
- **"Turn" means two things:** pi and pi-durable call one model response a turn, and the whole span
  a run.
- **Session status:** idle, running, waiting for approval or input, retrying, error. "Done" is a
  turn's outcome (completed, interrupted, failed), not a session's: sessions resume.
- **Native IDs** differ in shape: a host keeps its own ID, with the agent's kind and its native ID
  beside it.
- **Every agent can:**
  - interrupt a turn;
  - fork, though at a different point each: a turn, an entry, or a message.
- **Titles:** listing agents return one. Claude's `-p` sessions have none.
- **Messages while it works:**
  - Claude: steer and queue through `priority`, from the SDK's types.
  - Codex, pi, pi-durable, OpenCode: steer and queue.
  - ACP: neither.
- **Approvals:**
  - Codex, ACP, and OpenCode ask.
  - Claude asks only through the undocumented `stdio` prompt tool.
  - pi asks never; pi-durable only through its hook.

### Astryx's chat components

- Astryx 0.6.8, the pinned version, ships `ChatComposer`, `ChatComposerInput`, `ChatSendButton`
  (with a stop action), `ChatLayout`, `useChatStreamScroll`, `PowerSearch`, and `StatusDot`, in its
  `src/Chat/` folder (read in the main checkout's `node_modules`).
- `SideNavItem` takes an `icon` and an `endContent`, which can hold a status dot.
- The run log already uses `ChatMessage`, `ChatMessageBubble`, `ChatToolCalls`, and
  `ChatSystemMessage` ([`RunLog.tsx`](/packages/web/src/RunLog.tsx)).
- `ChatToolCalls` keeps each call's open state to itself, an Astryx gap
  ([UI improvements](../done/2026-10-12-ui-improvements.md)).

### Accessible chat

- `role="log"` is "a live region where new information is added in a meaningful order", polite by
  default, and needs a name
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/log_role)).
  W3C's technique [ARIA23](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA23) uses a chat history
  as its example.
- WCAG 2.2's [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  criterion asks that "busy", and its end, reach assistive technology without moving the focus.
- GDS's
  [webchat patterns](https://accessibility.blog.gov.uk/2016/12/09/patterns-for-accessible-webchats/):
  - Real buttons and labels.
  - Avoid "too many notifications".
  - Test several screen readers, since VoiceOver interrupts while NVDA queues.
  - Never rely on sound alone.
- For streamed replies, a third-party test with VoiceOver only
  ([article](https://azukiazusa.dev/en/blog/accessible-streaming-chat-ui)):
  - Keep the streaming text out of live regions.
  - Announce "Generating a response" and "Response complete" from a status region.
  - Keep the focus in the composer.

### Notifications in a browser

- Notifications need HTTPS and a permission asked from a tap. On phones, they must come from a
  service worker ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)).
- On iOS, Web Push works only for a web app added to the Home Screen, from iOS 16.4
  ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).

## The code

### Important reads

- [Constitution](../CONSTITUTION.md):
  - Principle III: "Only temporary chat state and caches MAY live in memory", and every step "MUST
    be completable with a git commit, without a live chat session". Chat stays optional, and its
    history may live outside git.
  - Principle I: a chat must not move the workflow unless the human asks.
- [Agents decision](../decisions/agents.md), the decision this feature changes:
  - Every agent is reached through one adapter that can "start or resume a session in a directory
    with one message".
  - "A run MUST work in the feature's worktree".
  - "A feature MUST have at most one session and at most one run at a time".
  - "Runs MUST carry the step, its reference, and the trigger in their message".
  - Cache rows "MUST be keyed by the repository's main checkout path and the feature's folder".
  - Tools "MUST NOT change the agent's … model, effort, or settings".
  - Its consequences say follow-up messages and interactive approvals "need a channel these rules do
    not give yet", and **Applies to** names "the chat in the web UI".
- [Stack decision](../decisions/stack.md):
  - Agent messages may be drawn with Astryx's `Markdown`.
  - fate was kept for "streamed responses".
  - TypeScript must not compute what the core gives, such as the main checkout's path.
- UI decisions:
  - [Layout](../decisions/ui-layout.md): a detail opens in a pane beside its list on wide screens,
    and as a page on narrow ones; open views live in the URL; mockups show both widths.
  - [Behaviour](../decisions/ui-behaviour.md): a status shows next to its control, and no shortcut
    acts while a text field has the focus.
  - [Components](../decisions/ui-components.md): Astryx and StyleX only.
  - [Checks](../decisions/ui-checks.md): both sizes, axe, and screenshots.
- [Runner record](../done/2026-10-12-claude-code-runner-triggered-manually-https-code.md):
  - [Q5](../done/2026-10-12-claude-code-runner-triggered-manually-https-code.md#q5-what-does-the-ui-show-of-a-run)
    set aside "a full chat" for this feature.
  - The human answered there that "it is normal for the server to have a small local state that is
    not in git" (round 01's answer, in commit `d595b24`).
  - Its follow-ups list Remote Control, interactive approvals, and follow-up messages as waiting for
    a channel.
- [`adapter.ts`](/packages/server/src/runner/adapter.ts):
  - `start({cwd, message, sessionId, resume, pluginDir, allowed})` returns events, `interrupt()`,
    and `terminate()`, with no way to send a second message.
  - `pluginDir` and `allowed`, an `--allowedTools` rule, are Claude's.
- [`claude.ts`](/packages/server/src/runner/claude.ts):
  - The flags:
    `-p --input-format stream-json --output-format stream-json --verbose --permission-mode auto --plugin-dir`,
    then `--resume` or `--session-id`.
  - It writes one message, then closes stdin.
  - No `--include-partial-messages`: text arrives a block at a time.
- [`events.ts`](/packages/server/src/runner/events.ts):
  - Stored events are text, tool, system, and denial. No event holds the human's message.
  - A run is `running | done | failed | stopped`.
- [`message.ts`](/packages/server/src/runner/message.ts):
  - Every run's message says "No chat session is attached: work until the next human gate, and
    commit every step. The commit is the message."
  - `allowRule` builds Claude's rule syntax.
- [`cache.ts`](/packages/server/src/runner/cache.ts):
  - Tables: `sessions` keyed by (repo, folder); `runs` with a required folder and step; `events`.
  - No agent, title, or session state, no listing across a repository, and no search.
  - The one-run claim is atomic, from commit `6f6cebb`, which also kept each server to its own
    repository's runs.
- [`runner.ts`](/packages/server/src/runner/runner.ts):
  - `#start` refuses unless the feature waits on the agent.
  - The directory comes from the core's `workDir`.
  - A watchdog fails a run after 30 minutes of silence, which would end an idle chat.
  - Stop sends SIGINT, then SIGTERM after 10 seconds.
  - "Allow and continue" starts a new workflow run with one rule.
- [`fate/runs.ts`](/packages/server/src/fate/runs.ts):
  - `writable` refuses the human's saves on a feature while it runs.
  - `mainRoot` goes through `nextStep(repo, folder)`, so it needs a feature.
- [`sources.ts`](/packages/server/src/fate/sources.ts): runs are read by ID only, with no list
  source.
- [`live.ts`](/packages/server/src/live.ts): a run and its last log pages are published every 250 ms
  while it runs.
- [`Shell.tsx`](/packages/web/src/Shell.tsx):
  - The sidebar holds Home, Priorities, then features grouped "Waiting on you", "Agents at work"
    (meaning waiting on an agent, not running), and "Done".
  - No status dot, no search, no sessions.
- [`AgentPanel.tsx`](/packages/web/src/AgentPanel.tsx),
  [`RunPage.tsx`](/packages/web/src/RunPage.tsx), and [`RunLog.tsx`](/packages/web/src/RunLog.tsx):
  - The feature page's agent section, and the run view at `/f/<folder>/runs/<id>`: a pane on wide
    screens, a page on the phone.
  - The view follows the end of the log and has no composer.
- [`CommitActions.tsx`](/packages/web/src/CommitActions.tsx): the commit buttons, labelled by their
  callers "Approve and continue", "Start and continue", and so on.
- Composers to reuse:
  - [`Question.tsx`](/packages/web/src/Question.tsx)'s `GrowingTextArea`.
  - [`CommentForm.tsx`](/packages/web/src/CommentForm.tsx), which quotes the selected lines.
- [Binding](/packages/binding/index.d.ts): the core knows nothing of runs or sessions, and gives the
  main checkout's path only through `nextStep` for a feature.
- [Priorities](../PRIORITIES.md):
  - The draft's line read "see actual message that goes with the commit and push".
  - Next: "Ping user when input is needed", the git listener, and a server for several repositories.
  - Later: the Codex and pi-durable runtimes.
  - Its scratchpad asks for repository-relative tool paths, clearer labels on every button that
    starts an agent, and an icon per agent.
- No other branch in flight touches the runner, the server, or the agent views. The flaky tests fix
  and the two remote branches are merged.

### The proposal's path and existing actions

- **Asking about a step without committing:**
  - Today the agent can only be reached through `run.start`. It refuses at a human gate, exactly
    when the human has questions about the questions file or the spec.
  - The message also tells the agent to work until the next gate and commit.
  - A chat needs a message of its own, a composer, and storage for the human's words.
- **The final message before handoff** has two readings, below in
  [the proposal](#the-final-message-before-handoff). The message the server sends is built in
  `runner.ts` and never stored or shown. The agent's last text is in the log, but the run's message
  tells it to say nothing else.
- **Asking about a spec or plan:**
  - The review page's comment form writes review comments to git. It does not ask the agent.
  - A question would reuse its selection and quote, and go to the agent with the file's path and
    lines.
- **A session with no feature:** every key, route, and guard needs a folder: the cache's tables,
  `Runner.start`, `ownRun`, the routes, and `RunPage`. No rule says which directory it runs in.
- **The session list:**
  - The sidebar lists features by what they wait on. The only running signal is Home's "Working"
    badge.
  - There is no list of runs, no title, and no search.
- **A run in progress when a message is sent:** today a second start is refused with "An agent is
  already working on this feature."
- **The human's own saves:** they are refused while the agent works on the feature. A chat turn
  counted as a run would block them too.
- **The agent committing during a chat:** nothing prevents it. `auto` mode allows git, and the skill
  allows an approval given "by the human in chat".
- **Stop:** SIGINT ends the process. With a process kept open, Stop becomes an interrupt that keeps
  the session.
- **A blocked action:** "Allow and continue" restarts a workflow run whose message says to "run it
  again, then continue", which is wrong for a chat.
- **Clearing the cache:** it loses every session's history. The agents decision accepts this, and
  Claude's own transcripts stay, for 30 days.
- **The phone:** the sidebar sits behind Astryx's mobile menu, so the list must be reachable there
  too.

### Likely changes

- [`agents.md`](../decisions/agents.md): the rules on one message, the worktree, one session per
  feature, the message's contents, and the cache's keys, under every option.
- **The runner** ([`runner/`](/packages/server/src/runner/)):
  - `adapter.ts`: an agent kind, capabilities, and skill loading and permission grants moved behind
    the adapter. With A of [driving Claude Code](#driving-claude-code-across-turns): open, send,
    interrupt, and close.
  - `claude.ts`: partial messages; with that same A, stdin kept open and interrupts on it.
  - `events.ts`: the human's message as an event, session statuses, a chat trigger.
  - `message.ts`: a chat message, and repository-relative tool paths.
  - `cache.ts`, a third migration: sessions by their own ID, with an optional folder, agent, title,
    status, and last seen; runs and turns by session; a list and a search scoped to the repository.
  - `runner.ts`: sends, guards by session, a start with no feature, the watchdog for idle sessions.
  - `fake.ts`, and the validation script.
- **The server's data** ([`fate/`](/packages/server/src/fate/),
  [`live.ts`](/packages/server/src/live.ts)): session views, a list source with a search, start,
  send, and stop, and session updates.
- **The core and binding** ([`api.rs`](/crates/core/src/api.rs),
  [binding](/packages/binding/index.d.ts)): the main checkout's path without a feature.
- **The web UI** ([`src/`](/packages/web/src/)):
  - A session view with a composer, replacing or extending `RunPage.tsx` and `RunLog.tsx`.
  - Session routes.
  - The sidebar in `Shell.tsx`, with statuses and search.
  - `AgentPanel.tsx`, and "Ask about this" on the review and file pages.
  - With A of [the message before handoff](#the-message-before-handoff): `CommitActions.tsx` and its
    callers.

## The proposal

### The final message before handoff

The proposal says "see the final message before handoff"; the priority line it came from said "see
actual message that goes with the commit and push". Both read as the message Uraeda sends to the
agent when a commit button hands the feature over, which today nobody sees. A third reading is the
agent's closing words when it hands the feature back, which the run's message suppresses.

### One session per feature

Searchable sessions in the plural, and chats about a feature, meet the agents decision's "at most
one session and at most one run at a time" per feature. If chats about a feature are turns of the
feature's session, the rule holds, and only sessions without a feature are new. If they are separate
sessions, the rule changes.

### Asking without committing

"Without committing" can mean two things. Either the chat must not commit, which needs read-only
permissions, or it must not be a workflow step, which needs a different message. Claude Code's
`plan` mode still runs Bash, so it does not prevent a commit on its own.

### A session without a feature

No rule says where it runs. The agents decision says "A run MUST work in the feature's worktree",
and the git decision keeps tools from switching the checkout the server runs from.

### Generic for Codex and pi-durable

pi-durable is a library inside the server, not a command-line tool. The adapter cannot assume a
process, and the agents decision's "installed command-line tool" wording does not cover it. Its
agents differ in whether they steer, queue, ask approvals, and stream.

### A status like herdr's

herdr's states need an "unseen" notion that Uraeda does not track. The workflow adds its own "needs
you": a feature whose step waits on the human, even when no agent asks anything.

## Approaches

Criteria come from:

- **The proposal:** chats like Claude Code's command line, generic concepts.
- **The constitution:** humans in control, chat optional, explicit and simple code.
- **The agents decision:** the installed binary, no SDK, the user's settings.
- **The UI decisions.**

### Sessions and features

How chats about a feature relate to the session the workflow's runs use. See
[Claude Code](#claude-code), [Codex](#codex), and
[one session per feature](#one-session-per-feature).

| Option                                          | Context the agent has          | Workflow session's context | Agents decision                | Effort                             |
| ----------------------------------------------- | ------------------------------ | -------------------------- | ------------------------------ | ---------------------------------- |
| A. One conversation per feature: runs and chats | Everything, as in the terminal | Grows with every chat      | Holds: one session per feature | Medium: runs become turns          |
| B. Side chats forked from the workflow session  | Everything, at the fork        | Untouched                  | Changes: several sessions      | Larger: forks, two writers, a list |
| C. Fresh sessions, reading files                | None until it reads            | Untouched                  | Changes: several sessions      | Medium                             |

### What a chat turn may do

What the agent may change during a chat. See
[Claude Code's stream-json mode](#claude-codes-stream-json-mode) and
[asking without committing](#asking-without-committing).

| Option                           | Ask without moving the workflow      | Fix things when asked | Sessions without a feature | Effort                                  |
| -------------------------------- | ------------------------------------ | --------------------- | -------------------------- | --------------------------------------- |
| A. Like a run, told it is a chat | By the message: acts only when asked | Yes                   | A full coding agent        | Small: a chat message                   |
| B. Read-only                     | Guaranteed                           | No                    | Questions only             | Small: flags and denied git commands    |
| C. A switch: Ask or Act          | Guaranteed in Ask                    | In Act                | Both                       | Medium: restart or an undocumented call |

### The message before handoff

What "see the final message before handoff" shows. See
[the proposal](#the-final-message-before-handoff).

| Option                                               | Covers                        | Effort                                           |
| ---------------------------------------------------- | ----------------------------- | ------------------------------------------------ |
| A. Preview the message sent, with a note of your own | Both wordings of the proposal | Medium: a preview call, the commit buttons       |
| B. Show the message in the session, once sent        | Seeing it, not before         | Small                                            |
| C. The agent's closing message, shown on the feature | The third reading             | Small: the run's message and the skill's wording |

### The session list

Where sessions appear in the sidebar. See [herdr](#herdr) and
[what they have in common](#what-they-have-in-common).

| Option                                              | Rows per feature | Needs you first               | Fits the sidebar today |
| --------------------------------------------------- | ---------------- | ----------------------------- | ---------------------- |
| A. Features with their status, plus a Chats section | One              | Within each group             | Yes: one section added |
| B. A Sessions section above the features            | Two              | Across everything, like herdr | Longer                 |
| C. A switch between Features and Sessions           | One per view     | In the Sessions view          | A second mode to learn |

### Sessions without a feature

Which directory a session without a feature works in. See
[a session without a feature](#a-session-without-a-feature).

| Option                       | Like `claude` in the repository | Risk to the running server     | Setup             | Drafts and priorities           |
| ---------------------------- | ------------------------------- | ------------------------------ | ----------------- | ------------------------------- |
| A. The main checkout         | Yes                             | A branch switch or broken file | None              | On the default branch, as today |
| B. A new worktree and branch | No                              | None                           | `vp install` each | On a branch to merge            |
| C. Chosen per session        | Either                          | Depends                        | Depends           | Depends                         |

### Driving Claude Code across turns

How the server keeps a conversation going with Claude Code. See
[Claude Code's stream-json mode](#claude-codes-stream-json-mode) and
[common ground](#common-ground-between-agents).

| Option                                      | Messages while it works     | Stop keeps the process | Prompt cache between turns    | Documented           | Other agents' shape         |
| ------------------------------------------- | --------------------------- | ---------------------- | ----------------------------- | -------------------- | --------------------------- |
| A. One process per open session, stdin open | Steer or queue (`priority`) | Yes, by interrupt      | Kept                          | The interrupt is not | Same: Codex, pi, pi-durable |
| B. One process per message, resumed         | Queued by Uraeda only       | No                     | Lost on every commit (#78720) | Yes                  | Different                   |

### Messages sent while the agent works

Only with A of [driving Claude Code](#driving-claude-code-across-turns). See
[Claude Code](#claude-code) and [Codex](#codex).

| Option                                | Like                               | Taken back                   | Effort                  |
| ------------------------------------- | ---------------------------------- | ---------------------------- | ----------------------- |
| A. Steer: read at the next tool's end | Claude Code's Enter, pi, Conductor | Until the agent reads it     | Small                   |
| B. Queue: sent when the turn ends     | Zed, Codex's Tab                   | Edited or removed until sent | Medium: a visible queue |
| C. Both, with two buttons             | Codex, Cursor                      | Both                         | Medium                  |

### Other agents

How far the generic design goes now. See [common ground](#common-ground-between-agents),
[pi and pi-durable](#pi-and-pi-durable), and [ACP](#agent-client-protocol).

| Option                                      | Proves the abstraction   | Agents decision | Effort now |
| ------------------------------------------- | ------------------------ | --------------- | ---------- |
| A. Generic model and interface, Claude only | With a fake second agent | Holds           | Small      |
| B. A, plus a Codex adapter                  | With a real one          | Holds           | Large      |
| C. ACP between the server and every agent   | Through ACP's adapters   | Breaks: the SDK | Large      |

### Blocked actions in a chat

What happens when `auto` mode blocks an action during a chat. See
[Claude Code's stream-json mode](#claude-codes-stream-json-mode).

| Option                                        | Turn waits for you | Documented              | Agents decision          |
| --------------------------------------------- | ------------------ | ----------------------- | ------------------------ |
| A. Denied, then "Allow and retry" in the chat | No                 | Yes                     | Holds: one rule, one run |
| B. Asked in the chat: Allow once or Deny      | Yes, forever       | No: `stdio` prompt tool | Changes                  |

### Scope

What else ships with the chat. See [what they have in common](#what-they-have-in-common).

| Option                                      | Effort | Notes                                                         |
| ------------------------------------------- | ------ | ------------------------------------------------------------- |
| A. The chat, the list, and "Ask about this" | Base   | Notifications, models, forks, and diffs left for later        |
| B. A, plus browser notifications            | Medium | iPhone: only from a Home Screen app, through a service worker |
| C. A, plus a model and effort picker        | Small  | Changes the agents decision's settings rule                   |

### Needs no choice

- **Statuses:**
  - herdr's states fit the proposal's reference: working, needs you, unseen, idle, failed or
    stopped.
  - "Needs you" also covers a feature waiting on the human.
  - The seen state can live in the cache, shared by the phone and the desktop, since one person uses
    both.
- **Titles:** Claude's `-p` sessions get none, and generating one costs a model call. The feature's
  name, or the first message's first line, with rename, is what the products without a model fall
  back to.
- **Search:** the history is small, so a query over titles and message text in the cache, scoped to
  the repository, is enough.
- **History:** Claude deletes transcripts after 30 days, and their format is internal. Uraeda keeps
  its own log, as the runs do today.
- **Archive and rename:** every product has them, at no design cost.
- **Pin:** it adds little with a list grouped by feature.
- **Streamed text:** `--include-partial-messages` with the existing 250 ms publishing.
- **Accessibility:**
  - The transcript is a named log with the streaming text kept quiet.
  - A status region says when a reply starts and ends.
  - The focus stays in the composer.
- **Stop:** it ends the turn, never the session.
- **Peek and side questions:** the sidebar's status and the session view cover the first. With A of
  [sessions and features](#sessions-and-features), a side question is a message in the same
  conversation.

## Not checked

- Claude Code:
  - `priority` and `cancel_queued` over raw stdin, rather than through the SDK's types.
  - The wire subtypes for changing the model or the permission mode, and for context usage.
  - The `stdio` prompt tool together with `auto` mode.
  - `AskUserQuestion` over stdin.
  - Tool calls across turns in one process.
  - Processes left idle for more than an hour.
  - Whether `--exclude-dynamic-system-prompt-sections` avoids issue #78720.
- Codex: the `agentMessage` item's fields, and the sessions folder from an official source (only
  third-party pages give `~/.codex/sessions/`).
- pi: the coding agent's "durable mode", which third-party pages mention but whose source folder
  does not exist.
- ACP: the state of its v2 and fork proposals, and whether Claude's adapter can list or fork.
- OpenCode: its documented message and event types. Only its current source was read, which differs
  from its older SDK's types.
- AG-UI.
- ChatGPT's help centre, which refused every request: its archive, search, and branching come from
  search snippets.
- The claude.ai/code sidebar's status icons, Sculptor's documentation, OpenCode's desktop app, and
  Cursor's agents sidebar: none is documented.
- Guidance on chat interfaces from Adrian Roselli or Deque: none found.
