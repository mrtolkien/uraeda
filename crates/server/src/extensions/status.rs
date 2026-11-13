//! The extensions as the running server sees them, written to `run/extensions-status.json` in
//! the data folder for `ura extension list`: each one's state, what it waits for, and its
//! problems, its code's loading and compiling included, which only the server meets. An agent
//! reads it there after it wrote an extension.
//!
//! It is written whole, through a temporary file and a rename, with the server's process id,
//! by which the core reads a killed server's file as none, and removed as the server stops.

use std::fs;
use std::path::{Path, PathBuf};

use uraeda_core::extensions::status::{
    STATUS_FILE, STATUS_VERSION, ServerExtension, ServerProblem, ServerStatus,
};
use uraeda_core::today::rfc3339;
use uraeda_protocol::ExtensionState;

use super::Extensions;
use crate::shared::Shared;

fn path(data_dir: &Path) -> PathBuf {
    data_dir.join("run").join(STATUS_FILE)
}

/// A state as the file names it.
pub(crate) fn state_name(state: ExtensionState) -> &'static str {
    match state {
        ExtensionState::On => "on",
        ExtensionState::Off => "off",
        ExtensionState::Broken => "broken",
        ExtensionState::Waiting => "waiting",
    }
}

/// Writes the extensions as the server sees them now. A failure is printed: the file is a
/// convenience, and the record `Extensions` says the same.
pub(super) fn write(shared: &Shared, extensions: &Extensions) {
    let (_, shown) = extensions.shown(shared);
    let rows = shown.into_iter().map(|shown| {
        let problems = shown.problems.into_iter().map(|problem| ServerProblem {
            file: problem.file,
            line: problem.line,
            message: problem.message,
        });
        ServerExtension {
            name: shown.extension.name,
            state: state_name(shown.state).to_owned(),
            problems: problems.collect(),
            waiting_for: shown.waiting_for,
        }
    });
    let status = ServerStatus {
        version: STATUS_VERSION,
        pid: std::process::id(),
        at: rfc3339(shared.now()),
        extensions: rows.collect(),
    };
    let path = path(shared.data_dir());
    let temporary = path.with_extension(format!("{}.tmp", std::process::id()));
    let written = serde_json::to_vec_pretty(&status)
        .map_err(std::io::Error::other)
        .and_then(|text| fs::write(&temporary, text))
        .and_then(|()| fs::rename(&temporary, &path));
    if let Err(error) = written {
        say_err!("uraeda: the extensions' status file: {error}");
    }
}

/// Removes the file, as the server stops: a stopped server runs nothing it said.
pub(super) fn remove(data_dir: &Path) {
    let _ = fs::remove_file(path(data_dir));
}
