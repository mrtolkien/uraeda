//! Whether a command can ask: the one check every TUI and editor of `ura` runs first.

use std::io::IsTerminal;

/// Whether `ura` can ask the user: stdin and stdout are a terminal that is not `dumb`, and
/// `--no-input` is not set.
pub fn interactive(no_input: bool) -> bool {
    !no_input
        && std::io::stdin().is_terminal()
        && std::io::stdout().is_terminal()
        && std::env::var("TERM").map_or(true, |term| term != "dumb")
}
