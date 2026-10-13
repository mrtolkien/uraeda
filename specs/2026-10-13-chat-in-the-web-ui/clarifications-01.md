---
status: awaiting-human
---

# Clarifications, round 01: Chat in the web UI

> [!IMPORTANT]
>
> 10 questions on the chat, the session list, and how agents are driven, about 40 minutes.
>
> - Two choices outlast this feature, because Codex, pi-durable, the git listener, and the
>   notifications will build on them. One is how the server keeps a conversation going with an
>   agent. The other is how far the generic agent model goes now.
> - Your answers amend the [agents decision](../decisions/agents.md) in up to five rules: one
>   message per run, one session per feature, runs in the feature's worktree, the message's
>   contents, and the cache's keys. The spec will propose the changes for your approval.
> - Three questions work together: how chats about a feature relate to its workflow session, what a
>   chat turn may change, and where a session with no feature works.
> - One gap in the proposal: "the final message before handoff" has two readings.
> - 12 points are settled without you, at the end, including the statuses, borrowed from herdr.

## Context

The [proposal](proposal.md) asks for back-and-forth chats with the agent, in a session view inspired
by coding agents and chatbots:

- ask about a step without committing;
- see the final message before handoff;
- ask about a spec or plan;
- start a session with no feature.

Sessions should be searchable in the sidebar, with a status like [herdr](https://herdr.dev/)'s.
Concepts should be generic, so Codex and pi-durable can join later.

Today the server runs Claude Code once per workflow step: one process, one message, then it exits
([`claude.ts`](/packages/server/src/runner/claude.ts)). It refuses to run when the feature waits on
you ([`runner.ts`](/packages/server/src/runner/runner.ts)), and keeps one session per feature in a
local SQLite cache. The feature page shows the latest run, and a run view shows its log, with no
composer ([`RunPage.tsx`](/packages/web/src/RunPage.tsx)). The message sent to the agent is never
shown. The sidebar lists features by what they wait on, with no status or search
([`Shell.tsx`](/packages/web/src/Shell.tsx)).

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: How do chats about a feature relate to the session its workflow runs use?

Today each feature has one Claude Code session, resumed at every run. In the terminal you would chat
in that same session between steps. Claude Code's `/btw` and Codex's `/side` instead ask side
questions in a copy that leaves the main conversation alone. More in
[discovery](discovery-01.md#sessions-and-features).

Why it matters: it decides what the agent knows when you ask, whether the agents decision's "one
session per feature" holds, and whether chats can run beside a workflow run. What a chat may change
is Q2.

- **A (recommended). Each feature has one conversation: the workflow's runs and your messages follow
  each other in the same session, and you can write to it between steps or during a run. Sessions
  without a feature are separate conversations.**
  - [pro] the agent that wrote the questions or the spec answers about them, with everything it
    read, as in the terminal.
  - [pro] the agents decision's "one session per feature" holds.
  - [con] long chats fill the workflow session's context, so it compacts sooner.
  - Why recommended: it is the back-and-forth you use in the terminal today, with the fewest new
    concepts.
- **B. Each chat about a feature is a new session, forked from the feature's workflow session when
  it starts, like `/side`: it knows everything the workflow knew, and the workflow never sees the
  chat.**
  - [pro] the workflow session stays focused, and several chats can run in parallel.
  - [con] what you settle in a chat reaches the next run only through git.
  - [con] a chat and a run can edit the same worktree at the same time.
  - [con] the agents decision changes to several sessions per feature.
- **C. Each chat is a fresh session, with no context: the agent reads the files it needs.**
  - [pro] simple, and independent of the workflow session.
  - [con] every question starts by re-reading the feature, and the agent cannot say why it chose
    what it wrote.

**Answer:**

## Q2: What may the agent change during a chat?

Claude Code's `plan` mode blocks edits but still runs shell commands, so it can still commit. A
read-only chat needs edits removed and git commands denied. Today every run is told to work until
the next human gate and commit each step. More in
[discovery](discovery-01.md#what-a-chat-turn-may-do).

Why it matters: it decides whether "ask without committing" is a promise the tool keeps, or one the
agent keeps, and whether a session without a feature is a full coding agent.

- **A (recommended). The agent may do what a run may do, in `auto` mode. A chat's message tells it a
  human is chatting: it answers, and changes files, commits, or moves the workflow only when you ask
  it to.**
  - [pro] you can say "fix that typo and commit" in the same breath as a question, as in the
    terminal.
  - [pro] sessions without a feature are a normal coding agent.
  - [con] nothing but the message keeps the agent from committing during a question.
  - Why recommended: it matches the terminal use the proposal names. The skill already commits
    approvals given in chat only when the human asks.
- **B. Chats are read-only: the agent can read and search, but edits are removed and git commits and
  pushes are denied.**
  - [pro] asking can never move the workflow.
  - [con] you cannot ask it to fix anything, and a session without a feature can only answer
    questions.
- **C. A switch in the composer chooses Ask (read-only, as in B) or Act (as in A), per message, with
  Ask by default.**
  - [pro] both, and a clear promise when asking.
  - [con] one more control on every message. Switching restarts the agent's process, or uses an
    undocumented call.

**Answer:**

## Q3: What is "the final message before handoff"?

The proposal says "see the final message before handoff"; the priority line it came from said "see
actual message that goes with the commit and push". Today "Approve and continue" and the other
commit buttons commit, then send the agent a message built on the server that you never see. The
agent's last words are in the run's log, but that message tells it to "say nothing else". More in
[discovery](discovery-01.md#the-message-before-handoff).

Why it matters: it decides what changes on the commit buttons, and whether runs end with a summary
for you.

C can come on top of A or B.

- **A (recommended). Show the message that goes to the agent before you send it: the commit buttons
  show it, with a field to add a note of your own, and every message sent appears in the session as
  your turn.**
  - [pro] covers both wordings: you see what goes with the commit before handing over, and can steer
    it.
  - [con] the commit buttons grow a preview and a field.
  - Why recommended: A, with C on top. A is what both wordings describe. C costs little once runs
    happen in a conversation you read.
- **B. Show the message in the session once it is sent, with no preview and no note.**
  - [pro] the smallest change.
  - [con] you see it only after the agent has it.
- **C. Runs end with a closing message from the agent: what it did and what waits for you, shown on
  the feature page and as the session's last message.**
  - [pro] the feature page says at once what happened.
  - [con] the skill's "the commit is the message: say nothing else" changes for runs started from
    the UI.

**Answer:**

## Q4: Where do sessions appear in the sidebar?

The sidebar lists features in three groups: waiting on you, agents at work, done. herdr shows a
workspace's state rolled up from its agents, and also offers a list of agents sorted by state: needs
you, then finished and unseen, then working, then idle. With A in Q1, a feature has one session, so
its row can carry the session's status. More in [discovery](discovery-01.md#the-session-list).

Why it matters: the sidebar is where you see what needs you, on the desktop and behind the menu on
the phone.

- **A (recommended). Keep the features in the sidebar, each with its status dot, and add a Chats
  section for sessions without a feature. A search field above both filters them by title and
  message text.**
  - [pro] one row per feature, as herdr rolls agents up into their workspace.
  - [pro] a small change to the sidebar you know.
  - [con] "needs you" sorts first only within each group.
  - Why recommended: no feature appears twice, and the groups already put what waits on you first.
- **B. Add a Sessions section above the features, listing every session, the feature ones under
  their feature's name, sorted with what needs you first, like herdr's agent list.**
  - [pro] one list, sorted by urgency across everything.
  - [con] each feature appears twice in the sidebar.
- **C. A switch at the top of the sidebar between Features, as today, and Sessions, the list of B.**
  - [pro] each view stays short.
  - [con] a second mode to learn, and the status of the other view is hidden.

**Answer:**

## Q5: Where does a session without a feature work?

Running `claude` in the repository works in your checkout, on its branch. The UI's server runs from
a checkout too, often the main one, and the git decision keeps tools from switching its branch. A
worktree per session would isolate the work, but each needs `vp install` before code runs. Drafts
and priorities live on the default branch. More in
[discovery](discovery-01.md#sessions-without-a-feature).

Why it matters: a coding agent in the main checkout can edit, commit, or switch the branch under the
running server.

- **A (recommended). In the main checkout, on its current branch, like `claude` started there. The
  chat's message tells the agent never to switch the branch.**
  - [pro] it behaves like the coding agent you know, and its drafts and priorities land on the
    default branch, where they belong.
  - [con] an agent that ignores the message, or breaks a file, affects the running server and your
    checkout.
  - Why recommended: it is "a normal coding agent", as the proposal asks, with nothing to set up.
- **B. In a new worktree, on a new branch `chat/YYYY-MM-DD-<slug>`, under `.worktrees/`.**
  - [pro] the checkout and the server are never touched.
  - [con] each session needs its setup, its work is on a branch to merge, and the worktrees pile up
    until cleaned.
- **C. You choose for each session: the main checkout or a new worktree.**
  - [pro] both.
  - [con] one more choice every time you start a chat.

**Answer:**

## Q6: How does the server keep a conversation going with Claude Code?

Today each run is one process with one message. Claude Code also takes several messages in one
process when its input stays open, as tested on the installed 2.1.296: it answers each in turn, and
an interrupt ends a turn without ending the process. The interrupt's format is not in the public
docs. With one process per message, the conversation is resumed each time. Its prompt cache is then
lost whenever `git status` changes, after every commit, an open issue. Codex, pi, and pi-durable all
keep a conversation open. More in [discovery](discovery-01.md#driving-claude-code-across-turns).

Why it matters: this is the adapter every later agent implements, and it changes the agents
decision's "with one message". It decides whether messages can reach a working agent, and whether
Stop keeps the session alive.

- **A (recommended). One Claude Code process per open session: messages go in as you send them, Stop
  interrupts the turn, and the process closes after 15 minutes idle, to be resumed with the next
  message.**
  - [pro] messages can reach the agent while it works, and Stop keeps the session.
  - [pro] the prompt cache is kept between turns.
  - [pro] it has the same shape as Codex, pi, and pi-durable.
  - [con] the interrupt relies on an undocumented message, which Claude Code could change; the
    runner's validation script will check it.
  - Why recommended: it is the only way to send a message while the agent works, and the shape the
    next agents need.
- **B. One process per message, as today: each message resumes the session, and messages sent while
  it works wait in Uraeda until the turn ends.**
  - [pro] the documented path, with the adapter almost unchanged.
  - [con] the agent never reads a message until it finishes, and Stop ends the process.
  - [con] the prompt cache is lost after every commit, which costs more of your plan's usage.

**Answer:**

### Q6.A: What happens to a message you send while the agent works?

Only if you picked A in Q6. In Claude Code's terminal, Enter sends a correction that the agent reads
as soon as its current tool finishes, within the same turn: a steer. Zed and Codex's Tab queue the
message until the turn ends, editable until then. Claude Code supports both through a field of the
message, which the SDK documents and the discovery did not test without it. More in
[discovery](discovery-01.md#messages-sent-while-the-agent-works).

- **A (recommended). The agent reads it as soon as its current tool finishes, as with Enter in
  Claude Code. It shows greyed until read, with a ✕ to take it back until then.**
  - [pro] the behaviour you already use, and corrections land before the agent goes further.
  - [con] a message meant for after the turn can surprise the agent mid-task.
  - Why recommended: it matches Claude Code, the agent you drive today.
- **B. It waits until the turn ends, shown above the composer, where you can edit or remove it.**
  - [pro] never disturbs a turn.
  - [con] a correction arrives only after the agent has finished the wrong thing.
- **C. Both: Send steers, and a second button queues until the turn ends.**
  - [pro] the right one for each message.
  - [con] two send buttons, on a phone too.

**Answer:**

## Q7: How far does the generic agent design go now?

Codex speaks JSON-RPC with threads, turns, and items. pi has an RPC mode. pi-durable is a library
running inside the server, not a command-line tool. The Agent Client Protocol (ACP) connects about
40 agents to editors. Its Claude adapter, though, is built on the Agent SDK, which the agents
decision forbids, and it has no steer. More in [discovery](discovery-01.md#other-agents).

Why it matters: the data model and the adapter interface chosen now are what Codex and pi-durable
will fit into.

- **A (recommended). A generic model now: sessions, turns, and items with ACP's vocabulary for tool
  kinds and statuses, an agent kind on every session, and capabilities per agent (steer, approvals).
  Claude is the only adapter. The tests' fake agent declares other capabilities to prove the design,
  and an agent picker and icons appear with the second agent.**
  - [pro] the design is ready for the next agents, at a small cost now.
  - [con] the generic parts are proven only against a fake until a second agent joins.
  - Why recommended: it gives the abstraction the proposal asks for without building an agent nobody
    asked for yet.
- **B. A, plus a Codex adapter through `codex app-server`.**
  - [pro] the abstraction is proven on a real second agent.
  - [con] a large addition to this feature, and the "Codex runtime" entry of your priorities, which
    is under Later.
- **C. Speak ACP between the server and every agent, through ACP's adapters.**
  - [pro] one protocol for about 40 agents.
  - [con] Claude's adapter needs the Agent SDK, against the agents decision.
  - [con] Codex's adapter bundles its own Codex.
  - [con] pi-durable has no adapter, and ACP has no steer.

**Answer:**

## Q8: What happens when `auto` mode blocks an action during a chat?

Today a blocked action is skipped and listed after the run, with "Allow and continue" starting a new
run with that one rule. Claude Code can instead ask before the action and wait for an answer,
through a prompt tool its docs do not list, as tested. A question never times out. More in
[discovery](discovery-01.md#blocked-actions-in-a-chat).

Why it matters: asking makes the agent wait for you, which is what "needs you" means in the sidebar,
but it relies on an undocumented option and changes the agents decision.

- **A (recommended). As today: the action is skipped, it shows in the chat as blocked, and "Allow
  and retry" restarts the session's process with that one rule and asks the agent to try again.**
  - [pro] documented, and the agents decision's narrow allow rule holds.
  - [con] the agent carries on without the action until you allow it.
  - Why recommended: it keeps the documented path while the prompt tool is undocumented.
- **B. The agent asks in the chat before a blocked action, with Allow once and Deny, and waits for
  your answer.**
  - [pro] like the desktop app, and the turn goes on with your answer.
  - [con] relies on an undocumented option, and a question left unanswered holds the session
    forever.

**Answer:**

## Q9: What else ships with the chat?

Coding-agent products share more than a chat. Notifications when an agent needs you or finishes, a
model picker, forking a conversation, and a diff view are common. Your priorities list "Ping user
when input is needed" as its own entry. The agents decision keeps your Claude Code settings for the
model and effort. More in [discovery](discovery-01.md#scope).

Why it matters: it sets the size of this feature.

B and C can both come on top of A.

- **A (recommended). The session view, its composer with Stop, streamed replies, sessions with and
  without a feature, the sidebar's statuses and search, rename and archive, and "Ask about this" on
  a selected block of a spec, plan, or questions file, which quotes it in the composer. Left for
  later: notifications, model and effort pickers, forking, editing past messages, a diff view, a
  context gauge, and the clearer labels on the buttons that start the agent.**
  - [pro] the whole proposal, and nothing outside it.
  - [con] you learn that a session needs you only by looking at the sidebar.
  - Why recommended: notifications have their own priority, and the pickers would change a decision.
- **B. Also browser notifications when a session needs you or finishes.**
  - [pro] the sidebar's status reaches you away from the page.
  - [con] on an iPhone, they work only once the UI is added to the Home Screen, through a service
    worker.
- **C. Also a model and effort picker in the composer.**
  - [pro] like the desktop app.
  - [con] changes the agents decision's rule that your Claude Code settings apply.

**Answer:**

## Settled without the human

- **The statuses** are herdr's, with colour and shape:
  - Working, animated.
  - Needs you: the agent asks, an action was blocked, or the feature's step waits on you.
  - Unread: finished, and not seen since.
  - Idle.
  - Failed or stopped.

  Needs you sorts first. Being seen is recorded on the server, so seeing a session on the phone
  clears it on the desktop too, since one person uses both. See [discovery](discovery-01.md#herdr).

- **Titles** are the feature's name, or for a session without a feature the first line of its first
  message, and can be renamed. No generated titles: Claude Code makes none for these sessions, and
  each would cost a model call. See [discovery](discovery-01.md#claude-code).
- **Search** looks at titles and message text in the cache, only for this repository. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The history** is Uraeda's own log in the cache, as for runs today, since Claude Code deletes its
  transcripts after 30 days. Losing the cache loses the history, which the agents decision accepts.
  When a session's transcript is gone, the next message starts a new session and says so. See
  [discovery](discovery-01.md#claude-codes-stream-json-mode).
- **Existing runs** become turns of their feature's session, so nothing is lost. With A in Q1, the
  run view becomes the feature's session view.
- **Every message sent to the agent** is stored and shown as your turn, the workflow's included.
- **Replies stream** as they are written, published every 250 ms as runs are today.
- **The session view** opens beside the feature page on wide screens, and as its own page on the
  phone, with its address in the URL, as the layout decision asks. A session without a feature has
  its own address. See [discovery](discovery-01.md#important-reads).
- **Your saves on a feature** wait while the agent works on it, during a chat turn as during a run,
  since the agent may edit the same files. Drafts and priorities stay writable.
- **A commit button pressed while a chat turn runs** commits, and its message waits for the turn to
  end.
- **Sessions without a feature** load the Uraeda skill too, so they can draft proposals or set the
  project up. See [discovery](discovery-01.md#important-reads).
- **The composer:**
  - It follows the accessibility research: the transcript is a named log whose streaming text stays
    quiet, a status says when a reply starts and ends, and the focus stays in the composer.
  - Enter sends on wide screens, and Return adds a line on the phone, where the button sends.

  See [discovery](discovery-01.md#accessible-chat).

**Notes:**
