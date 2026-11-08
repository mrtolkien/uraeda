# Rulings: Pressing Enter on a settled point focuses its comment

The low-impact choices made while building [the change](proposal.md), inside the limits of the
proposal and the decisions. None binds future work: those are decisions.

## R1: `i` acts on the held point, as Enter does

- **Decision**: `i` on a held settled point does what Enter does: it opens the point's comment form
  with the focus in its field, or gives the focus back to its field when the form is open on it
  already. The point's bar keeps "⏎ comment" alone.
- **Rationale**: the proposal's "`i` should also focus the last opened text box if it's relevant"
  read with the [keyboard guide](../../ui/keyboard.md): `i` edits the selection in place, as a held
  question's `i` focuses its comment field. The form a point opens is the last one opened while the
  cursor stays on that point, which is where the human comes back to it with `j` `k`. A second key
  for an action already shown stays unhinted, as the guide says.
- **Alternatives considered**: `i` on any point focusing whatever form is open, even on another
  point. It makes `i` mean something other than the held row, unlike every other page.
- **If wrong**: one line in `pointKeys`, in `packages/web/src/SettledPoints.tsx`.
- **Where**: `packages/web/src/SettledPoints.tsx`

## R2: A tap on a wide screen and Edit focus the field too

- **Decision**: a settled point's comment form takes the focus in its field whenever the human opens
  it on a wide screen, by a tap, a key, or Edit, and on the phone when a key opens it. A tap on the
  phone still opens the sheet without raising the keyboard. The form restored with the page, or an
  edit renumbered by a removal, takes no focus.
- **Rationale**: the same rule as a spec review's comment form, `useFieldAfterTap` in
  `packages/web/src/useCommentDraft.ts`, and the keyboard guide's "a form its field". One rule for
  every way of opening the form keeps the two kinds of comment alike.
- **If wrong**: the tap's case is `wide ||` in `onTap` and `onEdit`, in the same file.
- **Where**: `packages/web/src/SettledPoints.tsx`
