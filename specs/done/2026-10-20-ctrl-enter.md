---
kind: change
finished: 2026-10-20
---

# Record: Ctrl+Enter sends every composer

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-20, finished on
> 2026-10-20, merged locally with no pull request. Its full files are in git:
> `git log -- specs/changes/2026-10-20-ctrl-enter/`.

## What and why

Enter no longer starts a change or sends a chat message: Ctrl+Enter or Cmd+Enter does, as every
other multi-line field already saves. Enter adds a line. The rule follows
[UI coherence](/specs/decisions/ui-coherence.md): every agent chat composer behaves the same.

## Behaviour

- Ctrl+Enter or Cmd+Enter sends in every agent chat composer, at every width: a new chat, a
  feature's session, and "New change". Enter adds a line, on wide screens as on the phone.
- Shift+Enter, IME composition, an image-only send, and the wait while an image is saved are
  unchanged.
- On wide screens, the text send buttons ("Start the change", "Start the agent", "Start once this
  turn ends") show `Ctrl` and the Enter icon.
- The chat's round Send is Astryx's icon-only button: it shows no key. A tooltip made it
  `aria-disabled` and broke its tests.
- One-line fields, like the inbox's, are not composers and keep Enter.

## Design

The composer's one key handler, `useEnter`, decides: Ctrl or Cmd with Enter sends, Enter inserts a
newline, since Astryx sends text alone on Enter. The send buttons take a `keys` flag, true on wide
screens, which draws the key hint.

- [`Composer.tsx`](/packages/web/src/Composer.tsx)
- [`ComposerSend.tsx`](/packages/web/src/ComposerSend.tsx)

## Decisions

- [UI coherence](/specs/decisions/ui-coherence.md): a new rule for agent chat composers, added on
  the human's direct request.
