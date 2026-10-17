# Finish

Replaces a feature's or a change's folder with one record, the last commit of its branch, so the
default branch keeps what later readers need and git keeps the rest. Then marks the pull request
ready for the human.

- **Runs when**: the final review of a feature, or the review of a change, is done and its pull
  request is a draft; or the branch has the record, and its pull request is not ready yet
- **Writes**: `specs/done/YYYY-MM-DD-<slug>.md`, the deletion of the folder, the links into it, the
  `PRIORITIES.md` entry, and the pull request
- **Ends at**: a human gate, the pull request

A merged folder is mostly process: discovery notes, questions with their options, a plan with every
box checked. Kept on the default branch, it clutters the file tree and every search, and a finished
plan reads like instructions to an agent that finds it. The record keeps what a reader of the
project needs later, what the feature does and why each choice was made, in one dense file. Git
keeps every file of the folder, and `git log -- specs/<folder>/` finds them, or
`git log -- specs/changes/<folder>/` for a change.

## Where you are

Find the state of the branch in this table, and start at its step:

| State of the branch                                                               | Start at                                                                                         |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Every step is checked, and there is no pull request                               | The [final review](implementation.md#final-review), then the next row                            |
| A change's folder came back, and a round answered since is not made yet           | [Make it](change.md#making-the-change), and [review it](change.md#the-review), then the next row |
| Every step is checked, or the change is reviewed, and the pull request is a draft | [Write the record](#write-the-record): the final review is done                                  |
| The record, and the pull request is a draft                                       | [Mark the pull request ready](#mark-the-pull-request-ready)                                      |
| The record, and no pull request                                                   | [Open the pull request](#open-the-draft-pull-request), then mark it ready                        |

For a change, the first row is [the review](change.md#the-review), and the third its draft pull
request. A change's folder came back when the branch reverts its finishing commit, for
[changes asked on the pull request](#changes-asked-on-the-pull-request): `git log` shows whether a
round was answered after that revert. With `ura`, `ura next` names the step, `finish` for every row
but the first. Without `gh`, it cannot see the pull request, and names `pull-request` once the
record is there: check the pull request yourself.

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

- **Frontmatter**: `kind`, `feature` or `change`, as its branch is; `finished`, today's date;
  `pull-request`, its URL.
- **The `> [!NOTE]` block**: it says the file is a record, not instructions, with the start date,
  the date of the folder's name, the finish date, the pull request, and
  `git log -- specs/<folder>/`, or `git log -- specs/changes/<folder>/` for a change.
- **What and why**: the proposal's intent, in the human's terms.
- **Behaviour**: one line per user story, with the rules a later feature must keep, as the code does
  them, not as the spec first said. For a change, what was fixed or changed.
- **Design**: the spec's architecture, and the main components, each with a link to its code. For a
  change, the root cause or the approach, and the code it touched.
- **Questions**: every round, `### Round 01`, then every question under its exact heading at level
  4, `#### Q2: When does the next occurrence appear?`, so its anchor stays the questions file's. Its
  answer in a sentence: the letters and what they chose, or the human's words, shortened, quoted
  where they are the decision. A follow-up, `#### Q2.B: ...`, only when it applied. The human's
  notes on the settled points, under `#### Notes`. A change's record keeps its rounds' questions the
  same way, and has none when it asked nothing.
- **Decisions**: each decision the feature made or changed, linked, in a line.
- **Changes after approval**: the rulings that change behaviour, the spec's revisions after its
  approval, and the changes asked on the pull request.
- **Follow-ups**: the minor findings deferred by the reviews, noted in the inbox, and the work left.

The record links no image: the folder's `images/` is deleted with it, and git keeps them. Describe
in words what an image showed, when the record needs it.

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

In one commit: the record, the deletion of the whole folder, its images included, the rewritten
links, and the removal of the feature's entry from `PRIORITIES.md`, if the branch still has it, with
the blank line after it when it was the last started entry. Its message:
`finish(<slug>): <feature name>`. Run `ura check` first, with `ura`.

## Mark the pull request ready

Write the pull request's description, as the
[implementation step's pull request](implementation.md#pull-request) describes, with its links to
`spec.md` and `plan.md` at the commit before finishing, since the branch no longer has them. A
change's description follows [its own order](change.md#the-pull-request). Its last line, for a
feature or a change: "Once merged, run `ura clean` to remove the worktree and the branch." If the
default branch moved since the [catch-up](implementation.md#catch-up-with-the-default-branch), catch
up again first. Then mark it ready, with `gh pr ready`. It is the feature's last human gate.

Advise a rebase merge, which keeps the default branch's history linear, or else a merge commit: a
squash merge leaves the folder's files only in the pull request, out of
`git log -- specs/<folder>/`.

## Changes asked on the pull request

Apply them as the [implementation step](implementation.md#changes-requested-on-the-pull-request)
says, with the record in place of the spec: update its **Behaviour** or **Design** in place, so it
stays true to the code, and add a line under **Changes after approval**.

A change that needs a new round of questions brings the folder back:

1. Note the record's **Changes after approval** made since finishing: the revert deletes them with
   it.
2. `git revert` the finishing commit. When later commits changed the record, git stops on a conflict
   over it: delete the record, and continue the revert.
3. In the next commit, carry the changes you noted into the spec and the plan; for a change, see
   [its pull request](change.md#the-pull-request).
4. Turn the pull request back into a draft, with `gh pr ready --undo`.
5. Start the round, following
   [going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions).

Once the feature is built again, it is finished again, from this file's first step.

## After the merge

Records are frozen once merged: edit one only to fix a broken link. A later feature that changes the
behaviour says so in its own record.

The branch and its worktree stay until the human cleans them. When you find a merged feature with a
worktree or a local branch left, tell the human to run `ura clean`. By hand, from the main checkout,
never forced:

1. `git worktree remove .worktrees/<folder>`: git refuses a worktree with uncommitted or untracked
   files, and they stay until the human deals with them. `git worktree prune` drops the record of a
   worktree folder already deleted.
2. `git branch -D <branch>`, only when every commit of the branch is on the default branch:
   `git log --cherry-pick --right-only --format=%H <default>...<branch>` lists the commits it lacks.
   When the merge is only on the forge yet, run it with `origin/<default>` too: a commit counts as
   merged when either list leaves it out. `-D`, because `-d` refuses a rebased branch.

Remote branches are the forge's: GitHub's "Automatically delete head branches" setting removes them.

## Finishing a feature merged before this step

A feature merged with its folder stays as it is, listed as done. When a human asks to finish it, do
it on a new branch, with the same record, links, and commit, through a pull request: the `finished`
date is the day of that commit.

## Commit

One commit, `finish(<slug>): <feature name>`, then the pull request marked ready. The commit's body
is the pull request's first line, "Pull request to review, about 20 minutes.", as the implementation
step describes.
