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

## R3: `clean` completes the merged features it can clean

- **Decision**: `ura clean` completes the merged features and changes with a worktree or a branch
  left, the ones it can clean, where the round's settled point said the started ones.
- **Rationale**: `clean` refuses a feature that is not merged, so a started one is never a valid
  value. The list is `clean`'s own, `clean::candidates`, so both stay the same.
- **Alternatives considered**: the started features, as the round said, every one of them refused.
- **If wrong**: one line in [`main.rs`](/crates/cli/src/main.rs).
- **Where**: [`crates/cli/src/complete.rs`](/crates/cli/src/complete.rs)

## R4: `answer` reads the words typed before the one completed

- **Decision**: after `ura answer <target>`, Tab completes that target's open questions, and nothing
  once a question is typed. The completer reads the earlier words from the request,
  `ura -- <words>`, with zsh's and bash's `_CLAP_COMPLETE_INDEX`.
- **Rationale**: clap gives a value completer the word being completed alone, while `answer`'s
  arguments are one list, `[target] <question> <answer>`. Without the earlier words, a named round
  completed another round's questions, or none.
- **Alternatives considered**: splitting `answer`'s arguments, which changes a public command.
- **If wrong**: a `clap_complete` upgrade that changes the request's words breaks it: a test sends a
  zsh request with its index, and a fish one.
- **Where**: [`crates/cli/src/complete.rs`](/crates/cli/src/complete.rs)
