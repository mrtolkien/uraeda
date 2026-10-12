# Rulings: Review uraeda init and skill install flow

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: `--update` with nothing installed in the repository

- **Decision**: `ura install --repo --update` with nothing ura installed prints
  `nothing to update: ura installed no skill in this repository`, and exits 0.
- **Rationale**: the spec gives only the user's text, `... in ~/`; the repository's follows it.
- **Alternatives considered**: printing the repository's path, which says less than "this
  repository" from inside it.
- **If wrong**: one string and its test.
- **Where**: task 2.

## R2: Tests never see the real home folder

- **Decision**: `ura_in` sets `HOME` to a new temporary folder for every run, unless the test names
  `HOME`, and `ura(repo, ...)` uses `TestRepo::home()`, next to the repository.
- **Rationale**: `ura init` and `ura install` now read the home folder; on a machine with the skill
  installed, tests reading the real one would pass or fail by machine, and could write to it.
- **Alternatives considered**: setting `HOME` only in the new tests, which leaves every other
  command test one refactor away from touching the real home.
- **If wrong**: a test that needs the real home passes it in `env`.
- **Where**: task 1.

## R3: `j` and `k` in the pickers

- **Decision**: `j` and `k` move like ↓ and ↑; the help line names only the arrows.
- **Rationale**: the planned TUIs take vi motions, as the human asked in the
  [CLI TUIs draft](../drafts/cli-tuis.md), and they cost one match arm.
- **Alternatives considered**: arrows only.
- **If wrong**: remove two match arms and their test rows.
- **Where**: task 4.

## R4: ratatui's features

- **Decision**:
  `ratatui = { version = "0.30.2", default-features = false, features = ["crossterm"] }`.
- **Rationale**: the picker needs the crossterm backend, `Paragraph`, and `Line`; the defaults add
  every widget, macros, a layout cache, and underline colours, which the binary would carry for
  nothing, against the CLI decision's rule to keep it small.
- **Alternatives considered**: the defaults, as measured in the discovery.
- **If wrong**: a later TUI turns a feature on.
- **Where**: task 4.
