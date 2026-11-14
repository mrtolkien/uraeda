//! What waits on the human, over temporary repositories made with the git CLI.

mod support;

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use support::Server;
use tempfile::TempDir;
use uraeda_serve::Settings;
use uraeda_serve::waiting::{self, Ask, LocateError};

fn git(dir: &Path, args: &[&str]) {
    let output = Command::new("git")
        .args(args)
        .current_dir(dir)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_SYSTEM", "/dev/null")
        .env("GIT_AUTHOR_NAME", "Test")
        .env("GIT_AUTHOR_EMAIL", "test@example.com")
        .env("GIT_COMMITTER_NAME", "Test")
        .env("GIT_COMMITTER_EMAIL", "test@example.com")
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "git {args:?}: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

const FOLDER: &str = "2026-10-10-recurring-tasks";

fn round(status: &str) -> String {
    format!(
        "---\nstatus: {status}\n---\n\n# Clarifications, round 01: Recurring tasks\n\n\
         > [!IMPORTANT]\n>\n> 3 questions, about 5 minutes.\n\n## Questions\n\n### 1. Repeat\n"
    )
}

fn spec(status: &str) -> String {
    format!("---\nstatus: {status}\n---\n\n# Spec: Recurring tasks\n")
}

struct Fixture {
    _dir: TempDir,
    main: PathBuf,
    worktree: PathBuf,
}

/// A main checkout on `main`, and a worktree whose branch holds a feature folder with the files
/// given.
fn fixture(files: &[(&str, String)]) -> Fixture {
    let dir = TempDir::new().unwrap();
    let base = fs::canonicalize(dir.path()).unwrap();
    let main = base.join("todo");
    fs::create_dir(&main).unwrap();
    git(&main, &["init", "--quiet", "--initial-branch", "main"]);
    fs::create_dir(main.join("specs")).unwrap();
    fs::write(main.join("specs/PRIORITIES.md"), "# Priorities\n").unwrap();
    git(&main, &["add", "."]);
    git(&main, &["commit", "--quiet", "-m", "chore: start"]);
    let worktree = base.join("todo-recurring");
    git(
        &main,
        &[
            "worktree",
            "add",
            "--quiet",
            "-b",
            FOLDER,
            worktree.to_str().unwrap(),
        ],
    );
    let folder = worktree.join("specs").join(FOLDER);
    fs::create_dir_all(&folder).unwrap();
    fs::write(folder.join("proposal.md"), "# Recurring tasks\n").unwrap();
    for (name, text) in files {
        fs::write(folder.join(name), text).unwrap();
    }
    git(&worktree, &["add", "."]);
    git(&worktree, &["commit", "--quiet", "-m", "docs: files"]);
    Fixture {
        _dir: dir,
        main,
        worktree,
    }
}

fn settings(fixture: &Fixture) -> Settings {
    Settings {
        repositories: vec![fixture.main.clone()],
        ..Settings::default()
    }
}

fn home(server: &Server) -> String {
    server
        .get(&format!("/{}/", server.token))
        .into_body()
        .read_to_string()
        .unwrap()
}

#[test]
fn a_waiting_round_is_listed_and_a_spec_that_does_not_wait_is_not() {
    let f = fixture(&[
        ("clarifications-01.md", round("awaiting-human")),
        ("spec.md", spec("draft")),
    ]);
    let waiting = waiting::read(&settings(&f));
    let repository = &waiting.repositories[0];
    assert_eq!(repository.problem, None);
    assert_eq!(repository.name, "todo");
    assert_eq!(repository.items.len(), 1, "{:?}", repository.items);
    let item = &repository.items[0];
    assert_eq!(item.ask, Ask::Round(1));
    assert_eq!(item.folder, FOLDER);
    assert_eq!(item.slug, "recurring-tasks");
    assert_eq!(item.worktree, f.worktree);
    assert_eq!(item.address, format!("todo/{FOLDER}/round"));
    assert_eq!(
        item.waiting_line.as_deref(),
        Some("3 questions, about 5 minutes.")
    );

    let server = Server::with(settings(&f));
    let page = home(&server);
    assert!(page.contains("What waits on you"));
    assert!(page.contains(&format!("href=\"todo/{FOLDER}/round\"")));
    assert!(page.contains("Recurring tasks"));
    assert!(page.contains("Questions, round 1"));
    assert!(page.contains("3 questions, about 5 minutes."));
    assert!(!page.contains("Spec to review"));
    assert!(!page.contains("awaiting-human"));
    assert!(!page.contains("Nothing waits on you."));
}

#[test]
fn a_spec_awaiting_review_links_to_its_review() {
    let f = fixture(&[("spec.md", spec("awaiting-human"))]);
    let waiting = waiting::read(&settings(&f));
    let item = &waiting.repositories[0].items[0];
    assert_eq!(item.ask, Ask::Spec);
    assert_eq!(item.address, format!("todo/{FOLDER}/review/spec.md"));
}

#[test]
fn nothing_waiting_says_so() {
    let f = fixture(&[
        ("clarifications-01.md", round("answered")),
        ("spec.md", spec("approved")),
    ]);
    let server = Server::with(settings(&f));
    let page = home(&server);
    assert!(page.contains("Nothing waits on you."));
    assert!(!page.contains("waiting-card"));
}

#[test]
fn an_unreadable_repository_is_a_line_not_a_failure() {
    let dir = TempDir::new().unwrap();
    let server = Server::with(Settings {
        repositories: vec![dir.path().join("missing")],
        ..Settings::default()
    });
    let page = home(&server);
    assert!(page.contains("could not be read"));
}

#[test]
fn locate_finds_the_worktree_and_refuses_what_is_unknown() {
    let f = fixture(&[("clarifications-01.md", round("awaiting-human"))]);
    let settings = settings(&f);
    let located = waiting::locate(&settings, "todo", FOLDER).unwrap();
    assert_eq!(located.root, f.worktree);
    assert_eq!(located.main, f.main);
    assert_eq!(located.feature.folder, FOLDER);
    for (repo, folder) in [
        ("todo", "2026-10-10-unknown"),
        ("nope", FOLDER),
        ("todo", "../x"),
    ] {
        assert!(
            matches!(
                waiting::locate(&settings, repo, folder),
                Err(LocateError::NotFound)
            ),
            "{repo}/{folder}"
        );
    }
}

#[test]
fn readable_names() {
    assert_eq!(waiting::readable("recurring-tasks"), "Recurring tasks");
}
