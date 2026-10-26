---
status: auto-approved
spec-revision: 3
---

# Plan: Leader key/shortcut map

**Goal:** the whole web UI is driven from the keyboard: a Space leader menu, `g` sequences, one base
keymap on every page, a key picker, and a setting that turns single-key shortcuts off, all declared
in one key registry.

**Architecture:** keys become data, as the [spec's architecture](spec.md#architecture) says and the
[Keyboard decision](../decisions/keyboard.md) requires. Ownership:

- **`packages/web/src/keys/` owns every key rule.** One window listener, the one "a layer is open"
  rule, matching by the character typed, sequences with their delays, the off switch, the conflict
  check, and the hints the status line draws. No page, list, or shell part listens for keys, except
  the allowlist of [Complexity tracking](#complexity-tracking).
- **A component declares its keys while it is mounted**, with `useKeys(bindings)`. A binding is its
  keys, label, optional icon, hint, and handler; the leader menu is whatever the registry holds for
  the keys pressed so far, so it grows with the features. The owner of an action declares both its
  base key and its leader entry, so `[` and `Space u [` exist only while a navigation column does.
- **The scroll fallback is a registry default.** The vertical keys scroll the area holding the
  focus, else the page's main column, only when no mounted binding handled the key: a list that
  declared `j` moves its selection, and nothing scrolls.
- **The places** are `destinations.ts`, which already exists: the navigation column, the phone's
  tabs, and the leader menu draw their icons and labels from it.
- **The setting** is `[keyboard] single_key_shortcuts` in the Rust core, served by the server with
  the other settings, read by the registry through the settings record the page already reads.
- **The key picker** is the decisions page's Jump palette made general: one dialog, one source per
  kind, a raw markdown preview. The core serves each decision's raw text, the one server addition
  the spec allows.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The spec says what keys do. These are the inputs it implies but no scenario names. Each has its test
in the task that owns the code.

1. **Printable keys match the character typed, whatever Shift does.** `+` is Shift and `=` on a US
   keyboard, and `J`, `K`, `G` are shifted letters: all match by `event.key`, never by `code`.
   Task 2.
2. **AltGr is not a modifier.** On Windows it reports `ctrlKey` and `altKey` together, and `[`, `]`
   on AZERTY need it: a key whose `event.key` is one printable character with AltGr
   (`getModifierState("AltGraph")`, or Ctrl and Alt together) still matches as that character, so
   today's fold keys keep working there. A real Ctrl or Alt shortcut does not match. Task 2.
3. **Composition and dead keys are never shortcuts.** `isComposing`, `Dead`, `Process`, and
   `Unidentified` are skipped, and a repeated key (`event.repeat`) never starts a sequence or
   re-opens the menu while Space is held. Tasks 2 and 4.
4. **Shift on a named key is part of the binding.** `Shift+↓` moves the selected item and a bare `↓`
   moves the selection: `useListKeys` returns on any `shiftKey` today, and that goes. On a page with
   nothing movable, `Shift+↓` does nothing and does not scroll. Task 6.
5. **Space is taken with `preventDefault` on keydown** from the page, a button, a link, and a row,
   so no click fires and WebKit does not scroll; it is left alone in text fields, contenteditable
   regions, and on a checkbox, radio, switch, select, or combobox, including their `role=` forms,
   like the New page's radio cards. Task 4.
6. **One layer rule replaces three copies, and their callers' tests pass unchanged**: the list keys
   with a sort menu open, the decisions `/` on an expanded disclosure like the rail's logo, and the
   rail's Escape under a dialog. Tasks 2, 5, 6, and 7.
7. **Off means off, and nothing more.** With the switch off, every binding whose first key is one
   printable character is dropped (letters, shifted letters, `+ - [ ] / ,`, Space, and every `g`
   sequence), and named keys, Shift with them, and Ctrl or Cmd+K stay. A menu open when it turns off
   closes; one opened with Ctrl or Cmd+K walks its tree with letters. Tasks 2, 4, and 11.
8. **The menu's delay is measured from the last key while it is hidden, and a shown menu stays.**
   Space, `n`, `n` within half a second never shows it; Space, wait, then `n` shows the New group at
   once; a pending `g` ends after 2 seconds. Tested with fake timers and a pure state machine, never
   a sleep. Task 4.
9. **A key that means two things on one page throws, in every build but production**, so any page's
   test catches it: two bindings of one key, a key that is both a leaf and the start of a sequence,
   two fallbacks. The scroll fallback under a list's own key is not one. Tasks 2 and 4.
10. **A page change while the menu is open closes it**, and a layer opening closes it too. Task 4.
11. **Scrolling goes where the human is**: with the focus in a scrollable region the region scrolls,
    and the page behind stays; with the focus nowhere, the page's main column scrolls. A page with
    rows and the focus on the page moves the selection, and nothing scrolls. Task 5.
12. **A binding's handler is always the latest closure**, though its hint and label only change what
    readers draw when their text changes: a key held across re-renders never runs a stale handler,
    and the status line does not re-render on every keystroke. Task 2.
13. **Raw text for previews is checked through the real server** before any picker relies on it: a
    feature's proposal, a change's proposal, a decision's file, a note's text, and a priority's
    line. Task 1.

## Global constraints

Every task's requirements include these. The rules are copied from their sources.

From the [Keyboard decision](../decisions/keyboard.md), active as of this branch's approval:

- A shortcut that acts on the page MUST be declared in the key registry, with its label, icon,
  group, and whether the status line shows it, and MUST NOT be listened for anywhere else. Checked
  by a structural test and review.
- Single-key shortcuts MUST be switchable off by a setting in the settings file, and a modifier
  chord MUST stay available to open the leader menu while they are off. Checked by the settings
  page's tests.
- A single-key shortcut MUST NOT be the only way to do something. Checked by review.
- Space MUST open the leader menu outside text fields and while no layer is open, and the menu MUST
  wait a short moment, so quick typing shows nothing. Checked by the UI tests.
- Keys MUST work at every width, and MUST NOT show their hints on narrow screens. Checked by the UI
  tests.
- Every page MUST share one base keymap, arrows or `h j k l` to move or scroll, `a`, `i`, and `o` to
  add and edit, and `gg` and `g` sequences to go, and its own keys MUST be few and mnemonic. Checked
  by review.
- A key MUST NOT mean two things on one page, though two pages may give it different meanings.
  Checked by the registry's tests.
- The status line SHOULD show the keys that work on the page, drawn from the registry. Checked by
  the UI tests.

From the spec, exact values every task uses: the menu shows **half a second** (500 ms) after the
last key while hidden; a `g` sequence waits up to **2 seconds** for its second key; the leader menu
is titled with the keys pressed, `Space`, `Space n`, `g`; its entries are in alphabetical order of
their keys, Space and the symbols first; Backspace goes up a level and Escape closes; with nothing
that needs the human, the menu says **"Nothing needs you"**; the setting is
`[keyboard] single_key_shortcuts`, `true` when unset, shown as the switch **"Single-key shortcuts"**
in a **Keyboard** section of the settings page; the keymap tables of the
[second](spec.md#us2-go-anywhere-and-move-the-same-way-everywhere-p1) and
[third](spec.md#us3-a-few-keys-of-each-pages-own-p2) stories, and the leader's top level in the
[first](spec.md#us1-open-the-leader-menu-with-space-p1), are the exact keys. A key a page has no use
for is unbound there and not hinted. On a page with no selectable rows the vertical keys scroll, and
the scrolling is not hinted (the review's C1, which the approved spec carries).

From [UI behaviour](../decisions/ui-behaviour.md): every action works by tap and by keyboard, never
by hover alone, and lists whose rows open a pane share one keyboard behaviour. From
[UI checks](../decisions/ui-checks.md): UI tests drive the UI as a user does and never assert
markup, class names, or pixels; a UI change is handed over with screenshots of every changed view at
both sizes and in both themes, committed. From [UI layout](../decisions/ui-layout.md): on narrow
screens menus and forms are sheets. From [UI coherence](../decisions/ui-coherence.md): one shared
component draws a key. From [UI components](../decisions/ui-components.md): Astryx components
wherever one fits, and a raw element needs a reason and an entry in
[Complexity tracking](#complexity-tracking). From [Preview](../decisions/preview.md): a mockup of a
view is a story of the real components, and stories do not run as tests.

From [Settings](../decisions/settings.md): finding, reading, validating, and writing the settings
lives in the Rust core; a write keeps a human's comments, unknown keys, and order, and never
overwrites an unreadable or invalid file; a setting changed in the web UI applies at once.

From [Code quality](../decisions/code-quality.md): functions are at most 100 lines, files 500,
nesting 4, parameters 7, and **no new limit marker may be added**: a task that grows a unit past a
limit splits it first. Unit tests never depend on elapsed time. From the
[constitution](../CONSTITUTION.md#vi-code-is-checked-and-stays-maintainable): a test is never
loosened, skipped, or deleted to make a run pass, except with a ruling, and warnings, size,
complexity, and duplication do not go up.

From [Toolchain](../decisions/toolchain.md): after every task, `nix develop -c vp run fast`; before
the push, `nix develop -c vp run ready`. A single test file runs with
`nix develop -c vp test run <path>`.

Existing guarantees to keep, with their evidence (SC-004: nothing lost): the list keys
([`__browser__/list-keys.test.tsx`](/packages/web/src/__browser__/list-keys.test.tsx),
[`__tests__/status-hints.test.tsx`](/packages/web/src/__tests__/status-hints.test.tsx)); the
decisions palette ([`__tests__/palette.test.tsx`](/packages/web/src/__tests__/palette.test.tsx));
the rail's Escape ([`__tests__/rail.test.tsx`](/packages/web/src/__tests__/rail.test.tsx)); the
questions' `n p`
([`__tests__/round-outline.test.tsx`](/packages/web/src/__tests__/round-outline.test.tsx)); the
status line ([`__tests__/status-line.test.tsx`](/packages/web/src/__tests__/status-line.test.tsx),
[`__browser__/status-line.test.tsx`](/packages/web/src/__browser__/status-line.test.tsx)); the New
page's cards ([`__browser__/new-cards.test.tsx`](/packages/web/src/__browser__/new-cards.test.tsx)).
They pass unchanged, except the two the spec changes, which take a ruling: `status-hints.test.tsx`
(the hint API is replaced) and the palette's preview assertions (rendered becomes raw).

## Code read

- [`lists/useListKeys.ts`](/packages/web/src/lists/useListKeys.ts) (190 lines): the list keys on a
  `document` listener, acting only when the focus is on a row (`[data-row] a[href]`) or the page;
  `isLayerOpen()` is the first copy of the layer rule, document state: an expanded
  `[aria-haspopup]`, a shown dialog, an open popover that is not manual. Its hints come from
  `useStatusHints`. It returns on any `shiftKey`.
- [`statusHints.tsx`](/packages/web/src/statusHints.tsx): the hints' registry, with `place` page or
  shell, and `useCoverStatusLine`, a sheet that covers the line; the cover has nothing to do with
  keys and stays.
- [`shell/StatusLine.tsx`](/packages/web/src/shell/StatusLine.tsx): draws `useDeclaredHints()` on
  wide screens only.
- [`shell/Rail.tsx`](/packages/web/src/shell/Rail.tsx) `isOverlayOpen`, `useEscape`: the second copy
  of the layer rule, and the rail's own Escape: fold the open rail, unless a dialog or popover took
  it.
- [`decisions/DecisionsPage.tsx`](/packages/web/src/decisions/DecisionsPage.tsx) `inLayer`,
  `useJump`: the third copy, from the target's ancestors; `/` opens
  [`JumpPalette`](/packages/web/src/decisions/JumpPalette.tsx), which previews rendered rules. Its
  `jump.ts` ranks entries. `useListKeys` is also called here.
- [`shell/Column.tsx`](/packages/web/src/shell/Column.tsx) `[` and
  [`layout/SideColumn.tsx`](/packages/web/src/layout/SideColumn.tsx) `]`, both `useHotkeys` disabled
  when not wide; `RoundOutline.tsx` `useBlankKeys` `n p` with its hint; `KindCards.tsx` the New
  page's radio keys; `lists/CategoryPane.tsx` Y, N, and C of its dialog; `Composer.tsx` Ctrl or
  Cmd+Enter; `StoryPick.tsx` and `embedLayout.ts` Escape for their own overlays;
  `sandbox/mountSandboxBar.tsx`.
- [`keys/LeaderMenu.tsx`](/packages/web/src/keys/LeaderMenu.tsx) and its
  [stories](/packages/web/src/keys/LeaderMenu.stories.tsx), `KeyCap.tsx`: the picked design, already
  a story. Its title is hard-coded to start with "Space", and it takes `entries` and `path`.
- [`destinations.ts`](/packages/web/src/destinations.ts), read by `shell/ColumnPanes.tsx` and
  `shell/Tabs.tsx`: the places, once.
- [`lists/WorkList.tsx`](/packages/web/src/lists/WorkList.tsx) (`onMove`, `useDragOrder`),
  [`lists/cardMoves.ts`](/packages/web/src/lists/cardMoves.ts) (`moveIndex`, `movesOf`),
  [`lists/CardMenu.tsx`](/packages/web/src/lists/CardMenu.tsx),
  [`SidebarAdd.tsx`](/packages/web/src/SidebarAdd.tsx) (`useOpenAddForm("note" | "priority")`),
  `PrioritiesPage.tsx`, `InboxPage.tsx`: where the priorities' and the inbox's keys and moves live.
- The settings path to mirror, found by following `build_in_fresh_session`:
  [`crates/core/src/settings.rs`](/crates/core/src/settings.rs) and `settings/file.rs`
  (`parse_runs`), [`crates/binding/src/settings.rs`](/crates/binding/src/settings.rs),
  `packages/binding/index.d.ts` (generated by `vp run --filter uraeda-binding build`),
  [`packages/server/src/settings.ts`](/packages/server/src/settings.ts) (`RunSettingsView`,
  `inForce`), `fate/settings.ts`, `fate/settings-mutations.ts`,
  `packages/web/.fate/client.generated.ts` (generated by the fate Vite plugin when the web tests or
  build run, committed), the web's `views.ts` `SettingsRecordView`, and `settings/`
  (`categories.ts`, `RunSettings.tsx`, `SettingsPage.tsx`, `SettingsView.tsx`). Their tests:
  `crates/core/tests/settings*.rs`, `packages/binding/contracts.test.ts`,
  `packages/server/src/__tests__/settings*.test.ts`, `packages/web/src/__tests__/settings.test.tsx`.
- Raw text: `Feature.text(name)` and `api::read_file` give a feature's or a change's file as
  `FileView.current.text`; the ledger's `Decision` in
  [`crates/core/src/api/ledger.rs`](/crates/core/src/api/ledger.rs) holds a parsed `document` and no
  raw text, though `Texts` read it; notes and priorities carry their text.
- Tests: Vitest through `vp`, happy-dom,
  [`__tests__/helpers.tsx`](/packages/web/src/__tests__/helpers.tsx) (`renderPage`, `fixtureRepo`,
  `atWidth`, a real server in process), real-browser tests in `__browser__/` (`atSize`, `show`,
  `userEvent` from `vite-plus/test/browser`). Lint limits are in `vite.config.ts`; `__lint__/` and
  `lint.test.ts` hold the lint's fixtures. The files near a limit: `App.tsx` (423 of 500 lines) and
  `JumpPalette.tsx` (341).

## Constitution check

| I. Humans stay in control | II. Git and plain text first | III. Asynchronous by default | IV. Review effort matches impact | V. Tools are optional | VI. Code is checked and stays maintainable |
| ------------------------- | ---------------------------- | ---------------------------- | -------------------------------- | --------------------- | ------------------------------------------ |
| ✅                        | ✅                           | ✅                           | ✅                               | ✅                    | ✅                                         |

## Complexity tracking

No constitution exception and no new limit marker.

| Abstraction                                                                                                                                                   | Why it is needed                                                                                                                                                               | Simpler alternative rejected because                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| The key registry, `keys/registry.tsx`, with `match.ts` (the typed key as a token), `layers.ts` (the one layer rule), and `sequence.ts` (a pure state machine) | The Keyboard decision requires one registry; it replaces three copies of the layer rule and the hint registry. The state machine is pure so its delays are tested without time | Several hooks per page, as today: the leader menu, hints, and a later key search have no single source                |
| `useKeys(bindings, place)` and `Binding`                                                                                                                      | Every page, list, and shell part declares keys the same way                                                                                                                    | `useHotkeys` per key: no sequences, scopes, or hints                                                                  |
| `keys/scroll.ts`, the scroll fallback                                                                                                                         | Pages without rows scroll on the vertical keys, as the approved C1 asks; it is a registry default so no page copies it                                                         | Each page binding `j k`: a copy per page                                                                              |
| `keys/KeyPicker.tsx` with a source per kind, replacing `JumpPalette`'s decision-specific parts                                                                | One picker for find-anything, the per-kind finds, Continue, and the decisions `/` (the spec's US4)                                                                             | A picker per kind: five copies of the dialog, the sheet, and the cursor                                               |
| `Decision.text` in the core, `KeyboardSettings` in the core, binding, server, and web                                                                         | The preview shows a decision's raw file; the setting needs the settings path                                                                                                   | Reading decision files in the web or the server: a second reader of the files, against the settings and ledger owners |
| A raw `<kbd>` stays in `KeyCap`                                                                                                                               | Already in the repository: an Astryx gap, `Kbd` writes capitals                                                                                                                | None: not new                                                                                                         |
| `keys-structural.test.ts` with a named allowlist                                                                                                              | The decision's rule is checked by "a structural test and review"; the allowlist says which keys stay with their field or dialog                                                | Review alone: the three old copies grew unseen                                                                        |

Allowlist of what keeps its own key listener, because the key belongs to the field or the layer that
is open and not to the page: a text field's own keys (`Composer` Ctrl or Cmd+Enter and Escape to
leave, `fields/TextField.tsx`, `AddNote`, `QuickAdd`, `EditableLine`, `SlugField`, `AddRepository`,
`sidebar/Search`, `RepositoryMenu`'s filter), a dialog's own keys while it is open
(`lists/CategoryPane` Y, N, C), the radio group's own keys (`KindCards`), `StoryPick` and
`embedLayout`'s Escape for their own overlays, and the sandbox's bar. The task that writes the test
settles each file's entry and its reason, and any other hit is migrated.

## Test map

The tests run in Vitest with happy-dom on the real server in process, over the fixture repository
(`renderPage`, `fixtureRepo`), pressing keys with `fireEvent.keyDown` on the focused element or
`document.body`, as a user's key reaches the page. Timers are Vitest's fake timers, and the sequence
rules are tested on `sequence.ts` with no timer at all. A real browser (`__browser__/`) checks Space
on focused controls, scrolling, the sheet at phone width, and the settings page's switch, as the
Space experiment in the [discovery](discovery-01.md#space-on-a-focused-control-checked) did. Rust
and the binding are checked at their own boundary.

| Spec                                                                         | Task       | Test                                                                                                                                                                               |
| ---------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outside-behaviour check: raw text of each kind                               | 1          | `crates/core/tests/ledger.rs` decision `text`; `packages/server/src/__tests__/preview-text.test.ts`, each kind's raw text through the server                                       |
| SC-006 (off means off), US5 1, 3, review focus 7                             | 2, 4, 11   | `__tests__/keys-registry.test.tsx` drops single-character first keys, keeps named keys and `mod+k`; `keys-leader.test.tsx` menu closes when turned off; `settings.test.tsx` switch |
| SC-003 (no clash), review focus 9                                            | 2, 4       | `keys-registry.test.tsx` duplicate, leaf-and-prefix, two fallbacks throw; fallback under a list key does not                                                                       |
| Review focus 1, 2, 3 (matching, AltGr, IME)                                  | 2          | `keys-match.test.ts`                                                                                                                                                               |
| Review focus 12 (latest handler)                                             | 2          | `keys-registry.test.tsx`                                                                                                                                                           |
| One layer rule, review focus 6                                               | 2, 5, 6, 7 | `keys-registry.test.tsx`; `palette.test.tsx`, `rail.test.tsx`, `status-hints` and list-keys tests pass unchanged                                                                   |
| US6 1, 2, 3 (hints from the registry, leave under a dialog, none on a phone) | 2, 6, 9    | `status-line.test.tsx`; `keys-hints.test.tsx`                                                                                                                                      |
| US1 key 1, 2, 3, SC-002 (no flash), review focus 8                           | 4          | `keys-sequence.test.ts` pure; `keys-leader.test.tsx` with fake timers                                                                                                              |
| US1 key 4, more 3, 4, 5, review focus 5 (Space on controls)                  | 4          | `keys-leader.test.tsx` text field and composer; `__browser__/leader-space.test.tsx` button, link, row, checkbox, radio card                                                        |
| US1 more 2 (unbound key keeps the menu), edge: page change, layer opens      | 4          | `keys-leader.test.tsx`                                                                                                                                                             |
| US1 more 6 (phone sheet)                                                     | 4          | `__browser__/leader-space.test.tsx` at phone size                                                                                                                                  |
| US2 4, SC-004                                                                | 6          | the existing list-keys tests, unchanged                                                                                                                                            |
| US2 5, more 1, review focus 11                                               | 5          | `keys-scroll.test.tsx`; `__browser__/scroll-keys.test.tsx`                                                                                                                         |
| US2 2 (`gg`, `G`), 3 (the 2 s end), more 2 (`g x`)                           | 5, 10      | `keys-scroll.test.tsx` `G`; `keys-go.test.tsx` `gg`, the end, `g x`                                                                                                                |
| US2 1 (`g i`)                                                                | 10         | `keys-go.test.tsx`                                                                                                                                                                 |
| US3 4 (`K`, `L` move the item), review focus 4                               | 6, 8       | `keys-shift.test.tsx` priorities; inbox notes                                                                                                                                      |
| US3 1 (`o`), 3 (`m`)                                                         | 8          | `keys-priorities.test.tsx`, `keys-inbox.test.tsx`                                                                                                                                  |
| US3 2 (`i` in a session, Escape keeps the draft)                             | 9          | `keys-pages.test.tsx`                                                                                                                                                              |
| US3 5 (`s c f` on New)                                                       | 9          | `keys-pages.test.tsx`; `new-cards` unchanged                                                                                                                                       |
| US2 more 3 (`n` on the questions), US6 1                                     | 9          | `round-outline.test.tsx` unchanged, plus `keys-pages.test.tsx` hint `n p unanswered`                                                                                               |
| US4 1, 2, 3, more 1, 2, SC-005                                               | 7, 10      | `palette.test.tsx` (kept, raw preview ruling), `keys-picker.test.tsx` find group, `Space Space` all kinds, Escape returns focus; the ledger's three-letter test (SC-005)           |
| US4 4 (`/` on decisions)                                                     | 7          | `palette.test.tsx`                                                                                                                                                                 |
| US1 more 1 (Continue with 3, 1, 0 cards), edge: nothing needs you            | 10         | `keys-continue.test.tsx`                                                                                                                                                           |
| US1 top level and New group, SC-001 (three keys), SC-007 (one icon)          | 10         | `keys-leader-tree.test.tsx` every top-level page in at most three presses; entries carry `DESTINATIONS`' icon and label                                                            |
| US5 1, 2, more 1, edge: unreadable file                                      | 3, 11      | `crates/core/tests/settings.rs`; `settings-fate.test.ts`; `settings.test.tsx` the switch, the file value, the unreadable file keeps the shortcuts on                               |
| Decision's structural test                                                   | 12         | `__tests__/keys-structural.test.ts`                                                                                                                                                |
| The constitution, the ledger of rules                                        | all        | `vp run ready`                                                                                                                                                                     |

## Waves

1. **Wave 1: Task 1.** Raw text for previews, alone: it checks the one outside behaviour the spec
   marks unverified, and a failure stops the build before anything relies on it.
2. **Wave 2: Tasks 2, 3.** The registry (the web's `keys/`, `statusHints.tsx`, `StatusLine.tsx`,
   `Shell.tsx`) and the setting (the core, the binding, the server): no file in common.
3. **Wave 3: Tasks 4, 5, 6, 7.** The leader runtime and menu (`keys/`), the base keymap (`Column`,
   `SideColumn`, `Rail`, `keys/scroll.ts`), the list keys (`lists/`), and the picker (`decisions/`,
   `keys/KeyPicker.tsx`). They only consume Task 2's `useKeys`. Tasks 4 and 5 each add a mount line
   to `Shell.tsx`, the shared file.
4. **Wave 4: Tasks 8, 9, 10, 11.** The priorities' and inbox's keys (`lists/`, `SidebarAdd.tsx`),
   the other pages' keys (`Home`, `Composer`, `NewPage`, `RoundOutline`), the leader's tree
   (`keys/LeaderKeys.tsx`, `RepositoryMenu.tsx`), and the setting's section (`settings/`, `keys/`
   provider wiring). Task 8 alone changes `SidebarAdd.tsx`; Task 10 calls what exists there. Tasks
   10 and 11 each change a different part of `Shell.tsx`.
5. **Wave 5: Tasks 12, 13.** The retired hint API and the structural test, then the screenshots,
   which need the final UI.

---

## Task 1: Raw text for the picker's previews

**Files:**

- Modify: `crates/core/src/api/ledger.rs` (`Decision` gains `text`), `crates/core/src/view.rs` if
  the type is declared there
- No change needed in `packages/server/src/fate/views-ledger.ts` or `packages/web/src/views.ts`: the
  ledger record spreads each decision and the web's ledger view selects `decisions: true`, so
  `decisions[].text` is served and selected once the core has the field
- Test: `crates/core/tests/ledger.rs`, `packages/server/src/__tests__/preview-text.test.ts`
- Generated and committed: `packages/binding/index.d.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `Decision.text: string`, the decision file's raw text as read (the default branch's
  version, as the rest of the ledger); a server test showing the raw text of every kind of preview.
  The other kinds need no addition: `FileView.current.text` for `proposal.md` of a feature or change
  through `useFile(folder, "proposal.md")`, a note's `text`, and a priority's lines. Task 7 uses
  them by these names.

- [x] **Step 1: Write the failing tests**

```rust
// crates/core/tests/ledger.rs
#[test]
fn a_decision_carries_its_file_as_written() { /* a decisions/ui.md with frontmatter, H1, and rules */ }
```

Expect `decision.text` equal to the file's bytes as text, frontmatter included. The break it
catches: a text parsed back from the document, losing the frontmatter the preview must show.

```ts
// packages/server/src/__tests__/preview-text.test.ts: on a fixture repository with a feature, a
// change, a decision, a note, and a priority with a child
test("each kind a preview shows has its raw text through the server", async () => {
  /* the feature's proposal via the file source, the change's proposal, the ledger's decision
     text, the inbox's note text, the priorities' line with its children */
});
```

The break it catches: a kind whose raw text the picker would need and the server does not send,
which Task 7 would find late.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test ledger a_decision_carries`, then
  `nix develop -c vp test run packages/server/src/__tests__/preview-text.test.ts`
- Expected: FAIL, `no field text on type Decision`, then
  `Cannot read properties of undefined (reading 'text')` on the decision.

- [x] **Step 3: Add `text` to `Decision`** in the core from the `Texts` already read, in the one
      place the ledger builds a decision; build the binding with
      `nix develop -c vp run --filter uraeda-binding build` so `index.d.ts` follows (never edited by
      hand); serve it in the ledger's fate view and select it in the web's view.
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`. Expected: PASS. If a kind
      of the test cannot be served without a larger change than a field, stop: this is the spec's
      unverified item, and the stories that rely on it go back to the human.
- [x] **Step 5: Commit**

```bash
git add crates packages specs/2026-10-26-leader-key/plan.md
git commit -m "feat(leader-key): serve a decision's raw text for previews"
```

---

## Task 2: The key registry, the one layer rule, and the status line's hints

**Risky:** a rule several callers share (the layer rule and the key matching), and every later task
builds on it.

**Files:**

- Create: `packages/web/src/keys/registry.tsx` (`KeysProvider`, `useKeys`, `useHints`, the window
  listener), `keys/store.ts` (the declared bindings, the conflicts, the single-key switch, the
  hints), `keys/match.ts` (`tokenOf(event)`, `isSingleKey`), `keys/layers.ts` (`isLayerOpen`,
  `useLayerOpen`), `keys/groups.ts` (the group labels and icons)
- Modify: `packages/web/src/shell/StatusLine.tsx` (`Hints` reads `useHints()` first, then the old
  declarations until Task 12), `packages/web/src/Shell.tsx` (mounts `KeysProvider`)
- Modify: `packages/web/src/lists/useListKeys.ts` (`isLayerOpen` becomes a re-export of
  `keys/layers.ts` until Task 6, which owns that file)
- Test: `packages/web/src/__tests__/keys-match.test.ts`, `keys-registry.test.tsx`,
  `keys-hints.test.tsx`

**Interfaces:**

- Consumes: `statusHints.tsx`'s `StatusHint` type and cover hooks, unchanged.
- Produces (exact):

```ts
// keys/registry.tsx
export type Binding = {
  /** One token, or tokens separated by spaces for a sequence: "j", "J", "ArrowDown", "Home",
   *  "shift+ArrowDown", "mod+k", "g h", "space n n". Space is "space"; a printable key is the
   *  character typed. */
  keys: string;
  label: string;
  icon?: IconName;
  /** The status line's text for the key or keys, "j k": absent means no hint. */
  hint?: string;
  /** Still named while a layer is open, for the keys a layer's owner declares. */
  hintInLayer?: boolean;
  /** Returning `false` says nothing was done, and the key goes on to a fallback. */
  run: (event: KeyboardEvent) => void | false;
  /** An extra guard on the event's target; absent means any target outside a text field. */
  when?: (target: EventTarget | null) => boolean;
  /** Runs only when no other binding of the key ran. At most one fallback per key. */
  fallback?: boolean;
};
export function useKeys(bindings: ReadonlyArray<Binding>, place?: "page" | "shell"): void;
export function KeysProvider(props: { children: ReactNode; singleKeys?: boolean }): ReactNode;
export function useHints(): ReadonlyArray<StatusHint>;

// keys/match.ts
export function tokenOf(event: KeyboardEvent): string | null; // null: composition, dead, a lone modifier

// keys/layers.ts
export function isLayerOpen(target?: EventTarget | null): boolean;
export function useLayerOpen(): boolean;
```

A component declares while mounted; a binding's handler is the latest closure at every render, and a
reader (hints, menu) re-renders only when the binding's data, not its handler, changes. A hint's
place is page first, then shell, as `statusHints.tsx` orders them. `singleKeys` defaults to `true`
here: Task 11 wires the setting. Outside the provider, as in a story, `useKeys` declares nothing.

- [x] **Step 1: Write the failing tests, and the helpers they use**

`keys-match.test.ts` (pure, on `tokenOf` with constructed `KeyboardEvent`s):

- `+` typed with Shift is the token `+`, and `J` is `J`: the break caught is matching `code` or
  lowercasing, which loses `J K G +`.
- `[` typed with `ctrlKey` and `altKey` true and `AltGraph` modifier state is `[`; a Ctrl+`[` with
  no AltGraph is not a printable token: the break is skipping every Ctrl+Alt, which kills AZERTY.
- `isComposing`, `Dead`, `Process`, `Unidentified` give `null`.
- Space is `space`; `ArrowDown` with Shift is `shift+ArrowDown`; Ctrl or Cmd+K is `mod+k`.

`keys-registry.test.tsx` (a `Harness` component with `useKeys`, in a `KeysProvider`):

- A binding `j` runs on a keydown on the body; not in an `<input>`, a `<textarea>`, a
  contenteditable region, or while `isComposing`.
- While a dialog, an open menu, an expanded `[aria-haspopup]`, or an open popover is up, no binding
  runs; an expanded disclosure without `aria-haspopup` does not count (the rail's logo). The break
  caught: a layer rule that differs by caller.
- Two components binding `j` throw in a non-production build; a `j` and a fallback `j` do not; two
  fallbacks throw; unmounting one lifts the conflict.
- A handler that returns `false` lets the fallback run; a handler that returns nothing stops it.
- A re-render with a new closure runs the new closure, and a hint's reader does not re-render when
  only the closure changed.
- With `singleKeys={false}`: `j`, `J`, `+`, `[`, `/`, `,`, and `space` do nothing; `ArrowDown`,
  `shift+ArrowDown`, `Home`, `Enter`, `Escape`, and `mod+k` still run.

`keys-hints.test.tsx`: a binding with `hint: "j k"` is named, one without is not; a dialog opening
removes the hints, except one with `hintInLayer`; on a phone width none shows (the existing
`StatusLine` rule).

- [x] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp test run packages/web/src/__tests__/keys-match.test.ts packages/web/src/__tests__/keys-registry.test.tsx packages/web/src/__tests__/keys-hints.test.tsx`
- Expected: FAIL, `Failed to resolve import "../keys/match.ts"`.

- [x] **Step 3: Implement** `match.ts`, `layers.ts`, and `registry.tsx` to the contracts above.
      `layers.ts` is the one layer rule: the union of the three old ones, a shown dialog or
      `[role=dialog|alertdialog]`, an expanded `[aria-haspopup]` or `combobox`, an open popover that
      is not `manual`, or a target inside a `[role=listbox|menu]`; `useLayerOpen` observes the
      document so hints leave and return. The window listener ignores keys from a text field
      (`input`, `textarea`, `select`, contenteditable), tries the matching bindings of a key in the
      order they were declared, stops at the first that does not return `false`, calls
      `preventDefault` when one ran, and skips the off keys as review focus 7 says. Group labels and
      icons for the prefixes `space n`, `space f`, and `space u` are in `groups.ts`. Mount
      `KeysProvider` in `Shell.tsx` around the page, and make `Hints` in `StatusLine.tsx` draw
      `useHints()` before the old declarations. Keep each file under the limits: split
      `registry.tsx` if it nears them: the bindings' store, with the conflict check, the switch, and
      the hints, is `keys/store.ts`, and the listener and the hooks stay in `registry.tsx`. A
      repeated key keeps its token (R3).
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`. Expected: PASS, with the
      existing key tests unchanged.
- [x] **Step 5: Commit**

```bash
git add packages/web/src/keys packages/web/src/shell/StatusLine.tsx packages/web/src/Shell.tsx packages/web/src/lists/useListKeys.ts packages/web/src/__tests__ specs/2026-10-26-leader-key/plan.md
git commit -m "feat(leader-key): the key registry and its one layer rule"
```

The commit body reports the break made and seen failing: the layer rule's AltGr and conflict checks
removed, each test red, restored.

---

## Task 3: The `[keyboard]` setting, from the core to the page's record

**Risky:** the format of stored data: the settings file gains a table, and a write must keep a
human's comments and order.

**Files:**

- Modify: `crates/core/src/settings.rs` (`Settings.keyboard`, `KeyboardSettings`,
  `set_single_key_shortcuts`), `crates/core/src/settings/file.rs` (`parse_keyboard`)
- Modify: `crates/binding/src/settings.rs` (`set_single_key_shortcuts`)
- Modify: `packages/server/src/settings.ts` (`KeyboardSettingsView`, `inForce`), `fate/settings.ts`,
  `fate/settings-mutations.ts` (`settings.setSingleKeyShortcuts`)
- Modify: `packages/web/src/views.ts` (`SettingsRecordView` selects `keyboard`)
- Generated and committed: `packages/binding/index.d.ts`, `packages/web/.fate/client.generated.ts`
- Test: `crates/core/tests/settings.rs`, `packages/binding/contracts.test.ts`,
  `packages/server/src/__tests__/settings.test.ts`, `settings-fate.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `Settings.keyboard.single_key_shortcuts: Option<bool>` and
  `settings::set_single_key_shortcuts(dir, on) -> Result<Settings, ApiError>` in the core; in the
  binding `setSingleKeyShortcuts(dir: string, on: boolean): Promise<Settings>`; in the server
  `SettingsView.keyboard.singleKeyShortcuts: Setting<boolean>` (default `true`, no flag or variable,
  so its source is `file` or `default`) and the fate mutation `settings.setSingleKeyShortcuts` with
  input `{ on: boolean }`; in the web's record, `settings.keyboard.singleKeyShortcuts.inForce`. The
  problem message of a non-boolean value is `Single-key shortcuts is true or false.`, as the other
  settings word theirs.

- [ ] **Step 1: Write the failing tests**, mirroring the `[runs]` tests found by following
      `build_in_fresh_session`:
  - core: a file with `[keyboard]\nsingle_key_shortcuts = false\n` reads `Some(false)`; none reads
    `None`; `single_key_shortcuts = 1` is unreadable with
    `line 2, single_key_shortcuts: Single-key shortcuts is true or false.`; a write into
    `# mine\n[server]\nport = 4400\n` appends `[keyboard]\nsingle_key_shortcuts = false` and keeps
    the comment and the order; a second write keeps a trailing comment on the value; a write is
    refused while the file cannot be read. The break caught: a writer that rewrites the file whole
    and drops a hand edit.
  - binding contract: `single_key_shortcuts = false` reads as
    `keyboard: { singleKeyShortcuts: false }`.
  - server: `inForce` gives `true` and source `default` with no file, with the file's value its
    source `file`, and a file the core cannot read leaves it `true` (shortcuts stay on); the fate
    mutation writes the file and returns the record.
- [ ] **Step 2: Run them to check they fail**:
      `nix develop -c cargo nextest run -p uraeda-core --test settings`, expected FAIL
      `no field keyboard on type Settings`; then the binding and server tests, expected
      `settings.setSingleKeyShortcuts is not a function`.
- [ ] **Step 3: Implement it** in the core with the table of `runs`' pattern
      (`change_table(dir, "keyboard", …)`), the binding wrapper, the server's view and mutation, and
      the web's record selection; rebuild the binding
      (`nix develop -c vp run --filter uraeda-binding build`) and run the web tests once so the fate
      plugin regenerates its client, and commit both generated files.
- [ ] **Step 4: Run the task's validation**: `nix develop -c vp run fast`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add crates packages specs/2026-10-26-leader-key/plan.md
git commit -m "feat(leader-key): the keyboard setting in the core and the server"
```

The commit body reports the break made and seen failing: the writer made to rewrite the file whole,
the comment-keeping test red, restored.

---

## Task 4: Sequences, the leader menu, Space and Ctrl or Cmd+K

**Risky:** concurrency of timers and a rule every key goes through (a pending sequence takes the
next key).

**Files:**

- Create: `packages/web/src/keys/sequence.ts` (the pure state machine), `keys/LeaderMenuHost.tsx`
- Modify: `packages/web/src/keys/registry.tsx` (the listener hands keys to `sequence.ts`; the delay
  and the wait are timers here), `keys/LeaderMenu.tsx` (title from the path),
  `keys/LeaderMenu.stories.tsx`, `packages/web/src/Shell.tsx` (mounts the host)
- Test: `packages/web/src/__tests__/keys-sequence.test.ts`, `keys-leader.test.tsx`,
  `packages/web/src/__browser__/leader-space.test.tsx`

**Interfaces:**

- Consumes: Task 2's `Binding`, `useKeys`, `tokenOf`, `isLayerOpen`, and `groups.ts`. Start from the
  story `Leader menu, top level` in `keys/LeaderMenu.stories.tsx`: the host draws `LeaderMenu`.
- Produces: `LeaderMenu({ entries, path })` where `path` now **includes the first key**, titled
  `path.join(" ")` with Space written `Space` (so `Space n`, and `g` for a `g` sequence); the
  story's `path` props gain the leading `"Space"`. `sequence.ts`:

```ts
export type Step = { path: ReadonlyArray<string>; isShown: boolean };
export function next(
  bindings: ReadonlyArray<{ keys: string }>,
  step: Step | null,
  token: string,
): { step: Step | null; ran: string | null; consumed: boolean };
```

`ran` is the binding's `keys` when the token completed a sequence or a single key. `consumed` says
the key belongs to the pending sequence even when unbound, as an unbound key in an open menu does.
`registry.tsx` rules, exact: Space and `mod+k` start the leader (from anywhere outside a text field
and a layer; `mod+k` also on a field-less page with the switch off); any key that starts a declared
sequence, as `g`, starts that sequence; the menu shows 500 ms after the **last** key while hidden
and stays shown, updating at once, once shown; `Backspace` goes up a level and ends at the top,
`Escape` closes; an unbound key in a shown menu is consumed and leaves it open; a pending `g` ends 2
seconds after its key and a wrong second key ends it, doing nothing; a repeated keydown
(`event.repeat`) never starts a sequence; a page change, a layer opening, or the switch turned off
ends it. A binding that is both a leaf and the start of a sequence on one page throws, as Task 2's
conflicts do. **Space on a focused control**: Space starts the leader from the page, a button, a
link, and a row, with `preventDefault` on keydown, so the control is not pressed and Enter still
presses it; a text field, a contenteditable region, a checkbox, a radio, a switch, a select, and a
combobox (also their `role=` forms) keep Space.

- [ ] **Step 1: Write the failing tests**

`keys-sequence.test.ts` (no timers): from no step, Space gives `Space` pending; `n` then gives the
group; `n` again runs `space n n`; an unbound key in a shown menu is consumed and keeps the step;
Backspace pops one level and at the top ends; Escape ends; `g` then `x` ends the sequence with
nothing run; `g` then `g` runs `g g`. The break caught: a state machine that runs the unbound key or
ends the menu on it.

`keys-leader.test.tsx` (fake timers, a page declaring `space n n`, `space n s`, `g i` through
`useKeys`):

- US1 key 1: Space, `n`, `n` pressed with no time between runs `space n n`, and the menu never
  rendered (`queryByText("Space")` null even after the timers run).
- US1 key 2: Space, then 499 ms: no menu; 500 ms: the menu titled `Space` with the entries.
- Space, `n`, then 500 ms shows `Space n`; Backspace shows `Space`; Escape closes and nothing ran.
- Space, wait 600 ms, `n` shows the New group at once (the shown menu does not wait again).
- The delay restarts at each key while hidden: Space, 300 ms, `n`, 300 ms shows nothing; 200 ms more
  shows `Space n`.
- US1 key 4 and more 3: Space types a space in a composer and in an `<input>`, and opens nothing
  while a dialog is open.
- Pending `g` with 2 s: the menu titled `g` shows at 500 ms and goes at 2 s; `g` then `i` runs
  `g i`.
- A key bound to nothing keeps the menu open and runs nothing (US1 more 2).
- A held Space (`repeat: true`) does not open the menu, and a navigation while shown closes it.
- With `singleKeys={false}` Space and `g` do nothing, Ctrl+K opens the menu, and its letters work
  while open; turning the switch off with the menu open closes it.

`__browser__/leader-space.test.tsx` (real browser, desktop and phone): Space on a focused button
opens the menu and the button's click handler is not called, Enter still calls it; Space on a link
and on a row do not follow them; Space ticks a checkbox and picks a radio card, opening no menu; at
phone width the menu spans the window's width above the page in one column (US1 more 6).

- [ ] **Step 2: Run them to check they fail**:
      `nix develop -c vp test run packages/web/src/__tests__/keys-sequence.test.ts packages/web/src/__tests__/keys-leader.test.tsx`;
      expected FAIL `Failed to resolve import "../keys/sequence.ts"`.
- [ ] **Step 3: Implement** `sequence.ts`, the timers and Space rules in `registry.tsx`, the host
      (`LeaderMenuHost`, which reads the registry's step and draws `LeaderMenu`, closing on a route
      change), the title change, and the story updates; mount the host in `Shell.tsx`.
- [ ] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, then
      `nix develop -c vp run browser:desktop` for `leader-space.test.tsx`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add packages/web/src specs/2026-10-26-leader-key/plan.md
git commit -m "feat(leader-key): sequences and the leader menu"
```

The commit body reports the breaks made and seen failing: the `repeat` guard removed (the held Space
test red) and the delay measured from the first key (the restart test red), each restored.

---

## Task 5: The base keymap: the scroll fallback, the folds, and the rail's Escape

**Files:**

- Create: `packages/web/src/keys/scroll.ts` (`useScrollKeys()`, the fallback bindings of `j k`,
  `↓ ↑`, `+ -`, `Home End`, `G`)
- Modify: `packages/web/src/shell/Column.tsx` (`[`), `packages/web/src/layout/SideColumn.tsx` (`]`),
  `packages/web/src/shell/Rail.tsx` (`useEscape`, `isOverlayOpen`), `Shell.tsx` (mounts
  `useScrollKeys` through a component)
- Test: `packages/web/src/__tests__/keys-scroll.test.tsx`, `rail.test.tsx` (unchanged),
  `packages/web/src/__browser__/scroll-keys.test.tsx`

**Interfaces:**

- Consumes: Task 2's `useKeys`, `Binding` with `fallback`, `isLayerOpen`.
- Produces: the fallback bindings, the owners' declarations: `Column` declares `[` and `space u [`
  ("Fold navigation"), `SideColumn` declares `]` and `space u ]` ("Fold right column"), each with
  its hint (`[` "fold", as today), only while wide, as `useHotkeys` was disabled; the rail declares
  `Escape` as a fallback binding that folds an open rail, returning `false` when it is not open. The
  old `isOverlayOpen` and `useHotkeys` calls are gone from these three files. `G` scrolls to the
  page's bottom, and `Home`, `End` to the top and the bottom when no list handled them. Scrolling
  moves a few lines at a time (3 lines of the page's line height, one `scrollBy`), smooth scrolling
  off.

- [ ] **Step 1: Write the failing tests**

`keys-scroll.test.tsx`: on a page with no rows and a tall main column, `j`, `ArrowDown`, `+` call
`scrollBy` with a positive top; `k`, `ArrowUp`, `-` negative (US2 5); `G` scrolls to the bottom and
`Home` to the top; with the focus inside a scrollable region the region's `scrollBy` is called, the
page's is not (US2 more 1, review focus 11); a page whose list declared `j` handles it and nothing
scrolls (US2 4); nothing scrolls in a text field or under a dialog; `[` toggles the navigation fold
and `]` the right column's, and with the focus on a button the fold still works. The scrolling is
not hinted: the status line names `[ fold` and no `j k`. The break caught: a fallback that scrolls
as well as the list's move.

`__browser__/scroll-keys.test.tsx`: on the real spec page at desktop size, `j` scrolls it down and
`k` back, a nested scroller with the focus scrolls alone.

- [ ] **Step 2: Run them to check they fail**:
      `nix develop -c vp test run packages/web/src/__tests__/keys-scroll.test.tsx`; expected FAIL
      `Failed to resolve import "../keys/scroll.ts"`.
- [ ] **Step 3: Implement** `scroll.ts` and move the three owners onto `useKeys`. The scroll target
      is the nearest scrollable ancestor of the focused element, else the page's main scrolling
      element (read the layout to find which element scrolls: `layout/Page.tsx` and the shell). The
      Rail keeps its own pointer handling; only its keys move. If a unit crosses a limit, split it
      first, in a commit of its own.
- [ ] **Step 4: Run the task's validation**: `nix develop -c vp run fast`; the existing
      `rail.test.tsx` and the column tests pass unchanged. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add packages/web/src specs/2026-10-26-leader-key/plan.md
git commit -m "feat(leader-key): scroll keys and the folds on the registry"
```

---

## Task 6: The list keys on the registry, and moving the selected item

**Risky:** a rule several callers share: every list with a pane uses `useListKeys`.

**Files:**

- Modify: `packages/web/src/lists/useListKeys.ts` (declares through `useKeys`: no `document`
  listener, no `isLayerOpen` of its own, no `useStatusHints` call),
  `packages/web/src/lists/WorkList.tsx` (the item moves through `onMove`, the `isLayerOpen` import)
- Test: `packages/web/src/__tests__/status-hints.test.tsx` (replaced by `keys-hints.test.tsx`'s list
  rows, with a ruling), `keys-shift.test.tsx`; `__browser__/list-keys.test.tsx` unchanged

**Interfaces:**

- Consumes: Task 2's `useKeys`, `Binding`, `isLayerOpen`.
- Produces: `useListKeys`' signature is unchanged, plus an optional
  `onMoveItem?: (move: "up" | "down" | "left" | "right") => void`, called by `K`, `J`, `H`, `L` and
  `Shift` with the arrows, only when given. The list declares `j k ↓ ↑ + -` (one hint, `j k`
  "move"), `h l ← →` (hint `h l` "column", only with columns), `Home End`, `Enter` (hint `⏎`
  "open"), and `Escape` (hint its label, `hintInLayer` when it is the list's own overlay), all with
  `when` the focus is on a row of this list or the page. The registry's `isLayerOpen` replaces the
  first copy of the layer rule; `lists/useListKeys.ts` no longer exports it, and `WorkList` imports
  it from `keys/layers.ts`. `+` is the next row and `-` the previous.

- [ ] **Step 1: Write the failing tests**

`keys-shift.test.tsx` on the priorities page (US3 4, review focus 4): with Next's second line
selected, `K` moves it above the first and the file shows it (the same write a drag makes); `L`
moves it to Later; `J` down; `H` to Now; and `Shift+ArrowUp` is `K`. A bare `ArrowUp` still moves
the selection and not the item. On a list with no `onMoveItem`, the keys do nothing and do not
scroll. The break caught: `useListKeys`' old early return on `shiftKey`, which would swallow
`Shift+Arrow`, or a move that selects without writing.

The existing list tests (`list-keys.test.tsx`, `status-hints.test.tsx`'s list parts) pass unchanged
except where the hint API moved: those assertions are re-pointed to `useHints()`, with a ruling,
keeping each assertion's meaning. Add `+` and `-` to the list's keys test: `+` selects the next row,
`-` the previous, and the status line reads `j k move` without them.

- [ ] **Step 2: Run them to check they fail**:
      `nix develop -c vp test run packages/web/src/__tests__/keys-shift.test.tsx`; expected FAIL
      `Unable to find an element with the text` for the moved line (the key does nothing today).
- [ ] **Step 3: Implement** the move of `useListKeys` to `useKeys`, keeping `destination()` and its
      column logic as they are, then `WorkList`'s `onMoveItem`: `K` and `J` move one place within
      the section, `H` and `L` to the end of the previous and next section, all by the `onMove` the
      drag calls. Settle the target of `H` and `L` in a ruling.
- [ ] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, then the browser tests of
      the lists: `nix develop -c vp run browser:desktop`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add packages/web/src specs/2026-10-26-leader-key/plan.md specs/2026-10-26-leader-key/rulings.md
git commit -m "feat(leader-key): list keys on the registry and shifted moves"
```

The commit body reports the break made and seen failing: the list's `when` guard removed, so a key
in a text field moved the selection, the list-keys test red, restored.

---

## Task 7: The key picker, and the decisions' `/` on the registry

**Files:**

- Create: `packages/web/src/keys/KeyPicker.tsx`, `keys/pickerSources.ts` (one source per kind:
  features, changes, sessions, decisions, notes, priorities), `keys/KeyPicker.stories.tsx`
- Modify: `packages/web/src/decisions/JumpPalette.tsx` (becomes the decisions source and its use of
  the picker, or goes), `decisions/DecisionsPage.tsx` (`useJump` on `useKeys`, `inLayer` gone),
  `decisions/jump.ts`
- Test: `packages/web/src/__tests__/palette.test.tsx`, `keys-picker.test.tsx`

**Interfaces:**

- Consumes: Task 2's `useKeys` and `isLayerOpen`; Task 1's raw text (`Decision.text`,
  `FileView.current.text`, a note's `text`, a priority's lines). Start from
  [`JumpPalette.tsx`](/packages/web/src/decisions/JumpPalette.tsx): the dialog, the sheet on narrow
  screens, `CursorFooter`, and the search ranking are its parts, generalised, not rewritten.
- Produces (exact):

```ts
// keys/pickerSources.ts
export type PickerKind = "features" | "changes" | "sessions" | "decisions" | "notes" | "priorities";
export type PickerItem = {
  id: string;
  kind: PickerKind;
  title: string;
  icon: IconName;
  path: string;
  preview: string;
};
export function usePickerItems(kind: PickerKind | "all"): ReadonlyArray<PickerItem>; // suspends while it loads

// keys/KeyPicker.tsx
export function KeyPicker(props: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: ReadonlyArray<PickerItem>;
  /** What Enter does with an item: it opens its page, and the picker closes. */
  onPick: (item: PickerItem) => void;
}): ReactNode;
export function useKeyPicker(): { open: (kind: PickerKind | "all") => void };
```

`KeyPicker` is mounted once, in `Shell.tsx`, through a small host; `useKeyPicker` opens it from
anywhere. A feature's and a change's `preview` is its proposal's text, a decision's its file, a
note's its text, a priority's its line with its children, and a session's is three plain lines:
title, state, branch. The preview is raw markdown, shown as monospace text through the shared prose
component's code path or a `<pre>` with a reason and an Astryx gap entry if no component fits. On
narrow screens the picker is a sheet showing the list alone. Opening it adds a history entry, so
Back closes it; Escape closes it and returns the focus to where it was. The kind's rows show their
kind as a label in the all-kinds picker.

- [ ] **Step 1: Write the failing tests**

`keys-picker.test.tsx`: US4 1, 2: opening the decisions picker and typing "ui" lists the matching
decisions with the first selected and its file's raw text (frontmatter included) in the preview, and
Enter opens the decision and closes the picker; US4 more 1: Escape closes it and the focus returns
to the element that held it; US4 3: the `all` picker holds a row of each kind, each labelled by its
kind; a session's preview is its three lines; a phone width shows the list alone (more 2). The break
caught: a preview from the rendered document, which loses the raw text the spec asks for.

`palette.test.tsx` changes: its assertions of the preview's rendered rules become assertions of the
raw file text, each with a ruling in `rulings.md` (the spec: "the decisions picker loses its
rendered preview for now"). Every other assertion of the file, `/` on an expanded disclosure and in
a text field, "Jump to…", the three-letter test of SC-005, stays as it is.

- [ ] **Step 2: Run them to check they fail**:
      `nix develop -c vp test run packages/web/src/__tests__/keys-picker.test.tsx`; expected FAIL
      `Failed to resolve import "../keys/KeyPicker.tsx"`.
- [ ] **Step 3: Implement** the picker and the sources, move the decisions page's `/` to `useKeys`
      (`when` the focus is not in a layer), with its hint `/ jump`, delete `inLayer`, and keep "Jump
      to…" and its `aria-keyshortcuts="/"` button. Check Firefox's quick find on `/` outside text
      fields: the page's key wins (the spec's niche edge case), and record what was checked in a
      ruling.
- [ ] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, then
      `nix develop -c vp run browser:desktop` for the decisions palette checks. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add packages/web/src specs/2026-10-26-leader-key/plan.md specs/2026-10-26-leader-key/rulings.md
git commit -m "feat(leader-key): the key picker and the decisions' slash"
```

---

## Task 8: The priorities' and the inbox's own keys

**Files:**

- Modify: `packages/web/src/PrioritiesPage.tsx`, `InboxPage.tsx`, `lists/PrioritiesList.tsx`,
  `lists/WorkList.tsx`, `lists/Card.tsx`, `lists/CardMenu.tsx`, `SidebarAdd.tsx`, `AddNote.tsx`,
  `QuickAdd.tsx` (what the keys open)
- Test: `packages/web/src/__tests__/keys-priorities.test.tsx`, `keys-inbox.test.tsx`

**Interfaces:**

- Consumes: Task 2's `useKeys`; Task 6's `useListKeys` and `WorkList`'s `onMoveItem`.
- Produces: `useOpenAddForm(form)` takes an optional second argument,
  `{ section?: string; category?: string }`, which the form opens with; existing callers are
  unchanged. The priorities declare `a` (the add form), `o` (the form in the selected row's
  section), `i` (edits the selected line in place), `m` (opens the selected card's move menu); the
  inbox declares `a`, `o` (the selected note's category), `i`, `m` (move to another category), each
  with its hint and `when` the focus is on a row or the page. `J K H L` move notes where the inbox
  can move them, as on the priorities. `n` is not an add key.

- [ ] **Step 1: Write the failing tests**: US3 1: the inbox with a note in "Ideas" selected, `o`
      opens the add form with category "Ideas"; the priorities with a Next line selected, `o` opens
      the form in Next; `a` opens it in its default place (Next); `i` turns the line into its editor
      with the line's text; `m` opens the move menu of that line (US3 3), whose items are the card
      menu's; the same on a note; `K` and `L` on notes move them as a drag would (US3 4 for notes);
      none of these keys act in the add form's text field or under a dialog. The break caught: `o`
      opening the form without the place, which a test of the form's category shows.
- [ ] **Step 2: Run them to check they fail**:
      `nix develop -c vp test run packages/web/src/__tests__/keys-priorities.test.tsx`; expected
      FAIL `Unable to find role "dialog"` after pressing `o`.
- [ ] **Step 3: Implement** the keys with `useKeys` in the pages that own the actions, calling what
      the buttons and menus call (`useOpenAddForm`, the card actions, `EditableLine`), never a copy
      of them. Each needs to be reachable another way, as the decision says: the buttons exist
      today.
- [ ] **Step 4: Run the task's validation**: `nix develop -c vp run fast`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add packages/web/src specs/2026-10-26-leader-key/plan.md
git commit -m "feat(leader-key): the priorities' and the inbox's keys"
```

---

## Task 9: The other pages' keys

**Files:**

- Modify: `packages/web/src/Home.tsx` and the Sessions page (`a`), `SessionPage.tsx` or
  `Composer.tsx` (`i`, and Escape to leave the composer), `NewPage.tsx` and `KindCards.tsx`
  (`s c f`, `i`), `RoundOutline.tsx` (`useBlankKeys` on `useKeys`), the triage and decisions-check
  pages that use it
- Test: `packages/web/src/__tests__/keys-pages.test.tsx`; `round-outline.test.tsx`,
  `__browser__/new-cards.test.tsx` unchanged

**Interfaces:**

- Consumes: Task 2's `useKeys`.
- Produces: `a` on Home and on Sessions opens the New page (as the New button does); `i` in a
  session focuses the composer, and Escape in the composer leaves it for the page keeping its draft
  (the composer's own keydown stays, listed in the allowlist); on the New page `s`, `c`, `f` pick
  Session, Change, or Feature as a click would and `i` focuses the text box; the questions, the
  triage, and the decisions check keep `n` and `p` ("unanswered", the same hint) on the registry.
  `KindCards`' Y, N, C and radio keys are not moved.

- [ ] **Step 1: Write the failing tests**: US3 2: a session's page, `i` focuses the composer, typing
      "hello", Escape returns the focus to the page and the draft still reads "hello"; US3 5: the
      New page with Session picked, `f` picks the Feature card; `a` on Home opens the New page; US6
      1: the questions page's status line reads `n p unanswered`, drawn from the registry, and `n`
      jumps to the next blank question as today (US2 more 3). The break caught: Escape that clears
      the draft.
- [ ] **Step 2: Run them to check they fail**:
      `nix develop -c vp test run packages/web/src/__tests__/keys-pages.test.tsx`; expected FAIL
      `expected document.body to be the active element` after the composer's Escape is not handled.
- [ ] **Step 3: Implement** each owner's keys with `useKeys`, and move `useBlankKeys` off
      `useHotkeys` and `useStatusHints`.
- [ ] **Step 4: Run the task's validation**: `nix develop -c vp run fast`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add packages/web/src specs/2026-10-26-leader-key/plan.md
git commit -m "feat(leader-key): each page's own keys on the registry"
```

---

## Task 10: The leader's tree and the `g` go keys

**Files:**

- Create: `packages/web/src/keys/LeaderKeys.tsx` (a component calling `useKeys` for the tree)
- Modify: `packages/web/src/Shell.tsx` (mounts it), `RepositoryMenu.tsx` (a way to open it by key),
  `keys/groups.ts` if a group changes
- Test: `packages/web/src/__tests__/keys-go.test.tsx`, `keys-leader-tree.test.tsx`,
  `keys-continue.test.tsx`

**Interfaces:**

- Consumes: Task 2's `useKeys`; Task 4's sequences and menu; Task 7's `useKeyPicker`;
  `destinations.ts`; `useOpenAddForm`; the navigation's Needs-you cards through the same selection
  the status line counts (`needsYou`, `entriesOf` in `sidebar/`), never a copy.
- Produces: the declarations of the
  [first story's top level](spec.md#us1-open-the-leader-menu-with-space-p1): `space space` (find
  anything: `useKeyPicker().open("all")`), `space c` (Continue), `space h i p d s` and `space ,`
  (the places, from `DESTINATIONS`), the `n` group (`s` session, `c` change, `f` feature, `n` note,
  `p` priority), the `f` group (`f c s d n p` each `open(kind)`), `space u t` (theme: cycles Mocha,
  Latte, System, as the settings page's control; a ruling), `space r` (opens the repository menu),
  and the `g` sequences `g h i p d s ,` and `g g` (scroll to the top). Continue: with one card
  needing the human it opens it, with several it opens a picker of them whose Enter opens the
  selected, with none the menu says "Nothing needs you" and nothing opens; the picker is `KeyPicker`
  with a source of the cards. The `u [` and `u ]` entries come from their owners (Task 5).

- [ ] **Step 1: Write the failing tests**: US2 1: `g` then `i` on the priorities page opens the
      inbox; US2 2 and 3: `g g` scrolls a scrolled page to the top; after `g` and 2 seconds a later
      `a` acts as `a` does; more 2: `g x` ends and `x` does nothing; SC-001: for each page of the
      top level (`h i p d s ,` and `n s`, `f d`, `u t`), pressing its keys from Home reaches it in
      at most three presses; US1 more 1: three cards need you, `Space c` shows a picker of them and
      Enter opens the selected; with one, it opens at once; with none, the menu shows "Nothing needs
      you" and the page stays; SC-007: the menu's place entries carry the icon and label of each
      `DESTINATIONS` entry, and the navigation and the tabs do too. The break caught: a place entry
      with its own icon, which the one-icon test shows.
- [ ] **Step 2: Run them to check they fail**:
      `nix develop -c vp test run packages/web/src/__tests__/keys-go.test.tsx`; expected FAIL
      `expected "/r/fixture/priorities" to be "/r/fixture/inbox"`.
- [ ] **Step 3: Implement** `LeaderKeys` with each binding calling the code that the buttons and the
      pages call, and mount it in `Shell.tsx`.
- [ ] **Step 4: Run the task's validation**: `nix develop -c vp run fast`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add packages/web/src specs/2026-10-26-leader-key/plan.md specs/2026-10-26-leader-key/rulings.md
git commit -m "feat(leader-key): the leader's tree and the go keys"
```

---

## Task 11: The Keyboard section of the settings, and the switch's effect

**Files:**

- Create: `packages/web/src/settings/KeyboardSettings.tsx`
- Modify: `packages/web/src/settings/categories.ts` (the `keyboard` category and its setting),
  `settings/SettingsView.tsx`, `settings/SettingsPage.tsx` (`setSingleKeyShortcuts`),
  `settings/ServerSettings.tsx` (the action's type), `settings/SettingsView.stories.tsx`,
  `packages/web/src/Shell.tsx` (`KeysProvider`'s `singleKeys` from the settings)
- Test: `packages/web/src/__tests__/settings.test.tsx`,
  `packages/web/src/__browser__/keyboard-setting.test.tsx`

**Interfaces:**

- Consumes: Task 3's `settings.keyboard.singleKeyShortcuts.inForce` and the mutation
  `settings.setSingleKeyShortcuts`; Task 2's `KeysProvider singleKeys`. Start from the mockup
  [`keyboard-setting.html`](mockups/keyboard-setting.html) and the Runs section's `BuildFresh` row.
- Produces: the section "Keyboard", with the one switch "Single-key shortcuts", on by default, saved
  at once with its refusal under it, and the file's problem in place of the switch when the file
  cannot be read; `useSettings()` unreadable means shortcuts on.

- [ ] **Step 1: Write the failing tests**: US5 more 1: with `single_key_shortcuts = false` in the
      file, the page loads with the switch off and `j` moves nothing while `↓` still does (US5 3);
      turning the switch off writes `[keyboard]\nsingle_key_shortcuts = false` to the file and
      Space, `g`, and a letter stop acting at once with the status line showing no letter hints (US5
      1); with it off, Ctrl+K opens the leader menu (US5 2); a file that cannot be read keeps the
      shortcuts on and the page says so (edge case); the switch is a Keyboard row found by the
      settings search. A real-browser check of the switch at both sizes. The break caught: a
      `singleKeys` read once at mount, which an immediate effect test shows.
- [ ] **Step 2: Run them to check they fail**:
      `nix develop -c vp test run packages/web/src/__tests__/settings.test.tsx`; expected FAIL
      `Unable to find role "switch" and name "Single-key shortcuts"`.
- [ ] **Step 3: Implement** the section, the category, the action, and the provider wiring.
- [ ] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, then
      `nix develop -c vp run browser:desktop`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add packages/web/src specs/2026-10-26-leader-key/plan.md
git commit -m "feat(leader-key): the keyboard setting's section"
```

---

## Task 12: Retire the old hint API, and check that only the registry listens

**Files:**

- Modify: `packages/web/src/statusHints.tsx` (only the cover hooks stay), `shell/StatusLine.tsx`
  (`Hints` reads `useHints()` alone), every remaining `useStatusHints` caller
- Create: `packages/web/src/__tests__/keys-structural.test.ts`
- Modify: `packages/web/src/__tests__/status-hints.test.tsx` (the registry's hint order, with a
  ruling, or moved into `keys-hints.test.tsx`)
- Test: the same

**Interfaces:**

- Consumes: every earlier task's migrations.
- Produces: `statusHints.tsx` holds `useCoverStatusLine` and `useStatusLineCovered` only; the
  decision's structural test: it scans `packages/web/src` for `useHotkeys`,
  `addEventListener("keydown"` or `("keyup"`, and `onKeyDown` handlers, and fails for any file not
  in the allowlist, saying in its message how to fix it: declare the key with `useKeys`, or add the
  file with its reason to the list.

- [ ] **Step 1: Write the failing test**: `keys-structural.test.ts` lists each allowlisted file with
      its reason (the allowlist of [Complexity tracking](#complexity-tracking)) and fails on any
      other hit. The break caught: a page that adds `useHotkeys` back.
- [ ] **Step 2: Run it to check it fails**:
      `nix develop -c vp test run packages/web/src/__tests__/keys-structural.test.ts`; expected FAIL
      naming the files still listening, which Tasks 5 to 9 should have migrated: each one left is a
      miss to migrate, not an entry to add.
- [ ] **Step 3: Delete** `useStatusHints`, `StatusHintsProvider`'s hint part, and
      `useDeclaredHints`, and migrate what the failure names.
- [ ] **Step 4: Run the task's validation**: `nix develop -c vp run fast`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add packages/web/src specs/2026-10-26-leader-key/plan.md specs/2026-10-26-leader-key/rulings.md
git commit -m "refactor(leader-key): only the registry listens for keys"
```

---

## Task 13: Screenshots of the changed views

**Files:**

- Create: `specs/2026-10-26-leader-key/screenshots/` (the images)
- Modify: `packages/web/scripts/screenshots.ts` if a view needs a state it cannot reach

**Interfaces:**

- Consumes: the final UI.
- Produces: the committed images the [UI checks decision](../decisions/ui-checks.md) asks for, at a
  desktop and a phone size, in both themes: the leader menu at its top level and its New group, a
  `g` menu, the key picker with a preview and with the list alone on the phone, the settings'
  Keyboard section on and off, and the status line with its hints. Reviewed by the agent against the
  decisions, with a line per view in the pull request.

- [ ] **Step 1: Run `nix develop -c vp run screenshots`** for the views above, in each size and
      theme.
- [ ] **Step 2: Review every image** against the decisions ([UI look](../decisions/ui-look.md),
      [UI layout](../decisions/ui-layout.md), [UI coherence](../decisions/ui-coherence.md)), and fix
      what is off in a commit of its own.
- [ ] **Step 3: Run the task's validation**: `nix develop -c vp run fast`. Expected: PASS.
- [ ] **Step 4: Commit**

```bash
git add specs/2026-10-26-leader-key/screenshots packages/web
git commit -m "docs(leader-key): screenshots of the keys at both sizes and themes"
```
