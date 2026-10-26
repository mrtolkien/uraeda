# Rulings: Leader key/shortcut map

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: What "not listened for anywhere else" covers

- **Decision**: the [Keyboard decision](../decisions/keyboard.md) says a shortcut that acts on the
  page is declared in the registry. A key that belongs to a text field (a composer's Ctrl or
  Cmd+Enter and its Escape to leave, a one-line field's Enter and Escape), to a dialog while it is
  open (the category delete's Y, N, C), to a radio group, to the sandbox's bar, or to an overlay's
  own Escape (`StoryPick`, `embedLayout`) stays with its component. The structural test of Task 12
  holds exactly that line, as a named allowlist where each file has its reason.
- **Rationale**: the registry skips text fields and open layers, so it cannot own the keys they
  take; the decision's "acts on the page" says the rest. A file outside the list that listens for
  keys is migrated, never added.
- **Alternatives considered**: every key through the registry, fields included: it would need the
  registry to hand a field its own keys back, a second layer rule. No structural test: the three
  copies of the layer rule grew unseen.
- **If wrong**: a key kept out of the registry is missing from the leader menu and the status line;
  moving it is one `useKeys` call and one allowlist line.
- **Where**: task 12.

## R2: The menu's delay runs from the last key, and a shown menu stays

- **Decision**: while the menu is hidden, the half-second delay restarts at each key of a pending
  sequence; once shown, the menu stays and shows each next step at once. A pending `g` ends 2
  seconds after its key.
- **Rationale**: the spec says quick typing shows nothing and Space then waiting shows the menu; it
  does not say what a slow second key does. Which-key behaves this way, and a menu that disappears
  and returns while the human reads it would be worse.
- **Alternatives considered**: the delay from the first key only: the menu would flash during a
  sequence typed at a normal pace.
- **If wrong**: the delay is one constant and one rule in `sequence.ts`'s glue.
- **Where**: task 4.

## R3: A repeated key keeps its token

- **Decision**: `tokenOf` returns the token of a repeated key (`event.repeat`), and `null` only for
  a composition, a dead key, `Process`, `Unidentified`, and a modifier pressed alone. The plan's
  interface comment said "repeat-only" is `null`; it now says what is built. What a repeat may start
  (a sequence, the menu while Space is held) is the sequences' rule, Task 4's, which reads
  `event.repeat` itself.
- **Rationale**: holding `j` or an arrow goes on moving the selection or the scroll today, and the
  list keys never skipped repeats; a `null` for every repeat would end that, and the spec asks for
  nothing of the sort. Review focus 3 puts the rule on sequences and the menu.
- **Alternatives considered**: `null` for every repeat: held keys would stop moving. A flag on the
  token: a second return shape for one rule that only Task 4 needs, and it has the event.
- **If wrong**: `tokenOf` is the one place; the registry's listener would pass `event.repeat` on.
- **Where**: task 2, `keys/match.ts`.
