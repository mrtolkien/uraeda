#![allow(dead_code)]

pub mod repo;

use std::path::PathBuf;

use uraeda_core::temporary_status::{FileStatus, FolderStatus};

/// A path inside the repository's shared `fixtures/` folder.
pub fn fixture(path: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../fixtures")
        .join(path)
}

// TEMPORARY: replaced by the CLI feature.
/// Each file of a folder with its status, or `invalid: ` and its problem, as `ura status` shows it.
pub fn summary(folder: &FolderStatus) -> Vec<(String, String)> {
    folder
        .files
        .iter()
        .map(|file| (file.file.clone(), describe(file)))
        .collect()
}

fn describe(file: &FileStatus) -> String {
    match (&file.status, &file.problem) {
        (Some(status), _) => status.as_str().to_string(),
        (None, Some(problem)) => format!("invalid: {problem}"),
        (None, None) => panic!("{} has neither a status nor a problem", file.file),
    }
}

// TEMPORARY: replaced by the CLI feature.
pub fn rows(pairs: &[(&str, &str)]) -> Vec<(String, String)> {
    pairs
        .iter()
        .map(|(file, status)| (file.to_string(), status.to_string()))
        .collect()
}

/// A file of this repository, from its top level.
pub fn repository_file(path: &str) -> String {
    std::fs::read_to_string(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .join(path),
    )
    .unwrap()
}
