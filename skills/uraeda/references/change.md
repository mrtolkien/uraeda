# Change

The light flow, for a bug fix or a small change. In one session, it investigates the proposal, makes
the change with tests that fail first, uses it, has it reviewed, and opens a pull request.

- **Runs when**: a change branch, `change/YYYY-MM-DD-<slug>`, is at its `change` step, or its pull
  request has changes requested, is behind the default branch, or lacks the branch's latest commits
- **Writes**: the code and its tests, `rulings.md`, a round of questions when one is needed, and the
  draft pull request
- **Ends at**: the [finish](finish.md) step; a human gate, a round of questions; or an offer to make
  the change a feature

A change has no discovery file, no spec, and no plan. The proposal is its approved scope: the human
wrote it, often in two lines, and expects a merged fix without being asked anything. The
investigation lives in the commits: each code commit's body states the root cause or the approach.

A change is also how the human adjusts a feature after using it. That is expected, and cheap: keep
it so.

## What a change is

- a bug: behaviour that differs from what its spec, its record, its documentation, or a reasonable
  user expects;
- a small change to behaviour or UI, within the decisions and the guides.

One proposal may list several related items, like three tweaks to the same sidebar: one change, one
commit each, one pull request. A proposal that needs more is an [upgrade](#upgrading) to a feature.
Typos, formatting, and comments need no flow at all.

A change's folder is `specs/changes/YYYY-MM-DD-<slug>/`. It holds `proposal.md`,
`clarifications-NN.md`, `rulings.md`, `images/`, and `mockups/`, nothing else.

## Starting a change

Only when a human asks, as [starting a change](projects.md#starting-a-feature) says: a worktree on
`change/YYYY-MM-DD-<slug>`, whose first commit is the proposal, from a note of theirs or from their
words.

**From a session on the default branch**, a request for a code change is offered as a change, not
committed to the default branch. Offer it once, with its proposal in the human's own words, its
`# Title` first:

```markdown
# Login redirects twice

After signing in, the app shows the home page, then the sign-in page again.
```

Change no file before the human says yes. On their yes, start it with that text as its proposal, and
run the change in its worktree.

A run the human scheduled is their yes, given in advance, for the change that run offers, unless its
message says it only reports. A feature is never started this way.

## Finding the step

With `ura`, `ura next <slug>` names the step. By hand, in the change's worktree, run the first row
that matches.

| State of the change's checkout                                     | Step                                                                    |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| The human answered a round, and it is not committed                | [Commit it first](../SKILL.md#the-humans-work-is-committed-first)       |
| `proposal.md` is not committed                                     | [Commit the proposal](projects.md#starting-a-feature) alone             |
| The record is there, and no pull request is ready                  | [Finish](finish.md)                                                     |
| The record, and the pull request has changes requested             | [The pull request](#the-pull-request), comments                         |
| The record, and the open pull request is behind the default branch | [Catch up](implementation.md#catch-up-an-open-pull-request)             |
| The record, and the open pull request lacks the latest commits     | [Push](implementation.md#push)                                          |
| The record, and the pull request is ready                          | **Human gate**: the review happens on the pull request                  |
| A file has `status: awaiting-human`                                | **Human gate**: stop                                                    |
| The branch has no pull request                                     | This file, from [Investigating](#investigating)                         |
| The folder came back, and a round answered since is not made yet   | [Making the change](#making-the-change), then [the review](#the-review) |
| The branch's pull request is a draft                               | [Finish](finish.md)                                                     |

The folder comes back when the branch reverts its finishing commit, for a round asked on the pull
request. A round answered after that revert has its change to make before finishing, though the pull
request is a draft: `ura` cannot tell, and names `finish`. Without `gh`, `ura` cannot see the pull
request: check it yourself.

**Resuming**: read the proposal as it is now, the answered rounds, `rulings.md`, and `git log` on
the branch. Each item committed is done, and its commit's body says what was found.

## Investigating

Read the proposal, and what started it: the note it came from, in the human's notes, or what they
said in the session, is the human's intent for this change. Read the constitution, the decisions and
guides that cover the code involved, and the record of the feature the change touches.

**A bug.** No fix without the root cause, and no fix of a bug you reproduced without the test that
reproduces it. A fix guessed from the symptom hides the bug and adds new ones.

1. **Reproduce it.** Follow the proposal's steps in the running product, then write the smallest
   test that fails because of the bug, following [testing](code-quality.md#testing). It stays as the
   bug's one test. If it does not fail every time, find what makes it fail: timing, order, data.
2. **Trace the root cause.** Follow the wrong value back to where it first goes wrong, not where it
   shows. Check the recent changes to that code, and compare with similar code that works. For a
   look, a size, or a delay, measure in the running product before changing anything: guesses cost
   more than one measure.
3. **Confirm it.** One hypothesis at a time, tested with the smallest change. A hypothesis that
   fails is replaced, not stacked with another change.

When the bug does not reproduce, fix what the evidence supports in the simplest way, and say in the
pull request what was not reproduced. When fix after fix fails the reproduction test, the approach
is wrong, not the details: offer the [upgrade](#upgrading), naming what you tried.

**A change.** Read the code it touches, the decisions and guides, and the documentation of the
dependencies involved. Do not compare products: this is the `low`
[discovery effort](discovery.md#discovery-effort).

## Asking

A change asks rarely. Settle what the proposal's intent, the decisions, and the guides settle, as
[discovery](discovery.md#what-to-ask-and-what-to-settle) says, and list what you settled in the pull
request's "Decided without you". Ask only for:

- **an intent the human would notice in the result**, that the proposal leaves open and where you
  would not bet on your reading: which of two behaviours a fix keeps;
- **a change to a decision**: see [Decisions](#decisions);
- **the upgrade**: see [Upgrading](#upgrading).

A low-impact choice is never a question: do what makes the code simplest.

Ask in a round: `clarifications-NN.md` alone, with no discovery file, from
[the template](../assets/templates/specs/YYYY-MM-DD-feature-slug/clarifications-01.md), with
`status: awaiting-human`, written as [a round of questions](writing.md#a-round-of-questions) says.
Its Context carries what you found, with links to the code. The
[example change's round](../assets/example/specs/changes/2026-10-14-tasks-reappear/clarifications-01.md)
shows one. Then stop at the gate. Once it is answered, turn its block into a note, and continue.

## Decisions

Decisions hold the human's intent, and change with it. A change may need one rule of an active
decision changed: that is normal work, approved in a round. A brand-new decision is a reason to
upgrade.

1. **Propose it.** In the same commit as the round, edit the decision in place on the change's
   branch, as [new decision or change](spec.md#new-decision-or-change) describes. A change has no
   spec: its Why links the round's question. The round links it, and asks to approve it, "A
   (recommended). Approve the change" first.
2. **On "A"**, the decision stands as edited: continue.
3. **On another answer**, restore the decision's text as it was where the branch started,
   `git checkout $(git merge-base HEAD <default>) -- specs/decisions/<topic>.md`, and make the
   change within the decision as it is.

## Upgrading

Offer to make the change a feature when it needs:

- a new decision;
- a change to data users already have, or to a public interface: a CLI flag, a file format, an API;
- approved behaviour changed beyond what the proposal names;
- a new view;
- a constitution exception, or a new lint marker, since only a plan can carry its approval;
- another fix, after several failed the reproduction test.

The size of the diff is never a reason. When one item of a batch needs it, offer to split that item
out, as a proposal of its own: on yes, write the item's text as a new proposal in the human's notes,
`status: now`, or give it in your last message without notes, and make the other items.

Offer it, and never make it alone: in a session, with the reason in one sentence; in a run nobody
follows, as a round's question, "Make this change a feature?", with the upgrade as option A.

On yes, the change moves in place: its branch, folder, and code become the feature's, as
[make a change a feature](by-hand.md#make-a-change-a-feature) says. The feature has answered rounds
and no discovery file, so its first step is the [spec](spec.md#is-the-scope-clear), which starts a
new round for the feature's scope. On another answer, keep the change within that answer.

## Making the change

Run the project's complete validation once, before any change. Then one item at a time, one commit
per item:

- **Tests first**, as [writing one](code-quality.md#writing-one) says: a test fails first for the
  bug or the new behaviour, for the intended reason. A bug's fix commits its reproduction test.
- **The commit's body** states the root cause, for a bug, or the approach, for a change, and the
  behaviour that stays unchanged, with the test that checks it.
- **Benchmarks.** When the change touches what the constitution says to benchmark, record a baseline
  before it, and give both numbers in the pull request's "Measured".
- **Structure first.** A function or file over the project's limit is split in a structural commit
  before the item grows it ([extract, don't grow](code-quality.md#extract-dont-grow)).
- **Rulings** only for a reason that would otherwise be lost, as
  [the implementation step](implementation.md#rulings) says.
- **Problems outside the proposal** are fixed when the change needs them, and dropped otherwise,
  unless they pass the two tests of [agents' notes](notes.md#agents-notes).

Before each commit, run the validation the step needs, as the implementation step's
[each task](implementation.md#each-task) says. When something only the human can decide comes up
midway, ask in a round: the items already committed stay.

## The review

Once every item is committed:

1. **Catch up** with the default branch, as the implementation step's
   [catch-up](implementation.md#catch-up-with-the-default-branch) describes.
2. **Use it**, as [the final review](implementation.md#use-it) says: do what the proposal asked for,
   in the running product, at each width the project serves. For a bug, follow the proposal's steps
   again and see it gone. A fix for something the human saw is checked by seeing it.
3. **Review the branch** once, as [review the branch](implementation.md#review-the-branch) says, the
   reviewer given the proposal and its answered rounds in place of the spec and the plan.
4. **Grade and fix** the findings, as [grade the findings](implementation.md#grade-the-findings)
   says, with the change's scope.

## The pull request

Run the complete validation after the last commit, push, open the draft pull request, and run the
[finish](finish.md) step: the folder becomes its record, `kind: change`, and the pull request's body
is written as [the finish step](finish.md#mark-the-pull-request-ready) says.

Commits the open pull request lacks are [pushed](implementation.md#push), and a branch behind the
default branch is [caught up](implementation.md#catch-up-an-open-pull-request), as for a feature.
Comments on the pull request are handled as
[for a feature](implementation.md#comments-on-the-pull-request), with what differs for a change:

- the record and `rulings.md` stand for the spec and the plan;
- a new question is a round as in [Asking](#asking), and a new decision is the [upgrade](#upgrading)
  offer;
- when the folder is brought back for a round, the record's changes noted before the revert go into
  `rulings.md`, and the next record lists them under **Changes after approval**.

## Commit

- **A round**: `discovery(<slug>): <what it asks>`, with the block's first line as the body.
- **Code**: `fix(<slug>): <what changed>` for a bug, `feat(<slug>): <what changed>` for a change,
  and `refactor(<slug>):` for a structural commit, each with its tests and its body.
- **The record**: `finish(<slug>): <title>`, as the [finish](finish.md) step says.
