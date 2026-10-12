# Finish

Replaces a feature's or a bug's folder with one record, the last commit of its branch, so the
default branch keeps what later readers need and git keeps the rest. Then marks the pull request
ready for the human.

- **Runs when**: the final review of a feature, or the fix of a bug, is done and its pull request is
  a draft; or the branch has the record, and its pull request is not ready yet
- **Writes**: `specs/done/YYYY-MM-DD-<slug>.md`, the deletion of the folder, the links into it, the
  `PRIORITIES.md` entry, and the pull request
- **Ends at**: a human gate, the pull request

A merged folder is mostly process: discovery notes, questions with their options, a plan with every
box checked. Kept on the default branch, it clutters the file tree and every search, and a finished
plan reads like instructions to an agent that finds it. The record keeps what a reader of the
project needs later, what the feature does and why each choice was made, in one dense file. Git
keeps every file of the folder, and `git log -- specs/<folder>/` finds them.

## Where you are

Find the state of the branch in this table, and start at its step:

| State of the branch                                    | Start at                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| Every step is checked, and there is no pull request    | The [final review](implementation.md#final-review), then the next row     |
| Every step is checked, and the pull request is a draft | [Write the record](#write-the-record): the final review is done           |
| The record, and the pull request is a draft            | [Mark the pull request ready](#mark-the-pull-request-ready)               |
| The record, and no pull request                        | [Open the pull request](#open-the-draft-pull-request), then mark it ready |

With `ura`, `ura next` names the step, `finish` for every row but the first.

## Open the draft pull request

After the final review, push the branch and open its pull request as a draft, with
`gh pr create --draft`, so the record can link it. The draft also tells the next agent that the
final review is done. Its description can wait: it is written when the pull request is marked ready.

A forge without draft pull requests: write the record first, then open the pull request, and add its
link to the record in a second commit, `finish(<slug>): link the pull request`. When no pull request
can be opened, leave `pull-request` out of the record, and push the branch.

## Write the record

Write `specs/done/YYYY-MM-DD-<slug>.md`, named after the folder, from
[the template](../assets/templates/specs/done/YYYY-MM-DD-feature-slug.md). The
[example's record](../assets/example/specs/done/2026-10-06-recurring-tasks.md) shows a finished
feature. Read the whole folder first: the proposal, every round of questions and answers, the spec,
the plan, the rulings, and the review files.

- **Frontmatter**: `kind`, `feature` or `bug`; `finished`, today's date; `pull-request`, its URL.
- **The `> [!NOTE]` block**: it says the file is a record, not instructions, with the start date,
  the folder's date, the finish date, the pull request, and `git log -- specs/<folder>/`.
- **What and why**: the proposal's or the report's intent, in the human's terms.
- **Behaviour**: one line per user story, with the rules a later feature must keep, as the code does
  them, not as the spec first said. For a bug, the behaviour fixed.
- **Design**: the approach, and the main components, each with a link to its code. For a bug, the
  root cause and the fix.
- **Questions**: every round, `### Round 01`, then every question under its exact heading at level
  4, `#### Q2: When does the next occurrence appear?`, so its anchor stays the questions file's. Its
  answer in a sentence: the letters and what they chose, or the human's words, shortened, quoted
  where they are the decision. A follow-up, `#### Q2.B: ...`, only when it applied. The human's
  notes on the settled points, under `#### Notes`. No questions for a bug.
- **Decisions**: each decision the feature made or changed, linked, in a line.
- **Changes after approval**: the rulings that change behaviour, the spec's revisions after its
  approval, and the changes asked on the pull request.
- **Follow-ups**: the minor findings deferred by the final review, and the work left.

Write it for a reader who never saw the folder: dense, with no line count to reach or to stay under.
A section with nothing to say is left out, if the template marks it optional.

## Rewrite the links

Every link into the folder, in any file of the branch, now points to the record: decisions, drafts,
other records, the code's documentation.

- A link to a question, `../<folder>/clarifications-01.md#q6-how-does-ura-run-git`, keeps its
  anchor: `../done/<folder>.md#q6-how-does-ura-run-git`.
- A link to any other file or section, like a discovery topic, points to the first question, by
  round then number, whose text links that same file and section; otherwise to the record, without
  an anchor.

Links from other branches are theirs to fix, once this one is merged. With `ura`, `ura check`
reports every link that does not resolve.

## The finishing commit

In one commit: the record, the deletion of the whole folder, the rewritten links, and the removal of
the feature's entry from `PRIORITIES.md`, if the branch still has it. Its message:
`finish(<slug>): <feature name>`. Run `ura check` first, with `ura`.

## Mark the pull request ready

Write the pull request's description, as the
[implementation step's pull request](implementation.md#pull-request) describes, with its links to
`spec.md` and `plan.md` at the commit before finishing, since the branch no longer has them. Its
last line, for a feature or a bug: "Once merged, run `ura clean` to remove the worktree and the
branch." Then mark it ready, with `gh pr ready`. It is the feature's last human gate.

Advise merging with a merge commit or a rebase: a squash merge leaves the folder's files only in the
pull request, out of `git log -- specs/<folder>/`.

## Changes asked on the pull request

Apply them as the [implementation step](implementation.md#changes-requested-on-the-pull-request)
says, with the record in place of the spec: update its **Behaviour** or **Design** in place, so it
stays true to the code, and add a line under **Changes after approval**.

A change that needs a new round of questions brings the folder back:

1. `git revert` the finishing commit.
2. In the next commit, carry into the spec and the plan the changes the record lists since
   finishing.
3. Turn the pull request back into a draft, with `gh pr ready --undo`.
4. Start the round, following
   [going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions).

Once the feature is built again, it is finished again, from this file's first step.

## After the merge

Records are frozen once merged: edit one only to fix a broken link. A later feature that changes the
behaviour says so in its own record.

The branch and its worktree stay until the human cleans them. When you find a merged feature with a
worktree or a local branch left, tell the human to run `ura clean`. By hand, from the main checkout,
never forced:

1. `git worktree remove .worktrees/<branch>`: git refuses a worktree with uncommitted or untracked
   files, and they stay until the human deals with them. `git worktree prune` drops the record of a
   worktree folder already deleted.
2. `git branch -D <branch>`, only when
   `git log --cherry-pick --right-only --no-merges --format=%H <default>...<branch>` prints nothing,
   and the same with `origin/<default>` when the merge is only there yet. `-D`, because `-d` refuses
   a rebased branch.

Remote branches are the forge's: GitHub's "Automatically delete head branches" setting removes them.

## Finishing a feature merged before this step

A feature merged with its folder stays as it is, listed as done. When a human asks to finish it, do
it on a new branch, with the same record, links, and commit, through a pull request: the `finished`
date is the day of that commit.

## Commit

One commit, `finish(<slug>): <feature name>`, then the pull request marked ready. The pull request's
first line is the commit's body, as the implementation step describes.
