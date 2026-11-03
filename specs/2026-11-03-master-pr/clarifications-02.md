---
status: answered
---

# Clarifications, round 02: "Master" PR

> [!NOTE]
>
> Answered on 2026-11-03.
>
> - Verdict: worth building, with changes: the master pull request works with GitHub as it is. It
>   needs a merge commit, and two decisions meet it.
> - How the master merges decides whether you ever merge a feature alone, and closes the features'
>   pull requests for you.
> - Its agent needs a worktree of its own, which the agents decision gives only to features and
>   changes.
> - Where the option lives meets either the settings decision or the "tools are optional" principle.
> - Four points are settled without you: check them under "Check these", before the questions.

## Context

### Since the last round

You picked the integration pull request, as "an option in settings". Each feature keeps its pull
request. "As soon as a feature opens a PR after another one", a master pull request "holds all
features and merges neatly". The rest of [round 01](clarifications-01.md) is settled: features can
start on another, branches stop editing the priorities, agents' notes become files, and records
follow a catch-up rule. This round asks only what the master pull request needs.

### Goal

One pull request, the master, holds every feature waiting for you, conflicts already resolved, while
each feature keeps its own pull request for review.

### Today

Each feature's pull request merges alone, and you resolve, or ask for, what conflicts. GitHub marks
a pull request as merged when its commits reach the base branch through another pull request, an
"indirect merge"
([GitHub](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/about-pull-request-merges)).
That works only when the commits stay the same: a rebase or squash merge gives new ones.

### Scope

The master pull request: how it merges, what it holds, where its agent runs, and its option. Code
conflicts between features are resolved in it, by its agent, within each feature's spec.

### Sources

- GitHub's page on pull request merges, its indirect merges, and `spr`'s merge of a stack.
- The [agents](/specs/decisions/agents.md) and [settings](/specs/decisions/settings.md) decisions,
  and the [constitution](/specs/CONSTITUTION.md)'s principle V.
- The full investigation is in [discovery](discovery-02.md). Each question links to its topic.

## Check these

- **The master is rebuilt** from the default branch and the features in it, whenever one leaves,
  changes, or merges alone. Rebuilding is cheaper than patching, and gives the same branch every
  time. See [discovery](discovery-02.md#needs-no-choice).
- **The option is off by default**: a new project keeps today's flow until you turn it on. See
  [discovery](discovery-02.md#where-the-option-lives).
- **A feature built on another joins once the other is merged**, since it waits at its draft until
  then, as you chose in round 01. See
  [discovery](discovery-02.md#the-proposals-path-and-existing-actions).
- **The master runs the project's complete validation** before it waits for you, as any branch does.
  See [discovery](discovery-02.md#needs-no-choice).

## Q1: How do the master and the features' pull requests merge?

Example: Feature state and Proposal start are ready. The master pull request holds both, their 28
conflicting files resolved.

GitHub marks a feature's pull request as merged by itself once its commits reach the default branch
unchanged. A merge commit keeps them; a rebase merge does not. Today the finish advises a rebase
merge, for a linear history. More in [discovery](discovery-02.md#merging-the-master-pull-request).

Why it matters: it decides what you press, and whether the default branch's history stays linear.

- **A (recommended). You merge the master pull request with a merge commit, and GitHub marks each
  feature's pull request as merged.**
  - Example: one merge lands both features; both pull requests show "Merged".
  - [pro] one action, with no conflict left, and nothing to close by hand.
  - [con] the history gains merge commits, and every feature in the master merges together.
  - Why recommended: it is the "holds all features and merges neatly" you described.
- **B. You merge the features one by one; the master only proves they merge, and its resolutions are
  carried into each later feature's branch.**
  - Example: you merge Feature state, then Proposal start, already caught up by the master's agent.
  - [pro] each feature merges alone, and the history stays linear.
  - [con] every conflict is resolved twice, in the master and in the feature.
- **C. You merge the master pull request by rebase, and `ura clean` closes the features' pull
  requests.**
  - Example: the history stays linear; both pull requests close, unmerged on GitHub, at the cleanup.
  - [pro] a linear history.
  - [con] GitHub shows the features' pull requests closed, not merged.

**Answer:** Dropped, with the whole pull request flow: "Let's just do the changes to files
(dedicated notes files, not deleting rows when starting, ...), not the PR flow." Starting a feature
on another is dropped too, and the start keeps moving its line to the top of Now.

## Q2: Which features join the master pull request?

Example: Feature state is ready. Proposal start has just opened its draft pull request after its
final review, and writes its record next.

You wrote "as soon as a feature opens a PR". The workflow opens a draft right after the final
review, then marks it ready once the record is written. With a merge of the master (A in Q1), the
master lands everything it holds. More in
[discovery](discovery-02.md#what-joins-the-master-pull-request).

Why it matters: it decides whether a feature you have not reviewed can ever land through the master.

- **A (recommended). Only features whose pull request is ready for your review; the master exists
  once two are.**
  - Example: Proposal start joins once its record is written and its pull request is ready.
  - [pro] the master holds only work waiting for you, never a draft.
  - [con] conflicts are resolved a little later, after the finish.
  - Why recommended: merging the master never lands a draft.
- **B. Every feature with a pull request, drafts included.**
  - Example: Proposal start joins as soon as its draft opens.
  - [pro] conflicts are found as early as possible.
  - [con] the master can hold a draft, which you must not merge until it is ready.

**Answer:** Dropped, with the whole pull request flow: "Let's just do the changes to files
(dedicated notes files, not deleting rows when starting, ...), not the PR flow." Starting a feature
on another is dropped too, and the start keeps moving its line to the top of Now.

## Q3: Where does the master's agent work?

Example: Proposal start joins the master, and conflicts with Feature state. An agent resolves them.

The agents decision says "Every conversation with an agent MUST be a session, run in the worktree of
its change or feature." The master is neither. More in
[discovery](discovery-02.md#where-the-masters-agent-runs).

Why it matters: A changes the agents decision; B leaves the master's work inside one feature's
history.

- **A (recommended). The master has its own branch, worktree, and sessions, shown like a feature in
  the web UI; the agents decision names it.**
  - Example: a "Master pull request" item in the sidebar, its sessions and its step beside the
    features'.
  - [pro] the master's work and its failures are visible on their own.
  - [con] a change to the agents decision, and a new kind of item in every view.
  - Why recommended: you see the master like everything else that waits for you.
- **B. The agent of the feature that joined last builds the master, in that feature's worktree.**
  - Example: Proposal start's session merges the master after its finish.
  - [pro] no decision changes, and no new item.
  - [con] the master's work hides inside a feature, and moves when that feature leaves.

**Answer:** Dropped, with the whole pull request flow: "Let's just do the changes to files
(dedicated notes files, not deleting rows when starting, ...), not the PR flow." Starting a feature
on another is dropped too, and the start keeps moving its line to the top of Now.

## Q4: Where does the "create master PR" option live?

Example: you turn the option on for Uraeda's repository, and not for another project of yours.

Uraeda's settings live in one file in your config folder, for every repository. The settings
decision says it "MUST NOT … be read from a repository". But an agent run by hand, without Uraeda,
never sees that file: principle V asks the workflow to work without the tools. More in
[discovery](discovery-02.md#where-the-option-lives).

Why it matters: A changes the settings decision; B makes the master pull request a feature of
Uraeda's tools only.

- **A (recommended). In the repository, per project, shown and switched on the web UI's settings
  page; the settings decision gains this exception.**
  - Example: Uraeda's repository says "master pull request: on", and any agent, with or without
    Uraeda, builds the master.
  - [pro] per project, and every agent follows it.
  - [con] a change to the settings decision, and a project file that holds an option.
  - Why recommended: it keeps principle V, the constitution, above a decision.
- **B. In the settings file, one switch for every repository.**
  - Example: the switch is on, and every project you serve gets a master pull request.
  - [pro] no decision changes.
  - [con] agents run without Uraeda never build the master, and one switch serves every project.

**Answer:** Dropped, with the whole pull request flow: "Let's just do the changes to files
(dedicated notes files, not deleting rows when starting, ...), not the PR flow." Starting a feature
on another is dropped too, and the start keeps moving its line to the top of Now.

**Notes:**
