//! Tells Cargo to build a crate again when a folder it embeds with `include_dir` changes: every
//! file and folder under it, as `include_dir` reads them and does not tell Cargo. Shared by the
//! build scripts of `uraeda-core`.

use std::fs;
use std::path::Path;

/// `cargo:rerun-if-changed` for `folder`, relative to the crate, and everything under it: a file
/// changed, added, or removed anywhere in it builds the crate again.
pub fn track(folder: &str) {
    walk(Path::new(folder));
}

fn walk(path: &Path) {
    println!("cargo:rerun-if-changed={}", path.display());
    let Ok(entries) = fs::read_dir(path) else {
        return;
    };
    for entry in entries.flatten() {
        walk(&entry.path());
    }
}
