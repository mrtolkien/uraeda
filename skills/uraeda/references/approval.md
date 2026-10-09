# Approval

Applies the decisions of an approved spec, and records the human's review.

- **Runs when**: `spec.md` is `approved`, and a decision it links to is `proposed`, or has a
  `## Proposed change (<spec folder>)` section for this spec
- **Writes**: the decisions linked in the spec's **Decisions** section, and the record of the spec's
  review
- **Ends at**: the [plan](plan.md) step

The human's approval of the spec is the explicit request to apply its decisions. Only apply what the
spec links to: leave other proposed decisions and changes unchanged.

## Apply the decisions

For each decision linked in the spec:

- **`status: proposed`**: set `status: active`.
- **`## Proposed change (<this spec folder>)`**: rewrite the decision to include the change, and
  remove the section. If the change reverses an earlier choice, add the earlier choice to
  **Alternatives considered**, with why it was abandoned. If the change is "Delete this decision",
  delete the file.

If the human edited a decision or a proposed change before approving the spec, keep their wording.

Set `approved-by` on each decision you apply only if you know who approved the spec, for example
from the human's message. Otherwise leave it as it is: an approval tool or the human fills it in,
and git history records the approval anyway.

## Record the review

Turn the spec's `> [!IMPORTANT]` block into a record, if the human or a tool did not already: see
[Coming back to the human](../SKILL.md#coming-back-to-the-human). When an approved spec links no
decision to apply, this step does not run, and the plan step records the review instead.

## Check the review settings

Read the `risk-tier` and `plan-review` in the spec's frontmatter. The human may have changed them
when approving: the plan step uses them as they are now, not as you proposed them.

## Commit

Commit the decisions and the spec's record together: `decision(<slug>): apply <summary>`. Then run
the [plan](plan.md) step.
