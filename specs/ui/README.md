# The UI's direction

How Uraeda's web UI should read, behave, and be put together. The [decisions](../decisions/) hold
the binding rules, [UI look](../decisions/ui-look.md), [UI layout](../decisions/ui-layout.md),
[UI behaviour](../decisions/ui-behaviour.md), [UI coherence](../decisions/ui-coherence.md),
[UI components](../decisions/ui-components.md), and [Keyboard](../decisions/keyboard.md). These
guides say what those rules aim at, and how a view meets them, from what the human asked for while
going over every view by hand. Read them before designing or changing a view, and say in a spec when
a view departs from them, and why.

## In one paragraph

Uraeda is a terminal tool for reading and deciding. Every view can be driven from the keyboard with
Vim's habits, and every view is comfortable to read for a long time: prose in a reading font, at a
line one reads, with a hierarchy that shows what matters first. Nothing on screen is there for
decoration: each element earns its place, shows what it does, and looks the same wherever it
appears. What moves, glides; what is pressed, answers at once. The phone gets the same product,
reshaped for a thumb, not a smaller desktop.

## The principles, by priority

When two conflict, the higher one wins.

1. **Readable first.** The human reads specs, rounds, and sessions for hours. Text that is
   comfortable to read beats text that fits more on screen. See [Reading](reading.md).
2. **Every action by keyboard and by tap.** A view without keyboard navigation is unfinished. A key
   is never the only way, and hover is never the only way. See [Keyboard](keyboard.md).
3. **Coherent.** The same thing looks and behaves the same on every page, through one shared
   component. Two pages that drift apart are a bug. See [Components](components.md).
4. **Nothing pointless.** No element without a job: no decorative mark, no menu holding one action,
   no sentence explaining the obvious, no second copy of what is already on screen. See
   [Look and feel](look-and-feel.md).
5. **Clear affordance.** What can be pressed looks pressable, what can be typed in looks writable,
   and two separate targets look separate. See [Look and feel](look-and-feel.md).
6. **Calm motion, instant answers.** Moving content animates and never jumps; a press shows its
   effect at once, while the write runs behind it. See [Space and motion](space-and-motion.md).
7. **The human decides.** One primary action per flow, an agent never starts unseen, and what
   destroys asks first. See [Flows](flows.md).

## The guides

- [Reading](reading.md): fonts, line lengths, hierarchy, lists, tables, and what not to put in text.
- [Keyboard](keyboard.md): the keymap's habits, selection, focus, and which keys show as hints.
- [Surfaces](surfaces.md): when to edit in place, use a row's bar, a picker, the leader menu, a
  dialog, a sheet, a page, the side column, or the bottom bar.
- [Components](components.md): the shared component for each job, and which to reach for first.
- [Look and feel](look-and-feel.md): affordance, removing what is pointless, shapes, colours, and
  glass.
- [Space and motion](space-and-motion.md): room, tokens, animation, and speed.
- [Flows](flows.md): committing, starting the agent, confirming, and reviewing.
- By width: [the phone](phone.md), [semi-wide](semi-wide.md), and [wide](wide.md) screens.

## How the direction was found

These guides come from going over every view in the running app with the human, one element at a
time, in the `ui-fixes` work of October 2026: about 250 requests, each a small fix, a removal, or a
"make these two the same". The rules here are what those requests have in common. Where the human
said a rule outright, it is quoted.
