---
status: answered
---

# Clarifications, round 01: Claude Code runner (triggered manually)

> [!NOTE]
>
> Answered on 2026-10-12.
>
> - **Choices that outlast the feature:** how the server launches Claude Code, and what the agent
>   may do without asking. They become a decision on how Uraeda runs agents. The launch also decides
>   whether the SDK the stack decision expected comes in at all.
> - **Remote Control is not documented for headless sessions:** the recommended toggle depends on a
>   spike, with a fallback if the spike fails.
> - **Two gaps in the proposal:** how far one trigger runs, a single step or up to the next gate,
>   and which copy of the skill the session uses. The second matters in this repository, where
>   branches change the skill.
> - **Exposure:** any device that reaches a host in `URAEDA_ALLOWED_HOSTS`, your phone through
>   Tailscale included, can start an agent with this machine's login. Settled that way, since it can
>   already commit.
> - **Points settled without you:** 15, at the end. Check where the session ID is kept: a local file
>   that is never committed, treated as a cache under principle III.

## Context

The [proposal](proposal.md) asks the server to drive Claude Code headlessly:

- one session per feature, resumed at each step, with the Uraeda skill available;
- started from the web UI's committing actions, which offer "commit and continue" or "commit only";
- a toggle to turn on Remote Control.

What exists today:

- **The web UI commits** answers, approvals, change requests, proposals, and new features through
  the core ([mutations](/packages/server/src/fate/mutations.ts)). After that, the feature waits on
  an agent until someone runs one by hand, as you do today.
- **Open pages update live** within about 2 seconds of any commit under `specs/`
  ([live updates](/packages/server/src/live.ts)), so an agent's commits will show up with no extra
  work.
- **No runner and no agent SDK exist yet.** The binding does not expose the step's reference file,
  the pull request state, or a call that creates a feature's worktree
  ([binding](/packages/binding/index.d.ts)).

What other tools do:

- **Launch:** they start the real Claude Code binary headlessly, with `claude -p` and JSON streamed
  both ways, or with the Agent SDK.
- **Sessions:** one worktree and one resumed session per task.
- **UI:** a live view of the run, and a Stop button.
- **Permissions:** most skip permission prompts entirely.

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: How does the server run Claude Code?

`claude -p --input-format stream-json --output-format stream-json` keeps a process open:

- it prints one JSON event per line, with the session ID first and the cost last;
- it takes messages and interrupts on stdin.

The Agent SDK for TypeScript runs the same protocol, with typed messages. It bundles its own Claude
Code binary, and needs zod, the Anthropic SDK, and the MCP SDK.

Anthropic's terms say "developers building products [...] including those using the Agent SDK,
should use API key authentication". They also explicitly allow "an end user signing in to the
unmodified Claude Code binary with their own Claude subscription". The
[stack decision](../decisions/stack.md) expected "the official Claude Code and Codex SDKs" in its
consequences, though no rule requires them.

More in [discovery](discovery-01.md#launching-claude-code) and
[credentials](discovery-01.md#credentials-and-anthropics-terms).

Why it matters: this becomes part of a decision on how Uraeda runs agents. It decides the
dependencies, which binary and login run, and how Codex is added later.

- **A (recommended). Spawn the `claude` installed on this machine, with
  `-p --input-format stream-json --output-format stream-json`, one process per run, resumed with
  `--resume`. The server reads its events behind a small adapter, which a fake replaces in tests.**
  - [pro] no new dependency.
  - [pro] it is your own binary, settings, and subscription login, the case the terms allow.
  - [pro] it is the same binary that Remote Control needs.
  - [con] the server parses the events itself, and their format can change between Claude Code
    versions.
  - [con] `claude` must be installed and logged in on the machine.
  - Why recommended: the protocol is the SDK's own, without its dependencies, and stays within the
    terms for anyone who runs Uraeda on their subscription. Codex becomes one more adapter.
- **B. Use the Agent SDK's `query()` in the server, as the stack decision expected.**
  - [pro] typed messages, `interrupt()`, and a permission callback.
  - [pro] session helpers, and Anthropic maintains it.
  - [con] four dependencies, and a second Claude Code binary, unless pointed at yours.
  - [con] the terms ask products built on it to use an API key, a problem once others use Uraeda on
    their subscription.
- **C. Run the interactive Claude Code in a pseudo-terminal, and type the prompts into it.**
  - [pro] Remote Control is documented there.
  - [con] no structured events, a native dependency, and fragile keystrokes.

**Answer:** A

## Q2: What may the agent do without asking?

In `-p`, any action that would ask for permission is denied, and the run goes on without it. Steps
run commands like `vp run ready`, `cargo`, `git commit`, and `gh pr create`, so the mode decides
whether they can finish. The modes:

- **`auto`:** a classifier reviews each action, and skips it after repeated blocks. It works with
  Opus 5.5, on every plan.
- **`bypassPermissions`:** allows everything. Most of the tools compared use it, inside a container
  or not.
- **`acceptEdits`:** allows edits, plus the commands you list.

Approvals answered from the web UI could come later, on top of A or C. They need a permission
channel and an approval view, and are left out here. More in
[discovery](discovery-01.md#permission-mode).

Why it matters: the agent runs on this machine, outside a container, with your files and
credentials. It can be started from your phone.

- **A (recommended). Run every session in `auto` mode, and list the actions it denied in the run's
  view.**
  - [pro] no list to maintain, and destructive actions are blocked.
  - [con] a blocked action is skipped, so a step can end unfinished or work around it.
  - [con] the classifier's reviews use quota.
  - Why recommended: it is the safest mode that still runs unattended, and its denials stay visible.
- **B. Run every session in `bypassPermissions` mode.**
  - [pro] nothing is ever blocked.
  - [con] anything is allowed on this machine, whoever started the run.
- **C. Run every session in `acceptEdits` mode, with a list of allowed commands passed by the
  server: git, vp, cargo, ura, gh, and nix.**
  - [pro] what runs is bounded and readable.
  - [con] every new command is denied until it is added. A project's own allow rules are ignored in
    `-p` until its folder is trusted, so the list lives in Uraeda.

**Answer:** A: If there's a blocked action, could we get a button in the webUI to accept it? If
that's too hard, drop it. Auto has been pretty good for developing uraeda so far.

## Q3: How far does one trigger run?

The skill says to run the next step in the same session whenever no gate stops it. After an approved
spec, that can be the plan, when it is auto-approved, then every implementation task, the final
review, and the pull request: hours of work, from one click. The proposal's examples name single
steps: "Spec is approved, move to plan". A Stop button exists under both options. More in
[discovery](discovery-01.md#how-far-a-trigger-runs).

Why it matters: it decides how often you come back to click, and how much one click can spend.

- **A (recommended). Run until the next human gate, as the skill says: the run ends when a file
  waits for you, or the pull request is ready.**
  - [pro] one click per gate, the asynchronous flow the workflow is built for.
  - [con] one click can start hours of work and a large share of your quota.
  - Why recommended: gates are where the workflow wants you. Stopping between agent steps adds
    clicks without adding a decision.
- **B. Run one step, then stop, and offer "Continue" for the next one.**
  - [pro] each step's cost and result can be checked before the next.
  - [con] one click per step, including each implementation task.

**Answer:** A

## Q4: Which copy of the skill does the session use?

Claude Code loads skills from three places:

- the user's `~/.claude/skills/`: on this machine, a link to the main checkout's `skills/uraeda`;
- the project's `.claude/skills/`: what `ura init` installs, which this repository does not have;
- a plugin folder passed with `--plugin-dir`.

A session in a feature's worktree therefore runs the main checkout's skill today, not the branch's.
More in [discovery](discovery-01.md#the-skills-source).

Why it matters: in this repository, feature branches change the skill. It decides whether a branch's
runs follow its own version.

- **A (recommended). The project's own install, `.claude/skills/uraeda`, as `ura init` makes it.
  This repository gains a tracked link to `skills/uraeda`, so each worktree runs its branch's skill.
  In a project without the install, the runner refuses and says to run `ura init`.**
  - [pro] the version the branch is built with, the same one any agent opening the repository finds.
  - [con] a branch that breaks the skill runs the broken skill on itself.
  - [con] your user-level link becomes redundant, and should be removed.
  - Why recommended: the workflow files and the rules that wrote them stay on the same branch.
- **B. The server's own copy, passed with `--plugin-dir`, the same for every project and branch.**
  - [pro] one version, whatever the project has.
  - [con] a branch that changes the skill is not run with it, and the skill is named
    `/uraeda:uraeda`.
- **C. The user's own skills, as today.**
  - [pro] nothing to change.
  - [con] the main checkout's version, and only for users who set the link up themselves.

**Answer:** B

## Q5: What does the UI show of a run?

Every tool compared shows the run's state and a Stop button, and most show a live transcript and
accept follow-up messages. "Chat in the web UI", in your Next priorities, already covers talking to
a session. The run's events arrive in the server as it works, so showing them costs a view, not a
new channel. More in [discovery](discovery-01.md#what-the-ui-shows-of-a-run).

Why it matters: it sets the size of the UI work, and where this feature stops and the chat feature
starts.

- **A (recommended). On the feature page, the run's state, current activity, time, and estimated
  cost, a collapsible log of the agent's messages and tool calls, and Stop. Home's "Agents at work"
  rows show the state. The log stays in memory while the server runs.**
  - [pro] enough to follow the work and stop it, with no overlap with the chat feature.
  - [con] a run view to build, and a log that is gone when the server restarts. Claude Code's own
    transcript stays.
  - Why recommended: it covers what every compared tool offers, short of the chat.
- **B. Only the state and Stop: the work shows up through the agent's commits.**
  - [pro] the smallest UI.
  - [con] no way to tell a stuck run from a slow one.
- **C. A full chat: the transcript, and messages sent to the session while it works.**
  - [pro] you can steer the agent.
  - [con] it is the "Chat in the web UI" feature, built here.

**Answer:** A: Make sure you use the relevant Astryx components for it, they even have tool calls
components.

Also keep the core information in small local database (sqlite mostl likely): claude code session
ID, session transcript parsed, ...

We'll reuse that small local database for many future features: it is normal for the server to have
a small local state that is not in git.

## Q6: How do "Commit and continue" and "Commit only" appear?

The proposal asks for both options on each action that commits and leads to an agent step:

- submitting answers;
- approving;
- requesting changes;
- committing a proposal;
- starting a feature.

Today each of those is one button. The [UI improvements](/specs/PRIORITIES.md) feature is proposing
the rules these buttons will follow, with popovers on desktop and sheets on the phone. More in
[discovery](discovery-01.md#the-commit-choice).

Why it matters: it decides how easy it is to start an agent, and how easy to start one by mistake.

- **A (recommended). Two buttons side by side: "Commit and continue" as the primary one, "Commit
  only" as the secondary one. Without a working `claude`, only "Commit" shows.**
  - [pro] both options are visible and one click away.
  - [con] one more button on each of these pages.
  - Why recommended: the proposal asks to show both, and a visible choice avoids starting an agent
    by mistake.
- **B. A split button: "Commit and continue", with "Commit only" in its menu.**
  - [pro] one control.
  - [con] committing without the agent takes two clicks, and the default spends quota.
- **C. One "Commit" button, and a "Continue with the agent" switch remembered on each device.**
  - [pro] the fewest controls.
  - [con] the choice is hidden in a switch set earlier.

**Answer:** A

## Q7: How does Remote Control get turned on?

Remote Control connects the Claude app and claude.ai to a Claude Code process on this machine. It
forwards permission prompts and questions to the phone. It needs your claude.ai login, never an API
key.

Every documented way to start it is an interactive session or a server mode driven from the phone.
None is documented for `-p` or the SDK. The likely path is to resume the feature's idle session as
an interactive process, `claude --resume <id> --remote-control`, in a terminal the server holds.
Both flags are documented, but not together, and the combination is untested. More in
[discovery](discovery-01.md#turning-remote-control-on).

Why it matters: it is the only part of the proposal that the headless modes may not support.

- **A (recommended). A Remote Control switch on the feature page, while no run is going:**
  - **it resumes the session interactively with Remote Control, under a pseudo-terminal the server
    holds;**
  - **turning it off ends that process;**
  - **"Commit and continue" turns it off before the run.**

  **The plan starts with a spike that proves it. If the spike fails, the feature falls back to B.**
  - [pro] the session continues from the Claude app, anywhere, with its full history.
  - [con] a native dependency, `node-pty`, or the system's `script` command.
  - [con] an undocumented combination, which may break with a Claude Code release.
  - Why recommended: it gives what the proposal asks for, and the spike bounds the risk.

- **B. A "Remote Control" button that shows the command to run in a terminal,
  `claude --resume <id> --remote-control`, to copy.**
  - [pro] nothing to maintain, and documented parts only.
  - [con] it needs a terminal on the machine first, so not from the phone alone.
- **C. Leave Remote Control out of this feature.**
  - [pro] the smallest feature.
  - [con] the proposal's toggle waits for another feature.

**Answer:** C

## Settled without the human

- **One session per feature, kept as a cache.** Its ID is chosen by the server, passed with
  `--session-id` on the first run, and kept in a file in the repository's git folder,
  `.git/uraeda/sessions.json`. The file is shared by every worktree and never committed. When the ID
  or its transcript is gone, the next run starts a new session, and the run's view says so. The
  repository holds everything the step needs, as principle III requires. See
  [discovery](discovery-01.md#the-session).
- **Each run's message carries the step.** Claude Code freezes the system prompt at the first run,
  so the message names everything instead:
  - `/uraeda`, which loads the skill;
  - the feature;
  - the step from the core, and its reference;
  - what you just did, like "the human answered round 01";
  - that no chat session is attached, so the commit is the message.

  See [the CLI](discovery-01.md#claude-code-cli).

- **The step comes from the core.** The binding gains the step's reference, the pull request state
  read with `gh` as `ura next` does, and a call that returns a feature's worktree, creating it when
  missing. TypeScript recomputes none of them, as the [stack decision](../decisions/stack.md)
  requires. See [the code](discovery-01.md#important-reads).
- **Which actions offer the choice:**
  - submitting answers, approving, requesting changes, committing a proposal or a bug report, and
    starting a feature;
  - "Try again" after a refused hook keeps the choice made.

  Drafts and priorities commit only, since no step follows them. See
  [the path](discovery-01.md#the-proposals-path-and-existing-actions).

- **Starting without a commit:** a feature waiting on an agent, like this one or one whose run
  failed, gets a "Start the agent" button on its page. See
  [discovery](discovery-01.md#starting-without-a-commit).
- **One run per feature at a time, features in parallel.** A second trigger on a running feature is
  refused, with the run's state shown. Each feature has its own worktree, so parallel runs share
  nothing but your quota. See [needs no choice](discovery-01.md#needs-no-choice).
- **Stopping keeps the session resumable.** Stop sends an interrupt, then SIGINT, then SIGTERM after
  a delay: a SIGTERM alone can make a session unresumable. When the server stops, it interrupts its
  runs the same way. After a restart, the feature shows "Start the agent". See
  [the path](discovery-01.md#the-proposals-path-and-existing-actions).
- **A failed run** shows the errors from its result, and "Try again" resumes the session. See
  [the CLI](discovery-01.md#claude-code-cli).
- **Model, effort, and other settings** are your own Claude Code settings. The runner sets none in
  this feature, except the permission mode from Q2, which `-p` does not keep across resumes. See
  [the CLI](discovery-01.md#claude-code-cli).
- **No budget cap.** Each run shows its estimated cost, the latest result's cumulative total for the
  session. With A in Q3, Stop is the limit. See [the CLI](discovery-01.md#claude-code-cli).
- **Commit messages and attribution** follow the project's instructions and settings, unchanged by
  the runner. This repository's `AGENTS.md`, which Claude Code reads, forbids naming an agent. See
  [skills and instructions](discovery-01.md#skills-and-project-instructions).
- **The runner is reachable from the same hosts as every commit**, your phone through
  `URAEDA_ALLOWED_HOSTS` included, behind the same guard. The tailnet's rules stay the only
  protection, as the stack decision already says. See
  [the proposal](discovery-01.md#what-the-agent-may-do-without-asking).
- **Notifications are left out:** "Ping user when input is needed" is its own entry in Next. The
  pages already update live when a run ends at a gate. See
  [needs no choice](discovery-01.md#needs-no-choice).
- **The benchmarks' fresh session per step** is a point their postponed round settled, not a
  decision. This feature follows your proposal. Benchmarks can start fresh sessions through the same
  adapter later. See [the code](discovery-01.md#likely-changes).
- **The UI follows the UI improvements' decisions** that are active when this feature's plan is
  written. Both features change the same pages, so the plan checks for conflicts with that branch.
  See [the code](discovery-01.md#likely-changes).

**Notes:** > Model, effort, and other settings are your own Claude Code settings. The runner sets
none in this feature, except the permission mode from Q2, which -p does not keep across resumes.

It would be good if we could fetch the available models and effort levels, and offer an option to
select it when starting work on a feature (so when a proposal is committed).
