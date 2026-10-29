---
status: awaiting-human
---

# Clarifications, round 01: The key map's light theme

> [!IMPORTANT]
>
> 1 question, about 5 minutes.
>
> - Verdict: built as proposed, and it reads well in the dark theme. In the light theme the glass
>   over the dimmed page makes its text unreadable, which you asked to hear about.
> - The light theme's choice: a lighter glass for the key map alone, or the look as you described
>   it, below the contrast the [UI look](/specs/decisions/ui-look.md) decision requires.
> - The leader menu's light glass is under that contrast too, today: the second option of the
>   question fixes it with the key map.
> - Settled without you: what the map lists, that its rows run nothing, and `Space ?` beside `?`.

## Context

### Goal

The [proposal](proposal.md) asks for `?` after the leader in the status line, opening every key of
the page, searchable. The overlay is glass and darkens the page behind it. You asked to be told if
it is too different from other views or its contrast is bad.

### Today

The key map is built on this branch: `?` reads `? keys` in the status line, right after
`space menu`. It opens a dialog on the frosted glass of the leader menu
([`glass.ts`](/packages/web/src/layout/glass.ts)), over the page dimmed by the dialog's backdrop. On
the phone it is the glass sheet, as every phone dialog is. Try it with `vp run sandbox`, then `?`.

It is not too different: the phone's sheets are already glass over a dimmed page. The contrast is
the problem. It was measured on the home page, against every pixel behind the text. The
[UI look](/specs/decisions/ui-look.md) decision requires 4.5:1 of every text colour. "Worst" is the
lowest 1% of the pixels, "usual" the median:

| Theme                                     | Labels      | Keys (orange) | Headings    |
| ----------------------------------------- | ----------- | ------------- | ----------- |
| Dark, as built                            | 5.6:1 worst | 7.0:1 worst   | 8.6:1 worst |
| Light, as built                           | 1.6:1 worst | 1.6:1 worst   | 2.0:1 worst |
| Light, no dimming at all                  | 3.6:1 usual | 3.6:1 usual   | 4.6:1 usual |
| Light, lighter glass (option A, measured) | 5.4:1 worst | 4.3:1 worst   | 5.4:1 worst |

The light glass is a darker, smoked amber tint over 40% of the page's colour
([`glass.stylex.ts`](/packages/web/src/layout/glass.stylex.ts)), made so it "reads as glass over a
white page" ([Look and feel](/specs/ui/look-and-feel.md#glass)). The backdrop darkens the page to
70% of the theme's text colour. The glass turns a murky grey, and its dark text nearly vanishes.
Even with no dimming, its secondary text and keys stay under 4.5:1: the leader menu in the light
theme has the same shortfall today.

The lighter glass measured for option A is a 6% amber tint, where the light glass has 24%. It lies
over 85% of the page's colour, where the light glass has 40%. The page is dimmed to 30%, where
Astryx's dialogs use 70%. It reads as frosted near-white glass, the page's shapes and colours still
blurred behind it, its labels in the primary text colour.

### Scope

The key map's look in the light theme. The dark theme stays as built, and so does everything the map
does.

### Sources

- [`KeyMap.tsx`](/packages/web/src/keys/KeyMap.tsx), the overlay, and
  [`keyMap.ts`](/packages/web/src/keys/keyMap.ts), what it lists.
- The glass: [`glass.ts`](/packages/web/src/layout/glass.ts),
  [`glass.stylex.ts`](/packages/web/src/layout/glass.stylex.ts), and
  [Look and feel](/specs/ui/look-and-feel.md#glass).
- The [UI look](/specs/decisions/ui-look.md) decision: text at 4.5:1 in every scheme (MUST), glass
  for what floats (SHOULD).
- Astryx's `Dialog`, whose backdrop is the theme's `--color-overlay`, Latte's text colour at 70%
  ([`theme.ts`](/packages/web/src/theme/theme.ts)).
- [WCAG 2.2, contrast (minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

## Check these

- **The leader menu's light glass** is under 4.5:1 for its labels and keys today, without any
  dimming. Option B fixes it; with option A it stays as it is.

## Q1: How should the key map look in the light theme?

The key map is built as you described it: glass over a dimmed page. In the dark theme its text reads
at 5.6:1 or more. In the light theme it falls to about 2:1, the measures above, below the 4.5:1 the
[UI look](/specs/decisions/ui-look.md) decision requires.

Why it matters: it decides whether the light theme's key map is readable, and whether the light
glass keeps one look everywhere.

- **A (recommended). In the light theme, the key map gets a lighter glass and a lighter dim.** A
  faint tint over most of the page's colour, and the page dimmed to 30%.
  - [pro] every text reaches 4.3:1 or more, and its labels 5.4:1; the page still shows through,
    blurred and dimmed.
  - [pro] the dark theme, and every other glass, stay as they are.
  - [con] in the light theme the key map is a paler glass than the leader menu.
  - [con] its keys, at 4.3:1, stay just under 4.5:1 over the page's busiest spots.
  - Why recommended: it keeps what you asked for, glass over a darker page, readable, within this
    change.
- **B. The same lighter glass for every light-theme glass: the key map, the leader menu, and the
  phone's bars and sheets.**
  - [pro] one light glass everywhere, and the leader menu's shortfall fixed too.
  - [con] the light theme's glass becomes paler everywhere, which you tuned to look "glassy enough";
    it changes surfaces beyond your proposal.
- **C. Keep it as built, glass over a page dimmed to 70%, in both themes.**
  - [pro] exactly the look you described, the same glass everywhere.
  - [con] the light theme's text at about 2:1, which the [UI look](/specs/decisions/ui-look.md)
    decision's contrast rule forbids: choosing it is an exception to that rule.

**Answer:**

## Settled without the human

### Behaviour

- **What it lists**: every key that works where the focus is, read from the registry as it opens. It
  lists the page's, the shell's, the leader menu's by group, and the `g` keys. Keys with one label
  share a row (`j ↓ +` Next row). With the single keys off, only the keys that still work, the
  leader's written from `Ctrl+K`.
- **Its rows run nothing**: it is a reference with a search, closed by Escape, Back, Close, or a
  click outside. The leader menu already runs every sequence by a click.
- **`Space ?`** opens it too, so it stays reachable with the single keys off, as the
  [Keyboard](/specs/decisions/keyboard.md) decision asks of every single key.
- **The search** keeps the rows with every word in their label, keys, or group: "find" lists the
  Find group, "home" the places named Home.

### Under the hood

- **Labels**: the list's `j` and `h` are now labelled "next row" and "previous column"; the status
  line still says `j k move` and `h l column`.
- **A started proposal's link**: the proposal linked `specs/PRIORITIES.md` from its own folder,
  which failed `ura check`. The link is fixed here, and the New page's start, which writes it, is
  noted in the inbox.

**Notes:**
