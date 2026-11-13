//! The folders a human types in the add form: the server reads `~` as the home folder, since the
//! core takes absolute paths only, and suggests the folders a typed path starts.

use std::fs;
use std::path::{Path, PathBuf};

use uraeda_protocol::FolderSuggestion;

use crate::live::Fault;
use crate::shared::Shared;

/// At most this many folders are suggested.
const SUGGESTIONS: usize = 20;

/// The home folder, `HOME` in the server's environment.
pub(super) fn home(shared: &Shared) -> Option<PathBuf> {
    shared.environment().var("HOME").map(PathBuf::from)
}

/// The absolute folder a typed path names: `~` is the home folder, and a `/` at its end goes.
///
/// # Errors
///
/// `refused` for a path that starts with neither `/` nor `~`, or with `~` when no home is known.
pub(super) fn typed(text: &str, home: Option<&Path>) -> Result<PathBuf, Fault> {
    let from_home = text
        .strip_prefix('~')
        .filter(|rest| rest.is_empty() || rest.starts_with('/'));
    let folder = match (from_home, home) {
        (Some(rest), Some(home)) => format!("{}{rest}", home.display()),
        _ if text.starts_with('/') => text.to_owned(),
        _ => {
            return Err(Fault::refused(
                "Type an absolute path, starting with / or ~.",
            ));
        }
    };
    let folder = folder.trim_end_matches('/');
    Ok(PathBuf::from(if folder.is_empty() { "/" } else { folder }))
}

/// A path with the home folder written `~`, as the app shows it.
pub(super) fn home_path(path: &Path, home: Option<&Path>) -> String {
    match home.and_then(|home| path.strip_prefix(home).ok()) {
        Some(rest) if rest.as_os_str().is_empty() => "~".to_owned(),
        Some(rest) => format!("~/{}", rest.display()),
        None => path.display().to_string(),
    }
}

/// The folders whose path starts with the typed text, whatever the case of the last name: the
/// folder before the last `/` is listed, folders only, by name, at most 20. Hidden folders show
/// only when the name typed starts with `.`. Nothing is read beyond checking each for `.git`. A
/// text that is not absolute, or a folder that cannot be read, gets none.
pub(super) fn suggest(text: &str, home: Option<&Path>) -> Vec<FolderSuggestion> {
    let Some(slash) = text.rfind('/') else {
        return Vec::new();
    };
    let (prefix, start) = text.split_at(slash + 1);
    let start = start.to_lowercase();
    let Ok(parent) = typed(prefix, home) else {
        return Vec::new();
    };
    let Ok(entries) = fs::read_dir(&parent) else {
        return Vec::new();
    };
    let named = |name: &String| {
        name.to_lowercase().starts_with(&start)
            && (!name.starts_with('.') || start.starts_with('.'))
    };
    let names = entries.filter_map(|entry| entry.ok()?.file_name().into_string().ok());
    // `is_dir` follows a link to a folder.
    let mut folders: Vec<String> = names
        .filter(named)
        .filter(|name| parent.join(name).is_dir())
        .collect();
    folders.sort_unstable();
    folders.truncate(SUGGESTIONS);
    let suggestion = |name: String| FolderSuggestion {
        git: parent.join(&name).join(".git").symlink_metadata().is_ok(),
        path: format!("{prefix}{name}/"),
    };
    folders.into_iter().map(suggestion).collect()
}
