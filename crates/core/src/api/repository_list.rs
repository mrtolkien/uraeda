//! The list of repositories in Uraeda's data folder, which the server opens by name.

use std::path::{Path, PathBuf};
use std::time::SystemTime;

use super::Result;
use crate::repositories::{self, Color};
use crate::view::{AddedView, RepositoryView};

/// Uraeda's data folder: `custom` when set and not empty, else `URAEDA_DATA_DIR` from this
/// process's environment, else the operating system's default.
pub fn data_dir(custom: Option<&str>) -> String {
    custom
        .filter(|folder| !folder.is_empty())
        .map_or_else(repositories::default_data_dir, PathBuf::from)
        .to_string_lossy()
        .into_owned()
}

/// The list of repositories in `data_dir`, the most recently opened first.
pub fn read_repositories(data_dir: &Path) -> Result<Vec<RepositoryView>> {
    Ok(repositories::read(data_dir)?
        .into_iter()
        .map(RepositoryView::from)
        .collect())
}

/// Adds the git repository holding `folder`, an absolute path, to the list.
pub fn add_repository(data_dir: &Path, folder: &Path) -> Result<AddedView> {
    Ok(repositories::add(data_dir, folder, SystemTime::now())?.into())
}

/// Takes a repository off the list, leaving its folder and sessions as they are.
pub fn remove_repository(data_dir: &Path, name: &str) -> Result<()> {
    Ok(repositories::remove(data_dir, name)?)
}

/// Records that a repository was opened now.
pub fn open_repository(data_dir: &Path, name: &str) -> Result<RepositoryView> {
    Ok(repositories::touch(data_dir, name, SystemTime::now())?.into())
}

/// Sets the name and the colour a feature or a change of a repository shows in the sidebar, by its
/// folder: an empty name removes it.
pub fn set_item_settings(
    data_dir: &Path,
    name: &str,
    folder: &str,
    label: Option<String>,
    color: Option<Color>,
) -> Result<RepositoryView> {
    Ok(repositories::set_item(data_dir, name, folder, label, color)?.into())
}
