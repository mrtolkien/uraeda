# Approval

Activates the decisions of an approved spec, and records the human's review.

- **Runs when**: `spec.md` is `approved`, and a decision named by an item of its `## Decisions`
  section is `proposed`
- **Writes**: the frontmatter of those decisions, and the record of the spec's review
- **Ends at**: the [plan](plan.md) step

The human's approval of the spec is the explicit request to activate its decisions. The spec step
already wrote each one in place on the branch, new or changed: the human approved them as they
stand.

## Apply the decisions

Only the items of the spec's `## Decisions` section count: `- **New: ...**`, `- **Changed: ...**`,
and `- **Removed: ...**`. The links of its "Relied on" table do not, even to a `proposed` decision.
Leave every decision the items do not name unchanged.

For each decision a New or Changed item names:

- **`status: proposed`**: set `status: active`.
- **`approved-by`**: set it to the human who approved the spec, when you know who. Read it from the
  human's message, or from the author of the `spec(<slug>): approve` commit. Otherwise leave it
  empty: git history records the approval anyway.

Change nothing else in the file: if the human edited a decision before approving, their wording is
what they approved. A Removed item needs nothing: the spec step already deleted its file on the
branch.

The approval commit, `spec(<slug>): approve`, is the branch's first commit whose spec reads
`status: approved`. From there on, a decision edited again on the branch needs the human's approval
again, and `ura check` warns `decision.unapproved` on it. This step's own two fields, `status` and
`approved-by`, do not count as an edit.

## Record the review

Turn the spec's `> [!IMPORTANT]` block into a record, if the human or a tool did not already, as
`ura review --approve` does: see [Coming back to the human](../SKILL.md#coming-back-to-the-human).
When an approved spec lists no decision to activate, this step does not run, and the plan step
records the review instead.

## Check the review settings

Read the `plan-review` in the spec's frontmatter. The human decided it when approving, whatever the
risk tier: the plan step uses it as it is now, not as you proposed it. If the human changed the
`risk-tier` but left `plan-review` as you proposed it, set `plan-review` to `false`, as `ura review`
does: the plan waits only when the human turns plan review on, or when it lists a constitution
exception.

## Commit

Commit the decisions and the spec's record together: `decision(<slug>): apply <summary>`. Then run
the [plan](plan.md) step.
