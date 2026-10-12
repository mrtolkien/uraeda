---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: high
plan-review: true
---

# Spec: Finish feature

> [!IMPORTANT]
>
> Spec to review, about 35 minutes.
>
> - A new last step for every feature and bug: once the final review is done, a draft pull request
>   is opened, one record in `specs/done/` replaces the folder in a last commit, links into the
>   folder are rewritten, and the pull request is marked ready. Question headings keep their
>   anchors, so a decision's link only changes its path.
> - Changes asked on the pull request amend the record. One that needs a new round of questions
>   reverts the finishing commit, carries those changes back into the spec, and turns the pull
>   request back into a draft.
> - One changed decision: [git](../decisions/git.md) lets tools remove a merged feature's worktree
>   and local branch when you ask. Worktrees are never forced; a branch is force-deleted with
>   `git branch -D` only after checking that every commit is on the local or remote default branch,
>   or patch-equivalent to one, since `-d` refuses after a rebase merge. Remote branches are never
>   deleted.
> - `ura clean` is new: a target, or `--all`, and `--dry-run`. A worktree with uncommitted or
>   untracked files, or a branch with commits the default branch lacks, is left and reported, with
>   exit 1.
> - `ura status`, `ura next`, `ura check`, and the web UI read records as done features, and remind
>   you of worktrees and branches left behind. Features merged before this change still show as done
>   from their folders.
> - The three merged features are finished by a task of this feature: about 10,400 lines become
>   three records of about 200 lines each, at most 250, and 34 links are rewritten.
> - Risk tier `high`, since `ura clean` deletes branches and the migration deletes three folders:
>   the plan waits for your review. Both are recoverable from git, so `medium` without a plan review
>   is defensible if you prefer.

Uraeda's features end today with a pull request that merges their whole folder, and nothing happens
after it: three merged features left 10,405 lines in [`specs/`](/specs/), against 310 lines of
decisions, and their worktrees and branches stay until removed by hand. This feature adds a last
step that replaces a feature's folder with one dense record in `specs/done/`, gives `ura` a way to
read those records and to clean what merged features leave behind, and finishes the three merged
features ([proposal](proposal.md), [discovery](discovery-01.md),
[clarifications](clarifications-01.md)).

## User stories

### US1: Finish a feature before its pull request is ready (P1)

Once every task of the plan is checked and the final review is done, the agent pushes the branch and
opens the pull request as a draft. It writes the feature's record from the proposal, the questions
and answers, the spec, the plan, the rulings, and the reviews. In one commit, the record replaces
the folder, every link into the folder is rewritten, and the feature's `PRIORITIES.md` entry is
removed. Then it marks the pull request ready: the human reviews the code and the record, and
merging finishes the feature. The skill's `finish.md`, described under [Components](#components),
gives every step by hand.

Why this priority: it is the proposal itself, and works with the skill alone, without `ura`
([Q1](clarifications-01.md#q1-what-does-a-merged-feature-leave-on-the-default-branch),
[Q2](clarifications-01.md#q2-when-does-finishing-happen)).

Acceptance scenarios, on the example's recurring tasks feature and its record,
`skills/uraeda/assets/example/specs/done/2026-10-06-recurring-tasks.md`:

1. **Given** the example record, **When** `ura check` runs on it, **Then** it reports no problem:
   its frontmatter is `kind: feature` and `pull-request:` with a URL, it opens with a `> [!NOTE]`
   block, and its sections follow the record template.
2. **Given** the example record and the example's `clarifications-01.md`, **When** their anchors are
   compared, **Then** each question heading of the record, like
   `#### Q2: When does the next occurrence appear?` under `### Round 01`, has the same anchor as its
   heading in the questions file, `#q2-when-does-the-next-occurrence-appear`.
3. **Given** a branch `2026-10-06-recurring-tasks` with every plan step checked, its folder, and no
   pull request, **When** `ura next recurring-tasks` runs, **Then** it prints the step
   `final-review`, to follow `skills/uraeda/references/implementation.md`.
4. **Given** the same branch with a draft pull request, **When** `ura next recurring-tasks` runs,
   **Then** it prints the step `finish`, to follow `skills/uraeda/references/finish.md`: the final
   review is done.
5. **Given** the branch's tip has `specs/done/2026-10-06-recurring-tasks.md`, no folder, and a draft
   pull request, **When** `ura next recurring-tasks` runs, **Then** it prints the step `finish`.
6. **Given** the same, with the pull request ready for review, **When** `ura status` runs, **Then**
   the feature's row reads `you` and `pull-request`.

### US2: See finished features in `ura` and the web UI (P1)

`ura status`, `ura next`, and the web UI find a finished feature from its record: on its branch
before the merge, on the default branch after it. A merged feature whose worktree or local branch is
still there says so, with the command that removes them. `ura check` checks records like every
workflow file.

Why this priority: without it, the first finished feature disappears from `ura status` and the web
UI, or shows as a feature in progress from its leftover branch
([Q6](clarifications-01.md#q6-what-do-ura-and-the-web-ui-do-in-this-feature)).

Acceptance scenarios:

1. **Given** the default branch has `specs/done/2026-10-11-web-ui.md` and no
   `specs/2026-10-11-web-ui/`, and no branch is left, **When** `ura status` runs, **Then** the group
   "Done" lists `2026-10-11-web-ui` with `-` and `merged`.
2. **Given** that merged feature with `.worktrees/2026-10-11-web-ui` and the local branch
   `2026-10-11-web-ui` still there, **When** `ura status` runs, **Then** its row reads
   `merged: worktree and branch left, run ura clean`, and `ura status --json` gives it
   `"left-worktree": ".worktrees/2026-10-11-web-ui"` and `"left-branch": "2026-10-11-web-ui"`, with
   `"version": 1`.
3. **Given** the same leftovers, **When** `ura next` runs, **Then** it prints its target as before,
   then on stderr
   `ura: 2026-10-11-web-ui is merged, with its worktree and branch left: run ura clean`.
4. **Given** the record is on `origin/main` but not yet on the local `main`, and the local branch
   `2026-10-11-web-ui` has the record, **When** `ura status` runs, **Then** the feature is listed as
   `merged`, not as a feature to finish.
5. **Given** the default branch has the folder `specs/2026-10-10-cli-core/` and no record, **When**
   `ura status` runs, **Then** "Done" lists `2026-10-10-cli-core` as `merged`, as today.
6. **Given** the merged feature `2026-10-11-web-ui` with its worktree left, **When** the human opens
   its page in the web UI, **Then** it shows "Merged into the default branch", the note "Worktree
   and branch left" naming `.worktrees/2026-10-11-web-ui` and `ura clean`, and one file,
   `2026-10-11-web-ui.md`, labelled `record`, which opens in the reading view.
7. **Given** a record without `kind`, **When** `ura check` runs on it, **Then** it reports
   `frontmatter.missing` for `kind`, at the record's path.
8. **Given** a record whose round 01 has `#### Q3: ...` right after `#### Q1: ...`, **When**
   `ura check` runs on it, **Then** it reports `sections.numbering`, "Q3 should be Q2", on Q3's
   line.

### US3: Clean a merged feature's worktree and branch (P2)

When the human runs `ura clean`, or asks an agent to, each merged feature or bug loses its worktree
under `.worktrees/` and its local branch, unless that would lose work: then it is left, with what to
do. The skill gives the same steps as git commands, and the pull request's description and every
agent run that finds leftovers remind the human to run it.

Why this priority: worktrees are full checkouts, and they pile up; the human asked for it to run
only when they ask, and for the skill to tell them to
([Q5](clarifications-01.md#q5-who-removes-a-merged-features-branch-and-worktree)).

Acceptance scenarios, with the merged feature `2026-10-11-web-ui`, its branch rebase-merged into
`main`:

1. **Given** a clean `.worktrees/2026-10-11-web-ui` holding an ignored `node_modules/`, **When**
   `ura clean web-ui` runs, **Then** the worktree folder is gone, the branch `2026-10-11-web-ui` is
   deleted, it prints the mockup's three lines, and exits 0.
2. **Given** that worktree with an untracked file `notes.txt`, **When** `ura clean web-ui` runs,
   **Then** the worktree, `notes.txt`, and the branch stay, it prints the "uncommitted or untracked
   files" lines, and exits 1.
3. **Given** the branch `2026-10-11-web-ui` with 2 commits after the merge, on neither `main` nor
   `origin/main`, **When** `ura clean web-ui` runs, **Then** the worktree is removed, the branch
   stays, it prints "2 commits are on neither main nor origin/main", and exits 1.
4. **Given** the merge is on `origin/main` and the local `main` is behind it, **When**
   `ura clean web-ui` runs, **Then** the branch is deleted: its commits are on `origin/main`.
5. **Given** the main checkout on `2026-10-11-web-ui`, **When** `ura clean web-ui` runs, **Then**
   nothing changes, it prints "your checkout is on it", and exits 1.
6. **Given** the merged features `2026-10-10-cli-core` and `2026-10-11-web-ui` both with a branch
   left, **When** `ura clean` runs without a target, **Then** nothing changes, it lists both, and
   exits 1; **When** `ura clean --all --dry-run` runs, **Then** it prints what it would do for both,
   and nothing changes.
7. **Given** the feature `2026-10-12-finish-feature` not merged, **When** `ura clean finish-feature`
   runs, **Then** nothing changes, it prints
   `ura: 2026-10-12-finish-feature is not merged: only merged features are cleaned`, and exits 1.
8. **Given** the merged bug `2026-10-14-completed-tasks-reappear` with
   `.worktrees/fix/2026-10-14-completed-tasks-reappear` and the branch
   `fix/2026-10-14-completed-tasks-reappear`, **When** `ura clean completed-tasks-reappear` runs,
   **Then** both are removed.

### US4: Change a finished feature during its pull request (P2)

When the human asks for changes on the pull request, the agent amends the code and the record: its
Behaviour or Design is updated in place, so it stays true to the merged code, and the change is
listed under "Changes after approval". When a change needs a new round of questions, the agent
reverts the finishing commit, so the folder is back, carries the changes made since finishing into
the spec and the plan, turns the pull request back into a draft, and starts the round. Once the
feature is built again, it finishes again.

Why this priority: finishing before the merge moves the review of the pull request after it, so the
record must stay true to the merged code ([Q2](clarifications-01.md#q2-when-does-finishing-happen)).

Acceptance scenarios:

1. **Given** a finished branch whose pull request has changes requested, **When** `ura next` runs,
   **Then** it prints the step `pull-request-changes`, to follow `implementation.md`.
2. **Given** a branch whose finishing commit was reverted, its folder back with every plan step
   checked, and its pull request back to a draft, **When** `ura next` runs, **Then** it prints the
   step `finish`.
3. **Given** that branch with a new `clarifications-02.md` `awaiting-human`, **When** `ura next`
   runs, **Then** it stops at the human gate on `clarifications-02.md`.

### US5: Finish the three merged features (P2)

A task of this feature writes the records of the stack decision, the CLI core, and the web UI from
their folders and the git log, deletes the folders, and rewrites every link into them. This
feature's own finishing commit then holds only its own record.

Why this priority: they are the noise the proposal describes, and the first test of the record
format ([Q7](clarifications-01.md#q7-are-the-three-merged-features-finished-too)).

Acceptance scenarios:

1. **Given** `main` with `specs/2026-10-10-stack-decision/`, `specs/2026-10-10-cli-core/`, and
   `specs/2026-10-11-web-ui/`, **When** the migration task is done, **Then** none of the three
   folders exists, and `specs/done/` holds `2026-10-10-stack-decision.md`, `2026-10-10-cli-core.md`,
   and `2026-10-11-web-ui.md`, linking their pull requests #1, #2, and #3.
2. **Given** the 26 links of `specs/decisions/` and the 8 of `specs/drafts/cli-tuis.md` into those
   folders, **When** the migration task is done, **Then** each points into the matching record, and
   `ura check specs` reports no problem.

### US6: Finish a bug the same way (P3)

A bug's folder, `specs/bugs/YYYY-MM-DD-<slug>/`, is finished like a feature's, into the same
`specs/done/` folder, once its fix is done.

Why this priority: bug folders accumulate the same way, and no bug is merged yet
([settled points](clarifications-01.md#settled-without-the-human)).

Acceptance scenarios:

1. **Given** the branch `fix/2026-10-14-completed-tasks-reappear` with
   `specs/done/2026-10-14-completed-tasks-reappear.md`, `kind: bug`, and no bug folder, and a draft
   pull request, **When** `ura next` runs, **Then** it prints the step `finish`.
2. **Given** that record merged into `main`, **When** `ura status` runs, **Then** "Done" lists
   `fix/2026-10-14-completed-tasks-reappear` as `merged`.

## Edge cases

- **The session stops after the draft pull request, before the finishing commit**: the folder and
  the draft give the step `finish`, and the next agent writes the record without reviewing again.
- **The finishing commit is pushed, and the session stops before the pull request is ready**: the
  record and the draft give the step `finish`, and the next agent only marks it ready.
- **No pull request can be opened**: the agent finishes without one, leaves `pull-request` out of
  the record's frontmatter, and pushes; the record and no pull request give the step `finish`, which
  opens the pull request once it can.
- **A forge without draft pull requests**: the agent writes the finishing commit first, then opens
  the pull request, and adds its URL to the record in a second commit,
  `finish(<slug>): link the pull request`.
- **A link into the folder from another feature in flight**: finishing only rewrites links on its
  own branch. Once it is merged, `ura check` on the other branch reports the broken link, and that
  branch fixes it.
- **A link to a file or section other than a question**: it points to the first question, by round
  then number, whose text links that same file and section; otherwise to the record, without an
  anchor.
- **A feature with several rounds**: the record has `### Round 01`, `### Round 02`, ..., each with
  its questions. A question whose text repeats an earlier one gets the renderer's `-1` suffix, and
  the rewritten link follows it.
- **A follow-up question `Q2.B`**: a `#### Q2.B: ...` heading right after its parent, with its
  answer, only when it applied.
- **Free-text answers**: the record shortens them to their decision in a sentence, quoting the
  human's words where they are the decision.
- **A pull request opened before this change, with the folder**: it merges as today, and the feature
  shows as done from its folder; a human may ask to finish it later, through a pull request.
- **Both a folder and a record for the same feature on the default branch**: the record wins in
  `ura`. The example has both on purpose, its folder as the model of every file.
- **A merge known only to the remote**: a record on the local default branch or on its
  remote-tracking branch makes the feature merged, so a stale local `main` never sends an agent to
  finish it again.
- **A squash merge**: `ura clean` removes the worktree, and leaves the branch, whose commits are not
  on the default branch, with the `git branch -D` line. The full files stay in the pull request; the
  skill advises merge commits or rebases.
- **A worktree outside `.worktrees/`**: `ura clean` leaves it and the branch, and prints "checked
  out in <path>: remove that worktree yourself".
- **A locked worktree**: `ura clean` leaves it and the branch, and prints "the worktree is locked:
  unlock it with git worktree unlock, then run ura clean again".
- **A worktree folder deleted by hand**: git still lists the branch as checked out there.
  `ura clean` runs `git worktree prune` first, which only drops the records of missing folders, then
  deletes the branch.
- **`ura start` on a name taken by a record**: refused like a taken folder, "specs/done/<folder>.md
  exists: choose another slug". A bug started by hand follows the same rule.
- **A record edited after the merge**: records are frozen once merged; `ura check` does not enforce
  it, and the skill says to edit a record only to fix a broken link.

## Success criteria

- **SC-001**: Each of the three migrated records is at most 250 lines, and the feature folders'
  10,405 lines on `main` become at most 750 lines of records.
- **SC-002**: After the migration, `ura check specs` reports no problem, and no file in the
  repository links into a deleted folder.
- **SC-003**: In the tests, `ura clean` never removes a worktree that holds an uncommitted or
  untracked file, and never deletes a branch with a commit absent from both the local and the remote
  default branch.
- **SC-004**: For every state of a finished feature or bug in the tests, `ura next` gives the step
  of the skill's table.
- **SC-005**: `vp run ready` passes, the example included.

## Design

### Approach

Finishing is a workflow step, written in a new reference, `finish.md`, and run as the last commit of
the branch, after the final review of a feature or the fix of a bug, while its pull request is a
draft ([Q2](clarifications-01.md#q2-when-does-finishing-happen)). The draft marks the review as
done, and its readiness marks the finishing as done, so every state between the two is found from
the branch and its pull request alone. The record follows the precedent of changesets and Python
PEPs: a short summary written when the work is fresh, frozen once merged, with the full files kept
in git and in the pull request ([discovery](discovery-01.md#what-stays-on-the-default-branch)). Its
question headings reproduce the questions files' headings, so links keep their anchors
([Q3](clarifications-01.md#q3-where-do-links-to-a-finished-feature-point)). No living description of
the system is added: the code holds the current state, and the constitution and decisions hold what
the code does not
([Q8](clarifications-01.md#q8-should-uraeda-also-keep-a-living-description-of-the-system)).

`ura` reads a record as a finished feature, wherever it is, and keeps reading merged folders for the
features finished before this change. `ura clean` performs the cleanup only on request, with the
guards of the [changed git decision](../decisions/git.md#proposed-change-2026-10-12-finish-feature).

### Data

**The record**, `specs/done/YYYY-MM-DD-<slug>.md`, named after the feature's or the bug's folder,
from a new template, `assets/templates/specs/done/YYYY-MM-DD-feature-slug.md`:

```markdown
---
kind: feature
pull-request: https://github.com/owner/repo/pull/12
---

# Record: [Feature name]

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on [date], finished on [date],
> in [its pull request](url). Its full files are in git:
> `git log -- specs/YYYY-MM-DD-feature-slug/`.

## What and why

## Behaviour

## Design

## Questions

### Round 01

#### Q1: [The question, as it was asked]

**Answer:** [The answer, in a sentence]

## Decisions

## Changes after approval

## Follow-ups
```

- Frontmatter: `kind`, required, `feature` or `bug`; `pull-request`, optional, a URL.
- Title: `Record: ` then the feature's name, the spec's title without `Spec: `, or the bug report's.
- **What and why**: the proposal's or the report's intent, in two to four sentences.
- **Behaviour**: each user story in one line, with the rules a later feature must keep; for a bug,
  the behaviour fixed. Kept true to the merged code.
- **Design**: the approach, and the main components with links to the code; for a bug, the root
  cause and the fix.
- **Questions**, optional, absent for a bug: every round, then every question with its exact heading
  text, and its answer in a sentence: the letters and what they chose, or the human's words,
  shortened. The human's notes on the settled points, when they wrote any, follow their round's
  questions under `#### Notes`.
- **Decisions**, optional: each decision the feature made or changed, linked, in a line.
- **Changes after approval**, optional: the rulings that change behaviour, the spec's revisions
  after its approval, and the changes asked on the pull request, one line each.
- **Follow-ups**, optional: the deferred minor findings and the work left, one line each.
- Length: about 100 to 200 lines, at most 250.

**Links**: every link into a finished folder, in any file of the branch, is rewritten to the record.
A link to a question, `clarifications-NN.md#<anchor>`, keeps its anchor. A link to any other file or
section points to the first question, by round then number, whose text links that same file and
section; otherwise to the record, without an anchor.

**`ura`'s workspace** (`crates/core/src/workspace.rs`):

- `FileKind::Record`, for a file of `specs/done/`; it has no status.
- A finished feature has `path: "specs/done"`, and one file, `<folder>.md`, of kind `record`. Its
  `kind`, and so its branch, `<folder>` or `fix/<folder>`, come from the record's frontmatter. Its
  title is the record's title without `Record: `.
- `Feature` gains `left_worktree: Option<String>` and `left_branch: Option<String>`, set only for a
  merged feature or bug whose local branch, or worktree, still exists, and serialized as
  `left-worktree` and `left-branch`.
- Merged, the step `done`: a record or a folder on the default branch's tip, local or
  remote-tracking; the record wins when both exist. Finished, not merged: a branch whose tip, or
  worktree, has the record and no folder.
- `PullRequest::Draft`, from `isDraft` in the `gh pr list` query, apart from `Open`.
- `StepName::Finish`, `finish`, waiting on an agent, with the reference `finish.md`.

**The skill's step table**: these rows come right after the proposal's gate, in this order, and
replace the row "every step of `plan.md` is checked, and the branch has no pull request":

| State of the branch                                                    | Step                                                     |
| ---------------------------------------------------------------------- | -------------------------------------------------------- |
| The feature's record is in `specs/done/`, and no pull request is ready | [Finish](#components): the steps left                    |
| The record, and the pull request has changes requested                 | Implementation, changes                                  |
| The record, and the pull request is ready for review                   | **Human gate**: the review happens on the pull request   |
| Every step of `plan.md` is checked, and the pull request is a draft    | [Finish](#components)                                    |
| Every step of `plan.md` is checked, and there is no pull request       | Implementation, final review, then [Finish](#components) |

The existing rows for a pull request with changes requested, or open, stay last, for features whose
pull request was opened before this change. The bug table changes the same way, with the fix in
place of the plan.

### Components

- **The skill** ([`skills/uraeda/`](/skills/uraeda/)):
  - `references/finish.md`, new: when it runs and what it does from each state of the table above;
    opening the draft pull request; writing the record from each file; the link rewriting rule; the
    finishing commit, with the `PRIORITIES.md` line; marking the pull request ready, its description
    ending with "Once merged, run `ura clean` to remove the worktree and the branch.", for features
    and bugs; changes asked on the pull request, and the revert for a new round, with the changes
    carried back into the spec and the plan and the pull request back to a draft; advice to merge
    with merge commits or rebases, not squash; cleaning by hand, `git worktree remove` then
    `git branch -D` after the same checks as `ura clean`; and finishing a feature merged before this
    step, through a pull request.
  - `SKILL.md`: the `specs/` layout with `done/`, the step tables, the `finish:` commit type, a
    "Finishing a feature" section next to starting one, and, in finding the next step, "tell the
    human to run `ura clean` when a merged feature has a worktree or a branch left"; `ura clean` in
    the CLI table.
  - `references/implementation.md`: the final review hands over to `finish.md`, the pull request
    section moves there, and changes requested amend the record, its Behaviour or Design in place.
  - `references/bug.md`: its fix ends with `finish.md`.
  - `references/spec.md`: decisions link to the question, and finishing rewrites the link.
  - `assets/templates/specs/done/YYYY-MM-DD-feature-slug.md`, new, and `README.md`'s layout.
  - `assets/example/specs/done/2026-10-06-recurring-tasks.md`, new, the model record. The example
    keeps its folder as the model of every other file, and its decisions keep linking into it.
- **The README** ([`README.md`](/README.md)): its walkthrough of the example gains the finishing
  step, and links the example record.
- **The core** ([`crates/core/`](/crates/core/)):
  - `workspace.rs`: records, `left_worktree` and `left_branch`, and the remote-tracking default
    branch, as in **Data**.
  - `steps.rs`: `Finish`, `PullRequest::Draft`, and the rows above, for features and bugs.
  - `check/`: `Checked::Record` for `.md` files of `specs/done/`, with the record template's
    sections, `kind` and `pull-request` in `values.rs`, the `Round` and `Q` headings numbered from 1
    in `sections.rs`, as `sections.numbering`, and `done` among `specs/`'s fixed folders in
    `names.rs`.
  - `git.rs`: `has_local_changes`, a gix status read with untracked files and without ignored ones;
    `is_locked`, from the worktree's records; `prune_worktrees`, `remove_worktree`, and
    `delete_branch`, through `git`; and `unmerged_commits`, the commits of
    `git cherry <base> <branch>` marked `+` against both the local and the remote-tracking default
    branch.
  - `actions/clean.rs`, new: the cleanup of one merged feature or bug, returning what it did and
    what it left, with the reason for each; it never prints. It reads the worktree's state before
    calling git, and never parses git's messages.
  - `actions/init.rs`: `done/` with its `.gitkeep`. `actions/start.rs`: refuses a name taken by a
    record.
  - `view.rs` and `api.rs`: `left_worktree` and `left_branch` in the feature view, and a record read
    as a file of its feature.
- **The CLI** ([`crates/cli/`](/crates/cli/)): `clean.rs`, new,
  `ura clean [target] [--all] [--dry-run]`, resolving its target with the shared rule, among merged
  features and bugs with something left; `status.rs` and `next.rs`, the texts of the
  [mockup](mockups/cli-output.md).
- **The web UI** ([`packages/web/`](/packages/web/)): `FeaturePage.tsx` shows the note for leftovers
  and no "not yet" rows for a finished feature; `labels.ts` labels `record` files and the `finish`
  step.
- **Fixtures** ([`fixtures/`](/fixtures/)): a merged feature with a record on `main`, a finished
  feature on its branch, a merged bug, and broken records for the checks.
- **Migration**, a task of the plan: the three records, the deleted folders, and the rewritten links
  in `specs/decisions/` and `specs/drafts/cli-tuis.md`.

### Mockups

- [Command output](mockups/cli-output.md): `ura status` and `ura status --json` for finished and
  merged features, the `ura next` reminder, and every outcome of `ura clean`.
- [Web UI](mockups/web-ui.html): the home screen's done rows, a merged feature's page with its
  worktree left, and a feature finished on its branch.

### Error handling

- `ura clean`: each outcome of the [mockup](mockups/cli-output.md), with exit 1 when anything was
  left or refused. A git command that fails anyway is reported with its exit status, and what it
  concerned is left.
- `ura clean` without a merged feature to clean: "Nothing to clean: no merged feature has a worktree
  or a branch left.", exit 0.
- `ura clean <target>` on an unknown name: the shared target rule's message, exit 1.
- A record whose frontmatter does not parse: `ura check` reports it, and `ura status` lists the
  feature with "invalid files: run ura check", as for any workflow file.

### Testing

The Rust integration tests build temporary repositories with the existing `TestRepo` helper: a
`main` and an `origin` with records or folders, feature and bug branches merged by a rebase, a merge
commit, or a squash, and worktrees under `.worktrees/`, then run the core's functions and the `ura`
binary on them. Pull request states come from the `lookup` the step functions already take. The web
UI's tests render the feature page from fixtures through the server, as today.

| What                                                           | Test                                                                                     |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| US1.1, US2.7, US2.8                                            | `crates/core/tests/check.rs`, with the example and broken records                        |
| US1.2                                                          | `crates/core/tests/check.rs`, the example record's anchors against its questions         |
| US1.3 to US1.6, US4, US6.1, the stopped sessions, SC-004       | `crates/core/tests/steps.rs`, one table-driven test of finished states                   |
| US2.1, US2.2, US2.4, US2.5, US6.2, both a folder and a record  | `crates/core/tests/workspace.rs`, and `crates/cli/tests/status.rs` for the text and JSON |
| US2.3                                                          | `crates/cli/tests/next.rs`                                                               |
| US2.6                                                          | `packages/web/src/__tests__/feature.test.tsx`                                            |
| US3, SC-003, squash, worktree outside, locked, deleted by hand | `crates/core/tests/clean.rs` for the core, `crates/cli/tests/clean.rs` for the output    |
| US5, SC-001, SC-002                                            | `ura check specs` in `vp run ready`, and a line count in the plan's task                 |
| `ura start` on a record's name                                 | `crates/core/tests/actions.rs`                                                           |
| SC-005                                                         | `vp run ready` before the pull request                                                   |

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- Records go in `specs/done/`, one flat file per feature, named after its folder.
- A record opens with a `> [!NOTE]` block saying it is the record of a merged feature, not
  instructions, with its dates and pull request.
- The record's template is defined here, and the template and the example get one.
- The agent of the finishing step writes the record, from the feature's files.
- Bugs finish like features, into `specs/done/`.
- The `PRIORITIES.md` entry is still removed in the branch's last commit, now the finishing commit.
- The example keeps `2026-10-06-recurring-tasks/` complete, and gains its record.
- Finishing has its commit type, `finish(<slug>): <feature name>`.
- `git.md`'s line on worktrees changes with the cleanup, as a proposed change.

Settled while writing this spec:

- The pull request is opened as a draft before the finishing commit, so the record can link it and
  the draft marks the final review as done, and marked ready after it.
- The record's question headings sit at level 4 under `### Round NN`, so their anchors equal the
  questions files' anchors, and a link only changes its path.
- Links to anything but a question point to the first question that links the same target, since the
  record keeps no discovery; the record's top otherwise.
- "About 100 to 200 lines" from Q1 becomes a hard limit of 250, for features with many questions.
- Records are frozen once merged, like a final PEP, and are edited only to fix a broken link; a
  later feature that changes the behaviour says so in its own record.
- `ura` keeps reading merged folders as done, so projects with features merged before this change
  keep working.
- A record on the remote-tracking default branch counts as merged, so a merge on GitHub shows before
  `git pull`.
- `ura clean` takes the shared target rule of the [CLI decision](../decisions/cli.md), so it needs a
  target or `--all` when several merged features have something left; `--dry-run` shows what it
  would do, before anything is deleted.
- `ura clean` exits 1 when anything was left, so a script sees it.
- `ura clean` runs `git worktree prune` before deleting a branch, which only drops the records of
  worktree folders already gone.
- `ura next` reminds the human of leftovers on stderr, so its stdout stays the target.
- The web UI shows leftovers and the command, without a button: the cleanup stays in the terminal,
  where the human sees what it removes.
- `ura start` refuses a name a record holds, so a record's name stays unique.
- No living description of the system, and no `PRIORITIES.md` line for one, as you answered.
- This feature is finished by its own new step, as the first real use of it.

## Decisions

Changed, applied when this spec is approved:

- [Git](../decisions/git.md#proposed-change-2026-10-12-finish-feature): tools may remove a merged
  feature's worktree under `.worktrees/` and delete its local branch, only when a human asks; a
  worktree never with `--force`, and a branch with `git branch -D` only once every commit is on the
  local or remote default branch, or patch-equivalent to one; remote branches are never deleted.

Relied on:

- [CLI](../decisions/cli.md): `ura clean` follows the target rule, works without a terminal, prints
  data to stdout and messages to stderr, and the skill describes it with its manual steps; the new
  `--json` fields leave `version` at 1.
- [Stack](../decisions/stack.md): the cleanup and the record reading live in the Rust core, and the
  web UI reads them through the binding.
- [Toolchain](../decisions/toolchain.md): `vp run ready` checks everything, Rust included.

## Constitution check

| Principle                            | Complies | Notes                                                                                                          |
| ------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------- |
| I. Humans stay in control            | yes      | Finishing lands through the pull request the human merges; `ura clean` runs only when the human asks.          |
| II. Git and plain text first         | yes      | Records are markdown in git; the full files stay in git history and the pull request.                          |
| III. Asynchronous by default         | yes      | Every state between the final review and the merge is found from the branch and its pull request.              |
| IV. Review effort matches impact     | yes      | The human reads one record instead of the folder, in the pull request they already review.                     |
| V. Tools are optional                | yes      | `finish.md` gives every step by hand, git commands included; `ura check` validates records whoever wrote them. |
| VI. Code is checked against the spec | yes      | Each acceptance scenario has its test above; `actions/clean.rs` is the only new module.                        |

## Risk tier

**High**: `ura clean` deletes local branches and worktrees, and the migration deletes three merged
folders, both recoverable from git and guarded, but destructive.
