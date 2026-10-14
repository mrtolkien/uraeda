# Discovery, round 01: Dedicated session view

## Summary

Products that run coding agents show a running session in one of two places. Either it is a full
page with work panes beside the transcript (Claude Code's desktop app, Devin, VS Code's Agents
window, Codex), or it is a side panel that can be maximized, moved into an editor tab, or popped out
into its own window (VS Code's Chat view, Claude Code's VS Code extension). Most of them pin
progress somewhere outside the transcript: a todo list with N/M, the current step, the elapsed time,
a diff count. Every one of them lists sessions with a short set of states (working, needs you,
done). The pinned todo list and an auto-scroll that stops when the reader scrolls up are the two
things users ask for most.

The proposal asks for two things:

- a session view of its own on desktop, in place of today's pane beside the feature page;
- the plan's current task, "Task 7/11", in the sidebar, taken from the plan's checkboxes, so it
  works when the agent was started outside the web UI too.

What exists today:

- **The session view.** On wide screens, a feature's session opens at `/f/<folder>/session` in a
  pane 40% wide beside the feature page. That is about 480 px of a 1440 px window. On the phone it
  is a page of its own, and chats are full pages at both widths. The pane came from the old run view
  and was never questioned when sessions replaced runs.
- **The current task.** The core already computes it: the first task with an unchecked step, as
  `step.task`, "Task 3: The repeat menu". The sidebar receives it but does not show it, Home shows
  it, and no total is exposed.
- **External agents.** The server already sees plan changes made by an agent it did not start,
  through the core's file watcher, uncommitted edits included. Such an agent has no session, so the
  sidebar shows it as idle.

## How other products do it

### Claude Code

- **Web (claude.ai/code).** A session is a full page, and sessions are listed in a sidebar where
  they can be archived. Each session shows a diff count, `+42 -18`, which opens a diff view with
  inline comments. A message sent while Claude works is queued and can be taken back with ✕
  ([Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)).
- **Desktop app.** A sidebar lists sessions and filters them by status, project, or environment. A
  session is built around panes "you can arrange in any layout: chat, diff, browser, terminal, file,
  plan, tasks, and subagent". Panes can be resized, moved, or popped out into their own window, and
  two sessions can show side by side. An OS notification fires when a session finishes and is not
  being viewed ([desktop](https://code.claude.com/docs/en/desktop)).
- **Projects.** An Overview pane beside the conversation groups threads by state: Ready for review,
  Waiting on you, Working, Landing, Idle, Resolved
  ([projects](https://code.claude.com/docs/en/claude-projects)).
- **Agent view (`claude agents`).** Rows are grouped Needs input, Working, and Completed. Each row
  shows "the session's name, current activity, and its age". The activity line is model-written and
  refreshed at most every 15 seconds while the session works. A peek panel shows the latest status
  or question, and the docs note "Most of the time the peek panel is enough"
  ([agent view](https://code.claude.com/docs/en/agent-view)).
- **The task list.** In the terminal, Claude's to-do checklist shows pending, in progress, or
  complete, up to five tasks at a time, toggled with `Ctrl+T`
  ([interactive mode](https://code.claude.com/docs/en/interactive-mode)).
- **VS Code extension.** The panel can sit in either sidebar or open "as a tab alongside your
  files", or in a new window. Its Focus view hides tool calls and thinking behind expandable rows. A
  tab's dot turns blue for a pending permission and orange when Claude finished while the tab was
  hidden ([VS Code](https://code.claude.com/docs/en/vs-code)).
- **Complaints.**
  - The task list is a message in the transcript, so "the original plan [scrolls] up and out of
    view". Users asked twice for a sticky panel with the active task highlighted, and both requests
    were closed by a bot ([#8723](https://github.com/anthropics/claude-code/issues/8723),
    [#76537](https://github.com/anthropics/claude-code/issues/76537)).
  - Auto-scroll "should pause autoscroll when I scroll up", reported again after a fix
    ([#11092](https://github.com/anthropics/claude-code/issues/11092)).
  - Seen only in search results: complaints about text "stuck in narrow column" and requests to cap
    the panel's width for reading on wide displays (claudeissues.com 64511, 63813).

### OpenAI Codex

- The Codex app has a sidebar, a bottom panel, a terminal, a file tree, and a review tab, and
  switches "between chat and tabs" in full view or split view
  ([commands](https://learn.chatgpt.com/docs/reference/commands)).
- An Activity view in the sidebar lists "chats that are unread, running, or waiting for your
  response". A chat is Running, Needs input, Ready, or Blocked
  ([notifications](https://learn.chatgpt.com/docs/notifications)).
- The IDE extension is a sidebar, and its transcript ends with "Worked for 6m 53s"
  ([IDE](https://learn.chatgpt.com/docs/ide)).
- On mobile you "open a task, follow its progress, and send new instructions"
  ([mobile](https://learn.chatgpt.com/docs/mobile)).
- Seen only in a third-party post: goal progress shows above the composer, and a task sidebar shows
  the plan as it runs.

### Cursor

- The Agents Window is "Cursor's agent-first interface", alongside the editor or instead of it
  ([agents window](https://cursor.com/docs/agent/agents-window)). Cursor 2.0 added "a sidebar for
  your agents and plans" ([2.0](https://cursor.com/changelog/2-0)).
- Agents "plan ahead with structured to-do lists, making long-horizon tasks easier to understand and
  track", updated as work progresses ([1.2](https://cursor.com/changelog/1-2)).
- A user wrote that with thoughts collapsed "it feels like I am giving it a blind task". Staff
  pointed to a Tool Call Density setting with a Detailed level
  ([forum](https://forum.cursor.com/t/not-being-able-to-see-what-the-agent-is-doing-is-making-me-nervous/167226)).

### GitHub Copilot coding agent

- An agents panel is available from any page, and a session opens "the session log and overview,
  where you can monitor the agent's progress, token usage, and session length"
  ([tracking sessions](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/track-copilot-sessions)).
- A prompt box below the log steers the agent "after it finishes its current tool call", and Stop
  session is in the log viewer
  ([managing agents](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/manage-agents)).
- The pull request's body gets regular status messages, and its timeline links to the live session
  log
  ([training module](https://learn.microsoft.com/en-us/training/modules/github-copilot-code-agent/3-assign-track-troubleshoot-copilot-code-agent-tasks)).

### Devin

- A full page with tabs. The Progress tab shows "All shell commands, code edits, and browser
  activity... in one unified view", beside Shell, IDE, and Browser tabs. Clicking a command jumps to
  that point in time ([session tools](https://docs.devin.ai/work-with-devin/devin-session-tools)).

### Google Jules

- A plan of expandable steps, then "An activity feed as each step completes", with a diff preview
  per file and a Pause button ([running tasks](https://jules.google/docs/running-tasks/)).
- In the docs' own words: "You will have to navigate to the task to check for updates"
  ([tasks](https://jules.google/docs/tasks-repos/)).

### VS Code

- The Chat view sits in the Secondary Side Bar. It can also open as an editor tab, "giving chat more
  space", or in its own window
  ([chat view](https://code.visualstudio.com/docs/agents/run/chat-view)).
- The Agents window lists sessions on the left and the chat in the middle, with Changes and Files in
  a side panel. A grid of sessions offers Maximize in each session's header, and narrow widths show
  only the active session
  ([agents window](https://code.visualstudio.com/docs/agents/run/agents-window)).
- Session rows show the "session name, workspace, harness, and file change stats"
  ([chat sessions](https://code.visualstudio.com/docs/copilot/chat/chat-sessions)).
- Compact mode "replaces completed groups with expandable summaries"
  ([agent mode](https://code.visualstudio.com/docs/copilot/chat/chat-agent-mode)). Seen only in a
  documentation diff: the todo list sits at the top of the Chat view, "so you always have visibility
  into the progress being made".

### Zed, Windsurf, Amp, OpenHands, and others

- **Zed.** An agent panel, with a "follow the agent" mode that moves the editor along with the files
  the agent edits ([agent panel](https://zed.dev/docs/ai/agent-panel)).
- **Windsurf.** Cascade "will create a Todo list within the conversation to track progress"
  ([Cascade](https://docs.devin.ai/desktop/cascade/cascade)).
- **Amp.** You follow a thread from the phone, the Mac, or the terminal, and are notified when it is
  ready ([manual](https://ampcode.com/manual)).
- **OpenHands.** A chat panel with Changes, VS Code, Terminal, App, and Browser tabs
  ([features](https://docs.openhands.dev/openhands/usage/key-features)).
- **Conductor and vibe-kanban.** One workspace per agent, with its diff, terminal, and logs
  ([Conductor](https://www.conductor.build/docs/), [vibe-kanban](https://www.vibekanban.com/docs)).
- **A user's own heads-up display** for agents shows what they wanted to know: "1) it's still
  going 2) what is it currently doing and 3) what was its last message if it stopped"
  ([HN](https://hn.svelte.dev/item/49184388)).

### What they have in common

1. **A session can take the whole window.** Web products show it as a full page, and every IDE
   product added a tab, a window, or a Maximize button to its side panel.
2. **Work panes beside the transcript on wide screens.** These are changes or a diff (nearly
   always), a plan or tasks, a terminal, and a preview. On narrow screens only the transcript shows,
   and panes become tabs.
3. **Progress pinned outside the transcript.** A checklist with N/M or done, in progress, and
   pending marks, the elapsed time, and a diff count. A pinned checklist is the most requested
   missing piece.
4. **A few session states on every row.** Working, needs you, done, and failed, shown with a dot, a
   colour, or an animation.
5. **Rows that say what the session does now.** The name, the state, one line of current activity or
   the pending question, and its age.
6. **Compact and detailed following.** Tool calls fold into summaries that open on demand, and
   hiding too much makes users nervous.
7. **Sticky auto-scroll.** The view follows the end only while the reader is there, with a way back
   to the latest message.
8. **Steering and stopping from the session.**
9. **Notifications** when a session finishes or needs the human.
10. **Following from a phone.**

## Standards and libraries

### Astryx 0.6.8

The web UI pins `@astryxdesign/core` 0.6.8. These come from its type declarations in the installed
package, under `dist/`:

- **`AppShell`** has no slot for an aside. **`Layout`** has `header`, `start`, `content`, `end`, and
  `footer` slots, and a `contentWidth` for the reading measure. Its documentation says "Building a
  page area with a side panel? Use Layout with start/end slots".
  - **`LayoutPanel`** takes `width`, `hasDivider`, `label`, and a `resizable` from `useResizable()`.
  - It scrolls on its own unless `isScrollable={false}`, which its documentation recommends "for
    auto-height layouts where sticky positioning needs to work".
  - The app does not use `Layout` today: [`Panes.tsx`](/packages/web/src/layout/Panes.tsx) is a
    StyleX grid of its own.
- **`ProgressBar`** is the only progress component: there is no meter or ring.
  - It takes `value`, `max`, a required `label`, `formatValueLabel`, and `marks`, and renders
    `role="progressbar"` with `aria-valuetext`.
  - The app already uses it, in [`RoundNav.tsx`](/packages/web/src/RoundNav.tsx).
  - `Stepper` and `Step`, with a status per step, also exist.
- **`SideNavItem`** has `label` (a plain string), `icon`, `endContent`, `actions`, and `children`,
  and no second line.
  - `endContent` is "Passive right-side content only (badges, counts)", drawn inside the row's link,
    and hidden while the navigation is folded.
  - Nested `SideNavItem`s are how [`SessionNav.tsx`](/packages/web/src/SessionNav.tsx) draws
    sub-agent rows today.
- **`TabList`**, without `role="tablist"`, draws links with `href` and `aria-current`, which suits
  tabs kept in the URL.
- **`ChatMessageList`** renders `role="log"`, `aria-live="polite"`, and `aria-busy` while
  `isStreaming`. [`Transcript.tsx`](/packages/web/src/Transcript.tsx) does not pass `isStreaming`.
- **`ChatLayout`** has a `scrollButton` slot, and **`useChatStreamScroll`** returns `isScrolledUp`
  and `scrollToBottom`. The app follows the end with hooks of its own instead.

### Live regions and progress in WAI-ARIA

- **`role="log"`** is for content added "only to the end". It is implicitly polite and not atomic,
  and needs an accessible name
  ([MDN, log](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/log_role)).
- **Frequent updates.** "Unless these kinds of updates are the main function of the page, you likely
  do not want to inform the user every time it updates." `aria-busy` holds announcements while
  updates are in progress
  ([MDN, aria-live](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live),
  [aria-busy](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-busy)).
- **A pattern for streaming chats.** The transcript is a log with `aria-live="off"`, and a separate
  `role="status"` announces only when a response starts, ends, or fails. VoiceOver read a long
  `aria-busy` batch all at once at the end
  ([azukiazusa](https://azukiazusa.dev/en/blog/accessible-streaming-chat-ui)).
- **Progress bars.** A progress bar needs a name, and `aria-valuetext` when a percentage would
  mislead, as "Task 7 of 11" would
  ([MDN, progressbar](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/progressbar_role)).
  WCAG 4.1.3 lists progress among status messages
  ([status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)).
- **Moving content.** WCAG 2.2.2 asks for a way to pause or stop content that moves or updates on
  its own ([pause, stop, hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)).
  Following the end only while the reader is there is that way.

### Scroll following and scroll anchoring

- **Scroll anchoring.** It is on by default where supported, and `overflow-anchor: none` opts out
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow-anchor)).
  Safari's support is unclear: MDN's data says Safari 27, while caniuse lists Safari up to 27.2 as
  unsupported ([caniuse](https://caniuse.com/css-overflow-anchor)).
  - The app's own following, `useFollowEnd` in [`Transcript.tsx`](/packages/web/src/Transcript.tsx)
    (lines 173–207), uses a `ResizeObserver` and does not rely on anchoring.
  - It follows only while the reader is within 24 px of the end, which already handles the complaint
    in [Claude Code](#claude-code)'s #11092.
- **Sticky positioning.** `position: sticky` sticks to the nearest ancestor with an `overflow` other
  than `visible`
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position)). A column
  pinned beside a transcript that scrolls with the window must not sit inside a scrolling panel.

### Claude Code's progress events

- **What the runner reads.** [`claude-events.ts`](/packages/server/src/runner/claude-events.ts)
  turns streamed tool input into an activity line, such as "Thinking", "Writing spec.md", or
  "Waiting for 2 sub-agents", shown at the end of a running turn.
  - `tool_progress` and `tool_use_summary` are known message types that produce nothing.
  - The [SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript) documents both, and
    `system/session_state_changed`.
- **The agent's own checklist.** The task tools are `TaskCreate`, `TaskUpdate`, and the older
  `TodoWrite`. They "are available by default only on Opus 4.7, Sonnet 4.6, Haiku 4.5, and earlier
  models". On newer models they are left out unless enabled with `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`
  or named in `--allowedTools`, since "Claude keeps track of multi-step work without a written
  checklist" ([tools reference](https://code.claude.com/docs/en/tools-reference)). A client sees
  them only as `tool_use` blocks
  ([todo tracking](https://code.claude.com/docs/en/agent-sdk/todo-tracking)).
- **The runner today.** It treats them as unknown tools: a bare "TodoWrite" row, with its input
  dropped ([`transcript.ts`](/packages/server/src/runner/transcript.ts), lines 150–160).
- **The agents decision.** Enabling these tools would go against [agents](../decisions/agents.md):
  "Tools MUST NOT change the agent's commit attribution, model, effort, or settings, except the
  permission mode".

### The repository watcher

- **What it watches.** The core watches the git folder and every worktree's `specs/` with the
  `notify` crate. It re-reads the workspace after 200 ms of quiet
  ([`watch.rs`](/crates/core/src/watch.rs), lines 21 and 59–73).
- **What it reads.** A feature checked out in a worktree is read from disk, uncommitted edits
  included. A feature without a worktree is read from its branch's tip
  ([`workspace.rs`](/crates/core/src/workspace.rs), lines 538–558).
- **How changes reach the UI.** The server turns changes into fate live updates of the workspace,
  the feature, and the sidebar ([`live.ts`](/packages/server/src/live.ts), lines 29–51).
- **The consequence.** A terminal agent that checks a plan's boxes moves the sidebar within a
  fraction of a second, before it commits.
- **Node's own watcher.** Node 24's `fs.watch` is recursive on Linux and macOS and "can be
  unreliable... on network file systems"
  ([Node fs](https://nodejs.org/docs/latest-v24.x/api/fs.html#fswatchfilename-options-listener)). It
  is not used for this, since the core's watcher already covers it.

## The code

### Important reads

- [`App.tsx`](/packages/web/src/App.tsx), lines 146–156: `SessionRoute` draws `Panes`, with the
  feature page as the list and the session as the detail. Chats render `SessionPage` as full pages
  (lines 96–99).
- [`layout/Panes.tsx`](/packages/web/src/layout/Panes.tsx):
  - the detail is `minmax(var(--size-pane-min), 40%)` wide, sticky, as tall as the window, and
    scrolls on its own;
  - it has a Close button, and its scroll is restored for Back;
  - on narrow screens it draws the detail alone.
- [`theme/theme.ts`](/packages/web/src/theme/theme.ts): `--size-pane-min` is 400 px, and
  `--size-page-max` is 720 px, then 1200 px from `lg`. A page's column is capped by the pane it is
  in.
- [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx):
  - the header is a title, then the status, agent, and place on one line, its heading at level 2
    beside the feature page on wide screens (lines 58–94);
  - the transcript has a sticky composer;
  - crumbs show only on narrow screens (line 356);
  - it hands over with `?continue=`, asks about a block with `?ask=`, and refuses messages without a
    branch.
- [`Transcript.tsx`](/packages/web/src/Transcript.tsx), 611 lines:
  - tool calls fold into groups, and each sub-agent is a group of its own;
  - each turn sits under `#turn-<id>` and is paged in 100-item pages;
  - a running turn ends with an activity line and its elapsed time;
  - `useOpenAtEnd` and `useFollowEnd` find the scrolling element, the pane or the window, so they
    already work at full width (lines 132–207).
- [`AgentPanel.tsx`](/packages/web/src/AgentPanel.tsx), on the feature page: the session's status,
  its latest turn ("Run: Implementation · 4 min"), Stop, "Open the session", and "Review and start
  the agent".
- [`SessionNav.tsx`](/packages/web/src/SessionNav.tsx):
  - **Order.** Home and Priorities, then "Waiting on you", "Agents at work", Chats, and Done.
  - **Feature rows.** A row's label is the feature's title and links to the feature page (lines
    308–332). It is selected on any page under `/f/<folder>/`, the session included.
  - **Statuses.** A feature without a session is "Needs you" when its step waits on the human, and
    "Idle" otherwise (lines 150–161).
  - **Sub-agent rows.** Running sub-agents are nested rows linking to the session, hidden when the
    navigation is folded.
- [`Home.tsx`](/packages/web/src/Home.tsx), lines 128–137: "Agents at work" rows already show
  `step.task`, after the step's name when the server runs the agent.
- [`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx): the plan's review shows a done/total badge
  per task, from the core's `PlanItems`.
- [`crates/core/src/files/plan.rs`](/crates/core/src/files/plan.rs):
  - `tasks()` returns each `## Task N: title` with its checked and total steps;
  - a later level-2 heading that is not a task does not close the last task, so its checkboxes count
    toward it.
- [`crates/core/src/steps.rs`](/crates/core/src/steps.rs), lines 221–228: an approved plan's step is
  `implementation`, with `task: "Task N: title"` of the first task with an unchecked step. Once
  every box is checked, the step moves to the final review.
- [`packages/binding/index.d.ts`](/packages/binding/index.d.ts): `StepView.task` is a string. No
  task index or total reaches the feature or the workspace.
- [`skills/uraeda/references/implementation.md`](/skills/uraeda/references/implementation.md):
  - a task's boxes are checked together, once it is validated, and committed with its code (lines
    72–74);
  - a plan's text can change during the implementation, with a ruling;
  - a new round of questions revises the plan, and its unchecked tasks follow the new plan.
- [`skills/uraeda/references/plan.md`](/skills/uraeda/references/plan.md): a revised plan keeps the
  checked steps that still hold, and unchecks or rewrites the others. The number of tasks can change
  mid-implementation.
- **History.** `git log` shows the pane was made for the run view (`524ff2d`), then reused for
  sessions when chats came (`8d3b88a`). Neither feature asked about it: see the
  [UI improvements record](../done/2026-10-12-ui-improvements.md) and the
  [chat record](../done/2026-10-13-chat-in-the-web-ui.md#behaviour).

### The proposal's path and existing actions

- **Following a working agent, on a desktop.** Today it takes two clicks: the feature's row in the
  sidebar opens the feature page, then "Open the session" opens the pane. The pane is about 480 px
  wide at 1440 px. With a dedicated view, the session takes the content area, and the feature page
  is a link away.
- **Hand-over (`?continue=`).** "Commit and start the agent" and its siblings, from rounds, reviews,
  the editor, and the feature page, all open the session. They open the same address, with the
  feature page no longer beside it.
- **Ask the agent (`?ask=`).** It leaves a review or a round for the session. Back returns to the
  review.
- **Old run links (`/f/<folder>/runs/<id>`).** They redirect to the session at `#turn-<id>`. The
  anchor scroll targets the window instead of the pane, which `scroller()` already handles.
- **Close.** The pane's Close goes back to the feature page. A page of its own needs crumbs on wide
  screens too, as it has on the phone.
- **Back and scroll.** The pane keeps its own position in the history entry (`pane`). A page uses
  the window's (`scroll`), which `useOpenAtEnd` already respects.
- **The heading.** It is level 2 beside the feature page, and becomes level 1 on its own page.
- **Stop.** It is in the composer, and in the feature page's Agent section, which no longer shows
  beside the session.
- **Chats.** They are full pages already: a precedent for the layout.
- **The sidebar's feature row.** It is selected on the session too. During the implementation it
  gains the progress, which updates when a task's boxes are checked, by any agent.
- **A plan revised mid-implementation.** The total moves, and the current task can move back to an
  earlier, now unchecked, task.
- **Every box checked.** The step becomes the final review, and "Task N/M" has nothing to show.
- **A terminal agent.** Its progress shows, but its status stays Idle: the server has no session for
  it.

### Other features in flight

- **Image attachments**, on branch `2026-10-13-image-attachments`, not merged. It reworks
  `SessionPage.tsx`'s draft, adds about 400 lines to `Composer.tsx`, and shows images in
  `Transcript.tsx`. Restructuring `SessionPage.tsx` would conflict with it in text, not in
  behaviour.
- **Code quality in the skill**, on branch `2026-10-14-code-quality-in-the-skill`, not merged.
  - It sorts props and keys in every UI file, and renames `useOpenGroups`.
  - It adds a `code-quality` decision with a 500-line limit per file. `Transcript.tsx` already
    carries a suppression for it.
  - Its plan template adds a step for splitting a file over the limit. The task and step syntax
    stays, so the core's plan parser is unaffected.
- **Text inputs and comments**, on branch `2026-10-14-text-inputs`: a proposal only, about how text
  fields save. It may touch the composer.
- **The [look and feel](/specs/drafts/look-and-feel.md) draft**, not started, asks for "Better URLs
  for the navigation", which may rename `/f/<folder>/session`.

### Likely changes

- [`packages/web/src/App.tsx`](/packages/web/src/App.tsx): with
  [a page of its own](#session-layout-on-wide-screens), `SessionRoute` draws the session page alone.
  With the pane kept, nothing changes here.
- [`packages/web/src/SessionPage.tsx`](/packages/web/src/SessionPage.tsx): the header's level and
  crumbs at both widths, with a page of its own. Under every option, the step and progress in its
  header, or a side column.
- `packages/web/src/SessionAside.tsx`, new: only with [a side column](#the-side-column). It holds
  the plan's tasks, the step, the sub-agents, and links.
- [`packages/web/src/layout/Panes.tsx`](/packages/web/src/layout/Panes.tsx): a maximize control,
  only if the pane is kept and grows one.
- [`packages/web/src/SessionNav.tsx`](/packages/web/src/SessionNav.tsx): the progress on feature
  rows, as [the sidebar's approaches](#plan-progress-in-the-sidebar) say.
- [`packages/web/src/Transcript.tsx`](/packages/web/src/Transcript.tsx): a "Jump to the latest"
  button, `isStreaming` on the log, and a status line. It is over the
  [code quality](#other-features-in-flight) limit already, so additions go in a new file.
- [`crates/core/src/steps.rs`](/crates/core/src/steps.rs),
  [`crates/core/src/files/plan.rs`](/crates/core/src/files/plan.rs), and the binding's `StepView`:
  the current task's position and the number of tasks, under every option that shows "N/M". The
  [stack decision](../decisions/stack.md) keeps workflow logic in the core.
- [`specs/decisions/ui-layout.md`](../decisions/ui-layout.md): a proposed change, only with a page
  of its own on wide screens.
- [`skills/uraeda/references/implementation.md`](/skills/uraeda/references/implementation.md), the
  plan template, and the example's plan: only with [progress per step](#granularity-of-progress).
- [`packages/server/src/runner/`](/packages/server/src/runner/): only with
  [the agent's own checklist](#the-agents-own-checklist), or with
  [agents the server did not start](#agents-the-server-did-not-start) detected from their
  transcripts.
- Tests: [`__tests__/session.test.tsx`](/packages/web/src/__tests__/session.test.tsx) ("on a wide
  screen, the session is beside the feature page"), and
  [`__browser__/session.test.tsx`](/packages/web/src/__browser__/session.test.tsx) and
  [`__browser__/layout.test.tsx`](/packages/web/src/__browser__/layout.test.tsx), which assert the
  pane. [`__tests__/shell.test.tsx`](/packages/web/src/__tests__/shell.test.tsx) gains the progress.

## The proposal

### What the sidebar is

The proposal says the session is "just a sidebar" on desktop. The left navigation is the sidebar
elsewhere in the UI, while the session itself is a pane beside the feature page. The proposal's
reason, "the sidebar is too small for it", matches the pane: about 480 px of a 1440 px window. This
discovery reads "sidebar" as the session's pane, and "in the sidebar", for the task, as the left
navigation.

### The UI layout decision

The [UI layout](../decisions/ui-layout.md) decision says: "On wide screens, a detail opened from a
list MUST open in a pane beside the list, which stays usable." The session is drawn as such a detail
of its feature page. A session page of its own on wide screens needs one of two things:

- a change to that rule, saying that a session is a page and not a detail;
- or a reading in which the session is not a detail of a list.

Only the human can change an active decision.

### Agents the web UI did not start

"Even when we're not the ones running the agent" is met for progress by the watcher: plan files are
read from the worktree's disk. Two things are not met:

- the feature still shows "Idle", since only the server's own sessions have a status;
- the session view has no transcript for an agent started in a terminal.

The proposal does not say whether either is expected.

### Task N of M

- **Not exposed yet.** The core gives the current task's title and number, but not its position or
  the number of tasks.
- **Not a reliable position.** `## Task N` numbers are written by hand, so the position in the list
  is the safer count.
- **Per task only.** Boxes are checked when a task is done, so progress moves one task at a time,
  never within one.
- **Not stable.** A plan revision can add tasks or uncheck steps, so M can grow and N can go back.
- **Only during the implementation.** Before an approved plan and after the last box there is no
  current task.

## Approaches

Criteria come from:

- the [proposal](proposal.md): follow the agent comfortably on a desktop, and see the current task
  in the sidebar whoever runs the agent;
- the [constitution](../CONSTITUTION.md): plain text in git as the only workflow state (principle
  II), tools optional, and code kept simple (principle VI);
- the decisions: [UI layout](../decisions/ui-layout.md),
  [UI behaviour](../decisions/ui-behaviour.md), [UI components](../decisions/ui-components.md),
  [UI checks](../decisions/ui-checks.md), [agents](../decisions/agents.md), and
  [stack](../decisions/stack.md).

### Session layout on wide screens

Where a feature's session opens from 768 px. See
[what they have in common](#what-they-have-in-common) and
[the UI layout decision](#the-ui-layout-decision).

| Option                                                | Room for the transcript        | Feature context in view          | UI layout decision                      | Effort                                         |
| ----------------------------------------------------- | ------------------------------ | -------------------------------- | --------------------------------------- | ---------------------------------------------- |
| A. A page of its own, with a side column for progress | Content area minus the column  | Progress and links in the column | Changed: a session is a page            | Medium: the page, the column, the tests        |
| B. A page of its own, transcript only                 | The whole content area         | A line in the header             | Changed: a session is a page            | Small                                          |
| C. The pane, with a Maximize button and a resize edge | 40% by default, full on demand | The feature page, when not maxed | Kept, with a maximized state in the URL | Small to medium: a state for Maximize and Back |

### The side column

What sits beside the transcript. Only with option A of
[session layout](#session-layout-on-wide-screens). See [Claude Code](#claude-code),
[VS Code](#vs-code), and [Astryx's Layout](#astryx-068).

| Option                                                             | Answers "what is happening"         | New server work                      | Diff view, left for later by the chat |
| ------------------------------------------------------------------ | ----------------------------------- | ------------------------------------ | ------------------------------------- |
| A. The step, the plan's tasks with their checks, sub-agents, links | Where the feature is, and what runs | The task index and total in the core | Not touched                           |
| B. A, plus the files changed on the branch with their line counts  | Also what changed so far            | A git diff summary per feature       | Half of it: a list without the diff   |

The column needs room: at 768 px, with the navigation open, the content area is about 528 px. It can
fold away, like the navigation, with its state kept in the browser.

### Plan progress in the sidebar

How "Task 7/11" shows in the left navigation. See [Astryx's `SideNavItem`](#astryx-068) and
[task N of M](#task-n-of-m).

| Option                                                                               | Shows the task's title               | Folded navigation       | A way into the session from the sidebar | Rows added                  |
| ------------------------------------------------------------------------------------ | ------------------------------------ | ----------------------- | --------------------------------------- | --------------------------- |
| A. A nested row under the feature, "Task 7/11: The repeat menu", opening the session | Yes, cut to the width                | Hidden, like sub-agents | Yes                                     | One per feature in progress |
| B. A "7/11" badge at the end of the feature's row                                    | In the label for screen readers only | Hidden                  | No                                      | None                        |
| C. Both                                                                              | Yes                                  | Hidden                  | Yes                                     | One per feature in progress |

### Agents the server did not start

Whether the UI shows that an agent it did not start is working. See
[the repository watcher](#the-repository-watcher) and
[agents the web UI did not start](#agents-the-web-ui-did-not-start).

| Option                                                                                        | Accurate                                | Agent-neutral            | Effort                                         |
| --------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------ | ---------------------------------------------- |
| A. Progress only, from the plan: the status stays as today                                    | Yes, but silent about who works         | Yes                      | None beyond progress                           |
| B. A "Changed recently" mark when the worktree's files or commits changed in the last minutes | A guess: an edit by hand looks the same | Yes                      | Small: the watcher's events, timed             |
| C. Read Claude Code's own transcripts of the worktree, shown read-only in the session view    | Yes, for Claude Code only               | No: one parser per agent | Large, and fragile across Claude Code versions |

### Granularity of progress

How often the progress moves. See [task N of M](#task-n-of-m).

| Option                                                                                                   | Within a task               | Workflow change                                     |
| -------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------- |
| A. Per task, as today: a task's boxes are checked together when it is done                               | No: the transcript shows it | None                                                |
| B. Per step: the agent checks each step's box in the worktree as it finishes it, committed with the task | "Task 7/11 · step 3/5"      | The implementation reference, template, and example |

With B, the watcher reads the worktree's disk, so each box shows before the task's commit. A crashed
agent leaves the boxes and the code uncommitted together in the worktree, which the next run sees as
they are.

### The agent's own checklist

Whether the session shows Claude Code's to-do list. See
[Claude Code's progress events](#claude-codes-progress-events).

| Option                                                                       | Works on current default models | Agents decision                      |
| ---------------------------------------------------------------------------- | ------------------------------- | ------------------------------------ |
| A. No: the plan is the checklist, and to-do calls stay generic tool rows     | Not needed                      | Kept                                 |
| B. Parse TodoWrite and the Task tools when the agent uses them, and pin them | Rarely: they are off by default | Kept                                 |
| C. B, and enable the task tools for every session                            | Yes                             | Changed: tools would change settings |

### Following the end

How the reader keeps up with a working agent. See
[scroll following](#scroll-following-and-scroll-anchoring) and
[live regions](#live-regions-and-progress-in-wai-aria).

| Option                                                                                                   | Users' main complaint                   | Effort |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------ |
| A. As today: follow the end while the reader is within 24 px of it                                       | Covered, with no way back but scrolling | None   |
| B. A, plus a "Jump to the latest" button while scrolled up, and a status line announcing turns and tasks | Covered, with a way back                | Small  |

### Narrow screens

The session is already a page of its own on the phone. What a side column holds would need a place
there too: a line under the header ("Implementation · Task 7/11: The repeat menu") that opens the
task list. This is the pattern products use, showing only the transcript and putting panes behind a
tab or a menu ([VS Code](#vs-code)).

### Needs no choice

- **A session can take the whole window.** It does with options A and B of
  [session layout](#session-layout-on-wide-screens), and with Maximize in C.
- **Work panes beside the transcript.** These are covered by [the side column](#the-side-column). A
  terminal or a preview has no counterpart: the agent runs commands that show in its tool calls.
- **Progress pinned outside the transcript.** This is the proposal's own request, through the plan's
  tasks.
- **A few session states on every row.** They exist since the
  [chat](../done/2026-10-13-chat-in-the-web-ui.md#behaviour): Working, Needs you, Failed, New reply,
  Idle.
- **Rows that say what the session does now.** For a feature, the progress row says which task. A
  model-written activity summary, like Claude Code's agent view, would cost a model call every 15
  seconds, and the activity line already shows in the transcript.
- **Compact and detailed following.** Tool calls already fold into groups that open on demand, and
  their state is kept for Back.
- **Steering and stopping.** They exist in the composer.
- **Notifications.** They are a separate item of [PRIORITIES](../PRIORITIES.md#next), "Ping user
  when input is needed".
- **Following from a phone.** The session is already a page there.
- **Two sessions side by side.** The UI holds one feature's session at a time, and the sidebar's
  statuses cover the others.

## Not checked

- Codex app's session layout: its official pages describe panels only through keyboard shortcuts.
  The task sidebar comes from a third-party post.
- Cursor's to-do list placement: its planning page now redirects to the docs' root.
- VS Code's todo list position: seen only in a documentation pull request's diff.
- Claude Code complaints about the panel's width, on claudeissues.com: seen only in search results.
- Conductor's, vibe-kanban's, and Amp's sub-pages on following a session, and Sculptor's docs.
- Whether Astryx's `ProgressBar` passes `formatValueLabel`'s text to `aria-valuetext`: its built
  code was not read that far.
