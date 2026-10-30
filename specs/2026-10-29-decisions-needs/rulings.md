# Rulings: Decisions understandable with no context

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The setup templates and the example's plan follow the new rules too

- **Decision**: besides the rules the spec names, the example's Code quality marker rule and
  Preview's version rule hold one keyword each. The Preview and Testing decision templates, which a
  project's setup fills, follow the same splits, and the example's plan quotes the new rules.
- **Rationale**: each held two keywords, so `decision.keywords` would warn on the example and on
  every project set up from the templates. The plan copies decision rules word for word, so its
  quotes change with them. The example check's candidate Code quality, in `specs/decisions-check/`,
  splits the same rule: `ura check` measures candidates like decisions.
- **Where**: tasks 1 and 2, `skills/uraeda/assets/`

## R2: This feature's rounds keep their links to the removed decisions

- **Decision**: the discovery and the questions keep their five links to `ui-checks.md` and
  `ui-coherence.md`, which `ura check` reports, until the finish step replaces the folder with its
  record.
- **Rationale**: the spec keeps this feature's rounds as written, and answered rounds are never
  edited. The record links neither file, so the merged branch has no broken link.
- **If wrong**: `ura check specs` fails on the branch until the finish step; the pull request is
  marked ready only after it.
- **Where**: task 4

## R3: The example's decisions name folders, not the files inside them

- **Decision**: the example's Due dates, Task storage, and UI components rules name the date module,
  the upgrade, and the theme rather than their files, and Applies to links folders.
- **Rationale**: the final review found them breaking the fifth test and the Applies to rule, while
  the example is the model every agent copies. The example's plan quotes the new rules.
- **Where**: the final review's fixes, `skills/uraeda/assets/example/specs/`
