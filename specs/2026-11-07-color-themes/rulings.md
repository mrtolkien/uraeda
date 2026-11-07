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
  its first theme and change only the palette.
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
