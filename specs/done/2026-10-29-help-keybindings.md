---
kind: change
finished: 2026-10-30
pull-request: https://github.com/mrtolkien/uraeda/pull/67
---

# Record: The key map

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-29, finished on
> 2026-10-30, in [its pull request](https://github.com/mrtolkien/uraeda/pull/67). Its full files are
> in git: `git log -- specs/changes/2026-10-29-help-keybindings/`.

## What and why

The human asked for `?` in the status line, right after the leader's hint, opening every shortcut of
the page, searchable: an overlay on the glass look that also darkens the page, modal-like, for
readability. They asked to be told if it looked too different from other views, or read badly. It
did, in the light theme, and they chose a lighter light glass for every glass surface.

## Behaviour

- **`?` opens the key map**, and so does `Space ?` in the leader menu, which the `Ctrl+K` chord
  still opens when the single keys are off. The status line reads `space menu`, then `? keys`, then
  `[ ] fold`, then the page's hints.
- **It lists every key that works where the focus was** when it opened, read from the key registry:
  a key whose guard refuses that element is left out, so a row's own keys show only with the focus
  on the row.
- **Its sections**: This page, Everywhere (the shell's single keys), Leader menu, then each group
  the menu names (Find, New, UI, Fonts), then Go. Keys with one label share a row (`j ↓ +` Next
  row). Labels start with a capital, as the leader menu's do.
- **A fallback**, a key that runs only when the key's other binding did nothing, is listed only with
  the keys no other listed binding takes, and left out with none: on a list, `j` reads Next row
  alone, and Scroll to the bottom keeps only `G`.
- **Keys are written as typed**: arrows as `↓`, Enter as `⏎`, Escape as `esc`, Space as its glyph,
  and chords as `Ctrl+K`, on a Mac too, since every `mod+` key takes Ctrl and the half-screen keys
  refuse Command there. With the single keys off, only the keys that still work are listed, and the
  leader's start from `Ctrl+K`, as they also do where the focus is on a checkbox, a radio, a switch,
  or a combobox, which keep Space.
- **The search** keeps the rows with every word typed in their label, their keys as written, or
  their section's title: "find" lists the Find group, "home" every place named Home. It takes the
  focus as the map opens, and the dialog keeps its height while it filters, so the field never
  moves.
- **A reference, not a palette**: its rows run nothing. Escape, Back, Close, or a click outside
  closes it, and the focus returns where it was. Opening it adds a history entry.
- **Its look**: on wide and semi-wide screens, a square dialog on the frosted glass, over the page
  dimmed lightly; on the phone, the glass sheet every phone dialog is.
- **Every light-theme glass is lighter**: the leader menu, the key map, and the phone's bars and
  sheets take a faint amber tint (6%, where it was 24%) over 85% of the page's colour (where it was
  40%). Measured over the home page's busiest pixels, labels read at 5.2:1 or more on every light
  glass, the leader menu's secondary text and keys at 4.8:1; the key map's and the sheets' keys
  between 4.1 and 4.3:1 at worst, about 4.5:1 typically. The dark theme is unchanged.
- **A list's `j` and `h` are labelled by what they do**, "next row" and "previous column"; the
  status line still says `j k move` and `h l column`.

## Design

The key registry already held every key with its label, icon, guard, and owner, so the map reads it
once, as it opens, rather than keeping a list of its own.

- [`keyMap.ts`](/packages/web/src/keys/keyMap.ts), pure: which bindings work for the focused element
  (`when` guards, the single-key switch, Space kept by a control, fallbacks), their sections and
  rows, the search, and `written`, a token as the map writes it.
- [`KeyMap.tsx`](/packages/web/src/keys/KeyMap.tsx): the dialog or the phone's sheet, and
  `useKeyMap`, the `?` and `Space ?` bindings with the map they open, which
  [`LeaderKeys.tsx`](/packages/web/src/keys/LeaderKeys.tsx) declares in the shell. The list is a raw
  `ul` in CSS columns, an Astryx gap as the leader menu's rows are: Astryx's `List` draws rows with
  their own padding and surface, not keys beside their words.
- The registry gives the map its bindings with their places, `store.listed()`, through `useListed()`
  in [`registry.tsx`](/packages/web/src/keys/registry.tsx); the status line's first hints are
  `space`, `?`, `[ ]` ([`store.ts`](/packages/web/src/keys/store.ts)).
- The glass's colours are in [`glass.stylex.ts`](/packages/web/src/layout/glass.stylex.ts): the
  lighter light tint and scrim, and `--glass-dim`, the light dim under the key map's dialog, the
  theme's text colour at 30% on a light page where Astryx's dialogs use 70%. The phone's sheets keep
  Astryx's dim.
- Tests: [`keys-map.test.ts`](/packages/web/src/__tests__/keys-map.test.ts) for what the map lists,
  [`keys-map-open.test.tsx`](/packages/web/src/__tests__/keys-map-open.test.tsx) for `?` reading the
  focused element's keys and Escape closing it, and the hint order in
  [`keys-hints.test.tsx`](/packages/web/src/__tests__/keys-hints.test.tsx).
- The UI guides say where the map sits: [Keyboard](/specs/ui/keyboard.md),
  [Surfaces](/specs/ui/surfaces.md), and [Look and feel](/specs/ui/look-and-feel.md#glass).

## Gotchas

- **The dialog is named by its own `aria-label`**: Astryx names a dialog after its header's title
  imperatively, which happy-dom never sees, so a test could not find it by name
  ([`KeyMap.tsx`](/packages/web/src/keys/KeyMap.tsx)).
- **The dialog's header is drawn only while it is open**: a closed Astryx dialog stays in the page,
  and its heading was found by the questions page's `n`, which jumps between headings.
- **The search asks for the focus with `hasAutoFocus`, which `useFieldFocus` looks for**: Astryx's
  `DialogHeader` takes the focus as it opens, for screen readers, and would keep it.

## Questions

### Round 01

#### Q1: How should the key map look in the light theme?

**Answer:** B, the same lighter glass for every light-theme glass: the key map, the leader menu, and
the phone's bars and sheets. As built, the light glass over a page dimmed to 70% read at about 2:1,
and the light glass alone left secondary text and keys at about 3.6:1, under the 4.5:1 the
[UI look](/specs/decisions/ui-look.md) decision requires.

#### Settled without the human

- **What it lists**: every key that works where the focus is, read from the registry as it opens.
- **Its rows run nothing**: a reference with a search; the leader menu already runs every sequence.
- **`Space ?`** opens it too, so it stays reachable with the single keys off.
- **The search** matches words in the labels, the keys, or the groups.

## Changes after approval

- The review found that a fallback showed as a second meaning of its key, that chords read `Cmd` on
  a Mac where the half-screen keys refuse Command, and that Space on a checkbox is the checkbox's:
  each is fixed as **Behaviour** says.

## Follow-ups

- An inbox note: a proposal started from a priority links `specs/PRIORITIES.md` from its own folder,
  which `ura check` reports broken, so `vp run ready` fails on every such branch. This branch fixed
  the link in its own proposal and in the amend-latest change's.
