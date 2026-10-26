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

## R4: Existing settings tests gain the `keyboard` field they now read

- **Decision**: `Settings` gains the `keyboard` table, always present like `runs`, so the existing
  settings tests that spell a whole `Settings` value or a whole record gain the field: Rust's
  `reads_each_file` (`..Settings::default()` on its `full` value), the binding contract's two
  `toEqual` of a whole `Settings` (`keyboard: {}`), the server's `settings.test.ts` fixtures
  (`keyboard: {}`), and `settings-fate.test.ts` (the selection lists `keyboard`, its two
  whole-record expectations hold the defaults, and the broken-file test also tries
  `setSingleKeyShortcuts`, seven refusals instead of six). Nothing is loosened: each assertion still
  checks every value it checked, and the new field is checked as well.
- **Rationale**: a whole-value assertion cannot pass over a type that has a new field without naming
  it; the alternative is a loosened `toMatchObject`.
- **Alternatives considered**: `keyboard` optional and absent unless set: the other tables are
  always present, and the web's record would need a special case.
- **If wrong**: the added lines are the whole change; removing them restores the old tests.
- **Where**: task 3.

## R5: A dialog inside a closed popover is not a layer, in happy-dom too

- **Decision**: `keys/layers.ts`'s `shown` asks `checkVisibility()` as well as `getClientRects()`:
  an element is shown only when both say so. Task 2's rule counted every `[role="dialog"]` in the
  document whose `getClientRects()` had a rect, and happy-dom gives every element one, so the
  repository menu's closed popover (a `role="dialog"` inside a `display: none` popover, on every
  page) made the real app "a layer is open" for every key in a happy-dom test: no binding ran and no
  hint showed. A real browser gives a hidden element no rect, so nothing changes there.
- **Rationale**: Task 5 is the first task to press a key on the whole app in a happy-dom test (the
  folds, the status line's `[ fold`), and the existing `status-line.test.tsx` and `] folds…` tests
  of the column failed on it. Every task that tests keys on the real page needs the same.
- **Alternatives considered**: closing the repository menu's popover out of the DOM in tests, or
  making each test remove it: a workaround per test for a rule that is wrong in one environment.
  Dropping the `role="dialog"` selector: a real shown dialog would no longer hold the keys.
- **If wrong**: `shown` is one function; `checkVisibility` is in every browser the app supports
  (Chrome 105, Firefox 106, Safari 17.4), and the `?.` keeps the old answer where it is missing.
- **Where**: task 5, `keys/layers.ts`.

## R6: The decisions palette previews raw text, and its assertions say so

- **Decision**: the decisions page's `/` opens the key picker, whose preview is raw markdown (the
  spec: "the decisions picker loses its rendered preview for now"). The assertions of
  `palette.test.tsx` and of `__browser__/decisions.test.tsx` that read the rendered preview change
  to read the preview's text: a heading and a rule found by role become the file's
  `# Notifications`, its frontmatter (`approved-by: mrtolkien`), its first sentence, and every rule
  with its `- ` mark (the rendered preview cut at three, with "and 1 more"). The principle's numeral
  test and the cursor test read `### III. Asynchronous by default` and
  `### I. Humans stay in control`, where they read headings and "Constitution · N rules". Every
  other assertion of both files is untouched: the combobox's name "Jump to a decision or principle",
  `/` in a text field, in the sort menu, and on an open disclosure, the live list, "Nothing
  matches.", the beside-the-list position, and the SC-005 three-letter test.
- **Rationale**: the plan asks for exactly this change, each with a ruling. A principle has no file
  of its own and the constitution's text is not served (only `Decision.text` is, the one addition
  the spec allows), so a principle previews as its numbered heading and its rules as plain list
  lines: the ranking and the numeral still find it, and the reader beside the list still shows it
  rendered.
- **Alternatives considered**: serving `Constitution.text` too: a second core and binding change in
  a task that has none, for a preview of a few lines. Hiding principles from the picker: SC-005 and
  the numeral search would lose them.
- **If wrong**: the principle's lines are one `preview` in `decisions/jump.ts`; a served
  constitution text replaces them with the principle's slice of it.
- **Where**: task 7.

## R7: What the key picker adds to the plan's interface, and how it is opened

- **Decision**: `PickerItem` gains two optional fields, `mark` (a principle's numeral, drawn in the
  place of its icon, and matched first by a search) and `summary` (a first sentence, the second
  place a search looks); `KeyPicker` gains optional `label` (its search field's name, `title` by
  default), `placeholder`, and `showKinds` (the kind beside each row, set by the host for `"all"`).
  The open state is module state behind `useKeyPicker`, and `KeyPickerHost` is mounted once in
  `Shell.tsx` as a sibling of `Notifier`, so no provider wraps the page. Nothing is read until the
  first opening; after it the host stays mounted, closed. A feature's and a change's proposal comes
  in one batched request after the list, so those previews are empty for a moment and the list
  itself does not wait for them (the plan said the hook suspends: it does for the list, not for the
  proposals). A session's third line is its feature's branch, else the main checkout's current
  branch: a session row carries no branch, and no server field is added. The picker's search ranking
  is `searchRanked` in `decisions/jump.ts`, which `searchEntries` now calls: one ranking for both.
- **Rationale**: the decisions instance must keep principles (found by numeral) and rank on the
  first sentence, not on a whole file, or "noti" would match every file that says "notification";
  showing the kind only among several kinds keeps the decisions rows' text exactly their title, as
  the unchanged palette tests read it.
- **Alternatives considered**: a `principles` kind: the "all" picker and the leader menu would list
  a kind the spec does not name. A provider around the page: it re-indents the provider stack that
  tasks 4 and 5 edit. Reading each proposal when its row is under the cursor: more requests and a
  flicker at every arrow key, for the same text.
- **If wrong**: each addition is one optional field or prop with one reader; the host's module state
  is `keys/pickerState.ts`.
- **Where**: task 7.

## R8: Firefox's quick find on `/` outside text fields

- **Decision**: the decisions page's `/` runs from the registry on `keydown`, which the registry
  answers with `preventDefault` when a binding ran, so the page's key wins over Firefox's quick find
  (the spec's niche edge case). What was checked: the registry's `preventDefault` on the handled key
  (`palette.test.tsx`), and Playwright's Firefox loaded with a page that heard `/`, `a`, `b` with
  and without `preventDefault`: it delivers every key to the page either way, because it sends
  events into the page and not through Firefox's own key handling, so it cannot show the find bar.
  The run in a human's Firefox, `/` then a letter on the decisions page with no find bar, is
  deferred.
- **Rationale**: quick find opens on the key's `keypress`, which a prevented `keydown` cancels, in
  Firefox as in other browsers; the check that would show it needs the browser's own chrome.
- **Alternatives considered**: none: the spec says the page's key wins.
- **If wrong**: a find bar opens beside the picker on `/`; the cost is a human closing it.
- **Where**: task 7, deferred check.

## R9: Where H and L send the item, and where Task 6's tests live

- **Decision**: `H` and `L` (and Shift with the left and right arrows) move the selected item to the
  end of the previous or next section that takes drops, in the order the sections show: the ongoing
  entries, which hold running lines no drop lands in, are skipped, and an empty section counts. `K`
  and `J` move it one place within its section. The write is the one a drag's drop makes, through
  the list's `onMove`, and a second key waits for the first move to be written and shown (R30).
  `onMoveItem` takes the row as well, `(move, row)`, so the keys move the card the focus is on,
  which a click or `j` selects but a Tab does not. The existing hint test for a list's Escape moves
  from `status-hints.test.tsx` to `keys-hints.test.tsx` and reads the registry's hints, with the
  same three assertions (named, renamed, left out where it does nothing); the old API's own test
  stays until Task 12 retires it. The priorities page's key tests are in
  `__browser__/keys-shift.test.tsx`, a list alone's in `__tests__/keys-shift.test.tsx`.
- **Rationale**: the spec says "to the previous or next column or section" and the scenario sends
  Next's line to Later, without a place in it; the end is the one place that needs no row to compare
  with, and the move menu's "bottom" does the same. The row argument costs nothing and avoids moving
  a card other than the one with the focus ring. The priorities page's moves are written to a real
  repository and read back, so their tests are browser tests, as the existing list-keys tests are.
  (This ruling first said happy-dom took the Repositories popover for an open layer, so no whole
  page's key could be tested there: R5's `checkVisibility` fix ended that, and it was no reason.)
- **Alternatives considered**: the same row index in the neighbouring section, as `h` and `l` do for
  the selection: a card would land among others by its position, which says nothing of what the
  human means, and an empty section would need a special case. Moving only the selected card: a
  focused card the selection does not name would not move, with its ring on it.
- **If wrong**: the target is one function, `lists/itemMoves.ts`.
- **Where**: task 6.

## R20: A letter's case is Shift's, and keyCode 229 is a composition

- **Decision**: `tokenOf` gives a single Latin letter (`a` to `z`) the case Shift says, `J` with
  Shift and `j` without, whatever the key's own case and Caps Lock say; with Ctrl, Cmd, or Alt the
  letter is lowercase and Shift is the token's own (`mod+shift+k`). A keydown whose `keyCode` is 229
  is no shortcut, as with `isComposing`. A character with no case, and a letter of another script,
  stays what was typed.
- **Rationale**: with Caps Lock on, `j` types `J`, the key that moves the selected item and writes
  to git; the human pressed `j`. Astryx's `isImeKeyEvent` treats 229 as a composition because Safari
  ends the composition before the keydown, so `isComposing` is already false.
- **Alternatives considered**: reading `getModifierState("CapsLock")` and flipping the case back:
  the same result with one more state to stub, and it fails where the keyboard reports no Caps Lock
  state. Treating every non-ASCII letter the same way: `toUpperCase` is not one letter in every
  script (`ß`), and no binding names one.
- **If wrong**: a layout whose Latin letter needs a case other than Shift's (none known) loses the
  key; the change is `letter` in `keys/match.ts`.
- **Where**: fix pass A, `keys/match.ts`. Existing tests whose keydowns were a capital with no
  Shift, which no keyboard sends without Caps Lock (`J K H L` in `keys-shift.test.tsx`, `G` in
  `keys-scroll.test.tsx`), now send `shiftKey: true`, and `__browser__/keys-shift.test.tsx` types
  `{Shift>}J{/Shift}` for `J K H L` (the browser's `keyboard("J")` sends no Shift): the same
  assertions on a realistic event.

## R21: A binding names only keys a keydown gives, and Ctrl or Cmd with a named key is a chord

- **Decision**: `createKeyStore.set` throws, in every build but production and beside the clash
  check, where a token of a binding is none `tokenOf` can give: Space is `space`; a printable
  character is itself (`J`, `[`, `+`); `mod+` goes only before one printable character, lowercase
  (`mod+k`, `mod+/`); a named key is spelt as `event.key` spells it, with `shift+` before it or not
  (`ArrowDown`, `shift+Tab`, `F1`). `Space`, `escape`, `ctrl+k`, `shift+J`, `Shift+ArrowDown`,
  `mod+ArrowDown`, `mod+K`, `alt+x`, and an empty token throw. `tokenOf` keeps the name of a named
  key under Ctrl or Cmd as the browser spells it (`mod+ArrowDown`, `mod+shift+ArrowDown`) instead of
  lowercasing it (`mod+arrowdown`): a chord no binding can name, which ends a pending sequence and
  goes on to the browser (`isPassing` in `sequence.ts`). Both directions are tested: `isCanonical`
  is true of every token `tokenOf` gives for a binding's keys, false of the chords it gives for no
  binding.
- **Rationale**: `mod+ArrowDown`, `Space`, `shift+J`, `escape`, `ctrl+k`, and `Shift+ArrowDown` were
  declared and never ran, silently: a key that never matches is a bug a page's test should see at
  once, as it does for a key that means two things. The plan names only `mod+k` as a modifier
  binding; named keys with Ctrl or Cmd are the browser's and the OS's (Ctrl+ArrowDown moves a
  desktop on macOS).
- **Alternatives considered**: allowing `mod+` before a named key: no feature binds one, and each
  would clash with the browser's. Allowing `mod+shift+k` and `alt+`: nothing declares them, and one
  line adds them when something does. Warning with `console.error` instead of throwing: the clash
  check throws, and a warning is lost in a test run.
- **If wrong**: a feature that needs Ctrl+Arrow or Alt keys extends `isCanonical` in
  `keys/match.ts`, and `tokenOf` already gives their tokens.
- **Where**: fix pass A, `keys/match.ts`, `keys/store.ts`.

## R22: A pending sequence swallows printable keys only, and a named key ends it and goes on

- **Decision**: while a sequence is pending or the menu is shown, a key that completes or continues
  a sequence, Escape, Backspace, and the leader chord are the menu's; a printable key or Space that
  no binding uses is consumed ("`x` does nothing", and a shown menu stays open); every other key
  ends the sequence and goes on un-prevented, to the browser and then to the page's bindings: F1 to
  F12, PageUp, PageDown, Home, End, Enter, the arrows, Tab, and any chord. `g` then F5 reloads.
  Tested at the machine (`keys-sequence.test.ts`) and wired, with the keydown's `defaultPrevented`
  (`keys-leader.test.tsx`). The one existing assertion that changes:
  `an unbound key in a shown menu` in `keys-sequence.test.ts` took ArrowDown as consumed with the
  menu staying open; it now asserts `+` there, and ArrowDown is in the new test of the named keys.
- **Rationale**: preventing every key while a `g` is pending blocks the browser's own keys for two
  seconds, a menu shown for as long as the human reads it, which includes reload, find, and paging;
  the spec's one rule is about letters ("`x` ... does nothing").
- **Alternatives considered**: ending only on F-keys: Enter and the arrows have the same fault (a
  focused button that Enter would press, a page the arrows scroll). Keeping the menu open on a named
  key: the human who pressed PageDown wants the page to page, and the menu has no use of it.
- **If wrong**: a named key the leader tree needs (none now) binds like any other: a bound token is
  matched before this rule.
- **Where**: fix pass A, `keys/sequence.ts`.

## R23: The keyup of a Space the registry took is prevented, and Firefox is not a test project

- **Decision**: when the registry's keydown listener prevented a Space (the leader took it from a
  button, a link, or a row), the next `keyup` of Space is prevented too, once; a blur forgets it. A
  Space the registry did not prevent, or one another handler had already prevented, keeps its keyup.
  Tested at the unit level: `fireEvent.keyDown` and `keyUp` return `false` for the taken Space, and
  `true` for a checkbox's, for another key's, and for the keyup after. No Firefox project is added:
  the browser project runs in WebKit (`vite.config.ts`), and Playwright's Firefox, installed here
  (`firefox-1543`), sends events into the page rather than through Firefox's own key handling, as R8
  found for quick find, so it would not show a button pressed on keyup.
- **Rationale**: a button is pressed by Space on `keyup` in Firefox, and a prevented `keydown` does
  not stop it there as it does in Chromium and WebKit; the leader must never press the button the
  human only meant to start a menu on.
- **Alternatives considered**: a Firefox project with the button test: it would pass whether or not
  the keyup is prevented. Preventing every Space keyup: it would stop a checkbox, a switch, and a
  radio card from taking their own Space, which the registry leaves alone.
- **If wrong**: a Firefox human sees the Note button pressed on releasing Space after the menu
  opened; the check in a human's Firefox is deferred. The fix is the `keyup` listener in
  `KeysProvider`.
- **Where**: fix pass A, `keys/registry.tsx`; deferred check, Firefox by hand.

## R24: A key pressed inside a popover is the popover's, and the layer rule's tests pin each part

- **Decision**: `keys/layers.ts` adds the old rail's rule, a key pressed inside a `[popover]` that
  is not manual (`target.closest("[popover]")` in `Rail.tsx`'s `useEscape` before task 2) to the
  places a key is a layer's. New tests pin each other part of the rule so that dropping one fails:
  an alert dialog, an expanded combobox (and not a collapsed one), a key inside a listbox, an alert
  dialog, a dialog by role, and a bare `dialog`, a hidden dialog left in the page (by
  `display: none`, itself or its holder; by the `hidden` attribute in `keys-layers.test.tsx`,
  because happy-dom has no user-agent style for it), and a declaration clash inside one component's
  own list. Each part of `layers.ts` was removed in turn and a test failed.
- **Rationale**: the old rule treated a key inside any popover as the popover's, and the registry
  lost it: a focused control inside an open popover that is neither a menu nor a dialog (the
  Repositories popover's own content, a date picker) let `j` move the list behind it. A manual
  popover stays out, as the toasts' region is open on every page.
- **Alternatives considered**: reading `:popover-open` on the target's ancestors: the Popover API is
  missing in happy-dom, so the unit test could not see it, and the focus inside a closed popover
  cannot happen in a browser anyway.
- **If wrong**: a popover that should let the page's keys through (a tooltip holding a focusable
  control, which Astryx does not draw) is made manual.
- **Where**: fix pass A, `keys/layers.ts`, `keys-registry.test.tsx`,
  `__browser__/keys-layers.test.tsx`.

## R25: The leader menu lists only the entries whose `when` holds at the focus

- **Decision**: `entriesAt(bindings, path, target)` skips a binding whose `when` is false for
  `target`, as `leader.press` does at the key, so an entry or a group whose every binding is guarded
  off is not listed, and one key with two bindings is listed if either guard holds. The menu's host
  passes `document.activeElement`, which is where the key that began the sequence went, as the menu
  shows half a second after it. `target` defaults to `null`, which `when` functions of the
  registry's own tree read as "no target".
- **Rationale**: the menu showed an entry the key would not run: a human reads the menu to choose,
  and a dead entry is a lie in it.
- **Alternatives considered**: keeping the event's target in the leader's step: one more field on
  every step for a focus that rarely moves in half a second; and a focus that did move is better
  followed than the stale one.
- **If wrong**: a guard that reads more than the focus (none now) would list an entry that does not
  run; the guard's reader is `leader.press`'s `event.target`.
- **Where**: fix pass A, `keys/sequence.ts`, `keys/LeaderMenuHost.tsx`.

## R26: A sequence through a group `groups.ts` does not name throws

- **Decision**: `createKeyStore.set` throws, beside the clash check and in every build but
  production, where a sequence goes through a group `keys/groups.ts` has no entry for: every prefix
  of two or more tokens before the last (`space n` for `space n n`, `space n n` for `space n n z`).
  The first key, `space` or `g`, is the root, not a group. The message names the binding, its label,
  and the group. A binding with no sequence, or only one level, is never affected.
- **Rationale**: its keys work and the menu draws nothing for the group, so no human can find them:
  a mistake only a developer can see, best seen by the first test that mounts the page, as a clash
  is. `console.error` would be lost in a test run, and the plan's Task 10 names every group it adds
  in `groups.ts` with its keys.
- **Alternatives considered**: a warning with `console.error`: the setup does not fail a test on it.
  Drawing an entry with the keys as its label: a menu of entries with no name or icon looks finished
  and is not.
- **If wrong**: a feature that stages keys before their group is named adds the group's line first
  in `groups.ts`.
- **Where**: fix pass A, `keys/store.ts`.
## R30: A second move key queues; each target is read when it runs

- **Decision**: `WorkList`'s moves (`J K H L`, Shift with the arrows) go in a queue: a key pressed
  while an earlier move is being written is kept, and runs once that write resolved and the list was
  drawn in the order it wrote, with its target read from that list. A move whose write fails is
  dropped (the page shows a refusal through `onMoveRefused`), and the next one still runs. A write
  the list never shows (refused, or a no-op) holds the queue for 2 seconds at most (`SETTLE_MS` in
  `WorkList.tsx`). The first move of an idle queue starts in the key's own event.
- **Rationale**: R9 said a second key waits, and the first version dropped it: `J J` pressed
  quickly, or a held `J`, moved the card one place. A move written over the old list's hash would
  also be refused, so the wait is for the new list, not only for the write: the priorities' mutation
  resolves some tens of milliseconds before the list shows its result.
- **Alternatives considered**: ignoring a key during a write (R9's first reading): a held `J` would
  stop after one place, which is not what a held key means. Waiting a fixed time after the write:
  too short on a slow machine, too long on a fast one.
- **If wrong**: `useItemMoves` in `lists/WorkList.tsx` is the one place; the old behaviour is its
  `isMoving` guard.
- **Where**: fix pass B, `lists/WorkList.tsx`, `__tests__/work-list-moves.test.tsx`,
  `__browser__/keys-shift.test.tsx`.

## R31: The open rail's page Escape is a fallback: a pane closes first, then the rail folds

- **Decision**: with the rail open (a hover opened it, the focus on the page), Escape pressed
  outside the rail runs the page's own Escape first, and folds the rail only where no binding of the
  page took it. One Escape closes the pane (or whatever the page's Escape closes), the second folds
  the rail. Inside the rail, Escape is still the rail's own (`useRail`'s `onKeyDown`, which also
  moves the focus to the logo). This changes the old rail: its document listener folded the rail on
  every Escape, at the same time as a page's own Escape, and in a text field too; the registry's
  rule keeps Escape in a text field and under a layer for their owners.
- **Rationale**: one key, one thing (the registry's rule, R1): a fallback is how a shell default
  yields to a page's binding, and a rail left open by a resting mouse is the lesser thing to close.
  A text field's Escape (discarding a draft, closing a combobox) must not also fold the rail.
- **Alternatives considered**: the rail first, then the pane: a human closing a pane with Escape
  would see the rail fold instead and press again, on every page, for a rail they did not mean to
  open. Both at once, as before: two actions on one key.
- **If wrong**: `useEscape` in `shell/Rail.tsx` drops `fallback: true`, and the registry's conflict
  check then names the pages that bind Escape too.
- **Where**: fix pass B, `__tests__/keys-scroll.test.tsx` ("one Escape closes the pane and the next
  folds the rail").
