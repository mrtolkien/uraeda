//! Shared set-ups of the flows: the skill's example as a project, and repositories holding it.

use std::fs;
use std::path::{Path, PathBuf};

use tempfile::TempDir;

use crate::common::repo::TestRepo;

pub const FOLDER: &str = "2026-10-06-recurring-tasks";
pub const FEATURE: &str = "specs/2026-10-06-recurring-tasks";

/// The skill's example `specs/` folder, which is valid as written.
pub fn example() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../skills/uraeda/assets/example/specs")
}

pub fn copy(from: &Path, to: &Path) {
    fs::create_dir_all(to).unwrap();
    for entry in fs::read_dir(from).unwrap() {
        let entry = entry.unwrap();
        let target = to.join(entry.file_name());
        if entry.file_type().unwrap().is_dir() {
            copy(&entry.path(), &target);
        } else {
            fs::copy(entry.path(), target).unwrap();
        }
    }
}

/// A copy of the example `specs/` folder in a temporary folder, to break one rule at a time.
pub struct Example {
    dir: TempDir,
}

impl Example {
    pub fn new() -> Example {
        let dir = TempDir::new().unwrap();
        copy(&example(), &dir.path().join("specs"));
        Example { dir }
    }

    pub fn root(&self) -> &Path {
        self.dir.path()
    }

    pub fn read(&self, path: &str) -> String {
        fs::read_to_string(self.root().join(path)).unwrap()
    }

    pub fn write(&self, path: &str, text: &str) {
        let file = self.root().join(path);
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(file, text).unwrap();
    }

    /// Replaces the first `from` of a file by `to`, which the file must hold.
    pub fn edit(&self, path: &str, from: &str, to: &str) {
        let text = self.read(path);
        assert!(text.contains(from), "{path} has no {from:?}");
        self.write(path, &text.replacen(from, to, 1));
    }
}

/// Replaces the first `from` of a file in a repository by `to`, which the file must hold.
pub fn replace(repo: &TestRepo, path: &str, from: &str, to: &str) {
    let text = repo.read(path);
    assert!(text.contains(from), "{path} has no {from:?}");
    repo.write(path, &text.replacen(from, to, 1));
}

/// The example without its recurring-tasks feature and record, on `main`; the feature, valid, on
/// its own branch, checked out, with `edit` applied before its commit.
pub fn feature_repo(edit: impl FnOnce(&TestRepo)) -> TestRepo {
    let repo = TestRepo::new();
    copy(&example(), &repo.path().join("specs"));
    let folder = repo.path().join(FEATURE);
    let held = repo.parent().join("feature");
    fs::rename(&folder, &held).unwrap();
    fs::remove_file(repo.path().join(format!("specs/done/{FOLDER}.md"))).unwrap();
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    fs::rename(&held, &folder).unwrap();
    edit(&repo);
    repo.commit(&format!("plan({FOLDER}): the plan"));
    repo
}
