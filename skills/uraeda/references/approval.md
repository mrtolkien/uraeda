# Approval

Applies the decisions of an approved spec.

- **Runs when**: `spec.md` is `approved`, and a decision it links to is `proposed` or has a
  `## Proposed change` section for this spec
- **Writes**: the decisions linked in the spec's **Decisions** section
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

Set `approved-by` only if you know who approved the spec, for example from the human's message.
Otherwise leave it empty: an approval tool or the human fills it in, and git history records the
approval anyway.

If the human edited a decision or a proposed change before approving the spec, keep their wording.

## Clean up the spec

Remove the spec's `> [!IMPORTANT]` block if the human, or a tool, did not already: the spec is no
longer waiting for anyone.

## Check the review settings

Read the `risk-tier` and `plan-review` the human confirmed in the spec's frontmatter. The plan step
uses them as they are now, not as you proposed them.

## Commit

Commit the decisions: `decision(<number>): apply <summary>`. Then run the [plan](plan.md) step.
