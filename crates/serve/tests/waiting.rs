//! What waits on the human, over temporary repositories made with the git CLI.

mod support;

use support::Server;
use support::repo::{FOLDER, fixture, settings};
use tempfile::TempDir;
use uraeda_serve::Settings;
use uraeda_serve::waiting::{self, Ask, LocateError};

fn round(status: &str) -> String {
    format!(
        "---\nstatus: {status}\n---\n\n# Clarifications, round 01: Recurring tasks\n\n\
         > [!IMPORTANT]\n>\n> 3 questions, about 5 minutes.\n\n## Questions\n\n### 1. Repeat\n"
    )
}

fn spec(status: &str) -> String {
    format!("---\nstatus: {status}\n---\n\n# Spec: Recurring tasks\n")
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

#[test]
fn with_a_vault_each_card_opens_its_file_in_obsidian() {
    let waiting = uraeda_serve::waiting::Waiting {
        repositories: vec![uraeda_serve::waiting::Repository {
            name: "todo".into(),
            path: "/r/todo".into(),
            items: vec![uraeda_serve::waiting::Item {
                folder: "2026-10-10-recurring-tasks".into(),
                slug: "recurring-tasks".into(),
                kind: uraeda_core::workspace::Kind::Feature,
                worktree: "/r/todo-recurring".into(),
                file: "spec.md".into(),
                ask: uraeda_serve::waiting::Ask::Spec,
                waiting_line: None,
                address: "todo/2026-10-10-recurring-tasks/review/spec.md".into(),
            }],
            problem: None,
        }],
    };
    let page = uraeda_serve::waiting::render(&waiting, Some("My Notes"));
    assert!(
        page.contains(
            "obsidian://open?vault=My%20Notes&amp;file=projects%2Ftodo%2Fspecs%2F2026-10-10-recurring-tasks%2Fspec.md"
        ),
        "{page}"
    );
    assert!(page.contains("projects%2Ftodo%2FBoard.base"), "{page}");
    assert!(!uraeda_serve::waiting::render(&waiting, None).contains("obsidian://"));
}
