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

## R5: `ura init`'s line for a `.claude` folder ura did not install

- **Decision**: until task 3, `ura init` installs through the new action, so its test
  `an_existing_claude_skill_folder_is_kept` expects
  `kept    .claude/skills/uraeda: not installed by ura`, not the bare
  `kept    .claude/skills/uraeda` it printed before.
- **Rationale**: the spec's edge case reports a folder without `.ura-manifest` with that reason; the
  plan expected `tests/init.rs` to pass unchanged, which this test could not.
- **Alternatives considered**: keeping the old link logic in `init` until task 3, a second copy of
  the code the task moves.
- **If wrong**: task 3 removes the test with the other skill tests of `tests/init.rs`.
- **Where**: task 1.

## R6: Outside a repository, the scope is left out

- **Decision**: `outside_a_repository` runs `ura install --agents`, without `--user`, to check the
  `Install the Uraeda skill for: your user` line.
- **Rationale**: the line is the answer to a scope the command implied; with `--user` given, nothing
  was asked or implied, and no answer line prints, as in the spec's US1 scenario 1.
- **Alternatives considered**: printing the line with `--user` too, which would break scenario 1's
  exact stdout.
- **If wrong**: one test's arguments.
- **Where**: task 1.

## R7: No `note` line when the home folder is the repository

- **Decision**: `ura install` prints no `note` line when the other scope's folder is the same folder
  as the base, like a dotfiles repository at the home folder.
- **Rationale**: the copy found there is the one just installed, not another copy.
- **Alternatives considered**: always printing it, which would name the installed copy as another.
- **If wrong**: remove the comparison in `install::run`.
- **Where**: task 1.

## R8: `vp test`'s browser stage in this environment

- **Decision**: a task's `vp run ready` step is checked when every stage passes but the last,
  `vp test`, whose browser tests could not start here: Playwright's webkit is not installed, or
  vitest's browser port was taken by another run. Its other test files all passed.
- **Rationale**: the failure is the machine's, the same before any change of this branch, and this
  feature touches no TypeScript; CI runs the whole command.
- **Alternatives considered**: installing Playwright's browsers, a side effect outside the branch;
  leaving the boxes unchecked, which would mark built tasks as unfinished.
- **If wrong**: the pull request's CI run shows it.
- **Where**: tasks 1 to 6, step "Run all tests".

## R9: Leaving raw mode without `ratatui::restore`

- **Decision**: `picker::run` leaves raw mode with crossterm's `disable_raw_mode`, from a drop
  guard, on every return; `ratatui::restore` runs only in ratatui's panic hook.
- **Rationale**: `restore` also leaves the alternate screen, which an inline viewport never entered,
  and in xterm-like terminals that sequence restores a saved cursor position, which could move the
  answer line.
- **Alternatives considered**: `ratatui::restore` on every return, as the plan said.
- **If wrong**: call `ratatui::restore()` in the guard's `drop`.
- **Where**: task 4.
