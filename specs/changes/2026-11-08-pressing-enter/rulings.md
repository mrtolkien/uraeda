# Rulings: Pressing Enter on a settled point focuses its comment

The low-impact choices made while building [the change](proposal.md), inside the limits of the
proposal and the decisions. None binds future work: those are decisions.

## R1: `i` acts on the held point, as Enter does

- **Decision**: `i` on a held settled point does what Enter does: it opens the point's comment form
  with the focus in its field, or gives the focus back to its field when the form is open on it
  already. The point's bar reads "⏎ i comment".
- **Rationale**: the proposal's "`i` should also focus the last opened text box if it's relevant"
  read with the [keyboard guide](../../ui/keyboard.md): `i` edits the selection in place, as a held
  question's `i` focuses its comment field. The form a point opens is the last one opened while the
  cursor stays on that point, which is where the human comes back to it with `j` `k`. The bar shows
  `i`: while a point is held, `i` no longer reaches the session composer's "insert", and the
  [keyboard](../../decisions/keyboard.md) decision lets a selection give a key another meaning only
  when the selection shows it.
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
  every way of opening the form keeps the two kinds of comment alike. The focus is asked once per
  open: the form drawn again later, as its point moves in the file or the window narrows, takes
  none. On a wide screen the field scrolls into view as it takes the focus, so the human sees what
  they type; on the phone the sheet already shows it, and the page keeps its scroll.
- **If wrong**: the tap's case is `wide ||` in `onTap` and `onEdit`, in the same file.
- **Where**: `packages/web/src/SettledPoints.tsx`

## R3: Closing the form leaves the focus where the browser puts it

- **Decision**: once a form a key opened closes, by Add comment, Ctrl+Enter, or Cancel, the focus is
  not given back to its point, unlike a spec review's block (`useHandBack` in
  `packages/web/src/review/useKeyRange.ts`). The first `j` then takes the topmost stop on screen.
- **Rationale**: the proposal asks for the focus going into the form, not out of it. Giving it back
  is a change of its own, for both kinds of comment at once.
- **If wrong**: `useHandBack` can be shared with the settled points, in a change of its own.
- **Where**: `packages/web/src/SettledPoints.tsx`
