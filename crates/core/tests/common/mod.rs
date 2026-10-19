#![allow(
    dead_code,
    reason = "each test binary uses only part of the shared helpers"
)]

pub mod repo;
pub mod texts;

use std::path::PathBuf;

/// A path inside the repository's shared `fixtures/` folder.
pub fn fixture(path: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../fixtures")
        .join(path)
}

/// A path of this repository, from its top level.
pub fn repository_path(path: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join(path)
}

/// A file of this repository, from its top level.
pub fn repository_file(path: &str) -> String {
    std::fs::read_to_string(repository_path(path)).unwrap()
}
