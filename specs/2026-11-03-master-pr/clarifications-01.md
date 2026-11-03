---
status: answered
---

# Clarifications, round 01: "Master" PR

> [!NOTE]
>
> Answered on 2026-11-03.
>
> - Verdict: worth building, with changes: half the recent conflicts, in workflow files, can
>   disappear. One "master" pull request is not the best fix for the rest.
> - How pull requests land lasts beyond this feature. It changes when a pull request reads as ready
>   for you, a rule of the feature status decision.
> - Starting a feature after another, and the finish's removal from the priorities, work together.
>   Both change what a branch's last steps do.
> - Agents' inbox notes would become files of their own, a change to the inbox's format.
> - GitHub's merge queue is ruled out: it needs a repository owned by an organization.
> - Four points are settled without you: check them under "Check these", before the questions.

## Context

### Goal

The [proposal](proposal.md) asks that pull requests built in parallel by several agents merge
smoothly. It also asks for fewer conflicts on mundane workflow files, like the inbox and the
priorities. And it suggests choosing, when a feature starts, to make it mergeable after the features
in flight.

### Today

A branch catches up with the default branch once, at its final review, by a rebase
([catch-up](/skills/uraeda/references/implementation.md#catch-up-with-the-default-branch)). Once its
pull request is ready, nothing catches it up again. When another pull request merges first, it may
conflict, and you find out on GitHub. Uraeda reads no pull request's mergeability
([`pulls.rs`](/crates/core/src/pulls.rs)).

Every merge commit of the default branch since 2026-10-15 was replayed with `git merge-tree`. Of 43,
21 conflicted, and 11 of those only in `specs/` and `skills/`, without a code file:

| File                | Why every branch conflicts there                                                      |
| ------------------- | ------------------------------------------------------------------------------------- |
| `PRIORITIES.md`     | every start adds a line at the top of Now; every finish removes its own, next to it   |
| `INBOX.md`          | agents' notes go at the end of a category on their branch, where others' notes go too |
| `specs/done/*.md`   | both sides repair nearby links in an old record, and the paragraph re-wraps           |
| Binding's `index.*` | generated files, committed, which two branches regenerate differently                 |

Most branches were rebased, which leaves no trace of its conflicts: these counts are a floor.

### Scope

The workflow, for every project: how pull requests land, starting a feature after another, and the
shared workflow files. Changes follow the same rules as features, since they finish the same way.
Conflicts in code between two features stay: an agent resolves them in a catch-up, within each spec.
Out of scope: how agents run on their own, which is the
[Worker lifecycle](/specs/proposals/worker-lifecycle.md) proposal.

### Sources

- The [finish](/skills/uraeda/references/finish.md), the
  [catch-up](/skills/uraeda/references/implementation.md#catch-up-with-the-default-branch), the
  [start](/skills/uraeda/references/projects.md#starting-postponing-and-dropping-a-feature), and
  [agents' notes](/skills/uraeda/references/inbox.md#agents-notes).
- The [git](/specs/decisions/git.md) and [feature status](/specs/decisions/feature-status.md)
  decisions.
- GitHub's stacked pull requests and `gh stack`, its merge queue, Graphite, git-town,
  `git merge-tree`, merge drivers, and changesets, towncrier, and reno.
- Two experiments in throwaway repositories: a union merge driver, and a branch rebased after the
  one it was built on merged.
- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Check these

- **Catching up stays a rebase**, pushed by the agent with `--force-with-lease`, as today. The
  history stays linear, and no tool force-pushes, which the git decision forbids. See
  [discovery](discovery-01.md#needs-no-choice).
- **No union merge driver**, though git has one built in. Tried on `INBOX.md`: when the default
  branch removed a note and a branch added one after it, the removed note came back silently. See
  [discovery](discovery-01.md#merge-drivers-and-mergeunion).
- **Conflicts are found without GitHub**: `git merge-tree` merges a branch with the default branch
  in memory, with no forge needed. GitHub's own `mergeable` adds its view when `gh` is installed.
  See [discovery](discovery-01.md#git-merge-tree-and-git-rebase).
- **The generated binding files are regenerated in a catch-up**, never merged by hand. They are this
  repository's own, and the build writes them. See [discovery](discovery-01.md#important-reads).

## Q1: How should pull requests built in parallel land on the default branch?

Example: Feature state and Proposal start are both ready, each with a pull request. You merge
Feature state. Proposal start now conflicts with the default branch in 28 code files, as it did on
2026-10-31.

Today the workflow stops at the ready pull request, and nothing notices the conflict. GitHub's merge
queue does exactly this job, but only for repositories owned by an organization: this one is owned
by your user account. More in [discovery](discovery-01.md#landing-parallel-pull-requests).

Why it matters: it decides what you do when merging, and whether a tool ever merges for you. It
changes the feature status decision: a pull request reads as ready only when it merges cleanly.

- **A (recommended). Uraeda checks every open pull request against the default branch, and gives one
  that conflicts back to the agent, which catches it up and pushes. You merge them one by one, in
  any order.**
  - Example: once you merge Feature state, Proposal start reads "Catching up" until its agent has
    rebased it, run the validation, and pushed. It then waits for you again.
  - [pro] works without GitHub's queue, by hand too, and every ready pull request merges cleanly.
  - [con] each merge can start a catch-up run for the others, and you wait for it.
  - Why recommended: it fixes the pain at its source, and keeps merging yours.
- **B. A "master" pull request: an agent merges every ready feature into one integration branch,
  resolves the conflicts once, and opens one pull request. You review each feature, but merge only
  that one.**
  - Example: one pull request holds Feature state and Proposal start, conflicts already resolved.
  - [pro] conflicts are resolved once, by one agent seeing every feature.
  - [con] all or nothing: rejecting one feature means rebuilding the integration branch.
- **C. A merge train: you approve pull requests on GitHub, and Uraeda merges them in turn, catching
  up each next one first.**
  - Example: you approve both; Uraeda merges Feature state, catches up Proposal start, then merges
    it.
  - [pro] you never press merge, and nothing conflicts by the time you look.
  - [con] a tool merges on your behalf, a new power, and it stops on any conflict needing a choice.

**Answer:** B: I’m not fully sure I understand exactly when and how it triggers for A

I feel like B is the closest to what I want. Keep one PR per feature but as soon as a feature opens
a PR after another one, also start a master PR that holds all features and merges neatly.

It should be an option in settings btw (“create master PR”)

### Q1.A: When does a pull request go back to its agent?

Only if you picked A in Q1. Without a conflict, GitHub merges a pull request that is behind the
default branch. The two features may still break each other, which the default branch's CI then
shows after the merge.

Why it matters: catching up on every move costs an agent run per open pull request at each merge. On
2026-10-30, eleven pull requests merged in one day.

- **A (recommended). Only when it conflicts with the default branch.**
  - Example: Proposal start goes back; a third pull request touching other files stays ready.
  - [pro] few runs: only the pull requests that cannot merge.
  - [con] two features that merge cleanly can still break the build together, caught after.
  - Why recommended: CI on the default branch already catches the rare breakage.
- **B. Whenever the default branch moved since its last catch-up.**
  - Example: both Proposal start and the third pull request go back, and are validated again.
  - [pro] every pull request is validated against what it merges into.
  - [con] one run per open pull request at each merge.

**Answer:**

## Q2: How can a feature start after another feature in flight?

Example: you start Proposal start while Feature state is still being built, and it needs Feature
state's code.

Today every feature branches from the default branch. Proposal start's agent merged Feature state's
branch into its own, on its own initiative. Its pull request then held both features' commits until
Feature state merged. GitHub now has stacked pull requests, where each one targets the branch below
it, and `gh stack` drives them. Their status, preview or general, is not stated in the pages read.
More in [discovery](discovery-01.md#starting-a-feature-after-another).

Why it matters: it decides whether starting asks one more thing, and how GitHub shows the dependent
pull request.

- **A (recommended). Starting can name a feature in flight to build on: the branch starts from that
  feature's branch, and its pull request targets the default branch.**
  - Example: Proposal start's branch starts from Feature state's. Its catch-ups follow Feature
    state's branch until it merges, then the default branch.
  - [pro] plain git, any forge; tried: a rebase drops the merged copies of the other's commits.
  - [con] its pull request shows the other feature's commits too, until that one merges.
  - Why recommended: it is what an agent did unprompted, made a rule, with nothing new to install.
- **B. Stacked pull requests: the dependent pull request targets the other feature's branch, as
  `gh stack` does.**
  - Example: Proposal start's pull request shows only its own diff, based on Feature state's branch.
    GitHub retargets it once Feature state merges.
  - [pro] each pull request shows only its own work.
  - [con] needs GitHub's stacks or `gh stack`, and still a rebase after the other merges.
- **C. No stacks: a feature that needs another starts once the other is merged.**
  - Example: Proposal start waits in Now until Feature state merges.
  - [pro] nothing new.
  - [con] the dependent feature waits, discovery included.

**Answer:** A

### Q2.A: What does the dependent feature do while the other is not merged?

Only if you picked A in Q2. Its pull request holds both features' commits, so merging it first would
merge the other feature, unreviewed.

Why it matters: it decides whether a dependent pull request can ever reach you before the one it
needs.

- **A (recommended). It stops at its draft pull request, reading "Waits for Feature state", and
  finishes once that one is merged.**
  - Example: Proposal start's final review is done, and its finish runs after Feature state merges.
  - [pro] you never see a pull request that merges two features at once.
  - [con] it waits, even when both are ready the same day.
  - Why recommended: you review and merge one feature at a time, as today.
- **B. It finishes and is marked ready; its pull request says to merge the other one first.**
  - Example: both reach you; Proposal start's body opens "Merge Feature state first".
  - [pro] no wait.
  - [con] merging them in the wrong order merges both at once.

**Answer:** A

## Q3: Should a branch stop removing its proposal from the priorities?

Example: the default branch starts Feature state, adding its line at the top of Now. Reading pass
finishes on its branch, removing its own line, right above it. The two conflict.

The finish removes the feature's line in its last commit, the only write a branch makes to
`PRIORITIES.md`. A merged feature's folder link then points to a record. More in
[discovery](discovery-01.md#prioritiesmd).

Why it matters: it decides how long a merged feature's line stays in Now, and who removes it.

- **A (recommended). Branches never write `PRIORITIES.md`. A merged feature's line stays, shown as
  done, until it is removed on the default branch.**
  - Example: after the merge, Reading pass's line in Now shows as done.
  - [pro] no conflict, with or without `ura`.
  - [con] a done line stays in Now until removed.
  - Why recommended: the conflict disappears instead of being resolved better.
- **B. Keep the removal, with a merge driver from `ura` that merges the list item by item.**
  - Example: Reading pass's line leaves and Feature state's stays, without a conflict.
  - [pro] the line leaves at the merge.
  - [con] GitHub's merge button cannot run it, and without `ura` the conflicts stay.

**Answer:** A

### Q3.A: Who removes a merged feature's line?

Only if you picked A in Q3. Tools remove anything only when you ask, by the git decision.

Why it matters: it decides whether the cleanup you already run takes the line too.

- **A (recommended). `ura clean`, and its button in the web UI, remove it with the worktree and the
  branch.**
  - Example: you run `ura clean` after merging, and Reading pass's line leaves Now in one commit.
  - [pro] one action you already take after a merge.
  - [con] the line lingers while you have not cleaned.
  - Why recommended: no new action, and only on your request.
- **B. You remove it, in the priorities, like any line.**
  - Example: you delete Reading pass's line in the web UI.
  - [pro] nothing new in the tools.
  - [con] one more chore after each merge.

**Answer:** A

## Q4: Where should an agent's inbox note go?

Example: Feature state's agent notes "the workspace record's `running` is read by no view". Reading
pass's agent notes another problem, under the same category. Both branches conflict in `INBOX.md`.

Today an agent writes its note at the end of its category, on its branch, and the note reaches the
default branch with the merge. The git decision forbids agents to write notes on the default branch.
GitLab, towncrier, and reno ended this kind of conflict with one file per entry. More in
[discovery](discovery-01.md#inboxmd-and-agents-notes).

Why it matters: it changes the inbox's format, which every tool reads, or the git decision.

- **A (recommended). An agent's note is its own note file in `specs/notes/`, with its category. The
  inbox shows note files that no line of `INBOX.md` links.**
  - Example: Feature state brings `specs/notes/running-unread.md`; it shows in the inbox at the
    merge.
  - [pro] a new file never conflicts, and the note shows at the merge, as today.
  - [con] notes now live in two forms, which the inbox, its triage, and its moves must all read.
  - Why recommended: it removes the conflict for good, the way changelog tools did.
- **B. Notes stay in the record's Follow-ups, and `ura clean` copies them into `INBOX.md`.**
  - Example: Feature state's note shows in the inbox once you clean the merged feature.
  - [pro] no format change: the record lists its follow-ups already.
  - [con] the note waits for your cleanup, and by hand you copy it.
- **C. Agents write their notes on the default branch, which changes the git decision.**
  - Example: Feature state's note lands in the inbox the moment the agent writes it.
  - [pro] notes show at once, and keep their format.
  - [con] agents commit on your branch while you edit it, about work not merged yet.

**Answer:** A: Ok, make sure they are visible with the CLI and webui

## Q5: How should conflicts in the records of `specs/done/` be avoided?

Example: Proposal start's catch-up repairs a link in the Inbox again record, while the default
branch repaired the next link. The paragraph re-wraps at 100 columns, and both versions conflict.

Records change only for link repairs and links to newer records. Repairs are deterministic: two
sides repairing the same link agree. Conflicts come from two repairs in one paragraph. More in
[discovery](discovery-01.md#records-link-repairs).

Why it matters: B changes how every workflow file is written and formatted, in every project.

- **A (recommended). A catch-up rule: take the default branch's record, then repair the links
  again.**
  - Example: the agent takes the default branch's Inbox again record, and `ura check --fix` repairs
    the link left.
  - [pro] one line in the catch-up, settled mechanically.
  - [con] the conflict still happens, only settled without thought.
  - Why recommended: records conflict rarely, and the rule settles them all.
- **B. Write workflow files one sentence per line, so a repair touches one line.**
  - Example: the two repairs are on two lines, and git merges them.
  - [pro] far fewer conflicts in every workflow file, specs and plans too.
  - [con] every template, example, and file rewritten, and the formatter's setting changed.

**Answer:** A

## Settled without the human

### Behaviour

- **Changes follow the same rules** as features, since they finish and land the same way. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The order of merging stays yours**, but for a feature built on another, which merges after it.
  See [discovery](discovery-01.md#needs-no-choice).

### Under the hood

- **The step table gains its rows in both copies**, the skill's and the core's
  ([`steps.rs`](/crates/core/src/steps.rs)), as the step table's rule already requires. See
  [discovery](discovery-01.md#rules-and-their-owners).
- **A postponed feature's merge** meets the same files, and follows the same rules. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).

**Notes:**
