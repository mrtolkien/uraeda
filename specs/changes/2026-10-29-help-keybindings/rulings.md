# Rulings: The key map

The low-impact choices made while building [the change](proposal.md), inside the limits of the
[Keyboard](/specs/decisions/keyboard.md), [UI look](/specs/decisions/ui-look.md), and
[UI behaviour](/specs/decisions/ui-behaviour.md) decisions. None binds future work: those are
decisions.

## R1: The key map lists the keys of where the focus is, read as it opens

- **Decision**: `?` lists the bindings declared when it is pressed whose guard lets them act on the
  focused element: the page's, the shell's, the leader menu's by group, and the `g` keys. Keys with
  one label share a row (`j ↓ +` Next row). With the single keys off, it lists only the keys that
  still work, and writes the leader's from `Ctrl+K` (`Cmd+K` on a Mac).
- **Rationale**: "all shortcuts of the page" read from the one registry the
  [Keyboard](/specs/decisions/keyboard.md) decision names for "the later key search"; a key that
  does nothing where the human is would be listed wrongly.
- **Alternatives considered**: every key of every page, which would name keys that do nothing here.
- **Where**: [`keyMap.ts`](/packages/web/src/keys/keyMap.ts)

## R2: A reference, not a palette: its rows run nothing

- **Decision**: the rows are text, not buttons. The search filters them; Escape, Back, Close, or a
  click outside closes the map.
- **Rationale**: a page's key acts on the selection, which the map covers, and the leader menu
  already runs every sequence by a click. Running rows would make it a second command palette beside
  the pickers.
- **If wrong**: rows become buttons that close the map, then press their keys, as the leader menu's
  do.
- **Where**: [`KeyMap.tsx`](/packages/web/src/keys/KeyMap.tsx)

## R3: `? keys` in the status line, and `Space ?` in the leader menu

- **Decision**: the hint reads `? keys`, second after `space menu`, before `[ ] fold`. `Space ?`
  opens it too.
- **Rationale**: the proposal asks for `?` "after leader". `?` is a single key, which the switch
  turns off: the [Keyboard](/specs/decisions/keyboard.md) decision forbids a single key as the only
  way, and `Space ?` stays reachable from the chord.
- **Where**: [`store.ts`](/packages/web/src/keys/store.ts),
  [`KeyMap.tsx`](/packages/web/src/keys/KeyMap.tsx)

## R4: A list's `j` and `h` are labelled by what they do

- **Decision**: the list's `j` is "next row" and `h` "previous column", where they were "move" and
  "column", the status line's words, which stay as their hints' labels.
- **Rationale**: the key map lists each key by its label, and `j` read "Move" beside `↓`'s "Next
  row".
- **Where**: [`useListKeys.ts`](/packages/web/src/lists/useListKeys.ts)

## R5: The dialog keeps its height while the search filters

- **Decision**: on wide screens the dialog is as tall as the pickers' at most
  (`--size-palette-height`), whatever the search finds.
- **Rationale**: a dialog that shrinks as the rows go recentres, and the search field jumps under
  the typing.
- **Where**: [`KeyMap.tsx`](/packages/web/src/keys/KeyMap.tsx)
