---
kind: change
finished: 2026-11-04
pull-request: https://github.com/mrtolkien/uraeda/pull/93
supersedes: [2026-10-14-session-view, 2026-11-01-stable-buttons]
---

# Record: Reading long responses is not comfortable because the composer always stays…

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-11-04, finished on
> 2026-11-04, in [its pull request](https://github.com/mrtolkien/uraeda/pull/93). Its full files are
> in git: `git log -- specs/changes/2026-11-04-reading-long/`.

## What and why

Reading an agent's long reply was uncomfortable: the session's composer stayed at the window's foot,
an empty box covering about a third of the window. The human asked for the composer to be "always at
the end, after the messages", so that the agent's messages have all the vertical space.

## Behaviour

- **A session's composer comes after its messages**, at the page's end, at every width and in a
  round's Session column. Scrolled up, the transcript has the whole window; at the end, the composer
  shows whole above the status line, or above the phone's bottom bar.
- **A short session keeps its composer at the window's foot** from its first draw, and as the
  messages come, until they fill the window: Send does not move down with each message.
- **"Jump to the latest" floats at the window's foot** while the human reads above the end, and over
  the composer's top at the end. It still goes to the start of the agent's last reply, and the phone
  keeps the bottom bar's ↓.
- **A session opens at its true end**, the composer whole, though the composer's editor draws after
  the page moved to its end. A composer that grows while the human is at the end, as it unfolds on
  the phone, keeps the end in view. A human reading above the end is never moved.
- **Writing a message brings the composer into view**: `i`, and asking the agent from a round's
  page, scroll it into view above the status line as they focus it.
- **The UI guides say it**: [space and motion](/specs/ui/space-and-motion.md),
  [surfaces](/specs/ui/surfaces.md), and [the phone](/specs/ui/phone.md).

## Design

The composer in [`SessionView.tsx`](/packages/web/src/SessionView.tsx) is no longer
`position: sticky`: it follows the transcript in the page's flow. "Jump to the latest" moved to a
sticky anchor of its own, zero high, just before the composer: it takes no room, sticks at the
window's foot above the status line, and carries the `marginBlockStart: auto` that keeps a short
session's composer at the foot of the `isFull` [`Page`](/packages/web/src/layout/Page.tsx).

`useKeepsEndAsItGrows`, in [`following.ts`](/packages/web/src/following.ts), watches the composer:
when it grows, it moves the page to its end if the page was last moved there by its own scroll, as
it opened or followed, or if the human was within 24 px of the end before it grew. A scroll that
leaves the end the page moved to forgets it, so a stale end from an earlier page moves no one. Its
scroll goes through `toEnd`, so `useScrolledAway` and `useFollowEnd` read it as the page's own end.

`i`, in [`Composer.tsx`](/packages/web/src/Composer.tsx), scrolls the field's drop wrapper,
[`DropHint`](/packages/web/src/attach/DropHint.tsx), into view, whose scroll margin keeps it above
the status line. The round's Ask, `focusOnceDrawn` in
[`ColumnSession.tsx`](/packages/web/src/ColumnSession.tsx), scrolls the field into view in its
column.

## Replaced behaviour

- **The composer sticky at the window's foot**, scrolled up or at the end, from
  [stable buttons](2026-11-01-stable-buttons.md) and the [session view](2026-10-14-session-view.md),
  and floating over the transcript on the phone. No test guarded it; none was removed.

## Gotchas

- **The page keeps its end as the composer grows** because the composer's CodeMirror editor mounts
  in a layout effect after the transcript's `openAtEnd`: a wide session opened about 190 px short of
  its end. The sticky composer hid it; in the flow, it cut the composer in half
  ([`following.ts`](/packages/web/src/following.ts)).
- **`i` scrolls the drop wrapper, not the composer's box**: Astryx's `ChatComposer` puts its
  `xstyle` on an inner element, not on the root its ref gives, so a scroll margin set there was
  ignored ([`DropHint.tsx`](/packages/web/src/attach/DropHint.tsx)).
