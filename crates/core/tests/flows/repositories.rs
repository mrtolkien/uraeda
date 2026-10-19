//! The repositories decision's rules: the list is data in the data folder, holds each main checkout
//! once under a unique name, and removing an entry never touches the repository.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tempfile::TempDir;
use uraeda_core::repositories::{self, Color, ItemSettings};

use crate::common::repo::TestRepo;

fn at(hours: u64) -> SystemTime {
    UNIX_EPOCH + Duration::from_secs(1_790_000_000 + hours * 3600)
}

fn paths(data: &Path) -> Vec<PathBuf> {
    repositories::read(data)
        .unwrap()
        .into_iter()
        .map(|repository| repository.path)
        .collect()
}

#[test]
fn a_repository_is_listed_once_by_its_main_checkout() {
    let data = TempDir::new().unwrap();
    let repo = TestRepo::named("todo-app");
    repo.write("src/main.rs", "fn main() {}\n");
    repo.git(&["worktree", "add", "--quiet", "-b", "x", ".worktrees/x"]);

    let from_folder = repositories::add(data.path(), &repo.path().join("src"), at(0)).unwrap();
    let from_worktree =
        repositories::add(data.path(), &repo.path().join(".worktrees/x"), at(1)).unwrap();

    assert_eq!(from_folder.repository.path, repo.path());
    assert!(!from_folder.existed);
    assert!(from_worktree.existed, "a worktree is its main checkout");
    assert_eq!(paths(data.path()), [repo.path()]);
}

#[test]
fn names_are_unique_and_the_latest_opened_comes_first() {
    let data = TempDir::new().unwrap();
    let (first, second) = (TestRepo::named("todo-app"), TestRepo::named("todo-app"));

    let one = repositories::add(data.path(), first.path(), at(0)).unwrap();
    let two = repositories::add(data.path(), second.path(), at(1)).unwrap();

    assert_ne!(one.repository.name, two.repository.name);
    assert_eq!(paths(data.path()), [second.path(), first.path()]);
    repositories::touch(data.path(), &one.repository.name, at(2)).unwrap();
    assert_eq!(paths(data.path()), [first.path(), second.path()]);
}

#[test]
fn adds_at_the_same_moment_all_stay() {
    let data = TempDir::new().unwrap();
    let repos: Vec<TestRepo> = (0..6).map(|_| TestRepo::named("app")).collect();

    std::thread::scope(|scope| {
        for repo in &repos {
            scope.spawn(|| repositories::add(data.path(), repo.path(), at(0)).unwrap());
        }
    });

    let list = repositories::read(data.path()).unwrap();
    let mut names: Vec<_> = list.iter().map(|r| r.name.clone()).collect();
    names.sort();
    names.dedup();
    assert_eq!(list.len(), repos.len());
    assert_eq!(names.len(), repos.len(), "every name is unique");
}

#[test]
fn a_folder_that_is_not_a_repository_is_refused() {
    let data = TempDir::new().unwrap();
    let plain = TempDir::new().unwrap();

    assert!(repositories::add(data.path(), plain.path(), at(0)).is_err());
    assert!(repositories::add(data.path(), &plain.path().join("missing"), at(0)).is_err());
    assert!(repositories::read(data.path()).unwrap().is_empty());
}

#[test]
fn removing_a_repository_leaves_its_files_alone() {
    let data = TempDir::new().unwrap();
    let repo = TestRepo::named("todo-app");
    repositories::add(data.path(), repo.path(), at(0)).unwrap();
    assert_eq!(
        repo.porcelain(),
        "",
        "listing a repository writes nothing in it"
    );

    repositories::remove(data.path(), "todo-app").unwrap();

    assert!(paths(data.path()).is_empty());
    assert_eq!(repo.read("README.md"), "# Test\n");
    assert_eq!(repo.porcelain(), "");
    assert!(repositories::remove(data.path(), "todo-app").is_err());
}

#[test]
fn a_folder_deleted_since_is_listed_as_missing() {
    let data = TempDir::new().unwrap();
    let repo = TestRepo::named("gone");
    repositories::add(data.path(), repo.path(), at(0)).unwrap();
    fs::remove_dir_all(repo.path()).unwrap();

    let list = repositories::read(data.path()).unwrap();

    assert!(list[0].missing);
}

#[test]
fn a_list_that_cannot_be_read_is_refused_and_kept() {
    let repo = TestRepo::named("todo-app");
    for broken in ["{not json", r#"{"version": 2, "repositories": []}"#] {
        let data = TempDir::new().unwrap();
        let file = data.path().join("repositories.json");
        fs::write(&file, broken).unwrap();

        assert!(repositories::read(data.path()).is_err());
        assert!(repositories::add(data.path(), repo.path(), at(0)).is_err());
        assert_eq!(fs::read_to_string(&file).unwrap(), broken, "{broken}");
    }
}

#[test]
fn the_list_is_plain_json_in_the_data_folder_only() {
    let data = TempDir::new().unwrap();
    let folder = data.path().join("share/uraeda");
    let repo = TestRepo::named("todo-app");

    repositories::add(&folder, repo.path(), at(0)).unwrap();

    let text = fs::read_to_string(folder.join("repositories.json")).unwrap();
    let json: serde_json::Value = serde_json::from_str(&text).unwrap();
    assert_eq!(json["version"], 1);
    assert_eq!(
        json["repositories"][0]["path"],
        repo.path().to_str().unwrap()
    );
    let files: Vec<_> = fs::read_dir(&folder).unwrap().collect();
    assert_eq!(files.len(), 1, "no temporary file is left behind");
    assert_eq!(repo.porcelain(), "");
}

#[test]
fn the_ui_presentation_of_an_item_is_kept_apart_from_the_repository() {
    let data = TempDir::new().unwrap();
    let repo = TestRepo::named("todo-app");
    repositories::add(data.path(), repo.path(), at(0)).unwrap();
    let folder = "2026-10-16-redesign-interface";
    let settings = ItemSettings {
        label: Some("Redesign".into()),
        color: Some(Color::Blue),
    };

    repositories::set_item(
        data.path(),
        "todo-app",
        folder,
        settings.label.clone(),
        settings.color,
    )
    .unwrap();

    let list = repositories::read(data.path()).unwrap();
    assert_eq!(list[0].items.get(folder), Some(&settings));
    assert_eq!(
        repo.porcelain(),
        "",
        "the label is not written in the repository"
    );
    repositories::set_item(data.path(), "todo-app", folder, None, None).unwrap();
    assert!(repositories::read(data.path()).unwrap()[0].items.is_empty());
}

#[test]
fn the_data_folder_follows_the_platform() {
    type Case = (
        &'static [(&'static str, &'static str)],
        &'static str,
        &'static str,
    );
    let cases: [Case; 5] = [
        (&[("URAEDA_DATA_DIR", "/data")], "linux", "/data"),
        (&[("XDG_DATA_HOME", "/xdg")], "linux", "/xdg/uraeda"),
        (&[], "linux", "/home/me/.local/share/uraeda"),
        (&[], "macos", "/home/me/Library/Application Support/uraeda"),
        (
            &[("URAEDA_DATA_DIR", "/data"), ("XDG_DATA_HOME", "/xdg")],
            "macos",
            "/data",
        ),
    ];
    for (vars, os, expected) in cases {
        let var = |name: &str| {
            vars.iter()
                .find(|(key, _)| *key == name)
                .map(|(_, value)| value.to_string())
        };

        let folder = repositories::data_dir(var, os, Path::new("/home/me"));

        assert_eq!(folder, PathBuf::from(expected), "{vars:?} on {os}");
    }
}
