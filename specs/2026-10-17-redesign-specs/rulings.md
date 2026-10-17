# Rulings: Redesign and reword specs

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: `main` merged in before the plan, not rebased at the end

- **Decision**: the branch merged `main` before the approval step, and resolved its two decision
  conflicts there. Access-storybook's Storybook channel rule joins the rewritten stack decision as
  one sentence of its proxy rule, a sentence of its why, and a consequence. The rewritten UI
  behaviour decision is kept: it already exempts the chat composer that `main` made grow.
- **Rationale**: the spec builds on the clarifications redesign's writing reference, warnings, and
  round page, which were on `main` only. The spec also says whichever of this feature and
  access-storybook merges second folds the other's stack rule in.
- **Alternatives considered**: rebasing the branch: it rewrites the human's approval commit, and
  replays every decision rewrite against `main`'s changes.
- **If wrong**: the final review rebases as usual, with the resolutions git recorded.
- **Where**: the merge commit, and `specs/decisions/stack.md`

## R2: The branch's decision changes sit on the file view, not in `SpecItems`

- **Decision**: `FileView.decision_changes` carries the changes; `SpecItems.decisions` carries the
  spec's `## Decisions` items. The page joins them by name.
- **Rationale**: `SpecItems` is read from a text alone, for both the committed and the current
  version, and by `ura check`. The changes need git and the branch, once per file view.
- **Alternatives considered**: filling `SpecItems.decisions` with the changes in `file_view`, as the
  spec's details named it: two versions of the items would carry the same changes, and the check
  would see an empty list.
- **If wrong**: move the field; only the API and the page read it.
- **Where**: tasks 2 and 7

## R3: This feature's own spec and plan are rewritten in the new format

- **Decision**: once the templates change, task 2 rewrites this feature's spec and plan in the new
  format. The approved text is kept word for word where it stays. The spec's Details become the
  plan's tasks and test map, and its data the data model's.
- **Rationale**: `vp run ready` runs `ura check specs`, and the compatibility decision asks an agent
  to rewrite a file that fails it because its format changed. The spec's "the last one written in
  today's format" is about how it was written.
- **Alternatives considered**: leaving the spec in the old format until the finish step replaces it:
  `ready` would fail for every task after task 2.
- **If wrong**: the spec's text is in git at the approval commit, `2f82948`.
- **Where**: task 2, step 7

## R4: The plan is written in today's plan format

- **Decision**: this plan keeps today's `## Decisions` section and full constitution table, with its
  test map under `### Test map`. Task 2 rewrites it in the new plan format.
- **Rationale**: `ura check specs` reads plans against today's template until task 2 changes it.
- **Alternatives considered**: the new plan format from the start: `ready` would fail during the
  first wave.
- **If wrong**: nothing: task 2 changes only the plan's headings.
- **Where**: `plan.md`
