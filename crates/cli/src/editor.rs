//! Opening a file in the user's editor: `$VISUAL`, then `$EDITOR`, then `vi`, run through the
//! shell, as git does.

use std::io::IsTerminal;
use std::path::Path;
use std::process::Command;

/// Whether an editor can run: stdin and stdout are a terminal that is not `dumb`.
pub fn available() -> bool {
    std::io::stdin().is_terminal()
        && std::io::stdout().is_terminal()
        && std::env::var("TERM").map_or(true, |term| term != "dumb")
}

fn command() -> String {
    ["VISUAL", "EDITOR"]
        .iter()
        .filter_map(|name| std::env::var(name).ok())
        .find(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "vi".to_string())
}

/// Opens a file in the editor, and waits for it. `false` when no editor could run.
pub fn open(path: &Path) -> bool {
    let editor = command();
    Command::new("/bin/sh")
        .args(["-c", &format!("{editor} \"$@\""), "sh"])
        .arg(path)
        .status()
        .is_ok_and(|status| status.success())
}
