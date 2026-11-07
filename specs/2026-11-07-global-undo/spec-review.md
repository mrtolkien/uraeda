---
verdict: changes-requested
commit: 52170b9
---

# Review: Spec, Global undo

## C1: General

Good but one important things for lists (inbox and priorities):

- No undo toast for moving things around, it’s too distracting
- On desktop the step in the undo stack should group all list movements that happened within less
  than 1s of each other. It means that when a move starts it should start a timer, and every time a
  move is done during this timer the move is added to this step and the timer removed. Because often
  we move things multiple lines at once, and it’s better if u cancels the whole movement.
