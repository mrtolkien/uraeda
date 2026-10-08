# Approval

Records the decisions of an approved spec as active.

- **Runs when**: `spec.md` is `approved`, and a decision it lists is still `proposed`
- **Writes**: the decisions listed in the spec's **Decisions** section
- **Ends at**: the [plan](plan.md) step

The human's approval of the spec is the explicit request to activate its decisions. Only activate
the decisions the spec lists: leave any other proposed decision unchanged.

## Activate the decisions

For each decision listed in the spec with `status: proposed`:

- Set `status: active`
- Set `approved-by` only if you know who approved the spec, for example from the human's message.
  Otherwise leave it empty: an approval tool or the human fills it in, and git history records the
  approval anyway.
- If its context says it overrides an older decision, set the older one's `status: overridden` and
  its `overridden-by` to the new decision's file name

If the human edited a decision before approving the spec, keep their wording.

## Check the review settings

Read the `risk-tier` and `plan-review` the human confirmed in the spec's frontmatter. The plan step
uses them as they are now, not as you proposed them.

## Commit

Commit the decisions: `decision(<number>): activate <summary>`. Then run the [plan](plan.md) step.
