---
kind: change
finished: 2026-11-07
pull-request: https://github.com/mrtolkien/uraeda/pull/104
---

# Record: A swipe on a sheet's handle closes it, or takes it to the whole screen

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-11-07, finished on
> 2026-11-07, in [its pull request](https://github.com/mrtolkien/uraeda/pull/104). Its full files
> are in git: `git log -- specs/changes/2026-11-07-drag-handles/`.

## What and why

On the phone, the drag handle of a bottom sheet, such as the session's sheet on a round of
questions, did nothing: a swipe down sprang back. A swipe down on it now closes the sheet, and a
swipe up takes it to the whole screen.

## Behaviour

- A swipe down past 48 px on a sheet's top, its handle and title row (the top 64 px), closes it as
  the finger lets go, whatever the sheet holds. A form with text asks before it drops it, as its
  Close does. From the whole screen, a swipe down closes the sheet too.
- A swipe up past 32 px on the same top takes the sheet to the whole screen at once.
- A swipe that starts on content scrolled down scrolls it back up, and neither closes nor grows the
  sheet. A swipe below the sheet's top is the content's.
- A sheet closes once per gesture: Back goes back over its own history entry only.
- A form sheet still ignores a tap outside; an info sheet, the key map or a picker, still closes on
  one.

## Design

**Root cause**: [`Overlay`](/packages/web/src/layout/Overlay.tsx) makes every sheet a form
(`purpose="form"`), so that a tap outside does not lose a draft. Astryx's `BottomSheet` ties its
swipe-down close to that same purpose: it closes only an `info` sheet on a swipe, and springs a form
back.

**Approach**: [`useTopSwipe`](/packages/web/src/layout/Sheet.tsx), in the one phone sheet, replaces
the drag up it had. It follows a swipe that starts on the sheet's top, from touch events for a
finger and pointer events for a mouse or a pen, and closes through the sheet's `onClose`, the path
of its Close button. Every sheet closes on it, the info sheets too, since Astryx's own handle reads
pointer events alone, which a phone's browser may take back for its own gestures. `useOneClose`
drops a close that comes within 600 ms of another, from Astryx's gesture or the sheet's: closing
twice would go Back twice, off the page. The Close button is never dropped. The test is
[`sheet-swipe.test.tsx`](/packages/web/src/__tests__/sheet-swipe.test.tsx).

## Gotchas

- **The guard against a second close** exists because Astryx closes an info sheet on its own swipe,
  through `onOpenChange`, on the same gesture as the sheet's swipe: `useOneClose` in
  [`Sheet.tsx`](/packages/web/src/layout/Sheet.tsx). An Escape or a tap outside within 600 ms of a
  swipe whose form asked to keep its text is dropped once.
- **Touch events, not pointer events, for a finger**: Astryx's gesture code notes that iOS WebKit
  takes a touch's pointer back for its own gestures. The swipe was checked with a touch in Chromium
  and a mouse in WebKit, not on an iPhone.
- **A slow drag on a form sheet** moves with the finger, springs back as Astryx settles it, then
  slides out as the sheet closes.

## Changes after approval

- An info sheet closes on the sheet's own swipe too, with the guard against a second close, rather
  than on Astryx's swipe alone, which needed a fling or a drag past 40% of its height.
