# Bug

Finds the root cause of a reported bug, proposes a fix for the human to approve, then fixes it,
without going through the feature flow.

- **Runs when**: a bug branch, `fix/YYYY-MM-DD-<slug>`, is in one of the states of the table below
- **Writes**: `assessment.md`, then the fix, its test, and the draft pull request
- **Ends at**: a human gate: `assessment.md` with `status: awaiting-human`, or the pull request

> [!WARNING]
>
> Agent-authored draft, not reviewed by a human yet. The bug flow will get its own spec once the
> feature flow works: until then, follow it, and report what does not fit.

A bug is behaviour that differs from what its spec, its documentation, or a reasonable user expects.
A report that asks for new behaviour is a feature: say so in the assessment, with a question.

Two rules hold throughout: no fix without the root cause first, and no fix without a failing test
that reproduces the bug.

## Starting a bug

Only when a human asks. Name the bug with today's date and a short slug of its title,
`YYYY-MM-DD-<slug>`, and create the branch `fix/YYYY-MM-DD-<slug>` from the default branch. On it,
put the human's report in `specs/bugs/YYYY-MM-DD-<slug>/report.md`, from
[the template](../assets/templates/specs/bugs/YYYY-MM-DD-bug-slug/report.md) if they wrote it
elsewhere, and add the bug to the **Now** section of `PRIORITIES.md`, or where the human says.
Commit with `chore(<slug>): start <bug title>`.

## Finding the step

On the bug's branch, go down this table and run the first row that matches.

| State of the bug's branch                                    | Step                             |
| ------------------------------------------------------------ | -------------------------------- |
| The record is in `specs/done/`, and no pull request is ready | [Finish](finish.md)              |
| The record, and the pull request has changes requested       | [Fix](#fix), changes             |
| The record, and the pull request is ready for review         | **Human gate**: the pull request |
| `assessment.md` has `status: awaiting-human`                 | **Human gate**: stop             |
| No `assessment.md`                                           | [Assess](#assess)                |
| `assessment.md` is `changes-requested`                       | [Assess](#assess), revision      |
| `assessment.md` is `approved`, with unchecked steps          | [Fix](#fix)                      |
| Every step is checked, and the pull request is a draft       | [Finish](finish.md)              |
| Every step is checked, and the branch has no pull request    | [Fix](#fix), pull request        |
| The branch's pull request has changes requested              | [Fix](#fix), changes             |
| The branch has an open pull request                          | **Human gate**: the pull request |

## Assess

Investigate before proposing anything: a fix guessed from the symptom hides the bug and adds new
ones.

1. **Read** `report.md`, the constitution, the active decisions that apply to the code involved, and
   the spec of the feature the bug is in, if there is one.
2. **Reproduce it.** Follow the report's steps, then write the smallest test that fails because of
   the bug: an integration test, through the real components, following the spec step's
   [Tests](spec.md#tests) rules. Run it and keep its failure. If it does not fail every time, find
   what makes it fail: timing, order, data. Do not commit the test: the fix commits it.
3. **Trace the root cause.** Follow the wrong value back through the code to where it first goes
   wrong, not where it shows. Check the recent changes to that code (`git log`), and compare with
   similar code that works. Fix the cause at its source.
4. **Confirm it.** State one hypothesis, and test it with the smallest change, one at a time, in
   your working tree only. A hypothesis that fails is replaced, not stacked with another change.
5. **Plan the fix**: the change at the root cause, the files it touches, what else it changes for
   users, and the steps to make it, like a task of a [plan](plan.md#task-structure).

Write `assessment.md` from
[the template](../assets/templates/specs/bugs/YYYY-MM-DD-bug-slug/assessment.md), for a human
reading top to bottom, and set `status: awaiting-human`. Open it with the `> [!IMPORTANT]` block
described in [Coming back to the human](../SKILL.md#coming-back-to-the-human): how long the review
takes, the root cause in one line, the fix's risk, and any question.

Ask only what the human must decide, as questions at the end of the file, in the format of
[clarifications](discovery.md#question-structure), recommended option first: an expected behaviour
that is unclear, a fix that needs a [decision](spec.md#what-is-a-decision) or goes against one, a
report that asks for a feature. If you cannot reproduce the bug, say what you tried, and ask for
what you need.

**Revision**: when `assessment.md` is `changes-requested`, read `assessment-review.md`, investigate
again where it asks, apply it, and set `status: awaiting-human` again. The block says what changed,
and how each comment was handled. When the assessment was approved with comments, the fix carries
them out, and the pull request's description says how.

## Fix

Once the assessment is `approved`, turn its block into a record, in the first fix commit: see
[Coming back to the human](../SKILL.md#coming-back-to-the-human). Then work its steps in order, as
the [implementation](implementation.md) step does for a plan's task: watch the test fail, fix the
root cause, run the project's validation, and check each step's box in the commit.

Write the choices you make while fixing, that the assessment did not settle, in
`specs/bugs/YYYY-MM-DD-<slug>/rulings.md`, as the implementation step does.

When the fix touches what the constitution says to benchmark, the assessment's fix steps record a
baseline before any change, and compare to it after, as a plan does: see
[the plan step](plan.md#task-structure).

If the fix does not make the test pass, go back to the investigation with what you learned. After
three fixes that failed, the approach is wrong, not the details: revise the assessment with what you
found, and set it back to `awaiting-human`.

Then catch up with the default branch, review the branch, and open the pull request as a draft, as
in [implementation](implementation.md#final-review), and run the [finish](finish.md) step: the bug's
folder becomes its record, `kind: bug`, without questions, and the finishing commit removes its
entry from `PRIORITIES.md`. Handle the changes requested on the pull request the same way.

## Commit

Commit the assessment: `assessment(<slug>): <root cause>`. The commit message body is the first line
of the block. Commits of the fix use `fix(<slug>):`.
