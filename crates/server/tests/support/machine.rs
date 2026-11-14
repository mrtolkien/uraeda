//! The machine's commands no test's server runs, which use their owner's accounts: the agents,
//! and `gh`.
//!
//! The built-in runtimes ask their agent for its models as the server starts, and the pull
//! requests' refresh asks `gh` for each listed repository, so a test's server that found the
//! machine's `claude`, `codex`, or `gh` would start it, from every test. Each test's server
//! has instead a folder of its own, first on its `PATH` after the test's own commands, which
//! holds a stand-in under each of those names: `no-agents/stand-in`, which writes down that it
//! was asked and fails at once, as a command that is not installed.
//!
//! This is the one home of that rule: `support::setup()` builds the `PATH` of every server of
//! this crate's tests from here, and `crates/cli/tests/serve.rs` the one of its `ura serve-app`.

use std::fs;
use std::os::unix::fs::{PermissionsExt, symlink};
use std::path::{Path, PathBuf};

/// The agents' commands, which every server asks for their models as it starts.
pub const AGENTS: [&str; 2] = ["claude", "codex"];

/// The commands a test's server never finds on the machine: the agents', and `gh`.
pub const COMMANDS: [&str; 3] = ["claude", "codex", "gh"];

/// The stand-in every one of them is. The server's crate and the CLI's are in one folder.
const STAND_IN: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../server/tests/support/no-agents/stand-in"
);

/// Fills a new folder with a stand-in for each of [`COMMANDS`]. They are links: a script
/// written here and run at once can be refused as busy, while another thread starts a process.
pub fn stand_ins(dir: &Path) {
    for command in COMMANDS {
        symlink(STAND_IN, dir.join(command)).expect("a link to the stand-in");
    }
}

/// The `PATH` of a test's server: the folders of the test's own commands, then the stand-ins,
/// then the machine's, where everything else is found as the test finds it.
pub fn path(commands: &[PathBuf], stand_ins: &Path) -> String {
    let machine = std::env::var("PATH").unwrap_or_default();
    let folders = commands.iter().map(|dir| dir.display().to_string());
    let folders = folders.chain([stand_ins.display().to_string(), machine]);
    folders.collect::<Vec<_>>().join(":")
}

/// What the stand-ins of a folder were asked so far, a line each: `codex debug models`.
pub fn asked(stand_ins: &Path) -> Vec<String> {
    let asked = fs::read_to_string(stand_ins.join("asked")).unwrap_or_default();
    asked.lines().map(str::to_owned).collect()
}

/// The file a `PATH` finds for a command, as a process started with it does.
pub fn found(path: &str, command: &str) -> Option<PathBuf> {
    let files = path.split(':').map(|dir| Path::new(dir).join(command));
    let runs = |file: &PathBuf| {
        let mode = fs::metadata(file).map(|file| file.permissions().mode());
        file.is_file() && mode.is_ok_and(|mode| mode & 0o111 != 0)
    };
    files.into_iter().find(runs)
}
