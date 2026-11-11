//! The list of repositories, `repositories.json` in the data folder, as the server last read it
//! through the core: how every domain finds a repository by its name, the record `Repositories`,
//! and the list's actions.
//!
//! The list is read as the server starts, after each action that writes it, each time its file
//! changes on disk, as `ura add` or a hand edit changes it, and when a name asked for is not in
//! it, or its folder came or went since.

use std::path::PathBuf;
use std::sync::Mutex;

use uraeda_core::repositories::{self, ListError};
use uraeda_protocol::{
    FolderSuggestions, NeedsYouList, Repositories, RepositoriesAdd, RepositoriesAdded,
    RepositoriesOpen, RepositoriesRemove, RepositoryRow, Workspace,
};

pub(crate) use uraeda_core::repositories::Repository;

use super::folders;
use crate::live::{Bus, Call, Fault, Registry, locked};
use crate::runner::Runner;
use crate::shared::Shared;

/// What is told each time the list changes.
type Listener = Box<dyn Fn() + Send + Sync>;

/// The list, as last read.
#[derive(Default)]
pub(crate) struct List {
    read: Mutex<Read>,
    /// Held by the one reload that runs.
    reloading: Mutex<()>,
    listeners: Mutex<Vec<Listener>>,
}

/// What the last read gave.
#[derive(Clone, Default, PartialEq, Eq)]
struct Read {
    /// The repositories, the most recently opened first: the last read that worked.
    rows: Vec<Repository>,
    /// Why the file could not be read at its last read.
    problem: Option<String>,
}

/// Reads the list, and registers its records and actions.
pub(super) fn register(shared: &Shared, registry: &Registry) {
    shared.provide(List::default());
    reload(shared);
    // Read again on each read, so a folder moved away or back since shows as it is now.
    registry.record::<Repositories>(|shared, ()| {
        reload(shared);
        Ok(record(shared))
    });
    registry.record::<FolderSuggestions>(|shared, args| {
        unlocked(shared)?;
        let rows = folders::suggest(&args.text, folders::home(shared).as_deref());
        Ok(FolderSuggestions { rows })
    });
    registry.action::<RepositoriesAdd>(add);
    registry.action::<RepositoriesOpen>(open);
    registry.action::<RepositoriesRemove>(remove);
}

/// The listed repository of a name, its folder there: what every record and action of one
/// repository starts from. Its `path` is its main checkout.
///
/// # Errors
///
/// `refused` for a name the list does not have, and for a repository whose folder no longer
/// holds its main checkout.
pub(crate) fn find(shared: &Shared, name: &str) -> Result<Repository, Fault> {
    let list = shared.get::<List>();
    // A main checkout holds `.git`: a name not listed, or a folder that came or went since the
    // last read, reads the list again, where the core says which folder is missing.
    let stale = |row: &Option<Repository>| {
        let now_there = |row: &Repository| row.path.join(".git").exists();
        row.as_ref().is_none_or(|row| row.missing == now_there(row))
    };
    let mut row = list.row(name);
    if stale(&row) {
        reload(shared);
        row = list.row(name);
    }
    match row {
        None => Err(ListError::Unknown(name.to_owned()).into()),
        Some(row) if row.missing => {
            let folder = row.path.display();
            Err(Fault::refused(format!(
                "{name} is no longer at {folder}: move it back, or remove it from the list."
            )))
        }
        Some(row) => Ok(row),
    }
}

/// The main checkout of the listed repository of a name: [`find`], for what needs its folder
/// alone.
///
/// # Errors
///
/// As [`find`].
pub(crate) fn path(shared: &Shared, name: &str) -> Result<PathBuf, Fault> {
    Ok(find(shared, name)?.path)
}

/// Every listed repository, the most recently opened first, as last read: one whose folder is
/// gone is `missing`.
pub(crate) fn all(shared: &Shared) -> Vec<Repository> {
    locked(&shared.get::<List>().read).rows.clone()
}

/// Reads the list again, after a write of its file: the list's own actions do, and a domain that
/// writes the list through the core does too, so its answer comes after the list holds the change.
/// A file that cannot be read keeps the repositories as they were, and is the list's problem.
pub(crate) fn reload(shared: &Shared) {
    let list = shared.get::<List>();
    let changed = {
        let _turn = locked(&list.reloading);
        let read = repositories::read(shared.data_dir());
        let mut held = locked(&list.read);
        let before = held.clone();
        match read {
            Ok(rows) => {
                *held = Read {
                    rows,
                    problem: None,
                }
            }
            Err(error) => held.fails(error.to_string()),
        }
        *held != before
    };
    if changed {
        // The listeners first: a client that learns of a repository finds it already watched.
        locked(&list.listeners).iter().for_each(|tell| tell());
        announce(shared);
    }
}

/// Says on the bus that the list changed: the list itself, each repository's workspace, which
/// carries the names of its items, and what needs the human across them.
fn announce(shared: &Shared) {
    let bus = shared.get::<Bus>();
    bus.changed::<Repositories>(&());
    bus.changed_all::<Workspace>();
    bus.changed::<NeedsYouList>(&());
}

/// Calls `listener` each time the list changes, before the bus is told: a repository added,
/// removed, opened, renamed by hand, one whose folder came or went, or an item's name.
pub(crate) fn on_change(shared: &Shared, listener: impl Fn() + Send + Sync + 'static) {
    locked(&shared.get::<List>().listeners).push(Box::new(listener));
}

/// The name the human gave a feature or a change of a repository in the sidebar, by its folder.
/// No workflow rule reads it.
pub(crate) fn label(repository: &Repository, folder: &str) -> Option<String> {
    repository.items.get(folder)?.label.clone()
}

/// Forgets the listeners, as the server stops: one may hold what holds the list.
pub(crate) fn close(shared: &Shared) {
    locked(&shared.get::<List>().listeners).clear();
}

impl List {
    /// The repository of a name, as last read.
    fn row(&self, name: &str) -> Option<Repository> {
        let read = locked(&self.read);
        read.rows.iter().find(|row| row.name == name).cloned()
    }
}

impl Read {
    /// The file could not be read: the rows stay, and the problem is printed once.
    fn fails(&mut self, problem: String) {
        if self.problem.as_ref() != Some(&problem) {
            eprintln!("uraeda: {problem}");
        }
        self.problem = Some(problem);
    }
}

/// The value of the record `Repositories`.
fn record(shared: &Shared) -> Repositories {
    let home = folders::home(shared);
    let read = locked(&shared.get::<List>().read).clone();
    let row = |repository: Repository| RepositoryRow {
        id: repository.name.clone(),
        name: repository.name,
        home: folders::home_path(&repository.path, home.as_deref()),
        path: repository.path.to_string_lossy().into_owned(),
        missing: repository.missing,
    };
    Repositories {
        rows: read.rows.into_iter().map(row).collect(),
        problem: read.problem,
    }
}

/// Refuses a change of the list, and a look at the machine's folders, on a server whose list is
/// locked: the sandbox's, which serves its sample projects alone.
fn unlocked(shared: &Shared) -> Result<(), Fault> {
    match shared.find::<crate::sandbox::Mode>() {
        Some(_) => Err(Fault::refused("this server's list is locked")),
        None => Ok(()),
    }
}

/// The action `repositories.add`: lists the git repository holding a typed folder, or opens it
/// when it is listed, and answers its name.
fn add(call: &Call, input: RepositoriesAdd) -> Result<RepositoriesAdded, Fault> {
    let shared = call.shared();
    unlocked(shared)?;
    let folder = folders::typed(&input.folder, folders::home(shared).as_deref())?;
    let added = repositories::add(shared.data_dir(), &folder, shared.now())?;
    reload(shared);
    Ok(RepositoriesAdded {
        name: added.repository.name,
    })
}

/// The action `repositories.open`: the repository was opened now, and moves first.
fn open(call: &Call, input: RepositoriesOpen) -> Result<(), Fault> {
    let shared = call.shared();
    unlocked(shared)?;
    repositories::touch(shared.data_dir(), &input.name, shared.now())?;
    reload(shared);
    Ok(())
}

/// The action `repositories.remove`: takes a repository off the list, and leaves its folder and
/// its sessions as they are. Refused while an agent works in it: its run would show nowhere.
fn remove(call: &Call, input: RepositoriesRemove) -> Result<(), Fault> {
    let shared = call.shared();
    unlocked(shared)?;
    let listed = locked(&shared.get::<List>().read).rows.clone();
    let row = listed.into_iter().find(|row| row.name == input.name);
    let busy = row
        .zip(Runner::find(shared))
        .is_some_and(|(row, runner)| runner.busy(&row.path.to_string_lossy()));
    if busy {
        let name = &input.name;
        let refusal = format!("An agent is working in {name}: stop it first.");
        return Err(Fault::refused(refusal));
    }
    repositories::remove(shared.data_dir(), &input.name)?;
    reload(shared);
    Ok(())
}
