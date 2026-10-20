# Rulings: Tab completion for `ura` in fish and zsh

The low-impact choices made while building [the change](proposal.md), inside the limits of
[its round](clarifications-01.md) and the decisions. None binds future work: those are decisions.

## R1: zsh's script also completes when autoloaded

- **Decision**: `ura` prints clap's zsh script with a tail that calls the completer when zsh
  autoloads the file as `_ura`, as `gh`'s and other cobra scripts do.
- **Rationale**: installed on `fpath` by a package, clap's script only registers itself on the first
  Tab of each shell, which completes nothing. A pseudo-terminal zsh showed it: `ura upg` then Tab
  rang the bell the first time, and completed from the second. With the tail, it completes the first
  time, and sourcing the script from `~/.zshrc` behaves as before.
- **Alternatives considered**: leaving it, so every zsh session loses its first Tab. Patching the
  file in each package, which Homebrew's `generate_completions_from_executable` cannot do.
- **If wrong**: the tail names clap's function, `_clap_dynamic_completer_ura`. A `clap_complete`
  upgrade that renames it breaks zsh: a test checks the script's ending.
- **Where**: [`crates/cli/src/complete.rs`](/crates/cli/src/complete.rs)

## R2: `check` completes features, then paths

- **Decision**: `ura check` completes the features and changes under way, then files and folders.
  `ura add` completes folders.
- **Rationale**: `check` takes both a name and a path, and `add` takes a folder. The other targets
  complete names only, as a path is rarely typed there.
- **Alternatives considered**: names only, which loses Tab on `specs/`.
- **If wrong**: one line per argument in [`main.rs`](/crates/cli/src/main.rs).
- **Where**: [`crates/cli/src/complete.rs`](/crates/cli/src/complete.rs)
