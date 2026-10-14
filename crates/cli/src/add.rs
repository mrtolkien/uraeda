//! `ura add`: adds the git repository holding a folder to the web UI's list.

use std::path::PathBuf;
use std::process::ExitCode;
use std::time::SystemTime;

use uraeda_core::repositories::{self, ListError};

/// Adds the repository holding `folder`, the current folder by default; a relative folder joins
/// the current one.
pub fn run(folder: Option<PathBuf>) -> Result<ExitCode, String> {
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    let folder = folder.map_or_else(|| cwd.clone(), |folder| cwd.join(folder));
    let added = repositories::add(
        &repositories::default_data_dir(),
        &folder,
        SystemTime::now(),
    )
    .map_err(|error| match error {
        ListError::NotARepository(path) => format!(
            "{}: not in a git repository: run git init first",
            path.display()
        ),
        error => error.to_string(),
    })?;
    let repository = added.repository;
    let path = repository.path.display();
    if added.existed {
        eprintln!("{} is already added: {path}", repository.name);
    } else {
        eprintln!("added {}: {path}", repository.name);
    }
    Ok(ExitCode::SUCCESS)
}
