//! A feature's own run options: only what the feature or the change changed, kept in a file of
//! the data folder, and read over the settings' as they are at each read.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};

use uraeda_core::settings as core;
use uraeda_protocol::RunOptionsPair;
use uraeda_protocol::{RunOptions, RunPick, StepOptions};

use crate::live::Fault;
use crate::records::settings::{
    self,
    options::{given, left_to_agents, sent},
};
use crate::runtimes::Runtimes;
use crate::shared::Shared;

/// The file's name, in the data folder.
const FILE: &str = "run-options.json";

/// The file as stored: each repository's features' options, by its main checkout, then by the
/// feature's folder. Both are sorted, so the same options are the same text.
type Stored = BTreeMap<String, BTreeMap<String, RunOptions>>;

/// The features' own run options, in `run-options.json` of the data folder. A row holds only
/// what the feature changed, never a copy of the settings.
pub(super) struct Store {
    file: PathBuf,
    /// Held by the one read or write that runs.
    turn: Mutex<()>,
}

impl Store {
    /// The store of a data folder: its file is made at the first write.
    pub(super) fn new(data_dir: &Path) -> Store {
        Store {
            file: data_dir.join(FILE),
            turn: Mutex::default(),
        }
    }

    /// A feature's own options, of the repository whose main checkout is `root`: none set when
    /// it never changed any, and when the file cannot be read, which is printed.
    pub(super) fn own(&self, root: &Path, folder: &str) -> RunOptions {
        let _turn = self.turn.lock().unwrap_or_else(PoisonError::into_inner);
        let stored = self.read().unwrap_or_else(|problem| {
            say_err!("uraeda: {problem}");
            Stored::new()
        });
        let own = stored.get(&key(root)).and_then(|rows| rows.get(folder));
        own.cloned().unwrap_or_default()
    }

    /// Keeps a feature's own options, as the core reads them: each step once, and only what
    /// sets something. Options that set nothing remove the feature's row.
    ///
    /// # Errors
    ///
    /// `refused` for options the core refuses, and `internal` when the file cannot be read or
    /// written: a file that cannot be read is never replaced.
    pub(super) fn set(&self, root: &Path, folder: &str, options: RunOptions) -> Result<(), Fault> {
        let options = normalized(options)?;
        let _turn = self.turn.lock().unwrap_or_else(PoisonError::into_inner);
        let mut stored = self.read().map_err(Fault::internal)?;
        let rows = stored.entry(key(root)).or_default();
        match options == RunOptions::default() {
            true => rows.remove(folder),
            false => rows.insert(folder.to_owned(), options),
        };
        stored.retain(|_, rows| !rows.is_empty());
        self.write(&stored).map_err(Fault::internal)
    }

    /// The file's rows: none before its first write.
    fn read(&self) -> Result<Stored, String> {
        let problem = |error: &dyn std::fmt::Display| format!("{FILE} could not be read: {error}");
        match fs::read_to_string(&self.file) {
            Ok(text) => serde_json::from_str(&text).map_err(|error| problem(&error)),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(Stored::new()),
            Err(error) => Err(problem(&error)),
        }
    }

    /// Writes the file whole, beside it first, so a reader never sees half of it.
    fn write(&self, stored: &Stored) -> Result<(), String> {
        let problem =
            |error: &dyn std::fmt::Display| format!("{FILE} could not be written: {error}");
        let text = serde_json::to_string_pretty(stored).map_err(|error| problem(&error))?;
        let beside = self.file.with_extension("json.new");
        fs::write(&beside, text + "\n").map_err(|error| problem(&error))?;
        fs::rename(&beside, &self.file).map_err(|error| problem(&error))
    }
}

/// A repository's key in the file: its main checkout.
fn key(root: &Path) -> String {
    root.to_string_lossy().into_owned()
}

/// The options as the core reads them, merged over none: each step once, an empty reviewers'
/// list gone, checked, then without the tables that set nothing.
fn normalized(options: RunOptions) -> Result<RunOptions, Fault> {
    let merged = core::merge_run_options(&core::RunOptions::default(), &given(options));
    core::check_run_options(&merged)?;
    let mut options = sent(merged);
    options.steps.retain(|step| {
        let StepOptions {
            step: _,
            agent,
            model,
            effort,
            new_session,
        } = step;
        agent.is_some() || model.is_some() || effort.is_some() || new_session.is_some()
    });
    options
        .implementers
        .take_if(|pick| *pick == RunPick::default());
    Ok(options)
}

/// A feature's run options: its own, and the core's merge of them over the settings'.
pub(super) fn pair(shared: &Shared, root: &Path, folder: &str) -> RunOptionsPair {
    let own = shared.get::<Store>().own(root, folder);
    let merged = core::merge_run_options(&defaults(shared), &given(own.clone()));
    RunOptionsPair {
        own,
        merged: sent(merged),
    }
}

/// The run options a feature's next run starts on: its own over the settings', as they are now.
pub(crate) fn run_options(shared: &Shared, root: &Path, folder: &str) -> core::RunOptions {
    let own = shared.get::<Store>().own(root, folder);
    core::merge_run_options(&defaults(shared), &given(own))
}

/// The settings' run options in force, which a feature's own are read over.
fn defaults(shared: &Shared) -> core::RunOptions {
    given(settings::current(shared).runs.options)
}

/// Keeps a feature's own options, as a client sends them: a model or an effort left to the
/// agent's own default is kept as that default where the settings set another
/// (`left_to_agents`).
///
/// # Errors
///
/// As [`Store::set`].
pub(super) fn keep(
    shared: &Shared,
    root: &Path,
    folder: &str,
    options: RunOptions,
) -> Result<(), Fault> {
    let options = over_settings(shared, options);
    shared.get::<Store>().set(root, folder, options)
}

/// Options a client sends, as kept over the settings' as they are now.
fn over_settings(shared: &Shared, options: RunOptions) -> RunOptions {
    left_to_agents(options, &defaults(shared), &shared.get::<Runtimes>())
}

/// Options checked and normalized as the store keeps them, over the settings' as they are now:
/// what a feature with those options would run on, for options not kept yet. Options the store
/// would refuse set nothing.
pub(super) fn over(shared: &Shared, options: RunOptions) -> core::RunOptions {
    let own = normalized(over_settings(shared, options)).unwrap_or_default();
    core::merge_run_options(&defaults(shared), &given(own))
}

/// Refuses run options the store would refuse, before anything is written for them.
pub(super) fn check(shared: &Shared, options: RunOptions) -> Result<(), Fault> {
    normalized(over_settings(shared, options)).map(|_| ())
}
