mod common;

use std::fs;
use std::path::Path;

use common::*;

/// Runs `ura add` in a folder, with its list in `data`.
fn add(dir: &Path, data: &Path, args: &[&str]) -> Output {
    let mut all = vec!["add"];
    all.extend_from_slice(args);
    ura_in(dir, &all, &[("URAEDA_DATA_DIR", data.to_str().unwrap())])
}

/// The names and paths of the list, as stored.
fn listed(data: &Path) -> Vec<(String, String)> {
    let text = fs::read_to_string(data.join("repositories.json")).unwrap();
    let file: serde_json::Value = serde_json::from_str(&text).unwrap();
    file["repositories"]
        .as_array()
        .unwrap()
        .iter()
        .map(|entry| {
            (
                entry["name"].as_str().unwrap().to_string(),
                entry["path"].as_str().unwrap().to_string(),
            )
        })
        .collect()
}

#[test]
fn adds_the_repository_holding_the_current_folder() {
    let repo = TestRepo::named("todo-app");
    repo.write("src/main.rs", "fn main() {}\n");
    let data = tempfile::TempDir::new().unwrap();
    let path = repo.path().display().to_string();

    let output = add(&repo.path().join("src"), data.path(), &[]);

    assert_eq!(output.stderr, format!("added todo-app: {path}\n"));
    assert_eq!(output.stdout, "");
    assert_eq!(output.code, 0);
    assert_eq!(listed(data.path()), [("todo-app".to_string(), path)]);
}

#[test]
fn adds_a_folder_given_relative_to_the_current_one() {
    let repo = TestRepo::named("todo-app");
    let data = tempfile::TempDir::new().unwrap();

    let output = add(repo.parent(), data.path(), &["todo-app"]);

    assert_eq!(
        output.stderr,
        format!("added todo-app: {}\n", repo.path().display())
    );
    assert_eq!(output.code, 0);
}

#[test]
fn adding_again_says_so() {
    let repo = TestRepo::named("todo-app");
    let data = tempfile::TempDir::new().unwrap();
    let path = repo.path().display().to_string();
    let elsewhere = tempfile::TempDir::new().unwrap();
    assert_eq!(add(elsewhere.path(), data.path(), &[&path]).code, 0);

    let output = add(elsewhere.path(), data.path(), &[&path]);

    assert_eq!(
        output.stderr,
        format!("todo-app is already added: {path}\n")
    );
    assert_eq!(output.code, 0);
    assert_eq!(listed(data.path()), [("todo-app".to_string(), path)]);
}

#[test]
fn a_folder_outside_git_exits_1() {
    let folder = tempfile::TempDir::new().unwrap();
    let path = fs::canonicalize(folder.path()).unwrap();
    let data = tempfile::TempDir::new().unwrap();

    let output = add(&path, data.path(), &[]);

    assert_eq!(
        output.stderr,
        format!(
            "ura: {}: not in a git repository: run git init first\n",
            path.display()
        )
    );
    assert_eq!(output.code, 1);
    assert!(!data.path().join("repositories.json").exists());
}

#[test]
fn an_invalid_list_exits_1_and_is_kept() {
    let repo = TestRepo::named("todo-app");
    let data = tempfile::TempDir::new().unwrap();
    let file = data.path().join("repositories.json");
    fs::write(&file, "{not json").unwrap();

    let output = add(repo.path(), data.path(), &[]);

    assert!(
        output
            .stderr
            .starts_with("ura: repositories.json could not be read: "),
        "{}",
        output.stderr
    );
    assert_eq!(output.code, 1);
    assert_eq!(fs::read_to_string(&file).unwrap(), "{not json");
}

#[test]
fn adds_at_the_same_moment_all_succeed_and_leave_one_whole_file() {
    let repos: Vec<TestRepo> = (0..8)
        .map(|index| TestRepo::named(&format!("repo-{index}")))
        .collect();
    let data = tempfile::TempDir::new().unwrap();

    for _ in 0..3 {
        let outputs: Vec<Output> = std::thread::scope(|scope| {
            let running: Vec<_> = repos
                .iter()
                .map(|repo| scope.spawn(|| add(repo.path(), data.path(), &[])))
                .collect();
            running.into_iter().map(|run| run.join().unwrap()).collect()
        });

        for output in &outputs {
            assert_eq!(output.code, 0, "{}", output.stderr);
        }
        assert!(!listed(data.path()).is_empty());
        let files: Vec<String> = fs::read_dir(data.path())
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(files, ["repositories.json"]);
    }
}
