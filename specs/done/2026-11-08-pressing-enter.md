---
kind: change
finished: 2026-11-08
pull-request: https://github.com/mrtolkien/uraeda/pull/110
---

# Record: Pressing Enter on a settled point focuses its comment

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-11-08, finished on
> 2026-11-08, in [its pull request](https://github.com/mrtolkien/uraeda/pull/110). Its full files
> are in git: `git log -- specs/changes/2026-11-08-pressing-enter/`.

## What and why

On a round of questions, Enter on a settled point held by the keyboard's cursor opened its comment
form, but left the focus on the point: the human had to press Tab or click before typing. The field
now takes the focus at once, and `i` brings the human back to it, as on every other editable
selection.

## Behaviour

- Enter or `i` on a held settled point opens its comment form with the focus in its field, at every
  width: in the form under the point on a wide screen, in the sheet on the phone. The point's bar
  reads "⏎ i comment"; while a point is held, `i` comments on it rather than focusing the session's
  composer.
- Enter or `i` on a held point whose form is open already gives the focus back to its field, the
  text kept, as after Escape left it.
- A tap on a point, or Edit on one of its comments, focuses the field on a wide screen, as a spec
  review's comment does. On the phone, a tap opens the sheet without raising the keyboard.
- The focus is asked once per open: the form restored with the page, an edit renumbered by a
  removal, and the form drawn again as its point moves or the window narrows take none.
- Closing a form a key opened leaves the focus where the browser puts it: the point does not get the
  cursor back, unlike a spec review's block.

## Design

The form never asked for the focus: a held point's Enter ran the same open as a tap, and nothing
focused the field. [`useSettledForm`](/packages/web/src/SettledPoints.tsx) now holds the rule: an
open, or a key on the open form's point, takes the focus on a wide screen or after a key
(`isKeyInput` in [`cursor/held.ts`](/packages/web/src/cursor/held.ts)). Each such request bumps a
counter, and `useFocusAsked` focuses the form's field once it is drawn, waiting up to 10 frames for
the phone's sheet; a counter rather than the editor's `hasAutoFocus` keeps a later remount from
taking the focus again. The field scrolls into view on a wide screen and keeps the page's scroll on
the phone. `pointKeys` adds `i` beside Enter. Tested in
[`settled-keys.test.tsx`](/packages/web/src/__tests__/settled-keys.test.tsx).

## Gotchas

- The focus is not the form's `hasAutoFocus`: the editor focuses on every mount, and the form
  remounts when its point's block id shifts, when its point leaves the round, or when the window
  crosses into the phone's sheet, which would raise the keyboard after a wide tap.
- The field is found by CodeMirror's `[role="textbox"]` inside a `display: contents` box around the
  form, as the spec review's `fieldAfter` finds its own.

## Follow-ups

- Giving the held point the cursor back once its form closes, as the spec review's `useHandBack`
  does, would be a change of its own, for both kinds of comment at once.
