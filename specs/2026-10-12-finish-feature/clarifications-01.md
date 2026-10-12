---
status: answered
---

# Clarifications, round 01: Finish feature

> [!NOTE]
>
> Answered on 2026-10-12.
>
> - Two choices shape every future feature and decision: what a merged feature leaves on the default
>   branch, and where the decisions' links to their reasons point once its folder is condensed.
> - When finishing happens needs your attention: GitHub does not let you approve your own pull
>   request, so "once the pull request is approved" cannot trigger it, and the recommended answer
>   moves finishing before the pull request.
> - Cleaning branches and worktrees, and how much of it `ura` does, work together.
> - Two scope questions: the three features already merged, and a living description of the whole
>   system, which other tools have and Uraeda does not.
> - Nine points are settled without you, at the end, among them bugs, which the proposal does not
>   mention: check them.

## Context

The [proposal](proposal.md) asks for a clear end of a feature: what stays on the default branch once
it is merged, in a denser form than today, and when its branch and worktree are deleted. It values
specs and decisions, and suggests one file per feature in a `done` folder.

Today nothing happens after the pull request: the three merged features left 10,405 lines in 21
files in [`specs/`](/specs/), against 310 lines of decisions, and the four
[decisions](/specs/decisions/) link 26 times into those folders, to explain why each choice was
made. [`git.md`](/specs/decisions/git.md) expects "a feature-finishing step" to remove worktrees.
`ura` finds merged features by their dated folders on the default branch
([`workspace.rs`](/crates/core/src/workspace.rs)), so any change to those folders reaches
`ura status` and the web UI.

Other tools split into two families: most keep every feature folder forever, and their users
complain about clutter and stale specs; OpenSpec moves finished folders, intact, to an archive.
Python PEPs freeze a finished proposal as a historical record, and changesets and towncrier condense
per-change files into one summary, then delete them.

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: What does a merged feature leave on the default branch?

A merged feature leaves its proposal, discovery, questions, spec, plan, rulings, and mockups, about
3,500 lines. Changesets and towncrier condense per-change files into one summary and delete them;
OpenSpec moves the folder to an archive and keeps it whole; PEPs keep the full document, frozen. Git
keeps every deleted file, in every option. More in
[discovery](discovery-01.md#what-stays-on-the-default-branch).

Why it matters: this is what every future reader and agent finds for a past feature, and how much
the `specs/` folder grows with each one.

- **A (recommended). Replace the feature's folder with one record file,
  `specs/done/YYYY-MM-DD-slug.md`, of about 100 to 200 lines: what was built and why, the behaviour
  in short, the design's main choices, each question with its answer in a line, the decisions it
  made or changed, the rulings and changes that moved away from the spec, and the follow-ups left.
  The rest is in git.**
  - [pro] the densest form that still answers "what did this feature do, and why": about 15 times
    less than today.
  - [con] the full spec's details, its acceptance scenarios and edge cases, are only in git history
    and in the tests.
  - Why recommended: it matches the proposal's idea and its call for density, and the code and its
    tests already hold the exact behaviour, as PEP 1 says of finished proposals.
- **B. Keep `spec.md` and `rulings.md` where they are, and delete the proposal, discovery,
  questions, plan, reviews, and mockups.**
  - [pro] the full behaviour and design stay one click away.
  - [con] about 500 to 800 lines per feature, and a spec that drifts as later features change the
    same code.
- **C. Move the whole folder, unchanged, to `specs/done/`, and hide that folder from search tools
  with an `.ignore` file.**
  - [pro] nothing is lost, and grep stops returning it.
  - [con] the volume stays, and agents' search tools, which read `.ignore`, stop finding the reasons
    behind decisions too.
- **D. Delete the folder, and keep only a line per feature in a changelog, with git history for the
  rest.**
  - [pro] the least noise.
  - [con] the reasons behind decisions are only in git history, which agents rarely search.

**Answer:** A

## Q2: When does finishing happen?

Today the implementation ends with a pull request that you merge on GitHub, and nothing runs after
the merge. GitHub does not let a pull request's author approve it, and you open and merge your own,
so an approval cannot trigger finishing. superpowers' users found that a finished file must be
marked finished before the merge, or the merged tree never shows it. More in
[discovery](discovery-01.md#when-finishing-happens).

Why it matters: it decides whether you review the record, whether you take one more action per
feature, and whether agents ever write on the default branch.

- **A (recommended). As the last commit of the feature's branch, after the final review and before
  the pull request is marked ready: the record replaces the folder, so the pull request merges the
  code and the record. Changes requested on the pull request amend the record, which notes them.**
  - [pro] no extra step or action: you review the record with the code, and merging finishes the
    feature.
  - [con] the pull request's diff no longer shows the spec and the plan: their links point to the
    commit before finishing.
  - Why recommended: it asks nothing more of you, and needs no signal GitHub cannot give.
- **B. After you merge, an agent finishes the feature in a second, small pull request, which you
  merge too.**
  - [pro] the feature's pull request stays as it is today.
  - [con] a second merge for every feature, and a gap between the two when the folder is still
    there.
- **C. After you merge, an agent commits the finishing directly on the default branch.**
  - [pro] no extra action, and the pull request stays as it is today.
  - [con] agents write on the default branch, with no review before the commit lands.
- **D. When you tell an agent the pull request is ready, it finishes on the branch, then merges the
  pull request itself.**
  - [pro] the review sees the full spec, and the record lands with the merge.
  - [con] you message an agent instead of merging, and agents merge into the default branch.

**Answer:** A

## Q3: Where do links to a finished feature point?

Decisions explain each choice with links to the question and the discovery section behind it, as the
[decision template](/skills/uraeda/assets/templates/specs/decisions/decision-topic.md) asks: 26
links in the four decisions, and 8 in a draft. Once the folder is condensed, those links break. With
C in Q1, nothing breaks: answer `-`. More in
[discovery](discovery-01.md#links-into-finished-features).

Why it matters: a decision is read for its reasons, by agents and by you, long after its feature.

- **A (recommended). Finishing rewrites every link into the folder to point to the record, where
  each question and its answer has its own heading, and later decisions link there too.**
  - [pro] the links stay plain relative links that work offline and in Obsidian, and land on the
    answer.
  - [con] the full question, with its options, pros, and cons, is one `git show` away instead of a
    click.
  - Why recommended: it keeps decisions readable in the tree, and the record's one-line answer is
    the part a reader of a decision needs.
- **B. Finishing rewrites every link into the folder as a GitHub link to the file at a commit.**
  - [pro] one click to the full question, as it was.
  - [con] the links only work on GitHub, and a rebase merge changes the commit, so they can only be
    written after the merge.
- **C. Keep the questions files that decisions cite, next to the record, in a folder.**
  - [pro] the links keep working, to the full question.
  - [con] the questions files are the largest part of what stays, and the clutter comes back.

**Answer:** A

## Q4: How does a reader find the full files of a finished feature?

Git keeps every condensed file. A rebase merge keeps the branch's commits on the default branch with
new hashes, a merge commit keeps them as they are, and a squash merge keeps only one commit, though
the pull request keeps all of them on GitHub. This repository has used merge commits and a rebase.
More in [discovery](discovery-01.md#keeping-the-full-history-reachable).

Why it matters: it decides whether the details the record leaves out can always be found again.

- **A (recommended). The record links its pull request and names its former folder, so
  `git log -- specs/<folder>/` lists every commit of it; the skill advises against squash merges.**
  - [pro] nothing to create or push, and it works with merge commits and rebases.
  - [con] after a squash merge, the full files are only on GitHub, in the pull request.
  - Why recommended: it needs nothing beyond git and the pull request, which already exist.
- **B. On top of A, tag the branch's tip as `archive/<folder>` before the merge, push the tag, and
  name it in the record.**
  - [pro] the files survive any merge, even outside GitHub.
  - [con] a tag per feature to push, in a list that grows forever.
- **C. On top of A, require merge commits, so the branch's commits keep their hashes.**
  - [pro] the record can name the exact commit holding the full folder.
  - [con] the workflow dictates a repository setting.

**Answer:** A

## Q5: Who removes a merged feature's branch and worktree?

`ura start` creates each feature in `.worktrees/<folder>/`, and nothing removes it.
`git worktree remove` refuses a worktree with uncommitted or untracked files, and ignored files like
`node_modules/` do not block it. After a rebase merge, `git branch -d` refuses the merged branch, so
`-D` is needed once the merge is confirmed. Remote branches can be deleted by GitHub's
"Automatically delete head branches" setting, which is off in this repository. How much of this
`ura` does is Q6. More in [discovery](discovery-01.md#branch-and-worktree-cleanup).

Why it matters: worktrees are full checkouts, with their own dependencies, and they pile up.

- **A (recommended). When you ask, with `ura clean` or by asking an agent: for each merged feature,
  remove its worktree under `.worktrees/` without forcing, then delete its local branch; a worktree
  with uncommitted work is reported and left alone. `ura status` shows merged features that still
  have one.**
  - [pro] nothing is deleted without you, and nothing is lost.
  - [con] one command to remember, prompted by `ura status`.
  - Why recommended: deletions stay in your hands, at no risk, and the reminder makes them easy.
- **B. Automatically, with the same guards, at the start of any agent step or `ura` command.**
  - [pro] nothing to remember.
  - [con] a worktree disappears under a running dev server or an open editor, without warning.
- **C. By hand, with the git commands the skill describes.**
  - [pro] nothing to build.
  - [con] worktrees pile up, as they do today.

**Answer:** A: Document ura clean in the skill too.

If the workflow is applied via the skill it should tell the human to run ura clean. We’ll make our
own harness later and we’ll automate it at that point.

## Q6: What do `ura` and the web UI do in this feature?

`ura status` and the web UI list merged features from their folders on the default branch. Once a
folder is condensed, they no longer find it, and a leftover branch shows as a feature in progress.
The tools are optional, but the workflow ships with them. With C in Q5, B and A are the same. More
in [discovery](discovery-01.md#tool-support).

Why it matters: it decides whether the tools stay right the day the first feature is finished.

- **A (recommended). The skill, its templates, and the example, plus `ura` and the web UI reading
  records as done features, `ura check` checking records, and the cleanup of Q5 in `ura`.**
  - [pro] the tools match the workflow from the first finished feature.
  - [con] the largest scope: Rust, the web UI, and fixtures.
  - Why recommended: without it, the first finished feature breaks `ura status`, and `git.md`
    already expects the cleanup.
- **B. The same, without the cleanup in `ura`: it is done by hand or by an agent.**
  - [pro] smaller, with no command that deletes anything.
  - [con] the cleanup has no tool, whatever Q5 says.
- **C. The skill, its templates, and the example only; the tools follow in a later feature.**
  - [pro] the smallest scope.
  - [con] finished features disappear from `ura status` and the web UI until then.

**Answer:** A

## Q7: Are the three merged features finished too?

The stack decision, the CLI core, and the web UI are merged with their full folders, 10,405 lines.
The decisions' 26 links and the draft's 8 point into them. More in
[discovery](discovery-01.md#features-already-merged).

Why it matters: it removes today's noise at once, and tests the record format on real features.

- **A (recommended). Yes: this feature writes their three records, deletes their folders, and
  rewrites the links into them.**
  - [pro] the noise goes now, and the format is proven on three features before the next one.
  - [con] three records written after the fact, from the files and the git log.
  - Why recommended: they are the noise the proposal describes, and the best test of the format.
- **B. No: they stay as they are, and finishing starts with the next feature.**
  - [pro] a smaller feature.
  - [con] two layouts side by side, and the noise stays.

**Answer:** A

## Q8: Should Uraeda also keep a living description of the system?

OpenSpec keeps a description of how the system behaves now, updated by each change; Cline keeps six
living files; Spec Kit's users ask for one, since "the truth of the system being a chain of specs is
horrible". Their users also report drift when the update is skipped, and merges that lose details.
Uraeda has none: specs are change records, and decisions are the only living files. More in
[discovery](discovery-01.md#a-living-description-of-the-system).

Why it matters: records describe changes, and a reader wanting the system as it is now must read
them all, or the code.

- **A (recommended). Not in this feature: add it to `PRIORITIES.md` as a later item, next to "Public
  documentation maintenance".**
  - [pro] this feature stays focused on the proposal.
  - [con] no single description of the system for now.
  - Why recommended: it is a new kind of file with its own upkeep, worth its own discovery.
- **B. Yes, in this feature: finishing also updates a description of the system in `specs/`.**
  - [pro] one place to read the system as it is.
  - [con] a new artifact, its template, and its rules, and an update at every feature that drifts
    when skipped.

**Answer:** Don’t add it: the current state of the system is defined in the code.

We already have the constitution and decisions for human-decided points that are not in code.

Maybe I’m misunderstanding but to me having a “living spec file” describing the system as it is now
is asking for drift and coherence issues.

## Settled without the human

- **Where records go**: with A in Q1, `specs/done/`, the proposal's name, which reads like `drafts/`
  and `backlog/`, one flat file per feature, named after its folder, so the date and slug stay
  unique. See [discovery](discovery-01.md#what-stays-on-the-default-branch).
- **What a record opens with**: a `> [!NOTE]` block saying it is the record of a merged feature, not
  instructions, with its dates and pull request, because superpowers' users saw agents execute
  finished plans as live work orders. See [discovery](discovery-01.md#superpowers).
- **The record's template**: the spec defines its sections from Q1's list, and the template and the
  example get one, like every workflow file.
- **Who writes the record**: the agent of the finishing step, from the spec, the plan, the rulings,
  the questions, and the review files, since they hold everything it summarizes.
- **Bugs**: their folders are finished like features, into `specs/done/`, since nothing in a bug's
  files calls for a different treatment. See [discovery](discovery-01.md#no-word-on-bugs).
- **The `PRIORITIES.md` entry**: it is still removed in the branch's last commit, as today.
- **The example**: it keeps `2026-10-06-recurring-tasks/` complete, since it is the model of every
  file, and gains that feature's record in `done/`, as the model of a record.
- **The commit**: finishing gets its own commit type, `finish(<slug>): <feature name>`, like every
  workflow step.
- **`git.md`**: its line "Worktrees stay until removed by hand, until a feature-finishing step
  removes them" changes with Q5's answer, as a proposed change the spec's approval applies, since an
  active decision is never edited before approval. See [discovery](discovery-01.md#important-reads).

**Notes:**
