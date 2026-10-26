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
