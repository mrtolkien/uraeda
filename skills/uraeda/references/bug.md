# Bug

Finds the root cause of a reported bug and suggests a fix, without going through the feature flow.

- **Runs when**: `specs/bugs/<slug>/` has a `report.md` and no `assessment.md`, or `assessment.md`
  is `changes-requested`
- **Writes**: `assessment.md`
- **Ends at**: a human gate, `assessment.md` with `status: awaiting-human`

> [!WARNING]
>
> Agent-authored draft, not reviewed by a human yet. The `status` field of `assessment.md` and the
> "After the review" section are not part of the documented workflow: the bug workflow will get its
> own spec once the feature flow works.

## Assess

1. Read `report.md`, the constitution, and the active decisions that apply to the code involved.
2. Reproduce the bug, with a failing test when you can.
3. Find the root cause. Link to the code.
4. Suggest a fix, and the test that proves it.

Write `assessment.md` from [the template](../assets/templates/specs/bugs/bug-slug/assessment.md),
open it with the `> [!IMPORTANT]` block described in
[Coming back to the human](../SKILL.md#coming-back-to-the-human), and set `status: awaiting-human`.

If you cannot reproduce the bug, say what you tried and ask for what you need. If the fix needs a
decision, or the expected behaviour is unclear, ask in the assessment, with a recommended answer.

## After the review

When the human sets `approved`, turn the assessment's block into a record, as described in
[Coming back to the human](../SKILL.md#coming-back-to-the-human), then implement the fix in a pull
request, with the test from the assessment. In the same pull request, remove the bug's entry from
`PRIORITIES.md`. When they set `changes-requested`, read the `## Review` section, revise the
assessment, and set `status: awaiting-human` again.

## Commit

Commit the assessment: `assessment(<slug>): <root cause>`. Commits of the fix use `fix(<slug>):`.
