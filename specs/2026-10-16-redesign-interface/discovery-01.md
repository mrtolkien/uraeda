# Discovery, round 01: Redesign sidebars and global interface

## Summary

The global interface of tools like this one is a shell around every page: a left sidebar for
navigation and status, sometimes a right column for context, a top bar on phones, and the signals
that tell the human when they are needed. Established products agree on most of the shell: a sidebar
that hides with a button and a shortcut, resizes from its edge, and remembers both; row actions in a
"…" menu; finished items kept out of the way. Where they differ is how far the sidebar collapses (an
icon rail, or nothing), and how they tell the human about work. Agent orchestrators (Claude Code's
agent view, Devin, Cursor, Sculptor, Conductor) share one vocabulary of states, working, needs you,
done, failed, and attach the pull request to the session.

The [proposal](proposal.md) asks for a functional pass on that shell, with five strands: the
sidebar's hierarchy of concepts (Inbox > Priorities > Draft > Change > Feature) and each feature's
step; hiding and resizing both sidebars, a home button on phones, the last five done features, and
the theme leaving the sidebar; accurate statuses (no "waiting on you" while work goes on, the pull
request's address, "PR ready" only once it is open, only real workflow items); notifications when
the human is needed; and clear feedback on every button that works in the background. Two requests
came later in the chat that started this round, on 2026-10-16: renaming a feature or giving it a
colour from a "…" on its sidebar row, and optimistic statuses in the sidebar, since the server takes
a few seconds to settle.

The code already has much of the shell: Astryx's `SideNav` resizes (200 to 360 px) and folds to an
icon rail, with its handle shown on hover. The gaps are elsewhere. The core reads every step with an
unknown pull request, so a feature reads "Pull request" from its last task to its merge; a branch
checked out in a worktree counts as a feature without its folder; background shells do not hold a
run open; the step shows nowhere in the sidebar before implementation; no button tells the others
that a git write is running; and nothing notifies.

## How other products do it

### VS Code

- Two side bars: the primary on the left, the secondary on the opposite side, toggled by Ctrl+B and
  Ctrl+Alt+B, with title-bar buttons, and a layout remembered across sessions
  ([custom layout](https://code.visualstudio.com/docs/configure/custom-layout),
  [user interface](https://code.visualstudio.com/docs/getstarted/userinterface)).
- The resize handle, a "sash", is 4 px wide with a 300 ms hover delay before it highlights
  ([sash settings](https://raw.githubusercontent.com/microsoft/vscode/main/src/vs/workbench/contrib/sash/browser/sash.contribution.ts)).
  Double-clicking it resets the size. While dragging, it turns off pointer events on every iframe
  and forces the resize cursor everywhere
  ([sash.ts](https://raw.githubusercontent.com/microsoft/vscode/main/src/vs/base/browser/ui/sash/sash.ts)).
- Both side bars have a 170 px minimum and snap closed when dragged below it
  ([sidebarPart.ts](https://raw.githubusercontent.com/microsoft/vscode/main/src/vs/workbench/browser/parts/sidebar/sidebarPart.ts),
  [splitview.ts](https://raw.githubusercontent.com/microsoft/vscode/main/src/vs/base/browser/ui/splitview/splitview.ts)).
- `workbench.reduceMotion` follows the operating system by default
  ([workbench.contribution.ts](https://raw.githubusercontent.com/microsoft/vscode/main/src/vs/workbench/browser/workbench.contribution.ts)).

### Linear

- The sidebar collapses with `[`, a click on its border, or the command menu, and expands with `[`
  again or the top-left icon
  ([changelog](https://linear.app/changelog/unpublished-collapsible-sidebar)). Resizable left and
  right sidebars were seen only in a search snippet.
- Row actions sit behind a `···` shown on hover of a team's name
  ([teams](https://linear.app/docs/teams.md)). Statuses are edited from the three dots, with their
  name, colour, and description ([issue properties](https://linear.app/docs/issue-property.md)).
  Team icons take any colour, with random ones assigned at first
  ([sidebar and team icons](https://linear.app/changelog/2022-01-20-linear-preview-new-sidebar-and-team-icons)).
- Statuses come in a fixed order of categories, Backlog > Todo > In Progress > Done > Canceled, and
  Triage is "an Inbox for your team", under the team in the sidebar
  ([issue properties](https://linear.app/docs/issue-property.md),
  [triage](https://linear.app/docs/triage.md)). Done issues are archived automatically after a while
  ([archive](https://linear.app/docs/delete-archive-issues.md)).
- Linear "does not currently support setting up new browser push-notification subscriptions": its
  channels are the inbox, the desktop and mobile apps, Slack, and email
  ([notifications](https://linear.app/docs/notifications)).

### Notion

- `<<` and `>>` buttons or Cmd/Ctrl+\\ open and close the sidebar, and its right edge drags to
  resize it. Sections show from 5 to all of their pages, with `More` at the bottom. `•••` and `+`
  appear on hover of a page, and the `•••` menu holds Rename
  ([sidebar](https://www.notion.com/help/navigate-with-the-sidebar),
  [workspaces](https://www.notion.com/help/intro-to-workspaces)).

### claude.ai, Claude Code desktop, and ChatGPT

- claude.ai: a button at the sidebar's top right opens and closes it; a conversation is renamed from
  a "⋮" shown on hover, or a long press on iOS
  ([appearance](https://support.claude.com/en/articles/8887527-customizing-your-appearance-settings),
  [rename](https://support.claude.com/en/articles/8230524-delete-or-rename-a-conversation)).
- Claude Code desktop lists sessions in the sidebar, filtered by status; a session is archived from
  an icon shown on hover, and renamed by clicking its title in the toolbar
  ([desktop](https://code.claude.com/docs/en/desktop.md)).
- ChatGPT and Codex's desktop app: ⌘B toggles the sidebar, ⌘⌥R renames a chat
  ([commands](https://learn.chatgpt.com/docs/reference/commands.md)).

### GitHub, Slack, Figma, Zed, Obsidian, JetBrains

- GitHub's resizable panes (Primer `PageLayout.Pane`) keep their width in `localStorage`, reset on
  double-click, and warn that a stored width can shift the layout on load
  ([page layout](https://primer.style/product/components/page-layout/)). GitHub Projects offers 8
  fixed colours for its options, edited in a dialog
  ([schema](https://raw.githubusercontent.com/octokit/graphql-schema/main/schema.graphql),
  [single-select fields](https://docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields/about-single-select-fields)).
- Slack: a section's three dots show on hover on desktop and stay visible on mobile; sections rename
  and change their emoji from that menu
  ([sections](https://slack.com/intl/en-gb/help/articles/360043207674-Organise-your-sidebar-with-customised-sections)).
- Figma resizes its sidebar from the edge, and hides every panel with Ctrl+Shift+\\
  ([left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-View-layers-and-pages-in-the-left-sidebar)).
- Zed: Ctrl+B toggles the left dock, a 6 px handle resizes it, and a double-click resets its size
  ([keymap](https://raw.githubusercontent.com/zed-industries/zed/main/assets/keymaps/default-linux.json),
  [dock.rs](https://raw.githubusercontent.com/zed-industries/zed/main/crates/workspace/src/dock.rs)).
- Obsidian collapses its sidebars by default on mobile, where they open with a swipe
  ([sidebar](https://obsidian.md/help/sidebar)). JetBrains hides a tool window with Shift+Escape
  ([tool windows](https://www.jetbrains.com/help/idea/tool-windows.html)).
- GitLab's "super sidebar" peeks in as an overlay when the pointer reaches the window's left 8 px,
  and stays while a menu inside it is open
  ([issue 390773](https://gitlab.com/gitlab-org/gitlab/-/issues/390773)).

### Agent orchestrators

- **Claude Code's agent view**: rows are Working, Needs input, Idle, Completed, Failed, or Stopped;
  groups "Ready for review" and "Needs input" come first. A session with an open pull request moves
  to "Ready for review". A `#1234` label at the row's end links to the pull request, coloured by its
  state, with grey for a draft; Claude Code finds it with `gh pr view` after a push. In its JSON, a
  running sub-agent, workflow, or monitor counts as working, and "a session that finished its turn
  and is waiting for your next instruction reads `done`, not `blocked`"
  ([agent view](https://code.claude.com/docs/en/agent-view)).
- **Devin**: `working`, `waiting_for_user`, `waiting_for_approval`, `finished`, with
  `pull_requests: [{pr_url, pr_state}]` on the session
  ([API v3](https://docs.devin.ai/api-reference/v3/sessions/get-organizations-session.md)).
- **Cursor's cloud agents**: `ACTIVE` is "a turn is running, waiting on background work, or about to
  start" ([endpoints](https://cursor.com/docs/cloud-agent/api/endpoints)).
- **Sculptor**: a `waiting_for_background` state, "Waiting for background tasks...", while tasks
  whose `task_started` came have no `task_notification` yet; the "Create PR" button then shows the
  pull request's state and refreshes by itself
  ([useAgentStatus.ts](https://github.com/imbue-ai/sculptor/blob/HEAD/sculptor/frontend/src/pages/workspace/chat/useAgentStatus.ts),
  [pull requests](https://github.com/imbue-ai/sculptor/blob/HEAD/docs/help/pull_requests.md)).
- **Conductor**: distinct icons for plan approval and user input, counts on collapsed status groups,
  a jump to the next session needing attention, and GitHub's state at a glance
  ([0.39.0](https://www.conductor.build/changelog/0.39.0-insta-summarize-command-palette-opus-4-6),
  [0.44.0](https://www.conductor.build/changelog/0.44.0-new-sidebar-rebuilt-composer-codex-checkpoints)).
  Finished workspaces are archived out of the sidebar
  ([workflow](https://www.conductor.build/docs/concepts/workflow)).
- **GitHub Copilot's coding agent** always opens a draft, and asks for a review when it is done
  ([Microsoft Learn](https://learn.microsoft.com/en-us/training/modules/github-copilot-code-agent/3-assign-track-troubleshoot-copilot-code-agent-tasks)).
- **Vibe Kanban**: Running, Idle ("Waiting for your input"), Needs Attention, and a sidebar state
  built from the sessions ([sessions](https://vibekanban.com/docs/workspaces/sessions.md)).
- **Codex** notifies on turn completion and approval requests, with a condition `unfocused` or
  `always` ([config](https://learn.chatgpt.com/docs/config-file/config-advanced),
  [notifications](https://learn.chatgpt.com/docs/notifications)). Claude Code's own `idle_prompt`
  notification fires about 60 s after a reply, only if no background agent is still running
  ([hooks](https://code.claude.com/docs/en/hooks.md)).

### What they have in common

- A visible toggle near the top or leading edge, and a keyboard shortcut, for each sidebar.
- A drag handle on the edge, thin, with a wider hit area, a minimum width, and often a snap closed
  below it; the width and the hidden state kept across reloads.
- A double-click on the handle, which resets the width in most products, and toggles the fold in
  Astryx.
- A short animation, turned off by reduced motion.
- Sometimes a peek of a hidden sidebar on hover of the window's edge.
- Row actions in a "…" menu, shown on hover with a pointer and always on touch: rename, and in some
  products a colour from a fixed palette.
- Finished items kept out of the main list: a limit with "More", a filter, or an archive.
- One set of agent states: working, needs you, done or idle, failed or stopped, where background
  work still counts as working.
- The pull request attached to its session, with its state, read through `gh`.
- A notification when the human is needed, often only when the window is not in front.

## Standards and libraries

### Window splitter and accessibility

- The WAI-ARIA window splitter is a focusable `role="separator"` with `aria-valuenow`; arrows move
  it, and Enter collapses the pane or restores it
  ([APG](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)).
- WCAG 2.2: 2.5.7 asks for a single-pointer alternative to every drag, which a keyboard alternative
  does not satisfy
  ([dragging](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)); 2.5.8 sets 24
  px targets ([target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html));
  2.1.1 makes every function reachable by keyboard
  ([keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html)); 1.4.1 forbids colour as
  the only cue ([use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html));
  2.3.3 lets motion from interactions be turned off, through `prefers-reduced-motion`
  ([animation](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html),
  [C39](https://www.w3.org/WAI/WCAG22/Techniques/css/C39)).
- Animating `width` costs frames; `transform` and `opacity` do not
  ([animations guide](https://web.dev/articles/animations-guide)).

### Astryx 0.6.8

The project pins `@astryxdesign/core` 0.6.8 ([package.json](/packages/web/package.json)).

- **`SideNav`** takes `resizable` (`defaultWidth`, `minWidth`, `maxWidth`, `autoSaveId`) and
  `collapsible` (`hasButton`, a controlled `isCollapsed`). It renders its `ResizeHandle` revealed on
  hover or focus, hidden while collapsed, and its collapse button in the bottom row. Collapsing
  shrinks it to an icon rail, without a transition. `SideNavItem` takes `actions`, hidden while the
  rail is collapsed
  ([SideNav doc](https://raw.githubusercontent.com/facebook/astryx/main/packages/core/src/SideNav/SideNav.doc.mjs)).
- **`ResizeHandle`** follows the window splitter: arrows step 10 px, Shift 50 px, Home and End,
  Enter folds; a double-click toggles the fold. It takes the pointer, so a drag over an iframe is
  not lost
  ([Resizable spec](https://raw.githubusercontent.com/facebook/astryx/main/packages/core/src/Resizable/Resizable.spec.md),
  [ResizeHandle.tsx](https://raw.githubusercontent.com/facebook/astryx/main/packages/core/src/Resizable/ResizeHandle.tsx)).
- **`LayoutPanel`** takes `resizable` from `useResizable`, which keeps its size and fold in
  `localStorage` with `autoSaveId`
  ([LayoutPanel doc](https://raw.githubusercontent.com/facebook/astryx/main/packages/core/src/Layout/LayoutPanel.doc.mjs),
  [useResizable doc](https://raw.githubusercontent.com/facebook/astryx/main/packages/core/src/Resizable/useResizable.doc.mjs)).
- **`AppShell`** builds the phone's top bar from the `SideNav`'s header, with the drawer's toggle at
  the far right
  ([AppShell doc](https://raw.githubusercontent.com/facebook/astryx/main/packages/core/src/AppShell/AppShell.doc.mjs)).
- **`Button`**: `clickAction` runs in a transition, shows a spinner after 310 ms, dedupes double
  clicks, and keeps the focus with `aria-disabled` and `aria-busy`; `isLoading` shows it at once
  ([Button doc](https://github.com/facebook/astryx/blob/main/packages/core/src/Button/Button.doc.mjs),
  [busy changeset](https://github.com/facebook/astryx/blob/main/.changeset/button-busy-aria-disabled.md)).
  `ButtonGroup`'s `isDisabled` overrides its members
  ([button family](https://github.com/facebook/astryx/blob/main/docs/families/buttons.md)).
- `MoreMenu` is a "…" menu that becomes a bottom sheet on phones. `OverflowList` hides items by
  width only. There is no colour picker.
- The app adds its own icons, Lucide outlines registered through the theme
  ([icons.ts](/packages/web/src/theme/icons.ts)).

### react-resizable-panels and others

- react-resizable-panels 4.14.5 supports React 19, pixel sizes, collapsible panels, a double-click
  reset, and storage through `useDefaultLayout`
  ([README](https://raw.githubusercontent.com/bvaughn/react-resizable-panels/main/README.md),
  [CHANGELOG](https://raw.githubusercontent.com/bvaughn/react-resizable-panels/main/CHANGELOG.md)).
  allotment, react-split-pane, and re-resizable do the same with less keyboard support. React Aria
  and Base UI have no splitter. Astryx already covers the need, and the
  [UI components](/specs/decisions/ui-components.md) decision asks for Astryx wherever it has a
  component.
- shadcn's sidebar animates `width` over 200 ms, toggles with Cmd/Ctrl+B, keeps hover actions
  visible below 768 px and on focus, and its "rail" toggles on click without resizing
  ([sidebar.tsx](https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/new-york-v4/ui/sidebar.tsx)).

### Mobile navigation

- Apple puts the controls that go back or show a sidebar at the leading edge of a toolbar, and
  advises against hiding a sidebar by default and against critical items at its bottom
  ([toolbars](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/toolbars.json),
  [sidebars](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/sidebars.json)).
- Android's navigation icon sits at the left of the app bar; Up never shows on the start destination
  ([app bars](https://developer.android.com/develop/ui/compose/components/app-bars),
  [principles](https://developer.android.com/guide/navigation/principles)).
- NN/g: a left-aligned logo takes users home six times more often in one click; home links belong on
  interior pages ([homepage links](https://www.nngroup.com/articles/homepage-links/)).

### Feedback for slow actions

- NN/g: show progress past 1 s, use a spinner from 2 to 10 s with a short label, and a percent-done
  past 10 s ([response times](https://www.nngroup.com/articles/response-times-3-important-limits/),
  [progress indicators](https://www.nngroup.com/articles/progress-indicators/)).
- Primer avoids disabled buttons, which keyboard users cannot reach, prefers inline indicators, and
  keeps page-level loading for long processes or when the UI must be blocked
  ([loading](https://primer.style/product/ui-patterns/loading/),
  [button](https://primer.style/product/components/button/)). Fluent: "If only one section is
  loading, the spinner shouldn't block interaction with other sections"
  ([spinner](https://fluent2.microsoft.design/components/web/react/core/spinner/usage)). Carbon
  disables the controls tied to the action while it runs
  ([inline loading](https://carbondesignsystem.com/components/inline-loading/usage/)). Overlays that
  block everything are kept for critical processes like payments
  ([Halstack](https://developer.assure.dxc.com/halstack/16/components/spinner/)).
- Spinners wait 300 ms to 1 s before showing, and some stay 200 to 400 ms at least
  ([spin-delay](https://github.com/smeijer/spin-delay),
  [Learning Equality](https://design-system.learningequality.org/loaders)).
- `aria-disabled` keeps a control focusable, but its action must be blocked in code
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-disabled)).
- A global "in flight" state comes from a registry of pending work, like TanStack's `useIsMutating`
  ([docs](https://tanstack.com/query/latest/docs/framework/react/reference/useIsMutating)); fate has
  no such hook, and leaves loading states to the caller for imperative mutations
  ([actions](https://github.com/nkzw-tech/fate/blob/main/docs/guide/actions.md)).

### Optimistic updates

- fate's actions take an `optimistic` object that updates the cache at once, and roll it back if the
  mutation fails; the cache then takes the server's answer
  ([actions guide](https://github.com/nkzw-tech/fate/blob/main/docs/guide/actions.md), pinned
  1.7.7).
- React's `useOptimistic` state shows only while its action runs, and reverts when it ends
  ([useOptimistic](https://react.dev/reference/react/useOptimistic)).

### Git locks

- Git takes `index.lock` with `O_EXCL` and fails at once when it is taken
  ([lockfile API](https://git-scm.com/docs/api-lockfile)). `git commit` holds it while its
  pre-commit hook runs ([commit.c](https://github.com/git/git/blob/master/builtin/commit.c), read
  from the source), so a second commit in the same worktree fails while the first one's formatters
  run. GitHub Desktop queues its writes behind a reader-writer lock
  ([git concurrency](https://github.blog/news-insights/the-library/git-concurrency-in-github-desktop/)).

### Claude Code's end of a run

- In print mode, a `result` ends each turn, and background work can start more turns, each with its
  own result; results of injected follow-ups carry `origin: { kind: "task-notification" }`
  ([headless](https://code.claude.com/docs/en/headless),
  [TypeScript SDK](https://code.claude.com/docs/en/agent-sdk/typescript)).
- `background_tasks_changed` (2.1.203+) carries the full live set of background tasks;
  `task_notification` reports one finishing; `session_state_changed` (`running`, `idle`,
  `requires_action`) needs `CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS=1` (same SDK page).
- By default, a non-interactive session keeps reporting running past a turn while a background agent
  or workflow lives, but "background shell commands, such as a dev server, don't hold the running
  status" ([env vars](https://code.claude.com/docs/en/env-vars)).
- Background Bash in unattended sessions is limited to 30 minutes, at most 2 hours
  ([tools reference](https://code.claude.com/docs/en/tools-reference)).
- The Stop hook fires with a `background_tasks` list, to tell "done" from "paused waiting for
  background work" ([hooks](https://code.claude.com/docs/en/hooks)).

### Pull requests

- `gh pr list --head <branch> --json url,number,state,isDraft,reviewDecision` gives a branch's pull
  request ([gh pr list](https://cli.github.com/manual/gh_pr_list)); `gh pr view <branch>` gives one
  ([gh pr view](https://cli.github.com/manual/gh_pr_view)).
- GitHub's REST API allows 60 requests an hour unauthenticated and 5,000 authenticated; a `304` to a
  conditional request does not count
  ([rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api),
  [best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)).
- `git ls-remote origin 'refs/pull/*'` maps a tip to a pull request number without the API, but says
  nothing of its state
  ([checking out PRs](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/checking-out-pull-requests-locally),
  checked live on facebook/astryx).

### Browser notifications

- `http://127.0.0.1` and `http://localhost` are secure contexts, and so is `tailscale serve`'s
  `https://<machine>.<tailnet>.ts.net`: both may notify
  ([Secure Contexts](https://w3c.github.io/webappsec-secure-contexts/),
  [MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts),
  [Tailscale serve](https://tailscale.com/kb/1312/serve)).
- Firefox shows the permission prompt only after a click or a key press since version 72, and only
  an address-bar icon otherwise
  ([Mozilla](https://blog.mozilla.org/futurereleases/2019/11/04/restricting-notification-permission-prompts-in-firefox/));
  Safari needs a user gesture too ([WebKit](https://webkit.org/blog/12945/meet-web-push/)). Chrome
  turns a request without a gesture into a chip that collapses, and calls asking on load a bad
  practice ([permission chip](https://developer.chrome.com/blog/permissions-chip/)).
- A denied permission cannot be asked again by the page: only the browser's settings undo it
  ([permission UX](https://web.dev/articles/push-notifications-permissions-ux)). web.dev, Mozilla,
  Chrome, and NN/g all advise asking in context, after an in-page explanation
  ([NN/g](https://www.nngroup.com/articles/permission-requests/)).
- A page's `new Notification()` works on desktop browsers. On Android, Chrome only notifies from a
  service worker. On iOS, `Notification` does not exist in Safari tabs: only Home Screen web apps,
  from iOS 16.4, receive notifications, through Web Push
  ([MDN constructor](https://developer.mozilla.org/en-US/docs/Web/API/Notification/Notification),
  [WebKit iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
- Web Push reaches a closed tab through the browser vendor's push service: the server sends an
  encrypted POST, signed with VAPID keys, over outbound HTTPS only; the `web-push` npm package does
  it ([how push works](https://web.dev/articles/push-notifications-how-push-works),
  [web-push](https://github.com/web-push-libs/web-push)). Safari revokes the permission of a site
  that pushes without showing a notification
  ([Apple](https://developer.apple.com/tutorials/data/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers.json)).
- `tag` replaces a notification for the same subject; `requireInteraction` and `renotify` are Chrome
  only. Web Locks elect one tab among several
  ([showNotification](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification),
  [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)). The Page Visibility
  API tells whether the tab is in front
  ([Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)).
- The Badging API works for installed apps only, and not on Linux
  ([Badging API](https://developer.chrome.com/docs/capabilities/web-apis/badging-api)).
- ntfy and Pushover push to phones through their own apps, from a plain HTTP POST
  ([ntfy](https://docs.ntfy.sh/), [Pushover](https://pushover.net/api)).

## The code

### Important reads

- [`Shell.tsx`](/packages/web/src/Shell.tsx), 202 lines: Astryx `AppShell` with a `SideNav` that is
  `collapsible` and `resizable` (`autoSaveId: "uraeda.nav"`, 240 px, 200 to 360 px, line 133), the
  repository menu as its heading, the search on top, and the theme's `SegmentedControl` as its
  footer (lines 94 to 113). The chevron the proposal dislikes is Astryx's built-in collapse button.
  Folding shrinks the sidebar to an icon rail, without animation, and hides the search, the theme,
  the ＋ buttons, and the progress rows.
- [`SessionNav.tsx`](/packages/web/src/SessionNav.tsx), 355 lines, and
  [`SessionNavRows.tsx`](/packages/web/src/SessionNavRows.tsx), 178 lines: the sidebar's order is
  Home, Priorities ＋, Inbox ＋, New change, "Waiting on you", "Agents at work" with the Claude
  allowance bar ([`AgentsAtWork.tsx`](/packages/web/src/AgentsAtWork.tsx)), Chats with Archived, and
  Done. Features are grouped by who they wait on, not by kind; drafts are not in the sidebar. A
  feature's row is its slug, a status dot, a "Change" badge for changes, then a progress row during
  implementation only, and its running sub-agents. Its accessible name is "<slug>, <title>,
  [change,] <status>"; no step appears before implementation.
- [`SessionAside.tsx`](/packages/web/src/SessionAside.tsx), 405 lines: the session page's right
  column, "Progress", an Astryx `LayoutPanel` 320 px wide, not resizable, folded by "Hide progress"
  in the session's header, kept as `uraeda.sessionAside` in `localStorage`. A change has its own
  column, [`ChangeAside.tsx`](/packages/web/src/ChangeAside.tsx), the only place that shows a pull
  request, "Pull request #N", from the record.
- The phone's top bar is built by Astryx from the sidebar's heading: the repository menu at the
  left, the page's controls, then the drawer's toggle at the far right. No control goes home in one
  tap: home is in the drawer, the breadcrumbs, or the repository menu.
- [`AddRepository.tsx`](/packages/web/src/AddRepository.tsx), 127 lines: a Folder field with a list
  of up to 20 suggestions. Enter always adds the typed text; a suggestion only fills the field when
  clicked; the list has no arrow-key navigation.
- [`theme.tsx`](/packages/web/src/theme.tsx): the theme is per browser, in `localStorage` as
  `uraeda.theme`.
- Buttons that write use Astryx's `clickAction`: only the clicked button spins, after 310 ms, and
  its siblings stay enabled, like "Commit only" beside "Commit and start the agent"
  ([`CommitActions.tsx`](/packages/web/src/CommitActions.tsx)). The priorities' drag, a note's menu
  picks, removing a repository from its menu, and the composer's Stop show nothing while they run.
  There is no shared record of writes in flight.
- The core runs one write at a time for the whole server: a process-wide mutex, "One write at a
  time, whatever the repository" ([`api.rs`](/crates/core/src/api.rs), lines 111 to 119). A second
  click waits; it does not fail on git's lock.
- [`live.ts`](/packages/server/src/live.ts): the core's watcher reads the whole workspace again 200
  ms after the last change under `.git` or any `specs/`, then publishes what changed over fate's
  live views (Server-Sent Events). Each client then reads the changed views again.

### Status detection

- **Which branches are items.** [`Workspace::read`](/crates/core/src/workspace.rs) (lines 639
  to 715) lists every local branch and every `origin/` branch. A name `YYYY-MM-DD-<slug>` is a
  feature, `change/YYYY-MM-DD-<slug>` a change ([`paths.rs`](/crates/core/src/workspace/paths.rs)).
  A branch checked out nowhere needs its folder or record at its tip (lines 529 to 540, added by
  `9187d86`, "remove non-uraeda branches from the UI"). **A branch checked out in a worktree skips
  that check** (lines 515 to 528), and a dated folder on the main checkout's disk counts without a
  branch (lines 463 to 482).
- **Why `review-findings` showed.** Until `d19f35f` (2026-10-15), any `fix/<date>-<slug>` branch was
  a bug by its name alone, and `fix/2026-10-13-review-findings` had its own worktree, which skipped
  the check. Its branch has no spec folder. Today the `fix/` rule is gone, but the worktree bypass
  remains: a branch `2026-10-16-not-a-flow` in a worktree, without a folder, shows as "proposal.md:
  write it" (reproduced with `ura` 0.5.0 in a scratch repository). No test covers it.
- **Committed or on disk.** A branch with a worktree is read from that worktree's disk, uncommitted
  edits included; one without a worktree, from its tip. A file the agent saved with
  `status: awaiting-human` but has not committed already reads as a gate.
- **Pull requests.** [`steps.rs`](/crates/core/src/steps.rs) maps a pull request's state to the
  steps after the last task: none to `final-review`, a draft to `finish`, changes requested to
  `pull-request-changes`, open to `pull-request` waiting on the human. But `Workspace::read`, which
  every view reads, **always passes `Unknown`** (`workspace.rs` line 697), which maps to
  `pull-request` waiting on the agent (`steps.rs` line 284). `gh` runs only when a message is sent
  and for `ura next`. So from the last checked task to the merge, the UI reads "Pull request":
  through the final review, the draft, and the ready pull request alike. Basic security shows it
  today: `ura status` says `pull-request (pull request state unknown)` while `ura next` says
  `final-review`, and it has no pull request. Once the pull request is ready, its session reads
  "Needs attention, the agent stopped before a human gate", under "Agents at work"; the add
  bugfixing record lists it as a follow-up
  ([follow-ups](/specs/done/2026-10-15-add-bugfixing.md#follow-ups)).
- **Pull request addresses** come only from a finished item's record (`pull-request:` in its
  frontmatter, [`view/feature.rs`](/crates/core/src/view/feature.rs)). `gh` is asked only for
  `reviewDecision,isDraft`, not `url` or `number`.
- **When a run ends.** [`claude-events.ts`](/packages/server/src/runner/claude-events.ts) (lines 302
  to 313) keeps only `local_agent` and `local_workflow` tasks from `background_tasks_changed`,
  dropping shells and ambient tasks, "since shells and watchers may never end". A result with a
  sub-agent still running keeps the turn open; a result with a background shell running ends it
  ([`transcript.ts`](/packages/server/src/runner/transcript.ts), lines 229 to 276). When the shell
  reports back, output reopens the turn with "The agent went on by itself" (`f7212fa`). The local
  cache shows such reopenings in at least ten turns: each time, the status read "Needs you" or "New
  reply" in between. After a turn ends, the 15-minute idle timer can close the process while an
  uncounted shell still runs ([`turns.ts`](/packages/server/src/runner/turns.ts), lines 200 to 213).
- **Statuses.** [`status.ts`](/packages/server/src/runner/status.ts) applies, in order: Working (a
  turn running or queued), Needs you (a blocked action, or a step waiting on the human), Needs
  attention (a failed or stopped turn, or a run that ended while the step still waits on the agent),
  New reply, Idle. A feature without a session reads "Needs you" or "Idle" from its step.
- **Cost.** One `Workspace::read` takes about 25 ms on this repository (`ura status`, measured three
  times), but each fate read of a feature or session runs a full one, and a watcher burst sets off
  several. `gh pr list` for one branch took 429 ms.
- **States that can disagree**, and how the code settles them: local and `origin/` branches (local
  wins, `behind` counted); a branch only on `origin` (read from it); a worktree with uncommitted
  files (disk wins, flagged); merged on `origin/main` but not pulled (done); a merged feature with
  newer commits on its branch (done); `PRIORITIES.md` (the default branch's checkout, never
  `origin/main`).

### The proposal's path and existing actions

- **Starting the agent** from a commit button navigates to the session with the message prefilled;
  the agent starts when the human presses "Start the agent" in the composer
  ([`Composer.tsx`](/packages/web/src/Composer.tsx)). The status turns Working only once the server
  has opened the session, the process, and the turn, and published them.
- **Answering, approving, committing**: the human's commit moves the step; the sidebar learns it
  through the watcher, 200 ms after the commit, then a new read. The mutation's own answer does not
  carry the new step.
- **Folding the sidebar** keeps Home and the repository menu as icons, and each feature's status
  dot; it hides the progress rows, the search, and the ＋ buttons
  ([`layout.test.tsx`](/packages/web/src/__browser__/layout.test.tsx), "the folded navigation keeps
  Home and the repository menu").
- **Search** hides Home, Priorities, Inbox, and New change, and filters features and chats.
- **Removing a repository** is refused while an agent works; it is the only action in a repository
  row's "⋯" menu ([`RepositoryMenu.tsx`](/packages/web/src/RepositoryMenu.tsx)).
- **A feature's name** is its proposal's title, or its record's
  ([`view/feature.rs`](/crates/core/src/view/feature.rs), lines 121 to 126); the sidebar shows its
  slug, as the [UI layout](/specs/decisions/ui-layout.md) decision asks. The slug is in the folder,
  the branch, the worktree's path, every address `/f/<folder>/`, `PRIORITIES.md`'s link, and the
  commits' scopes. The session cache keys sessions by the folder.
- **Done features** are all listed at the end of the sidebar, after Chats, latest first, and all on
  Home under "Done". There is no list page for them.

### Overlaps with work in flight

- **Settings page** (`2026-10-16-settings-page`, round 01 awaiting answers): its settled points keep
  **the theme in the sidebar's footer**, "a choice of the device", the opposite of this proposal.
  Its Q5 recommends a Settings entry in the sidebar's footer, beside the theme, and says "the
  interface redesign in Now will build on" it. Its proposal asks to rename a repository's slug,
  which is a repository, not a feature. It names no notification setting.
- **Basic security** (`2026-10-16-basic-security`, implemented, not merged): adds Sign out and Sign
  out everywhere at the end of the repository menu, a sign-in page without the sidebar, and changes
  to `App.tsx`, `RepositoryMenu.tsx`, and `routes.tsx`. It does not touch `Shell.tsx` or the
  sidebar's rows. Its cookie is `SameSite=Lax` so that a link from a notification opens signed in.
- **Drafts that build on this one**: the feature page redesign also asks to "Show the PR URL", and
  names a slow "Commit and start the agent"; the clarifications redesign wants "Ask the agent" to
  open the session in the right sidebar; the priorities redesign keeps a constitution view out of
  the sidebar; the look and feel pass holds icons, the logo, and the misplaced `x` in the sidebar's
  failure mark; the flow review covers the transitions between pages.
- **Earlier choices**: the session view chose a sidebar "small and visual more than textual", by
  slug
  ([Q2](/specs/done/2026-10-14-session-view.md#q2-how-does-the-current-task-show-in-the-sidebar)),
  and the right column with its "Hide progress"; the chat feature set the statuses and left
  notifications for later
  ([Q9](/specs/done/2026-10-13-chat-in-the-web-ui.md#q9-what-else-ships-with-the-chat)).

### Rules and their owners

- **Steps and who they wait on**: the core, `steps.rs`; the web UI only labels them
  ([`labels.ts`](/packages/web/src/labels.ts)). The [stack](/specs/decisions/stack.md) decision
  forbids TypeScript from reimplementing workflow states, and the constitution's principle VI asks
  for one home per rule.
- **What counts as a feature or change**: the core, `workspace.rs` and `paths.rs`.
- **Pull request state**: the core, `steps.rs`, through `gh`.
- **Session statuses**: the server, `status.ts`; their marks, the web UI's
  [`StatusMark.tsx`](/packages/web/src/StatusMark.tsx).
- **When a turn ends**: the server, `transcript.ts` and `claude-events.ts`, under the
  [agents](/specs/decisions/agents.md) decision: "a turn is one message until the agent settles,
  after its background sub-agents report back, and reopens when the agent goes on by itself after
  it, as when a background shell reports back".
- **One write at a time**: the core's mutex.
- **Sidebar widths and folds**: Astryx's `useResizable`, in `localStorage`.

### Likely changes

- **Every option**: `crates/core/src/workspace.rs` (the folder-or-record rule for every branch,
  steps from commits, pull requests on the read path), `steps.rs` (the pull request's address),
  `crates/core/src/view/feature.rs`, the binding's generated types,
  `packages/server/src/runner/claude-events.ts` and `transcript.ts`, `status.ts`,
  `packages/web/src/Shell.tsx`, `SessionNav.tsx` (355 lines, to split before it grows),
  `SessionNavRows.tsx`, `SessionAside.tsx` (405 lines), `AddRepository.tsx`, `labels.ts`,
  `theme/icons.ts`, new stories next to the shell's components, and their tests.
- **Organising the sidebar by concept**: `SessionNav.tsx`, `AgentsAtWork.tsx`, `Home.tsx` if home
  follows, and the workspace view for drafts (`data.ts`, 474 lines, near the 500-line limit).
- **Notifications**: a new module in `packages/web/src/`, reading the global client's data across
  repositories; with Web Push, a service worker, a manifest, `web-push` on the server, and VAPID
  keys in the data folder.
- **Feedback for writes**: a shared record of writes in flight in `packages/web/src/`, used by every
  button listed in [important reads](#important-reads).
- **Renaming and colouring**: depends on where they are kept, from a browser store to a file in the
  server's data folder, or the proposal's title and a git commit.
- **Addresses**: `routes.tsx` (482 lines) is near the limit, and must be split before any change.
- **Theme**: `Shell.tsx`, `theme.tsx`, and the settings page's files, or the repository menu.

## The proposal

### The theme's new home does not exist yet

The proposal removes the theme from the sidebar "as part of the settings page", but that page is
still in its first round, whose settled points keep the theme in the sidebar. Whichever feature
merges first decides where the theme sits in between. See [overlaps](#overlaps-with-work-in-flight).

### Asking for permission on the first visit

"Ask for permission to send notification on first accessing the page" cannot work as written:
Firefox and Safari ignore a request made without a click, and Chrome reduces it to a chip that
collapses. See [browser notifications](#browser-notifications).

### Notifications on the phone

The human reaches Uraeda from an iPhone through `tailscale serve`. Safari tabs on iOS cannot notify
at all: only a Home Screen web app with Web Push can, which is a much larger piece of work than
notifying from an open tab.

### Graying out every button

"Spinner + graying out all buttons on the page" goes further than every design system read: they
keep page-wide blocking for critical processes, and avoid native `disabled`, which keyboard users
cannot reach. The server already queues writes, so a second write is not lost.

### Optimistic statuses and the core's rules

The core is the only owner of the next step. A client that guesses the next status of an action,
like "Waiting on the agent" after answering, would copy the workflow's table into TypeScript, which
the stack decision forbids.

### Background commands

"Including sub-agents or background comments": the server already waits for sub-agents. Background
shells are the gap, and the agents decision says they do not hold a turn. Claude Code itself treats
them the same way, since a dev server never ends.

### Renaming a feature

The sidebar shows a feature's slug, not its title. A rename can mean a label in the sidebar, the
proposal's title, or the slug itself, which is in the branch, the folder, the worktree, every
address, and the open pull request's branch.

### The last five done features "only if there's room"

No product read hides a list by the sidebar's height: they limit it by count, filter it, or archive
it. Apple advises against critical items at a sidebar's bottom; done features are not critical. The
proposal does not say what `...` opens.

### The URLs

The opening paragraph lists "the URLs" among what the feature redesigns, but no item asks for a
change: the draft's "Better URLs ... right now it's a bit messy" did not reach the proposal.

### The hierarchy and moving between states

The proposal asks the sidebar to show Inbox > Priorities > Draft > Change > Feature, and that "it
should be easy to go from one state to another". The sidebar today groups by who waits, has no
drafts, and moves nothing; the [flow review](/specs/drafts/flow-review.md) is planned to review the
transitions between pages later.

### A broken link

The proposal's link to the look and feel pass points to `look-and-feel.md` in the feature's folder;
the draft is [`specs/drafts/look-and-feel.md`](/specs/drafts/look-and-feel.md).

## Approaches

### Splitting the feature

What the feature covers: five strands that touch different layers. Criteria: the proposal's intent,
review effort (principle IV), and dependencies between strands.

- **One feature, built in order**: statuses first, since the sidebar's step, notifications, and
  optimistic statuses all show them; then the sidebar; then notifications and feedback. One spec,
  long, with one review.
- **Statuses and notifications as their own feature**: core and server work, reviewed apart from the
  shell's look and behaviour. Two specs, and the sidebar's step waits on the other.
- **Three features**: statuses, shell, notifications. The smallest specs, three rounds of review.

### Organising the sidebar by concept

What the sidebar groups by. Relies on [important reads](#important-reads) and [Linear](#linear).
Criteria: the hierarchy the proposal asks for, the [UI layout](/specs/decisions/ui-layout.md)
decision's "short and visual", and seeing what waits on the human.

- **Sections by concept in the flow's order**: Inbox and Priorities with counts, Drafts, Changes,
  Features, each item with its step and status; what waits on the human sorted first within each
  section, and counted on Home's row. Shows the hierarchy; loses the "Waiting on you" group.
- **Today's groups by who waits, with the concepts added**: Inbox, Priorities, and Drafts rows with
  counts above, and a kind icon on each item. Keeps the human's queue in one place; the hierarchy
  shows only in icons.
- **Both**: a "Needs you" group at the top, then the sections by concept for the rest. Each item
  appears once, the queue first.

### Moving an item to its next state

Whether the sidebar moves items. Criteria: the proposal's "easy to go from one state to another",
the flow review's planned scope, and reuse of the core's existing actions (start as a feature or a
change, make a draft, move a note to the priorities).

- **The row's "…" menu holds the item's next moves**, reusing the existing actions: a draft starts
  as a feature or a change, a note becomes a draft or a priority.
- **No moves in the sidebar**: it shows the hierarchy; the pages keep the actions, and the flow
  review revisits them.

### Showing the step on a row

How a feature's step shows before implementation. Criteria: "small and visual"
([session view Q2](/specs/done/2026-10-14-session-view.md#q2-how-does-the-current-task-show-in-the-sidebar)),
accessible names, and the look and feel pass coming later.

- **An icon per step** at the row's end (questions, spec, plan, implementation, review, pull
  request), in the accessible name, with the progress row kept during implementation.
- **A short word under the slug**, like the progress row: "Spec", "Questions 01".
- **A ring of the steps done**, filled to the step's position: compact, but ClickUp's users report
  that filling circles imply a linear order that blocked or waiting states break
  ([feature request](https://feedback.clickup.com/feature-requests/p/status-progress-icons-assume-too-much)).

### Hiding and resizing the sidebars

What hiding does, and how. Relies on [Astryx](#astryx-068) and
[what they have in common](#what-they-have-in-common).

- **Hide completely**, with a hide button at the sidebar's top shown on hover and focus, a show
  button at the page's top left when hidden, the edge handle to resize, a snap closed below the
  minimum, a shortcut, and a slide. The rail and its status dots go.
- **Keep the icon rail** as the folded state, with the button moved to the top and an animation.
- **Either, plus a peek**: a hidden sidebar slides over the page when the pointer reaches the
  window's left edge, like GitLab and claude.ai.

### Done features

What the last five done features look like. Relies on
[the proposal's gap](#the-last-five-done-features-only-if-theres-room).

- **Pinned at the sidebar's bottom**, up to five, losing the oldest rows as the window gets shorter,
  and gone when none fits; "…" opens Home's Done group.
- **Pinned at the bottom, "…" unfolds** the full list in place, the section then scrolling.
- **At the end of the list, not pinned**, up to five, with "…": shown whatever the height.

### Where the theme goes

Relies on [the theme's new home](#the-themes-new-home-does-not-exist-yet).

- **Into the settings page, and the repository menu until that page is merged.**
- **This feature waits for the settings page**, and removes the theme once it has a home.
- **The theme follows the system** until the settings page exists, with no switch.

### When a run is over

What holds a run's "Working". Relies on [the end of a run](#claude-codes-end-of-a-run) and
[status detection](#status-detection). Criteria: never "Needs you" while work goes on; a run must
end.

- **Every background task holds the turn**, shells included, within Claude Code's own limit for
  background shells (30 minutes, 2 hours at most): the agents decision changes.
- **Shells hold the turn only in workflow runs**, not in chats, where the human may start a server.
- **As today**, with a "background command running" mark next to the status.

### Feedback for git writes

Relies on [feedback for slow actions](#feedback-for-slow-actions) and
[graying out every button](#graying-out-every-button).

- **The clicked button spins at once, with a word saying what it does; every other button that
  writes is blocked**, kept focusable, until the write ends, the sidebar's included; reading and
  navigating stay usable; a thin bar at the top of the page while a write runs.
- **Every button of the page grayed out**, as the proposal says.
- **An overlay over the page** while a commit runs.

### Optimistic statuses

Relies on [optimistic updates](#optimistic-updates) and
[the core's rules](#optimistic-statuses-and-the-cores-rules).

- **The row shows the action itself at once**, "Committing…", "Starting the agent…", until the
  server's status arrives or 10 seconds pass; nothing guesses the next step.
- **The client guesses the next status** from the action, like "Agents at work" after answering:
  instant, but a second copy of the workflow's table, against the stack decision.
- **The server answers each write with the new step**, computed by the core right after the commit:
  no guess, but the button waits for the commit's hooks, and a run's start still waits for the
  process.

### Notification events

What notifies. Criteria: "ping the user when input is needed".

- **Only what needs the human**: a step waiting on them once the run is over, a blocked action, a
  failed or halted run, a pull request ready.
- **The same, plus every finished reply in a chat.**
- **Every status change.**

### Asking for permission

Relies on [asking on the first visit](#asking-for-permission-on-the-first-visit).

- **A banner on the first visit**, explaining what notifies, with "Turn on" asking the browser and
  "Not now" remembered in the browser; the same switch later in the settings page.
- **Ask the browser on load**, as written: ignored by Firefox and Safari.
- **Only from the settings page.**

### Notifications on the phone and with the tab closed

Relies on [notifications on the phone](#notifications-on-the-phone).

- **Notifications from an open tab only**, on desktop browsers, and the tab's title counting what
  waits ("(2) Uraeda"); Web Push later.
- **Web Push now**: a service worker, a manifest, the `web-push` package, and VAPID keys, so a
  closed tab and an iPhone Home Screen app are notified.
- **A push service like ntfy**, posted by the server: the phone needs ntfy's app.

### Renaming and colouring a feature

Relies on [renaming a feature](#renaming-a-feature) and
[the sidebar products](#github-slack-figma-zed-obsidian-jetbrains).

- **A label and a colour kept by the server** in its data folder, per repository and folder: git is
  untouched, every device sees them.
- **A label and a colour kept in the browser**, like the sidebar's width: each device has its own.
- **The proposal's title renamed**, with a commit on the branch, and the sidebar showing titles; the
  colour kept by the server.
- **The slug renamed**: branch, folder, worktree, addresses, priorities link, and the pull request's
  branch.

### Addresses

- **Today's addresses**, with only what new views need.
- **Addresses named after the concepts**, `/features/<folder>`, `/changes/<folder>`,
  `/drafts/<name>`, with redirects from the old ones.

### Needs no choice

- **Only real workflow items**: the folder-or-record rule applies to every branch, worktree or not,
  and a dated folder on disk without a branch is no item; the human's words decide it.
- **Steps from commits**: the human asked to "focus on the committed state of all worktrees"; each
  worktree's step comes from its checked-out commit, and uncommitted files stay a flag.
- **Pull request state on the read path**: `gh` already gives it, with its address; the steps
  already map each state.
- **The idle timer** must not close a process whose background tasks still run, whatever holds the
  turn.
- **The right column** follows the left's pattern with Astryx's `LayoutPanel` and `ResizeHandle`.
- **The phone's home button**: the top bar's leading edge is where Apple and Android put navigation.
- **Enter in the add-a-repository dialog** with one suggestion: the field becomes a list the
  keyboard drives, as Astryx's `Typeahead` does.
- **Shortcuts**: products use `[`, Ctrl+B, or Cmd+\\; the
  [UI behaviour](/specs/decisions/ui-behaviour.md) decision forbids shortcuts while a text field has
  the focus.
- **Duplicate notifications** across tabs: `tag` and Web Locks.
- **Hover-only controls**: the UI behaviour decision forbids them; touch and keyboard always see the
  "…" and the hide button.
- **A colour's palette**: a fixed palette from the theme, never the only cue, like GitHub Projects'
  8 colours.

## Not checked

- Linear's resizable sidebars and its status icons (snippet only), its custom colour picker (snippet
  only), and its workflow configuration page (404).
- help.openai.com (403): ChatGPT's sidebar rename and project colours.
- Slack's notification permission banner (429) and its sidebar width.
- m3.material.io and m2.material.io (rendered empty).
- Chrome's abusive notification enforcement posts (snippets only), Firefox's support page on
  re-enabling notifications.
- Whether iOS 26 Home Screen apps receive Web Push without a manifest.
- NN/g's disabled buttons article (404), Atlassian's loading button page (404).
- Why "Commit and start the agent" took many seconds in the bugfixing flow: the time was not
  measured; the feature page redesign names it.
- `gh pr view`'s exit code when a branch has no pull request.
