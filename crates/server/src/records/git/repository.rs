//! A repository of the server's list, by the name a record or an action gives.

use std::path::PathBuf;

use uraeda_core::repositories::{self, Repository};

use crate::live::Fault;
use crate::shared::Shared;

/// The main checkout of the repository named `name` in the server's list.
///
/// # Errors
///
/// `refused` for a name the list lacks, or a list that cannot be read.
// JOIN(wave 6): repositories, a repository of the list by its name
pub(super) fn path(shared: &Shared, name: &str) -> Result<PathBuf, Fault> {
    let unknown = || Fault::refused(format!("no repository is named `{name}`"));
    let mut listed = repositories::read(shared.data_dir())?.into_iter();
    let found = listed.find(|repository| repository.name == name);
    found.map(|repository| repository.path).ok_or_else(unknown)
}

/// The list's repositories whose main checkout is still there: none when the list cannot be
/// read.
// JOIN(wave 6): repositories, the list
pub(super) fn all(shared: &Shared) -> Vec<Repository> {
    let listed = repositories::read(shared.data_dir()).unwrap_or_default();
    let there = listed.into_iter().filter(|repository| !repository.missing);
    there.collect()
}
