//! The fixtures shared with the TypeScript tests, in `fixtures/` at the repository's root, and
//! the git repository built from them.

use std::fs;
use std::path::{Path, PathBuf};

use super::repo::{TestRepo, without_user_git_config};

/// A path of `fixtures/`.
pub fn fixture(path: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../fixtures")
        .join(path)
}

/// A fixture file's text, by its path under `fixtures/`.
pub fn fixture_text(path: &str) -> String {
    fs::read_to_string(fixture(path)).expect("a fixture")
}

/// A git repository named `name`, built from `fixtures/repo/`: `main/` committed on `main`, then
/// each folder of `branches/` committed on a branch of its name, from `main`. The checkout is
/// left on `main`. The git the test's process runs, through the core, is kept away from the
/// machine's configuration.
pub fn fixture_repo(name: &str) -> TestRepo {
    without_user_git_config();
    let repo = TestRepo::named(name);
    copy(&fixture("repo/main"), repo.path());
    repo.commit("chore: specs");
    let mut branches: Vec<PathBuf> = fs::read_dir(fixture("repo/branches"))
        .expect("the fixture's branches")
        .map(|entry| entry.expect("a branch").path())
        .collect();
    branches.sort();
    for branch in branches {
        let name = branch.file_name().and_then(|name| name.to_str());
        let name = name.expect("a branch's name");
        repo.git(&["switch", "--quiet", "--create", name, "main"]);
        copy(&branch, repo.path());
        repo.commit(&format!("work on {name}"));
        repo.switch("main");
    }
    repo
}

/// Copies a folder's files into another, folder by folder.
fn copy(from: &Path, to: &Path) {
    fs::create_dir_all(to).expect("a folder");
    for entry in fs::read_dir(from).expect("a fixture's folder") {
        let entry = entry.expect("a fixture's file");
        let target = to.join(entry.file_name());
        if entry.path().is_dir() {
            copy(&entry.path(), &target);
        } else {
            fs::copy(entry.path(), target).expect("a copied file");
        }
    }
}
