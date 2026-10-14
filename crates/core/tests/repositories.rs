mod common;

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use common::repo::{TestRepo, run_git};
use tempfile::TempDir;
use uraeda_core::repositories::{self, ListError, Repository};

fn tempdir() -> TempDir {
    TempDir::new().expect("a temporary folder")
}

/// An RFC 3339 instant in UTC, `2026-10-14T09:00:00Z`, as a time.
fn at(text: &str) -> SystemTime {
    let number = |range: std::ops::Range<usize>| text[range].parse::<i64>().unwrap();
    let (year, month, day) = (number(0..4), number(5..7), number(8..10));
    // Howard Hinnant's days-from-civil algorithm.
    let year = if month <= 2 { year - 1 } else { year };
    let era = year.div_euclid(400);
    let year_of_era = year - era * 400;
    let day_of_year = (153 * ((month + 9) % 12) + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    let days = era * 146_097 + day_of_era - 719_468;
    let seconds = days * 86_400 + number(11..13) * 3600 + number(14..16) * 60 + number(17..19);
    UNIX_EPOCH + Duration::from_secs(seconds as u64)
}

/// A new git repository at `path`, its parents created.
fn git_init(path: &Path) -> PathBuf {
    fs::create_dir_all(path).unwrap();
    run_git(path, &["init", "--quiet"]);
    fs::canonicalize(path).unwrap()
}

fn names(data: &Path) -> Vec<String> {
    repositories::read(data)
        .unwrap()
        .into_iter()
        .map(|repository| repository.name)
        .collect()
}

#[test]
fn a_missing_file_is_an_empty_list() {
    let data = tempdir();

    let list = repositories::read(data.path()).unwrap();

    assert_eq!(list, Vec::<Repository>::new());
}

#[test]
fn adding_a_subfolder_adds_the_main_checkout() {
    let (data, repo) = (tempdir(), TestRepo::named("todo-app"));
    repo.write("src/main.rs", "fn main() {}\n");

    let added = repositories::add(
        data.path(),
        &repo.path().join("src"),
        at("2026-10-14T09:00:00Z"),
    )
    .unwrap();

    assert_eq!(
        (
            added.repository.name.as_str(),
            added.repository.path.as_path(),
            added.existed
        ),
        ("todo-app", repo.path(), false)
    );
}

#[test]
fn adding_a_worktree_adds_its_main_checkout() {
    let (data, repo) = (tempdir(), TestRepo::named("uraeda"));
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        "-b",
        "2026-10-14-x",
        ".worktrees/2026-10-14-x",
    ]);

    let added = repositories::add(
        data.path(),
        &repo.path().join(".worktrees/2026-10-14-x"),
        at("2026-10-14T09:00:00Z"),
    )
    .unwrap();

    assert_eq!(
        (
            added.repository.name.as_str(),
            added.repository.path.as_path()
        ),
        ("uraeda", repo.path())
    );
}

#[test]
fn adding_twice_keeps_one_entry_and_touches_it() {
    let (data, repo) = (tempdir(), TestRepo::named("todo-app"));
    repositories::add(data.path(), repo.path(), at("2026-10-14T09:00:00Z")).unwrap();

    let added = repositories::add(data.path(), repo.path(), at("2026-10-14T11:00:00Z")).unwrap();

    assert_eq!(
        (added.existed, added.repository.opened_at.as_str()),
        (true, "2026-10-14T11:00:00Z")
    );
    let list = repositories::read(data.path()).unwrap();
    assert_eq!(
        list,
        vec![Repository {
            name: "todo-app".into(),
            path: repo.path().into(),
            opened_at: "2026-10-14T11:00:00Z".into(),
            missing: false,
        }]
    );
}

#[test]
fn names_are_unique() {
    let cases: [(&[&str], &str, &str); 4] = [
        (&[], "dev/todo-app", "todo-app"),
        (&["dev/todo-app"], "work/todo-app", "work-todo-app"),
        (
            &["dev/todo-app", "work/todo-app"],
            "x/work/todo-app",
            "work-todo-app-2",
        ),
        (&[], "dev/my app", "my-app"),
    ];
    for (existing, new, expected) in cases {
        let (data, folders) = (tempdir(), tempdir());
        for path in existing {
            let path = git_init(&folders.path().join(path));
            repositories::add(data.path(), &path, at("2026-10-14T09:00:00Z")).unwrap();
        }
        let path = git_init(&folders.path().join(new));

        let added = repositories::add(data.path(), &path, at("2026-10-14T10:00:00Z")).unwrap();

        assert_eq!(added.repository.name, expected, "{existing:?} then {new}");
    }
}

/// Review focus 4: each write reads the file again under the write lock.
#[test]
fn two_adds_at_once_both_stay_with_unique_names() {
    let (data, folders) = (tempdir(), tempdir());
    let dev = git_init(&folders.path().join("dev/todo-app"));
    let work = git_init(&folders.path().join("work/todo-app"));

    std::thread::scope(|scope| {
        for path in [&dev, &work] {
            let data = data.path();
            scope.spawn(move || repositories::add(data, path, at("2026-10-14T09:00:00Z")).unwrap());
        }
    });

    // Either add may run first: the second one takes its parent's name.
    let mut listed = names(data.path());
    listed.sort();
    assert!(
        listed == ["todo-app", "work-todo-app"] || listed == ["dev-todo-app", "todo-app"],
        "{listed:?}"
    );
}

#[test]
fn a_folder_outside_git_is_refused() {
    let (data, folder) = (tempdir(), tempdir());
    let path = fs::canonicalize(folder.path()).unwrap();

    let error = repositories::add(data.path(), &path, at("2026-10-14T09:00:00Z")).unwrap_err();

    assert_eq!(
        error.to_string(),
        format!(
            "Not a git repository: {}. Run git init there first.",
            path.display()
        )
    );
    assert!(matches!(error, ListError::NotARepository(_)));
    assert!(!data.path().join("repositories.json").exists());
}

#[test]
fn a_folder_that_does_not_exist_is_refused() {
    let (data, folder) = (tempdir(), tempdir());
    let path = folder.path().join("nope");

    let error = repositories::add(data.path(), &path, at("2026-10-14T09:00:00Z")).unwrap_err();

    assert_eq!(
        error.to_string(),
        format!("No such folder: {}.", path.display())
    );
}

#[test]
fn the_list_is_most_recent_first() {
    let (data, todo, uraeda) = (
        tempdir(),
        TestRepo::named("todo-app"),
        TestRepo::named("uraeda"),
    );
    repositories::add(data.path(), uraeda.path(), at("2026-10-14T10:00:00Z")).unwrap();
    repositories::add(data.path(), todo.path(), at("2026-10-14T09:00:00Z")).unwrap();

    let list = names(data.path());

    assert_eq!(list, ["uraeda", "todo-app"]);
}

#[test]
fn touching_moves_a_repository_first() {
    let (data, todo, uraeda) = (
        tempdir(),
        TestRepo::named("todo-app"),
        TestRepo::named("uraeda"),
    );
    repositories::add(data.path(), uraeda.path(), at("2026-10-14T10:00:00Z")).unwrap();
    repositories::add(data.path(), todo.path(), at("2026-10-14T09:00:00Z")).unwrap();

    let touched = repositories::touch(data.path(), "todo-app", at("2026-10-14T11:00:00Z")).unwrap();

    assert_eq!(touched.opened_at, "2026-10-14T11:00:00Z");
    assert_eq!(names(data.path()), ["todo-app", "uraeda"]);
}

#[test]
fn an_unknown_name_is_refused() {
    let data = tempdir();

    let touched = repositories::touch(data.path(), "old-site", at("2026-10-14T11:00:00Z"));
    let removed = repositories::remove(data.path(), "old-site");

    assert_eq!(
        touched.unwrap_err().to_string(),
        "No repository named “old-site”"
    );
    assert_eq!(
        removed.unwrap_err().to_string(),
        "No repository named “old-site”"
    );
}

#[test]
fn removing_leaves_the_folder() {
    let (data, repo) = (tempdir(), TestRepo::named("todo-app"));
    repositories::add(data.path(), repo.path(), at("2026-10-14T09:00:00Z")).unwrap();

    repositories::remove(data.path(), "todo-app").unwrap();

    assert_eq!(names(data.path()), Vec::<String>::new());
    assert_eq!(repo.read("README.md"), "# Test\n");
    assert_eq!(repo.porcelain(), "");
}

#[test]
fn a_deleted_folder_is_missing() {
    let (data, folders) = (tempdir(), tempdir());
    let path = git_init(&folders.path().join("work/client-site"));
    repositories::add(data.path(), &path, at("2026-10-14T09:00:00Z")).unwrap();
    fs::remove_dir_all(&path).unwrap();

    let list = repositories::read(data.path()).unwrap();

    assert_eq!(
        list,
        vec![Repository {
            name: "client-site".into(),
            path,
            opened_at: "2026-10-14T09:00:00Z".into(),
            missing: true,
        }]
    );
}

#[test]
fn an_invalid_file_is_refused_and_kept() {
    let (data, repo) = (tempdir(), TestRepo::named("todo-app"));
    let file = data.path().join("repositories.json");
    fs::write(&file, "{not json").unwrap();

    let read = repositories::read(data.path()).unwrap_err().to_string();
    let added = repositories::add(data.path(), repo.path(), at("2026-10-14T09:00:00Z"))
        .unwrap_err()
        .to_string();

    assert!(
        read.starts_with("repositories.json could not be read: "),
        "{read}"
    );
    assert_eq!(added, read);
    assert_eq!(fs::read_to_string(&file).unwrap(), "{not json");
}

#[test]
fn an_unknown_version_is_refused() {
    let data = tempdir();
    let file = data.path().join("repositories.json");
    fs::write(&file, r#"{"version": 2, "repositories": []}"#).unwrap();

    let error = repositories::read(data.path()).unwrap_err();

    assert_eq!(
        error.to_string(),
        "repositories.json could not be read: unknown version 2"
    );
}

#[test]
fn the_file_is_the_documented_json() {
    let (data, repo) = (tempdir(), TestRepo::named("todo-app"));

    repositories::add(data.path(), repo.path(), at("2026-10-14T09:00:00Z")).unwrap();

    let text = fs::read_to_string(data.path().join("repositories.json")).unwrap();
    let json: serde_json::Value = serde_json::from_str(&text).unwrap();
    assert_eq!(
        json,
        serde_json::json!({
            "version": 1,
            "repositories": [
                { "name": "todo-app", "path": repo.path(), "openedAt": "2026-10-14T09:00:00Z" }
            ]
        })
    );
    let files: Vec<_> = fs::read_dir(data.path())
        .unwrap()
        .map(|entry| entry.unwrap().file_name())
        .collect();
    assert_eq!(files, ["repositories.json"]);
}

#[test]
fn the_data_folder_is_created_on_the_first_write() {
    let (data, repo) = (tempdir(), TestRepo::named("todo-app"));
    let folder = data.path().join("share/uraeda");

    repositories::add(&folder, repo.path(), at("2026-10-14T09:00:00Z")).unwrap();

    assert!(folder.join("repositories.json").is_file());
}

/// The environment's variables, the operating system, and the data folder expected.
type DataDirCase = (
    &'static [(&'static str, &'static str)],
    &'static str,
    &'static str,
);

#[test]
fn the_data_folder_follows_the_platform() {
    let cases: [DataDirCase; 7] = [
        (&[("URAEDA_DATA_DIR", "/data")], "linux", "/data"),
        (&[("XDG_DATA_HOME", "/xdg")], "linux", "/xdg/uraeda"),
        (&[], "linux", "/home/me/.local/share/uraeda"),
        (
            &[("XDG_DATA_HOME", "")],
            "linux",
            "/home/me/.local/share/uraeda",
        ),
        (&[], "macos", "/home/me/Library/Application Support/uraeda"),
        (
            &[("APPDATA", "C:\\Users\\me\\AppData\\Roaming")],
            "windows",
            "C:\\Users\\me\\AppData\\Roaming\\uraeda",
        ),
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
