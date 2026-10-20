# Discovery, round 01: Merge chats and changes

## Summary

Agentic coding tools converge on one composer, with a mode or an environment picked before the first
message, and on binding a conversation to a branch late: a chat starts locally and moves into a
worktree, with its history, when the work grows. Products differ on whether uncommitted work moves
with it, on whether the history moves whole or as a summary, and on who triggers the move: a button
almost everywhere, the agent itself rarely.

The proposal asks for that ladder in Uraeda: a chat, then a change, then a feature, with smooth
moves up, the agent able to offer or perform them, and a `+` next to Features like the one next to
Changes and Chats.

Today the three are separate. A chat is a row in the server's session cache, always in the main
checkout, with nothing in git. A change and a feature are started from a draft or the "New change"
page, each with its own branch, worktree, and session. Nothing moves a session from a chat to a
change: the skill's rule 8 has the agent start a change as a new session, and "the chat stays a
chat". A change becomes a feature by reverting its code, postponing its folder to `drafts/`,
merging, and starting the draft again as a new feature, with a new session.

## How other products do it

### Kiro

- A session starts in a mode picked in the session picker: Vibe, for "interactive Q&A-focused
  sessions", or Spec, for "complex development tasks"
  ([Vibe docs, mirror](https://alpha.us-east-2.kiro.adc.aws.dev/docs/chat/vibe/)).
- Vibe is now the Default agent. The agent selector in the chat input switches mid-session, "the
  switch takes effect immediately for your next message", and "the agent sees prior messages". The
  selector is disabled while a multi-step workflow runs
  ([Kiro chat](https://kiro.dev/docs/ide/chat/)).
- Specs start from a `+` under Specs, or from Spec in the chat, then ask "Feature or Bug". A Bugfix
  spec and a Quick Spec, all three files in one pass with no approval gates, are the light tiers
  ([Kiro specs](https://kiro.dev/docs/specs/)).
- Specs are files in the repository, with no branch of their own (same page).
- Users complain of heavy specs for small tasks, which Quick Spec answers, and of specs drifting
  from code (search snippet only:
  [DevClass](https://devclass.com/2025/07/15/hands-on-with-kiro-the-aws-preview-of-an-agentic-ai-ide-driven-by-specifications/)).

### Cursor

- A mode picker in the agent input chooses Agent, Plan, and others. Cursor suggests Plan Mode by
  itself for complex tasks, and a plan is built with one click
  ([modes](https://cursor.com/docs/agent/modes)).
- An agent can start in a worktree, or an existing agent can be moved into one. `/apply-worktree`
  brings its changes back to the main checkout
  ([worktrees](https://cursor.com/docs/configuration/worktrees)).
- Cloud agents work "on a separate branch, then push changes … for handoff", with merge-ready pull
  requests ([cloud agent](https://cursor.com/docs/cloud-agent)). An agent moves between cloud and
  local ([agents window](https://cursor.com/docs/agent/agents-window)).
- Forum reports of lost edits when the worktree and the project path diverge (search snippets only:
  [lost edits](https://forum.cursor.com/t/lost-edits-work-ide-agent-worktree-and-canonical-project-path-diverge/154663),
  [worktree lost](https://forum.cursor.com/t/worktree-lost-when-model-switches/154077)).

### Claude Code

- Plan mode: no edits until the plan is approved, with an option to approve and clear the planning
  context ([permission modes](https://code.claude.com/docs/en/permission-modes)).
- Asked to "work in a worktree" mid-session, Claude calls `EnterWorktree`, and the transcript
  follows the session to the new folder. The worktree starts from `origin/HEAD` or the local `HEAD`:
  uncommitted changes in the main checkout are not documented as carried
  ([worktrees](https://code.claude.com/docs/en/worktrees)).
- The desktop app has a Worktree toggle set before the first message. "Open in → Cloud" continues a
  session "with your conversation carried over as a summary"
  ([desktop](https://code.claude.com/docs/en/desktop), first part read).
- Teleporting a cloud session to the terminal needs a clean working tree
  ([on the web](https://code.claude.com/docs/en/claude-code-on-the-web)).
- Issues ask for a warning before a worktree overwrites uncommitted work, and for session state to
  persist across worktrees (search snippets only:
  [#72467](https://claudeissues.com/issue/72467-feature-warn-user-immediately-when-session-opens-inside-a-worktree-before-allowi),
  [#15776](https://claudeissues.com/issue/15776-session-state-should-persist-across-git-worktrees)).

### OpenAI Codex

- A chat picks "This computer" or "Cloud", then the current checkout or a worktree
  ([modes](https://learn.chatgpt.com/docs/environments/modes)).
- Starting a worktree from a branch with local changes, "Codex applies the uncommitted changes to
  the worktree as well". A **Hand off** button moves the chat between Local and Worktree: "moves
  your chat and code". **Create branch here** names the worktree's detached `HEAD`
  ([worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees)).
- Reports of handoffs failing once a branch was created in the worktree (third party, search snippet
  only:
  [worktree lifecycle](https://codex.danielvaughan.com/2026/04/11/codex-app-worktree-lifecycle-local-environments/)).

### GitHub Copilot

- A Session Target dropdown in the chat input, or `/delegate`, hands a local chat to a cloud agent,
  which "carries the conversation history and context with it"
  ([cloud agents](https://code.visualstudio.com/docs/copilot/agents/cloud-agents)).
- With uncommitted changes, the delegate button asks "Include changes" or "Ignore changes". The
  agent answers with a link to the pull request it opens
  ([cloud agent in your IDE](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-in-your-ide)).

### Conductor and Vibe Kanban

- Conductor: "the workspace is the unit of delegation", each with its own branch and worktree. The
  agent renames the branch to match the work once the first chat starts
  ([workspaces and branches](https://www.conductor.build/docs/concepts/workspaces-and-branches),
  [workflow](https://www.conductor.build/docs/concepts/workflow)).
- Vibe Kanban: a task gets a worktree on `vk/<id>-<slug>`, holding several conversations
  ([creating workspaces](https://www.vibekanban.com/docs/workspaces/creating-workspaces)).

### Spec Kit and superpowers

- Spec Kit's bug extension is an entry point of its own: "No SDD feature workflow is required
  first". The branch is a hook, independent of the spec folder's name
  ([Spec Kit](https://github.com/github/spec-kit),
  [specify](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/specify.md)).
- superpowers sizes the work first: a quick task is just done, a small change stays in the chat, a
  project gets a design. If the work grows midway: "stop, say so, and step up a size"
  ([brainstorming](https://raw.githubusercontent.com/obra/superpowers/main/skills/brainstorming/SKILL.md)).
  Its worktree comes after the design, not at the start
  ([using git worktrees](https://raw.githubusercontent.com/obra/superpowers/main/skills/using-git-worktrees/SKILL.md)).

### What they have in common

1. One composer, with a mode or an environment chosen before the first message. No product has a
   separate "new change" screen.
2. A switch inside a session keeps the conversation, whole or as a summary.
3. A conversation binds to a branch or a worktree late, once the work grows. The branch is often
   named after the work, once it is known.
4. Uncommitted work moves with the conversation (Codex), or the user picks (Copilot). Claude Code
   leaves it, and users write handoff skills around it.
5. The agent may suggest stepping up (Cursor, superpowers). The move itself is a human's button
   almost everywhere.
6. A light tier sits between chat and full spec: Kiro's Quick and Bugfix specs, Spec Kit's bug
   extension, superpowers' small change.
7. Going back down, from a spec to a chat, is not a documented move anywhere read.

## Standards and libraries

### Claude Code's sessions

- `claude --resume <id>` from another folder than the one the session started in finds it: checked
  with Claude Code 2.1.304, in two temporary folders, the second session recalled a word given to
  the first. The transcript stays in the first folder's project directory, and its new lines record
  the new `cwd`.
- Uraeda's [`hasSession`](/packages/server/src/runner/claude.ts) scans every project directory, so
  it finds a moved session's transcript.

### git worktrees

- A branch checked out in a worktree can be renamed with `git branch -m` from the main checkout, and
  the worktree follows it: checked with a throwaway repository.
- A branch cannot be checked out in two places at once, the pitfall Codex's docs name
  ([worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees)). Uraeda never switches
  the human's checkout ([git decision](/specs/decisions/git.md)).

## The code

### Important reads

- [`runner/sessions.ts`](/packages/server/src/runner/sessions.ts): `featureSession` gets or creates
  a folder's session, `newChat` one with `folder: null`. `rename` and `archive` refuse a feature's
  session.
- [`runner/cache.ts`](/packages/server/src/runner/cache.ts) and
  [`runner/migrations.ts`](/packages/server/src/runner/migrations.ts): sessions live in
  `runner.sqlite`, in Uraeda's data folder. `folder` is NULL for a chat, unique per repository
  otherwise, and set once: `updateSession` changes only the agent's id, the title, and the seen and
  archived dates.
- [`runner/processes.ts`](/packages/server/src/runner/processes.ts): the working folder is computed
  at each process start, the main checkout for a chat, `binding.workDir` otherwise.
- [`runner/message.ts`](/packages/server/src/runner/message.ts): a chat gets no opening line. A chat
  on a feature gets `chatOpening`; a run gets `runMessage`, a `/uraeda` command per step.
- [`fate/mutations.ts`](/packages/server/src/fate/mutations.ts): `session.newChat`, `change.start`
  (`startTypedChange`), and `feature.start` with a kind.
- [`sidebar/Sidebar.tsx`](/packages/web/src/sidebar/Sidebar.tsx): sections in order Home, Needs you,
  Inbox and Priorities with their `+` buttons, Changes with a "＋ New change" row, Features with no
  add row, then Chats with "＋ New chat". A chat is a row whose folder is null.
- [`NewChangePage.tsx`](/packages/web/src/NewChangePage.tsx): a composer and a slug field, "Start
  the change". Features start only from a draft, in the editor or the priorities pane
  ([`useEditorActions.ts`](/packages/web/src/useEditorActions.ts)).
- [`workspace/paths.rs`](/crates/core/src/workspace/paths.rs): a change is told from a feature only
  by its branch's `change/` prefix and its folder under `specs/changes/`. The dated folder name and
  the worktree, `.worktrees/<folder>/`, are the same for both.
- [`steps.rs`](/crates/core/src/steps.rs): `change_step` and the feature steps are separate state
  machines over the same folder files.

### The proposal's path and existing actions

- **New chat**: opens `/chats/new`, runs in the main checkout, titled by its first line. Unchanged
  by the feature unless chats start in a worktree.
- **A chat asks for code**: the skill's rule 8 has the agent answer with a draft's title, text, and
  slug, and start a change on yes, as a new session at `/f/<folder>`
  ([SKILL.md](/skills/uraeda/SKILL.md),
  [change.md](/skills/uraeda/references/change.md#starting-a-change)). Nothing in the code shows the
  offer: it is plain text in the transcript.
- **A chat edits files on the main checkout** before any offer: the edits stay uncommitted on the
  default branch, mixed with any of the human's. The stored tool calls keep each call's target, so
  the files a chat's edit and write tools touched are known; files changed by shell commands are not
  ([chat's right column draft](/specs/drafts/chat-right-column.md)).
- **Upgrading a change**: a round asks "Make this change a feature?". On yes, the agent reverts the
  code, moves the folder to `drafts/`, merges into the default branch, removes the worktree and
  branch, and the human starts the draft again
  ([change.md](/skills/uraeda/references/change.md#upgrading)). No code supports it.
- **Rename and archive**: allowed for a chat, refused for a feature's or change's session. A chat
  that becomes a change loses both.
- **Needs you**: a change waiting on the human and a blocked chat both show there
  ([notifications decision](/specs/decisions/notifications.md)).
- **Search**: covers features and chats
  ([`fate/sessions.ts`](/packages/server/src/fate/sessions.ts)).
- **Inbox triage and the decisions check** run as chats on the main checkout, since drafts and
  priorities are written on the default branch ([git decision](/specs/decisions/git.md)).

### Other features in flight

- Fix testing, on branch `2026-10-19-fix-testing`, changes the toolchain decision and the test
  setup: the tests that pin chats and changes apart may move. No overlap on behaviour.
- Inbox screenshots, on branch `change/2026-10-20-inbox-images`, touches the inbox pane only.
- Drafts that overlap: [flow review](/specs/drafts/flow-review.md) (the transitions Inbox,
  Priorities, Draft, Change, Feature), [chat's right column](/specs/drafts/chat-right-column.md),
  and [worker lifecycle](/specs/drafts/worker-lifecycle.md) (session identity across restarts).

### Rules and their owners

- **One session per feature, in its worktree**: the [agents decision](/specs/decisions/agents.md),
  enforced by the cache's unique index and `featureSession`. A chat's session becoming a change's
  touches this rule's wording.
- **Sessions are a cache, never workflow state**: the same decision, and constitution principle III.
  A chat's link to its change must therefore be recoverable from git, or not matter.
- **Starting a feature or a change is a human action**:
  [projects](/skills/uraeda/references/projects.md), and SKILL.md rule 8 ("Start it only on their
  yes").
- **What a chat may do on the main checkout**: SKILL.md rule 8 and
  [change.md](/skills/uraeda/references/change.md#starting-a-change): typos, formatting, and
  comments stay in the chat; any other code change is offered as a change.
- **Kind of a branch**: [`paths.rs`](/crates/core/src/workspace/paths.rs) owns it, read by
  `ura next`, `ura status`, and the server through the binding.

### Likely changes

- [`runner/sessions.ts`](/packages/server/src/runner/sessions.ts),
  [`cache.ts`](/packages/server/src/runner/cache.ts): a session's folder set once, from null, on an
  upgrade, under every option that keeps the chat's session.
- [`runner/message.ts`](/packages/server/src/runner/message.ts): an opening line telling the agent
  it now works in a change's worktree.
- [`fate/mutations.ts`](/packages/server/src/fate/mutations.ts): a mutation upgrading a chat, built
  on `startTypedChange`.
- [`sidebar/Sidebar.tsx`](/packages/web/src/sidebar/Sidebar.tsx),
  [`NewChangePage.tsx`](/packages/web/src/NewChangePage.tsx),
  [`routes.tsx`](/packages/web/src/routes.tsx): the merged section and the features' `+`, with the
  sidebar's tests and stories.
- [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx): the offer as an action, and an upgrade
  control.
- [`crates/core/src/actions/start/`](/crates/core/src/actions/start/) and the CLI: an in-place
  upgrade of a change to a feature, with the in-place option of
  [change to feature](#change-to-feature).
- [`SKILL.md`](/skills/uraeda/SKILL.md) rule 8, [`change.md`](/skills/uraeda/references/change.md),
  [`projects.md`](/skills/uraeda/references/projects.md),
  [`cli.md`](/skills/uraeda/references/cli.md), and the example change if the upgrade's files
  change.
- [`specs/decisions/agents.md`](/specs/decisions/agents.md): its session rule.

## The proposal

### What "merge" means

The proposal says "merge chats and changes", and also that a change is a chat that grew. The first
reads as one concept in the UI, the second as two stages of one thing. The skill's change flow, with
its tests, review, and pull request, is not in question: what merges is how a human starts and sees
them.

### What a chat may change

"Chat = chit chat or targeted change … ~ normal Claude Code" lets a chat edit code on the main
checkout. The skill's rule 8 today allows only typos, formatting, and comments there. The line
between a chat's targeted change and a change is open.

### Who upgrades

"The agent should be able to upgrade it itself too if necessary, or at least offer it". Starting a
change is a human action today, under constitution principle I and rule 8.

### Smooth switching

Upgrading a change to a feature takes a merge into the default branch and a fresh start today. A
smooth switch needs it in place, on the same branch. Going down, from a feature to a change, is not
mentioned.

### The features' `+`

"If there's a `+` near changes/chats there should also be one near features" does not say what it
opens: a typed proposal, like New change, or a draft.

## Worth it and feasibility

- **Gain**: one place to start talking to the agent, and work that grows keeps its conversation.
  Every product read has moved this way. The `+` next to Features removes a detour through a draft.
- **Cost**: a session's folder becomes settable, with a new opening line; a merged sidebar and its
  tests; an upgrade control; the skill's rule 8 and upgrade section; an in-place change-to-feature
  move in the core, the CLI, and the skill. Five stories at most: under the split rule.
- **Outside behaviour**: a Claude Code session resumes from another folder, checked above with
  2.1.304. Renaming a branch checked out in a worktree works, checked above. Moving a chat's
  uncommitted edits off the main checkout is not checked: it depends on the option chosen.
- **Guards**: an agent allowed to start a change by itself could create branches, worktrees, and a
  commit on the default branch (the **Now** entry) without the human's yes.

## Approaches

Criteria: the proposal's smooth switching and agent-driven upgrades; constitution principles I
(humans decide), III (state in git, sessions a cache), and VI (simple code); the
[agents](/specs/decisions/agents.md) and [git](/specs/decisions/git.md) decisions.

### The sidebar

How chats and changes show and start. See [what they have in common](#what-they-have-in-common).

| Option                                                                                    | One concept | Starting a change directly  | Code                         |
| ----------------------------------------------------------------------------------------- | ----------- | --------------------------- | ---------------------------- |
| A. One section, chats and changes together, one "New chat", a change row showing its step | yes         | through a chat, or a draft  | sidebar, routes, New change  |
| B. One section, and a New chat page with a "Start as a change" toggle                     | yes         | yes, from the same composer | A, plus a toggle on the page |
| C. Two sections as today, with upgrade moves added                                        | no          | yes, as today               | none in the sidebar          |

### Where a chat works

| Option                                           | Chit chat    | Isolation of edits       | Cost                                                 |
| ------------------------------------------------ | ------------ | ------------------------ | ---------------------------------------------------- |
| A. The main checkout, as today                   | direct       | none, mixed with human's | upgrade must move edits                              |
| B. A worktree per chat, detached, from the start | slower start | full                     | a worktree per chat, cleanup, drafts still need main |
| C. Picked per chat                               | either       | either                   | both paths                                           |

### Moving a chat's edits

Only with option A of [where a chat works](#where-a-chat-works).

| Option                                                            | Human's own edits | Completeness                        |
| ----------------------------------------------------------------- | ----------------- | ----------------------------------- |
| A. Move the files the chat's tools edited, leave the rest         | safe              | misses files shell commands changed |
| B. Move every uncommitted change, after listing them              | moved too         | complete                            |
| C. Move nothing: the change redoes the work from the conversation | safe              | redone, main keeps a stale copy     |

### Keeping the session

| Option                                                      | History      | Agents decision |
| ----------------------------------------------------------- | ------------ | --------------- |
| A. The chat's session becomes the change's, in its worktree | whole        | rule reworded   |
| B. A new session, its first message linking the chat        | as a summary | unchanged       |

### Who upgrades

| Option                                                                  | Principle I | Smoothness            |
| ----------------------------------------------------------------------- | ----------- | --------------------- |
| A. The agent offers, and the human accepts in one click; a button too   | kept        | one click             |
| B. The agent upgrades by itself when the work calls for it, and says so | relaxed     | none                  |
| C. A button only                                                        | kept        | the human must notice |

### Change to feature

| Option                                                                             | Steps             | Code already written      |
| ---------------------------------------------------------------------------------- | ----------------- | ------------------------- |
| A. In place: rename the branch, move the folder, revert the code, keep the session | one move          | reverted, kept in history |
| B. In place, keeping the code on the branch                                        | one move          | kept, before any spec     |
| C. As today: postpone, merge, start again                                          | merge and restart | reverted, new session     |

### What a chat may change

| Option                                                                                  | Like Claude Code | Default branch     |
| --------------------------------------------------------------------------------------- | ---------------- | ------------------ |
| A. Targeted edits the human asks for, left uncommitted; larger work offered as a change | mostly           | uncommitted edits  |
| B. Today's rule: typos, formatting, comments only                                       | no               | clean              |
| C. Anything, commits included                                                           | yes              | unreviewed commits |

### The features' `+`

| Option                                                          | Reuse             | Ends at              |
| --------------------------------------------------------------- | ----------------- | -------------------- |
| A. A New feature page: a typed proposal, a slug, then discovery | New change's page | a started feature    |
| B. A new draft in the editor                                    | the editor        | a draft, not started |
| C. A chat that helps write the proposal, then starts it         | the upgrade       | a started feature    |

### Going down

| Option                                           | Cost           |
| ------------------------------------------------ | -------------- |
| A. No downgrade: postpone or drop as today       | none           |
| B. A feature before its spec can become a change | a reverse move |

### Needs no choice

- **A light tier between chat and spec**: the change is that tier already.
- **The pull request as a button**: a change's run opens it already.
- **History as a summary**: only matters with a new session, under
  [keeping the session](#keeping-the-session).
- **Branch named after the work**: the upgrade names it from the slug, as `ura start` does.

## Not checked

- Kiro's issues, and whether a Default chat has a "generate spec from this chat" action.
- The second half of Claude Code's desktop page, and what exactly moves under "Open in → Cloud".
- Codex's local-to-cloud delegation, and Copilot's complaints.
- Conductor's pages on uncommitted changes in the main checkout; Crystal; Sculptor's docs beyond a
  search snippet.
