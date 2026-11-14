# Finish

Replaces a feature's or a change's folder with one record, the last commit of its branch, then
writes the pull request's body and marks it ready for the human.

- **Runs when**: the final review of a feature, or the review of a change, is done and its pull
  request is a draft; or the branch has the record, and its pull request is not ready yet
- **Writes**: `specs/done/YYYY-MM-DD-<slug>.md`, the deletion of the folder, the links into it, and
  the pull request's body
- **Ends at**: a human gate, the pull request

A merged folder is mostly process: discovery notes, questions with their options, a plan with every
box checked. The record keeps what a later reader needs, what the feature does and why each choice
was made, in one dense file. Git keeps every file of the folder: `git log -- specs/<folder>/`.

**A feature is not finished until this step ran.** A pull request merged while still a draft leaves
its folder in the tree and no record: when you find one, tell the human, and finish it on a new
branch when they ask.

## Where you are

| State of the branch                                                               | Start at                                                                           |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Every step is checked, and there is no pull request                               | The [final review](implementation.md#final-review)                                 |
| A change's folder came back, and a round answered since is not made yet           | [Make it](change.md#making-the-change) and [review it](change.md#the-review) first |
| Every step is checked, or the change is reviewed, and the pull request is a draft | [Write the record](#write-the-record)                                              |
| The record, and the pull request is a draft                                       | [Mark the pull request ready](#mark-the-pull-request-ready)                        |
| The record, and no pull request                                                   | [Open the pull request](#open-the-draft-pull-request)                              |

## Open the draft pull request

After the final review, push the branch and open its pull request as a draft, with
`gh pr create --draft`, so the record can link it. Its body is written when it is marked ready.
Without `gh`, `ura next` cannot see the pull request: check it yourself. A forge without draft pull
requests is covered [by hand](by-hand.md#a-forge-without-draft-pull-requests).

## Write the record

Write `specs/done/YYYY-MM-DD-<slug>.md`, named after the folder, from
[the template](../assets/templates/specs/done/YYYY-MM-DD-feature-slug.md). The
[example's record](../assets/example/specs/done/2026-10-06-recurring-tasks.md) shows one. Read the
whole folder first.

**The record's reader is the next agent to touch this code**, and the human months later. Neither
saw the folder. Write what they could not get from the code:

- **Frontmatter**: `kind`, `finished`, `pull-request`, and `supersedes` when it replaces the
  behaviour of older records.
- **The `> [!NOTE]` block**: that the file is a record, not instructions, with its dates, its pull
  request, and the `git log` command that finds its files.
- **What and why**: the proposal's intent, in the human's terms.
- **Behaviour**: one line per user story, with the rules a later feature must keep, as the code does
  them, not as the spec first said. For a change, what was fixed.
- **Design**: the approach, and the main components, each linked to its code. For a change, the root
  cause.
- **Replaced behaviour**: what it replaced, with the tests that guarded it and the tests removed.
- **Gotchas**: what the code and tests do not show, like a library's behaviour that forced a choice.
  These are the most useful lines of a record: a routine debugging step is not one.
- **Questions**: every round, `### Round 01`, then each question under its exact heading at level 4,
  so its anchor stays, with its answer in a sentence: the letters and what they chose, or the
  human's words, quoted where they are the decision. A follow-up shows only when it applied. The
  human's notes go under `#### Notes`. A round's Context or settled points, when quoted, go under
  `#### Context`, `#### Check these`, or `#### Settled without the human`, their sub-headings at
  level 5: a level-3 or level-4 heading there would read as a round or a question. A round asked in
  the session has no file: its `### Round NN` gives the answers as the spec quoted them, one line
  each. A change that asked nothing has no Questions.
- **Decisions**: each decision the feature made or changed, linked.
- **Changes after approval**: the rulings that change behaviour, the spec's revisions after its
  approval, and the changes asked on the pull request, each in words, never by a ruling's number.
- **Follow-ups**: the [agents' notes](notes.md#agents-notes) the feature added, and work the human
  chose to leave.

A section with nothing to say is left out, when the template marks it optional. The record links no
image: the folder's `images/` is deleted with it. Say in words what an image showed, when the record
needs it.

## Point to the records it replaces

A feature or a change that replaces the behaviour of older records lists them in its record's
`supersedes`, by name. They come from the spec's replaced behaviour, and from the records the code's
history leads to. The older records are not edited: a reader finds what replaced one by searching
`specs/done/` for its name.

## Rewrite the links

Every link into the folder, in any file of the branch, now points to the record. A link to a
question keeps its anchor. A link to any other file or section points to the first question whose
text links that same place, or else to the record without an anchor.

Then repair every other link of `specs/` that no longer resolves, which `ura check` reports, as
[where a moved link points](by-hand.md#where-a-moved-link-points) says.

## The finishing commit

One commit: the record, the deletion of the whole folder, and the rewritten links. Its message is
`finish(<slug>): <feature name>`, and its body the pull request's first line.

## Mark the pull request ready

The human often has three features in flight when a pull request lands. Its body tells them, in this
order, what was done, what to look at, and what you decided for them. Each paragraph and list item
sits on one line: a forge shows every line break of a body.

If the default branch moved since the catch-up, catch up again first, and amend its link repairs
into the finishing commit.

1. **The opening block**, a `> [!IMPORTANT]` block. Its first line is what is asked and the time:
   "Pull request to review, about 15 minutes." Then:
   - **What was done**, in two or three sentences, in the product's words: what the user can now do,
     or what no longer happens. Never a list of files or tasks.
   - **Look at**: where the human's eyes are needed, most important first: a view to try, with how
     to start the product; a goal the feature missed, with its number; an important finding left
     unfixed; a test removed by ruling; a new dependency; a function or file grown past a limit; a
     spec amended during the build; how a review comment was carried out; a failure that was already
     there; what could not be reproduced or started; a review done without a fresh reviewer or on
     another pick than the human's; an agent's note the feature added.
   - **Decided without you**: every behaviour users will notice that the approved request left open,
     and every departure from what was approved, one line each, said as what happens to them and
     why. This is where the human checks your reading. Nothing they would be surprised by is
     anywhere else. A choice that needed their authority was asked before this point: this list
     never stands for permission.
   - **Measured**: each success criterion with its number, when the spec has some.
   - **Used**: what you ran while [using it](implementation.md#use-it), on which runtime, at which
     widths and with which input, in a line or two.
2. **One screenshot per new or changed view**, taken of the running product while
   [using it](implementation.md#use-it), into a file outside the repository, attached with
   `gh pr edit <number> --body-file <body> --attach '<path>#<view>'`. Never commit the image. When
   the forge cannot attach one, give the command that starts the product on that view instead.
3. **The record's "What and why" and "Behaviour"**, with their links made absolute at the finishing
   commit, `https://<forge>/<owner>/<repo>/blob/<finishing commit>/<path>`, then a link to the
   record there for the rest. The body repeats nothing else of the folder: no size table, no list of
   tests, no rulings, no review history.

Advise a rebase merge, or else a merge commit: a squash merge leaves the folder's files out of
`git log -- specs/<folder>/`.

## Changes asked on the pull request

Apply them as [the comments pass](implementation.md#comments-on-the-pull-request) says, with the
record in place of the spec: update its **Behaviour** or **Design** in place, add a line under
**Changes after approval**, and write the body's record part again, keeping the links of the
screenshots already in it.

A change that needs a new round of questions brings the folder back:

1. Note the record's **Changes after approval** made since finishing: the revert deletes them.
2. `git revert` the finishing commit. When later commits changed the record, git stops on a conflict
   over it: delete the record, and continue the revert.
3. Carry the changes you noted into the spec and the plan; for a change, see
   [its pull request](change.md#the-pull-request).
4. Turn the pull request back into a draft, with `gh pr ready --undo`.
5. Start the round, following
   [going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions).

Once the feature is built again, it is finished again, from this file's first step.

## After the merge

Records are frozen once merged: edit one only to fix a broken link. A later feature that changes the
behaviour says so in its own record.

The branch and its worktree stay until the human or their session host removes them, as
[after the merge](projects.md#after-the-merge) says.

## Commit

One commit, `finish(<slug>): <feature name>`, then the pull request marked ready, with
`gh pr ready`.
