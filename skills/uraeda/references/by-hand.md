# By hand

The mechanical steps of the workflow, for an agent without the `ura` command-line tool. With `ura`,
a command does each of them: see [The `ura` CLI](cli.md). Read a section only when a step sends you
here: nothing in this file changes what a step decides.

## Start, postpone, or drop a feature or a change

Only when the human asks, as [Projects](projects.md#starting-postponing-and-dropping-a-feature)
says.

- **Expand**: a proposal line of `PRIORITIES.md` becomes a proposal file,
  `specs/proposals/<slug>.md` or the next free name with `-2`, `-3`, ..., from the proposal template
  with the line as its title and as the first paragraph of What, followed by its children, which
  leave the line, and no placeholder text, and the line links to it alone. The children's relative
  links are rewritten to point at the same files from the proposal file's folder. With `ura`,
  `ura expand <text>` does it, on the default branch, without committing, and opens the editor.
- **Start**: name the folder with today's date and a slug of two words at most,
  `YYYY-MM-DD-feature-slug`, like `2026-10-06-recurring-tasks`. Propose a slug from the feature's
  name and ask the human for theirs before starting. The date never changes, even if the feature is
  renamed. If a folder or branch with that name exists, choose another slug. With `ura`,
  `ura start <proposal> --slug <slug>` runs these steps for a proposal file or folder of
  `specs/proposals/`, or its name, whatever it holds: the proposal is freeform. Without `--slug`, it
  takes the first two words of the proposal file's name that name something.
  1. On the default branch, create `specs/YYYY-MM-DD-feature-slug/`, and move the proposal file into
     it as `proposal.md`, its words unchanged: the proposal is the human's words, never rewritten.
     Only its relative links change, to point at the same files from the new folder, as **Expand**
     does. When the proposal is a folder, a proposal with images, move all its files into it, the
     same way. A proposal with no file is expanded first, as **Expand** says: the human writes its
     file, and asks for the start once it is ready. Every other file of `specs/` linking a moved
     file points at its new path, in its own form, as
     [where a moved link points](#where-a-moved-link-points) rewrites a moved link. A file with
     uncommitted changes is rewritten too, but stays out of the commit.
  2. In the same commit, move the feature's proposal in `PRIORITIES.md` to the top of **Now**, after
     the other started proposals, then a blank line, unless the human says otherwise, as a link to
     the `proposal.md` from the repository root,
     `[Name](/specs/YYYY-MM-DD-feature-slug/proposal.md)`, and commit with
     `chore(<slug>): start <feature name>`. Commit these files alone: other changes in the checkout,
     uncommitted or staged, stay as they are. The link resolves on the default branch, which holds
     the proposal from the start. Proposals match branches through that link. Started proposals are
     those linking a dated folder's `proposal.md`, a feature's or a change's. Proposals started
     lower in **Now** stay where they are, and no blank line is left at the end of **Now**.
     `PRIORITIES.md` lives on the default branch: branches never write it, and the feature's line
     leaves it after the merge, when the human cleans the feature. While the branch is there, the
     folder is the branch's: the default branch's copy is read as merged only once the branch is
     gone.
  3. Create the branch `YYYY-MM-DD-feature-slug` from there, checked out in its worktree,
     `.worktrees/YYYY-MM-DD-feature-slug/`, unless the human asks to switch their checkout to it.
     Every later step writes on the branch.
  4. Then run the next step in the same session when you can, as
     [finding the next step](../SKILL.md#finding-the-next-step) says: [Discovery](discovery.md),
     round 01, for a proposal alone, or the first matching row of
     [the table](../SKILL.md#finding-the-next-step) for a folder. A round left waiting for answers
     stays at its gate. When the human asks for fresh research, start a new round instead, following
     [going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions).
- **Start as a change**: a bug fix or a small change starts as a [change](change.md), with the same
  steps under its own names: the folder `specs/changes/YYYY-MM-DD-<slug>/`, the branch
  `change/YYYY-MM-DD-<slug>`, and the worktree `.worktrees/YYYY-MM-DD-<slug>/`. A change started
  from an inbox note takes the note's text as its proposal, and the note leaves `INBOX.md` in a
  commit of its own. A line of **Now** started as a change is replaced by the change's link in the
  start commit, as a feature's proposal is. Its nested lines go into the change's proposal, but
  those the request holds already. A line changed since it was read stays, and the link is added
  above it. A line of **Next** or **Later** started as a change leaves `PRIORITIES.md` as before:
  the link is added at the top of **Now**, and the line leaves in a write of its own. A session's
  yes starts one too: see [Change](change.md#starting-a-change). With `ura`,
  `ura start <proposal> --slug <slug> --change` starts a proposal file as a change. By hand, the
  steps above, with the proposal linked to `/specs/changes/YYYY-MM-DD-<slug>/proposal.md`. Then run
  the [change](change.md) step.
- **Start a change as a feature**: on the human's yes, a started change becomes a feature in place.
  It keeps its code and its worktree. With `ura`, `ura start <change> --feature`. By hand, as
  [Upgrading](change.md#upgrading) says.
- **Postpone or block**: the feature or the change leaves the workflow, and only a proposal stays. A
  change's folder is `specs/changes/YYYY-MM-DD-<slug>/`, on its branch `change/YYYY-MM-DD-<slug>`.
  Stop first when its worktree, or its folder on the default branch, has uncommitted changes, since
  they would be lost. An agent working in its worktree writes the default branch where it is checked
  out, the main checkout, with `git -C <main checkout>`.
  1. On its branch, remove its dated folder, and commit with `chore(<slug>): close for postponing`:
     a branch without its folder is no longer a feature or a change, so no tool resumes it in place
     of the new proposal. Its previous commit keeps every file.
  2. On the default branch, write its current state, read on its branch, as a new proposal file,
     `specs/proposals/<slug>.md`, without its date. It keeps the proposal's `discovery` level, its
     `# Title`, a **What** and a **Why**, and the human's words wherever they still hold. What their
     answers, notes, and reviews settled becomes part of the request, said as they decided it, never
     as a question or an option. It ends with what is still open or unverified, and where the
     earlier work lives: the branch, the commit before the one that closed it, and the paths of its
     rounds, its spec, and its rulings, read with `git show <commit>:<path>`. It links no file of
     the folder. A change's proposal ends its **What** saying it was a change, to start again as
     one.
  3. In the same commit, remove the dated folder from the default branch, and move its line in
     `PRIORITIES.md` to the section the human names, **Later** for one not scheduled, after what it
     needs when it is blocked, linked to the new proposal file. Commit these files alone,
     `chore(<slug>): postpone <name>`, only when `PRIORITIES.md` had no other changes: otherwise
     they stay uncommitted, beside the human's edits.
  4. Repair the links into the removed folder, as
     [where a moved link points](#where-a-moved-link-points) says: a link to its `proposal.md`
     points at the new proposal file, and every other one becomes its words. With `ura`,
     `ura check --fix`. Commit them alone, `fix(<slug>): repair the links to moved files`.

  The branch is never merged: its code and its edits to the decisions never reach the default
  branch. Remove the worktree and keep the branch, as **Drop** says below. The worktree an agent
  works in stays, and the human gets `git worktree remove <path>`: its sessions keep their folder
  until then.

- **Drop**: after the human confirms, on the default branch, remove the feature's or the change's
  proposal from `PRIORITIES.md`, and its dated folder, which the start put there, so the default
  branch keeps no folder of a dropped feature or change: it would read as merged once its branch is
  gone. Stop first when that folder has uncommitted changes, since they would be lost. Commit both
  alone, `chore(<slug>): drop <name>`, only when `PRIORITIES.md` had no other changes: otherwise the
  removals stay uncommitted, beside the human's edits. After that commit, links to the folder read
  as deleted. Repair them as [where a moved link points](#where-a-moved-link-points) says: each
  becomes its words. With `ura`, `ura check --fix`. Commit them alone,
  `fix(<slug>): repair the links to moved files`. Remove its worktree, never forced. It stays when
  it has uncommitted changes, is locked, is the one you are in, or is outside `.worktrees/`: then
  say where it stays. Keep the branch, so nothing is lost, and give the human
  `git branch -D <branch>` to delete it. A merged feature is not dropped: `ura clean` removes it.

## Make a change a feature

The move behind [upgrading](change.md#upgrading), once the human said yes.

1. Check first, and stop if one fails, saying why. The change is not done: a merged change is
   cleaned, not moved. It has no pull request: close it first, since its branch would be renamed.
   Its worktree has no uncommitted changes, and no untracked file in the change's folder or
   `specs/decisions/`, nor in its folder on the default branch. No branch or folder named
   `YYYY-MM-DD-<slug>` exists: if one does, rename or remove it first.
2. On the default branch, relink the change's proposal in **Now**, in place, to
   `/specs/YYYY-MM-DD-<slug>/proposal.md`. When no proposal links the change, add one at the top of
   **Now** instead, named `<slug>`. Move `specs/changes/YYYY-MM-DD-<slug>/`, which the start put
   there, to `specs/YYYY-MM-DD-<slug>/`, so the proposal never links a missing folder. Commit both
   together, `chore(<slug>): start <name> as a feature`.
3. Rename the branch: `git branch -m change/YYYY-MM-DD-<slug> YYYY-MM-DD-<slug>`. The worktree stays
   where it is. A pushed branch is renamed locally only: the old remote branch stays until the human
   deletes it. Unset its upstream, `git branch --unset-upstream YYYY-MM-DD-<slug>`, so the next
   `git push -u` sets the feature's.
4. In the worktree, move `specs/changes/YYYY-MM-DD-<slug>/` to `specs/YYYY-MM-DD-<slug>/`, its files
   unchanged. Every file of `specs/` but `PRIORITIES.md` linking into the old folder, the moved one
   included, points at the new one, as [where a moved link points](#where-a-moved-link-points)
   rewrites a moved link. The decisions the branch changed were approved for the change only: the
   feature's spec lists them again. Commit `chore(<slug>): upgrade to a feature`.

The code the change committed stays on the branch, and the feature's spec describes it as built. The
feature has answered rounds and no discovery file, so its first step is the
[spec](spec.md#is-the-scope-clear). It reads the change's rounds, which settled the change, not the
feature's scope. It starts a new round, with its discovery file, at the proposal's
[discovery effort](discovery.md#discovery-effort). Run it in the same session.

**To split one item out of a batch**, on the human's yes: on the default branch, write that item's
text as `specs/proposals/<item-slug>.md`. Add its proposal to **Now**, first after the started
proposals and their blank line, not nested under the change's proposal. Commit
`chore: expand <Name>`. Then make the other items. The branch never writes `PRIORITIES.md`: the
change's proposal keeps its line, nested lines included, until the merge, and `ura clean` then
removes that line with all its nested lines, on the default branch. The new proposal has a line of
its own, not nested, so it stays.

## Where a moved link points

By hand, `git log -M --name-status -- <path>` lists the commits that removed a missing file. Follow
its newest removal, then the new path's removals after it, to the end:

- **A rename**, as git detects it, moved the file.
- **A start** moved it: a commit removing one proposal or note main file, `proposals/<x>.md`,
  `proposals/<x>/proposal.md`, `notes/<x>.md`, or `notes/<x>/note.md`, that git did not see renamed,
  pairs it with the one file the same commit added, not by a rename, that is either a dated folder's
  `proposal.md` or a main file named `<x>` or `<x>-<n>`, as a file made a folder or a note moved to
  the proposals is. With no such file, or more than one, the commit deleted it. The pair holds even
  when the file was edited past git's rename detection.
- **A change made a feature** moved `specs/changes/<folder>/<file>` to `specs/<folder>/<file>`.
- **A finish**: a commit adding `specs/done/<folder>.md` turned every file it removed from
  `specs/<folder>/` or `specs/changes/<folder>/` into that record.
- **Otherwise** the commit deleted the file.
- **A folder** went where its files went, when the newest commit removing any of them sent all the
  files it removed to one folder, one record, or one deletion.

Then rewrite the link:

- **Moved**: point it at the new path, in its own form. A rooted link, `/specs/...`, stays rooted,
  and a relative one is written from its file's folder; Its anchor, title, and `<…>` stay, and a
  link to a folder keeps its trailing `/`.
- **Became a record**: point it at the record. A question's anchor in a `clarifications-NN.md`,
  `#q<number>...`, stays; any other anchor is dropped. A file of the folder that is not markdown,
  like an image, counts as deleted: the finish deleted it.
- **Deleted**: a link becomes its words, and an image its alt text. A reference definition,
  `[label]: path`, stays.

A path no commit ever removed, or one back at the tip, is left as it is. So are wikilinks, links in
code, and links outside `specs/`, in `README.md`, `docs/`, or code comments. `ura check` keeps
reporting the ones in `specs/`. Its `links.file` message says where each file went:
`no file <path>: it moved to /<new path>`, `...: it became the record /specs/done/<folder>.md`, or
`...: deleted in <commit> (<subject>)`.

## Whether a pull request is behind, or lacks commits

Read the pull request's head with `gh pr view <branch> --json headRefOid`. The branch lacks nothing
when `git merge-base --is-ancestor <branch> <head>` succeeds, or when the head is not in the
repository: the branch is then most likely behind it.

A branch is **behind** when neither it nor `origin/<branch>` holds the tip of `origin/<default>`, or
of the local default branch without a remote, and the commits it lacks change any file but the
default branch's own. Those are `PRIORITIES.md`, `INBOX.md`, `INBOX-TRIAGE.md`, `proposals/`,
`notes/`, and a started folder's `proposal.md`, all under `specs/`: a branch never changes them.
With `ura`, `ura next` names the step. By hand, after `git fetch`, the branch lacks the tip when
`git merge-base --is-ancestor origin/<default> <branch>` fails, and fails for `origin/<branch>` too.
Then `git diff --name-only <merge-base> origin/<default>` lists the files the commits it lacks
change. A branch the default branch already holds,
`git merge-base --is-ancestor <branch> origin/<default>` succeeding, is merged, not behind. When one
of `<branch>` and `origin/<branch>` holds the other, only the newer one counts. Without a remote,
use `<default>` for `origin/<default>`.

## Read a pull request's comments

- **Review threads** come from `gh api graphql`, on the pull request's `reviewThreads`: each
  thread's `isResolved` and `isOutdated`, and each comment's `author`, `path`, `line`, `body`, and
  `createdAt`.
- **Reviews and comments** come from `gh pr view <number> --json reviews,comments`, and count when
  posted after the last push. Fetch first, then take the remote branch's last commit date as the
  last push's: `git log -1 --format=%cI origin/<branch>`. A commit pushed later than it was made
  only counts more comments, never fewer.

```bash
gh api graphql -f owner=<owner> -f repo=<repo> -F number=<number> -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100) {
          nodes {
            isResolved
            isOutdated
            comments(first: 100) { nodes { author { login } path line body createdAt } }
          }
        }
      }
    }
  }'
```

A pull request with more than 100 threads, or a thread with more than 100 comments, is read page by
page, with `pageInfo { hasNextPage endCursor }` and `after:`.

## Clean up after a merge

From the main checkout, never forced:

1. `git worktree remove .worktrees/<folder>`: git refuses a worktree with uncommitted or untracked
   files, and they stay until the human deals with them. `git worktree prune` drops the record of a
   worktree folder already deleted.
2. `git branch -D <branch>`, only when every commit of the branch is on the default branch:
   `git log --cherry-pick --right-only --format=%H <default>...<branch>` lists the commits it lacks.
   When the merge is only on the forge yet, run it with `origin/<default>` too: a commit counts as
   merged when either list leaves it out. `-D`, because `-d` refuses a rebased branch.
3. On the default branch, remove the line of `PRIORITIES.md` linking the folder's `proposal.md`,
   with the blank line after it when it was the last started proposal, and commit it alone,
   `chore(<slug>): remove "<name>" from the priorities`, `<name>` the line's text. When
   `PRIORITIES.md` has other uncommitted changes, remove the line without committing: they are
   someone's work in progress. A line already gone needs nothing.

Remote branches are the forge's: GitHub's "Automatically delete head branches" setting removes them.

## A forge without draft pull requests

Write the record first, then open the pull request, and add its link to the record in a second
commit, `finish(<slug>): link the pull request`. When no pull request can be opened, leave
`pull-request` out of the record, and push the branch.

## The inbox, by hand

### Write a note

The human's notes are written on the default branch, from any checkout, like `PRIORITIES.md`: in the
checkout or worktree that has the default branch, see [Branches](conventions.md#branches). An
agent's notes are note files of their own, written in its own worktree, see
[agents' notes](inbox.md#agents-notes). Write one line per note, at the end of its category, or
after the last note without one. A new category goes at the end of the file. When `INBOX.md` does
not exist, create it as `# Inbox`, a blank line, and the note, and add that title to a file without
one.

- **By hand**: add the line, then commit `specs/INBOX.md` alone, with
  `chore: add "<note>" to the inbox`. When it has other uncommitted changes, write the note without
  committing: they are someone's work in progress.

### Images on a note

An image belongs beside the file that links it, and `INBOX.md` has no folder of its own: a note's
images live in its note file's folder, in `specs/notes/`. By hand, to add images to a note:

1. When the note has no note file, write one, `specs/notes/<slug>/note.md`. A note file is free
   form, from no template: the note's text is its `# ` title, and its sub-items follow. The note's
   line becomes a link to the file, with its marks kept and no sub-items left. When the slug is
   taken, it gets `-2`, `-3`, ...
2. Put each image in the note file folder's `images/`, and link it at the end of the file, each on a
   line of its own after a blank line: `![alt](images/name.webp)`. A single-file note file,
   `<slug>.md`, becomes a folder first, `<slug>/note.md`, and the links to it follow.

An image no file of its folder links is an orphan: a commit of the folder deletes it, and one left
in a folder nobody has committed stays on disk. `ura inbox clean` lists them with `--dry-run`, and
deletes them without it, in every folder of `specs/proposals/` and `specs/notes/`, leaving the
deletion uncommitted. By hand, delete the files of `images/` that no markdown file of the folder
links.

### What a note becomes

The human decides what each note becomes. Each outcome moves the note out of `INBOX.md`, in the same
commit as what it became:

- **A proposal**: the note's lines become the last proposal of a `PRIORITIES.md` section, links kept
  and marks dropped. A note with a note file takes it along: the file, or its folder with its
  images, moves to `specs/proposals/` under a free name, its `note.md` becoming `proposal.md`, and
  the line links its new path. A proposal file needs a `## What`, so a free-form note file takes the
  proposal template's shape on the way: its `# ` title as the title and the first paragraph of What,
  the rest of its text after it, and no placeholder text. A note file with a `## What` moves as it
  is.
- **A new proposal file**: `specs/proposals/<slug>.md` from the proposal template, with the note as
  its title and the first paragraph of What, and no placeholder text, linked from the end of a
  section of `PRIORITIES.md`. When the slug is taken, it gets `-2`, `-3`, ... A note with a note
  file moves it there instead, as above.
- **A line of an existing proposal file**: the note's lines, marks dropped, at the end of the
  proposal file's `## What` section. A note with a note file goes into the proposal file's
  `## Notes` instead, added at the file's end when it has none: the note file's text at its end,
  under a `### <note title>` heading, its own headings nested below it and its images moved beside
  the proposal file (a single proposal file becomes its folder's `proposal.md`). The note file is
  deleted. A note with a note file can go into any proposal of `PRIORITIES.md`: a proposal without a
  file gets one first, `specs/proposals/<slug>.md` from the proposal template, named after the
  proposal's text, which is its title and the first paragraph of What, its sub-items after it, or
  `<slug>/proposal.md` when the note file has images. The proposal becomes a link to it, alone, and
  the note goes into its `## Notes`.
- **A change**, for a bug or a small change: the note becomes a new proposal file, as above, which
  the human then starts as a change, as [starting a change](change.md#starting-a-change) says. The
  note leaves the inbox in the proposal file's commit. Starting makes a branch, which only the human
  asks for: the inbox page has no action for it.
- **Nothing**: the note is deleted, with its note file and the images in it. A note file with
  uncommitted changes the note did not write stays, unlinked: tell the human. A note linking a
  proposal file loses its line only: the file stays.

A note can also have its text edited, its marks kept, or move, with the lines indented under it, to
another place in its category or to another category.

An agent's note is organized like a note with a note file, once its line is written: any outcome, or
edit, first adds its line, `- [agent] [<slug>] [<title>](notes/<file>)`, at the end of its category
in `INBOX.md`; an outcome or edit that fails leaves `INBOX.md` as it was. Nothing deletes the file
but its removal; a move puts the line where the note goes, and drops the file's `category`, which
the line now carries. A move that drops the note where it already shows changes nothing. Its removal
leaves `INBOX.md` as it was, and deletes the file: `chore: remove "<note>" from the inbox`. Only a
file as committed is removed: one edited since its commit, or never committed, holds someone's work,
and the removal refuses with `<path> has uncommitted changes: the note was not removed`. Undo of the
removal brings the file back alone when the note goes back where it showed, and writes its line
anywhere else.

A note file that moves takes its links along: every file of `specs/` but `PRIORITIES.md` and
`INBOX.md` linking it points at its new path, as
[where a moved link points](#where-a-moved-link-points) rewrites a moved link. A note file merged
into a proposal file is linked at the `### <note title>` heading it became. A file with uncommitted
changes is rewritten too, but stays out of the commit.

Commit `INBOX.md` with the files the notes went into, their note files' moves and removals included,
the files whose links changed, and nothing else. The message names the one change, with the note's
text shortened like a proposal's: `edit "<note>" in the inbox`, `remove "<note>" from the inbox`,
`move "<note>" within <Category> in the inbox`, `move "<note>" to <Category> in the inbox`, with
`No category` for none, `move "<note>" from the inbox to <Section>`, or
`move "<note>" from the inbox to the proposal <title>`, each with `chore:`. A note counts as moved
only when the proposal, or the proposal file's line, has its exact text: one edited on the way is a
removal and an addition. With more changes, `PRIORITIES.md`'s included, the subject names the first
one and ends with `, and <count> more`, and the body lists every change, one per line, the inbox's
first: `- Move from the inbox to Next: <note>`, `- Remove from the inbox: <note>`. Each other file
of `specs/` whose only change since `HEAD` is its links, as a move or a Fix rewrites them, is a
change of its own, after the lists': `repair links in <file>` as a subject, `- Repair links: <file>`
as a line, `<file>` its name, or its path from `specs/` when another repair has the same name. See
[Commits](conventions.md#commits).

## Commits a human or a tool makes

Tools save the human's edits and never commit them on their own. An edit waits until the human
commits it, or runs an action that says it commits, like submitting a round's answers. Starting a
feature or a change may commit on its own. A tool commits the files the human staged, with the
message they typed, in the checkout that holds them.

The human's commits, and the agent's when the human asks, use the step's type for what they answer
and `chore:` for the rest. `ura` and other tools write the same messages. A message the human typed
is committed as typed.

| Commit                             | Example                                                                                                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Answer a round of questions        | `discovery(recurring-tasks): answer round 01`                                                                                                       |
| Approve, or request changes        | `spec(recurring-tasks): approve`, `plan(recurring-tasks): request changes`                                                                          |
| A proposal file, then its edits    | `chore: expand Recurring tasks`, `chore: edit the proposal Recurring tasks`                                                                         |
| A started proposal, then its edits | `chore(recurring-tasks): proposal`, `chore(recurring-tasks): edit the proposal`                                                                     |
| A note file, then its edits        | `chore: add the note Sort completed tasks`, `chore: edit the note Sort completed tasks`                                                             |
| Start, postpone, drop              | `chore(recurring-tasks): start Recurring tasks`, `chore(recurring-tasks): postpone Recurring tasks`, `chore(recurring-tasks): drop Recurring tasks` |
| `PRIORITIES.md` alone              | `chore: move "Recurring tasks" to Next`                                                                                                             |
| A merged feature's line, cleaned   | `chore(recurring-tasks): remove "Recurring tasks" from the priorities`                                                                              |
| A note                             | `chore: add "Sort completed tasks" to the inbox`                                                                                                    |
| `INBOX.md`, and where notes go     | `chore: move "Sort completed tasks" from the inbox to Next`                                                                                         |
| The inbox triage                   | `chore: propose an inbox triage`, `chore: answer the inbox triage`, `chore: apply the inbox triage`                                                 |
| Notes moved into the inbox         | `chore: move the scratchpad to the inbox`                                                                                                           |
| Drafts moved to the proposals      | `chore: move the drafts and the backlog to the proposals`                                                                                           |
| A file edited as a buffer          | `chore: edit specs/PRIORITIES.md`, on a feature's branch `chore(recurring-tasks): edit spec.md`                                                     |

A commit of `PRIORITIES.md` alone names its one change: `add "<proposal>" to <section>`,
`remove "<proposal>"`, `edit "<proposal>"`, `move "<proposal>" to <section>`, or
`move "<proposal>" within <section>`, with the start of the proposal's text. With more changes, the
subject names the first one and ends with `, and <count> more`, and the body lists every change, one
per line: `- Add to Now: <proposal>`.

A commit of `INBOX.md`, with the `PRIORITIES.md` and proposal files its notes went into, names its
changes the same way: `add "<note>" to the inbox`, `edit "<note>" in the inbox`,
`remove "<note>" from the inbox`, `move "<note>" to <Category> in the inbox`,
`move "<note>" from the inbox to <Section>`, or
`move "<note>" from the inbox to the proposal <title>`. See [Inbox](inbox.md).

`ura` and other tools amend the latest commit rather than add one when both are `chore:` commits
without a scope, of `INBOX.md`, `PRIORITIES.md`, and files under `specs/proposals/` and
`specs/notes/` alone, on the default branch. The latest commit has one parent, and no other branch,
remote branch as last fetched or pushed, or tag holds it: a commit pushed and known to be pushed
stays as it is. Its message is not one the human typed, and neither is the new commit's. Its body
must be empty or a list of changes, and the amend must not leave it empty. The amended subject names
the first change and ends with `, and <count> more`, and the body lists every change of both
commits, a commit's one change given by its subject: `- Add "<note>" to the inbox`. By hand,
amending is optional.
