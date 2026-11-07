# Rulings: Color themes

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Views read roles as `--role-<role>` variables, with a tint for the accents

- **Decision**: the palette rule sets `--role-<role>` for every role, and `--role-<role>-tint`, the
  role at 12% over `page`, for the accent roles: `action`, `needs-you`, `changed`, `added`,
  `removed`, `caution`, `context`, `yours`, `link`, `working`, `live`, `example`, `sub-agent`. Views
  write `var(--role-needs-you)`, which the token lint already allows. Astryx's semantic tokens
  (`--color-accent`, `--color-text-secondary`, `--color-success`, …) stay: they name a meaning, and
  the mapping sets them from roles.
- **Rationale**: a hue's background is today's tint of that hue (`tint` in `theme.ts`), so each
  accent role needs one; a variable per role keeps the views' styles static, as StyleX needs.
- **Alternatives considered**: a StyleX `defineVars` of roles: its names are hashed, so the palette
  rule could not set them by name.
- **Where**: tasks 4 and 7

## R2: An inherited role resolves against the child's palette

- **Decision**: a role a file leaves out takes its parent's expression, a palette name or a colour,
  resolved against the file's palette merged over its parent's. A family's variant can then extend
  its first theme and change only the palette. A role naming a palette entry that does not exist
  keeps the parent's expression too, resolved against the merged palette: the parent's colour,
  unless the file redefines the palette name that expression names.
- **Rationale**: Helix's loader does the same, merging palettes before resolving; the data model
  says a role names an entry "of the same file, or of a theme it extends".
- **If wrong**: a user who redefines a palette name their parent uses changes every role naming it.
  Inheriting resolved colours instead is a change in one function of the core.
- **Where**: task 2

## R3: Each list sorts by name, its mode's default first

- **Decision**: shipped and the user's themes of a mode sort by their name, Catppuccin Mocha or
  Latte first; the picker lists the dark themes, then the light ones.
- **Rationale**: the spec's lists group by family, which sorting by name gives, and a new shipped
  file needs no registry.
- **Where**: task 2

## R4: The floor step is HSL lightness, a whole percent at a time, Catppuccin's included

- **Decision**: a shipped colour under the floor is shipped as the first step, 1% of HSL lightness
  at a time from its published colour, lighter on a dark theme and darker on a light one, hue and
  saturation kept, at which every pair its roles are in passes. The file keeps the published colour
  under its name, and the step as `<name>-floor`. Catppuccin Latte's darkened accents and Mocha's
  `dim`, which were picked by hand before this feature, are recomputed by the same rule.
- **Rationale**: the Colour themes decision asks for "the smallest change in lightness", checked by
  a test; HSL keeps every step in gamut, so the test can check it exactly. The decision wins over
  SC-001 where the two differ: those few Catppuccin colours move by a step or two, listed in task
  4's commit and in the pull request.
- **Alternatives considered**: OKLCH lightness, closer to perception, but a step may leave the sRGB
  gamut and need a clamp the test must repeat; keeping Latte's hand-picked values, which the
  decision's test would refuse.
- **If wrong**: a family looks slightly off its published colours; another step rule changes
  `floor.ts` and the `-floor` entries the script prints.
- **Where**: tasks 4 and 5

## R5: Five tokens with no role of their own take the nearest one

- **Decision**: `--color-text-gray` takes `ink` (Mocha drew `subtext1`), `--color-icon-secondary`
  takes `ink-quiet` (Latte drew `subtext0`), `--color-icon-gray` takes `ink-faint` (Latte drew
  `overlay2`), `--color-skeleton` takes `chip` (each drew a step lighter), and the pink hue takes
  `changed`. `--color-on-dark` and `--color-on-light` stay the built theme's constants: they are
  drawn over images, not over the page. SC-001's test lists these exceptions.
- **Rationale**: the approved roles have no entry for these Catppuccin steps, and adding roles named
  for them would be roles named by colour, which the decision refuses. Pink is drawn only for a pink
  variant, which the new lint refuses in views.
- **If wrong**: a shade of grey on icons or skeletons differs from before by one Catppuccin step.
- **Where**: task 4

## R6: The theme picker floats over the page at every width

- **Decision**: on a phone too, the picker is the narrow floating list, the window's width less its
  margins, not the bottom sheet the other pickers use there.
- **Rationale**: the spec's picker previews in the page; a sheet covering the page would hide the
  preview it exists for.
- **Where**: task 8

## R7: The palette rule's selector holds in every surface, as the probe read it

- **Decision**: `applyPalette` keeps the selector
  `[data-astryx-theme="uraeda"][data-theme="<mode>"]`, unlayered. In Chromium, Astryx's root `Theme`
  puts both attributes on `<html>` and on its own wrapper, the sandbox bar's wrapper carries both,
  and a story's preview carries both once its embedding page sends the mode: the rule set every
  token it names on the page, a pane, a portalled dialog, a `Selector`'s popover, the sandbox bar,
  and a story's document. The page beside the panes paints `--color-background-surface`, the panes
  `--color-background-body`; no element paints a story's background, so the frame's canvas shows
  there, with the built theme as with the rule.
- **Rationale**: the built theme declares its tokens in `@layer astryx-theme`, under
  `@scope ([data-astryx-theme="uraeda"])`, so any unlayered rule matching the same element wins. The
  probe put the same rule in `@layer reset` and saw every surface miss, so its `ok` is earned.
- **If wrong**: a page of Storybook loaded on its own, in the system's mode, has no `data-theme` and
  keeps the built Catppuccin, as task 9 intends; a surface that needs it would need a per-mode
  `@media (prefers-color-scheme)` block.
- **Where**: tasks 1, 4, and 9

## R8: In each list, the shipped themes come before the user's

- **Decision**: a mode's list is its default, then its other shipped themes by name, then the user's
  themes by name, so a theme of yours never sits between two shipped ones.
- **Rationale**: the spec's lists say "The user's follow, marked yours"; R3's sort by name holds
  within each group.
- **If wrong**: one sort key in `themes::read`.
- **Where**: task 2

## R9: Two theme problems the spec does not word

- **Decision**: a theme extending a file of the user's that left the lists says
  `extends "a", which has problems of its own: see its row.`, and extends its mode's default, as an
  unknown `extends` does. Every message ends with a period, the loop's included:
  `extends forms a loop: a → b → a.`
- **Rationale**: the spec words the unknown `extends` and the loop, not a parent with its own
  problems; calling that parent unknown would send the user looking for a missing file. The edge
  cases quote the messages inside a sentence, where the period falls away.
- **If wrong**: the wording of one message in `themes/resolve.rs`.
- **Where**: task 2

## R10: `useThemes` lives in its own module, `useThemes.ts`

- **Decision**: `useThemes`, its view, and `ThemesRecord` are in `packages/web/src/useThemes.ts`,
  not in `data.ts`, as `writes/useWriteQueue.ts` holds its own record's view and hook.
- **Rationale**: `data.ts` is at the 500-line limit of the code quality decision, and so is
  `views.ts`; the hook is the same as `useSettings`, reading the one `Themes` record.
- **If wrong**: a move of one function and its view into `data.ts`, once it has room.
- **Where**: tasks 3 and 6

## R11: The neutral theme's own colours stay its own, and Latte's cursor row follows its accent

- **Decision**: five colours the built theme inherits from Astryx's neutral theme,
  `--astryx-theme-neutral-color-destructive-overlay-hover` and `-pressed`, and `-on-tint-neutral`,
  `-on-tint-overlay-hover` and `-pressed`, are not mapped: no role sets them, and SC-001's test
  lists them as exceptions. Latte's `mauve-tint`, its `cursor-row`, stays `mauve-floor` at 10% over
  `base`, so it moves with the recomputed `mauve-floor`, from `#e3def3` to `#e4ddf4`; its
  `overlay2-floor` is then the step that reads at 4.5:1 on that row, `#5e6173`.
- **Rationale**: the five are Astryx's constants, the same in every theme, which no view of the app
  reads as a colour of its own; the cursor row's comment in the file says what it is made of, and
  the floor step measures the row as it ships.
- **If wrong**: a role for them is a row of the mapping in `roles.ts`; a hand-picked `mauve-tint` is
  one line of the Latte file, with `scripts/theme-floor.ts` run again.
- **Where**: task 4

## R12: A shipped theme's floor test reads the floors its roles name

- **Decision**: `theme-roles.test.ts` checks each `-floor` entry a shipped theme's roles name, not
  every `-floor` entry of its merged palette; the core test of the lists' order leaves out the
  shipped themes other than the two defaults.
- **Rationale**: a family's first file without `extends`, such as Dracula or GitHub Dark, extends
  its mode's default, so its merged palette holds Catppuccin's floors, which no role of its own
  names; GitHub Light High Contrast's roles name its own published tokens, which reach the floor,
  not GitHub Light's floors it inherits. The order test listed every shipped theme, and each new
  file would have broken it.
- **If wrong**: a stale `-floor` entry left in a shipped file, which no role names, is no longer
  caught by the test; the floor script still prints only what the roles use.
- **Where**: task 5

## R13: The shipped themes were built in three parts, one commit each

- **Decision**: task 5 was built by three implementers at the same time, each on a group of
  families: Catppuccin's other flavours, Dracula, Alucard, and GitHub's themes; Gruvbox, Kanagawa,
  Nord, and One; Rosé Pine, Solarized, and Tokyo Night. Each is its own commit; this commit checks
  the task's boxes once all three were merged and the floor script printed no pair under the floor
  for the 28 themes.
- **Rationale**: 26 files, each read from its published source, touch no file in common; one
  implementer would have held the wave for hours.
- **Where**: task 5

## R14: The palette rule paints `<html>` in the page's colour

- **Decision**: for each mode it sets, the palette rule, and the first paint's script with it, adds
  `html[data-astryx-theme="uraeda"][data-theme="<mode>"] { background-color: var(--color-background-body); }`.
- **Rationale**: nothing paints `<html>`, so before the app mounts the first frame showed the
  browser's own canvas, whatever the cache held: `palette-probe.ts --first-paint` read
  `rgba(0, 0, 0, 0)` there without it. Painting it in `page`, the ground behind everything, makes
  SC-003's first frame the theme's, and a phone's overscroll with it.
- **If wrong**: a story's document, once task 9 applies the rule there, paints its canvas in the
  theme's page instead of the frame's (R7); one line of `paletteCss` and of the script.
- **Where**: task 6

## R15: The drawn colours are a function of the themes and the picks, which the provider calls

- **Decision**: `drawnTokens(themes, picks, preview?)` in `theme.tsx` holds the rule "a pick the
  lists lack draws its mode's default", and the test of a deleted theme calls it on the themes the
  binding reads, not on a rendered provider. The provider learns the server's themes from
  `ThemesFeed`, a component drawn where the app is signed in under a `Suspense` of its own, since
  the provider sits above the sign-in page, where no themes can be read.
- **Rationale**: the same guarantee, tested without a fate client or a DOM, as the testing
  decision's "pure logic with many cases" asks.
- **If wrong**: a test rendering the provider over a fake themes record.
- **Where**: task 6

## R16: Where a view's hue and its meaning name different roles

- **Decision**: each view takes the role of what it means, which draws today's Catppuccin colour,
  except the sandbox's badge, orange, which takes `caution`, yellow: it warns, and asks nothing of
  the human. Where no role names the meaning, the view keeps its colour through the nearest role: a
  ledger's changed part, yellow, takes `caution`, as the ledger's "Changed" badge draws the
  warning's colour (`changed` means changed since you read it); an `[!IMPORTANT]` callout's bar,
  purple, takes the accent of the other callouts, the same mauve; a list section's Ongoing title,
  green, takes `added`, and Now's, blue, `working`; a rule's strength takes `added` for MUST and
  SHOULD, `removed` for SHOULD NOT and MUST NOT; a list row's marks, lavender, take `pane-title`. A
  list section's `Tone` and a pane's `PaneTint` name meanings (`ongoing`, `now`, `later`; `added`,
  `working`, `quiet`), no longer hues. The rule also refuses a hue picked by a condition,
  `variant={active ? "green" : "yellow"}`, as a decision's badge was written, and its test counts
  one report per break of its fixture.
- **Rationale**: the task follows the meaning where the two disagree; the data model's roles name no
  priorities section, strength, callout kind, or row mark, and a role named for them is a change of
  the data model the human approves.
- **If wrong**: one line of each view; or a role added to `ROLES`, every shipped file, and the
  mapping.
- **Where**: task 7
