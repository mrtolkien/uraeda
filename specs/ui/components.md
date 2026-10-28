# Components

"Make those two the SAME component." The [UI coherence](../decisions/ui-coherence.md) decision holds
the rule: a kind of information is drawn by one shared component everywhere. This guide names the
component for each job, in `packages/web/src/`, so a new view reaches for it before drawing
anything, and a change made to one is made once.

## The page and its parts

| Job                                        | Component                                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| A page's width, inset, and reading measure | `layout/Page.tsx`: `isReading`, `isPaired`, `isSession`, `isTight`, `isSnug`, `isFull`       |
| A group of content with a title            | `layout/Pane.tsx`: the title in the border, its tone, its fold, its count `· N`, its actions |
| A document's or a session's companions     | `layout/DocumentColumn.tsx`, over `layout/SideColumn.tsx`                                    |
| The same companions on the phone           | `layout/ColumnStatusLine.tsx` with `layout/NavBar.tsx`'s tiles, each opening a sheet         |
| What floats over the page on the phone     | `layout/glass.ts`'s frosted glass, shared by the bottom bar and the row's bar                |
| A separator between parts                  | `layout/rules.ts`: the rule above, the bar beside; `layout/Band.tsx`, the band between parts |
| A picked row or card, and its focus ring   | `layout/picked.ts`                                                                           |
| Prose                                      | `Blocks.tsx` for a document's blocks; `Prose.tsx`'s styles and markdown; `Paragraph`         |
| A key, written out                         | `keys/KeyCap.tsx`                                                                            |

## Things the human acts on

| Job                                        | Component                                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| A list of rows: the priorities, the inbox  | `lists/WorkList.tsx` and `lists/Card.tsx`, their keys from `useListKeys` and `useRowKeys`    |
| Rows nested under a row                    | `lists/OutlineEditor.tsx`                                                                    |
| A row's actions                            | `lists/RowBar.tsx`: under the row, or floating on the phone                                  |
| A feature's or a session's card            | `sidebar/ItemCard.tsx` and `CardRow.tsx`: the sidebar, home, and the sessions page           |
| A row's whole text                         | `pane/DetailOverlay.tsx`                                                                     |
| Choosing one of many                       | `keys/KeyPicker.tsx`, its rows drawn with the card's icon and state                          |
| A dialog, or the phone's sheet             | `layout/Overlay.tsx`                                                                         |
| A confirmation                             | `fields/Confirm.tsx`'s `useConfirm`, answered by `y` and `n`                                 |
| An undo                                    | `layout/useUndoToast.ts`                                                                     |
| A button that writes to git                | `writes/WriteButton.tsx`: it reads what it does while it runs, and blocks every other write  |
| A one-line field edited in place           | `EditableLine.tsx`'s `LineField`                                                             |
| A field of several lines                   | `fields/TextField.tsx`, its height by its `kind`, with `useTextField`'s unsaved store        |
| A comment                                  | `CommentForm.tsx`                                                                            |
| A message to the agent                     | `Composer.tsx`                                                                               |
| An agent's session: its messages and calls | `SessionView.tsx`, `Transcript.tsx`, `session/ActivityPanel.tsx`, `session/PlanProgress.tsx` |
| A menu of actions, as a last resort        | `layout/ActionsMenu.tsx`                                                                     |
| A key and what it does                     | the registry's `useKeys`, which the status line and the leader menu read                     |

## Rules of thumb

- **Find it before drawing it.** A view that needs a row, a pane, a picker, or a confirmation uses
  the one above, and adds what it lacks to it, for every page.
- **Two copies are a bug to merge.** When two pages draw the same thing their own way, such as the
  home's Inbox beside the inbox page's list ("This should be WorkList too, why do we have a custom
  component here?"), the fix is one component, not two that look alike.
- **Styles shared by several components live once**, as a StyleX object exported from `layout/`,
  such as `ruleStyles`, `legendStyles`, `glassStyles`, `pickedStyles`, and `proseStyles`, or as a
  token in a `*.stylex.ts` file, such as `paneVars`. "Make sure it's a global variable."
- **Astryx first.** A raw element stands in only where Astryx has no component for the job, with the
  reason in a comment, as the [UI components](../decisions/ui-components.md) decision asks.
