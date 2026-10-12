mod common;

use common::repo::TestRepo;
use uraeda_core::actions::priorities as actions;
use uraeda_core::actions::{ActionError, draft, place};
use uraeda_core::files::document::hash;
use uraeda_core::files::priorities::{self, Section};
use uraeda_core::git::Git;

const TEXT: &str = "# Priorities\n\n## Now\n\n- [Web UI](/specs/2026-10-11-web-ui/proposal.md)\n\n## Next\n\n- Git listener process\n- Ping user when input is needed\n\n## Later\n\n- [Nice TUI](drafts/cli-tuis.md)\n  - with colours\n- Slack\n\n## Blocked\n\n- Benchmarks: blocked\n";

fn section_texts(text: &str, section: &str) -> Vec<String> {
    priorities::read(text, None)
        .sections
        .into_iter()
        .find(|s| s.section == section)
        .unwrap()
        .entries
        .into_iter()
        .map(|e| e.text)
        .collect()
}

#[test]
fn reads_sections_with_ids_and_nested_lines() {
    let read = priorities::read(TEXT, None);

    assert_eq!(read.hash, hash(TEXT));
    let later = &read.sections[2];
    assert_eq!(later.section, "later");
    assert_eq!(later.entries[0].id, "later-1");
    assert_eq!(later.entries[0].text, "[Nice TUI](drafts/cli-tuis.md)");
    assert_eq!(later.entries[0].nested, ["  - with colours"]);
    let link = later.entries[0].spans[0].link.clone().unwrap();
    assert_eq!(link.path.as_deref(), Some("specs/drafts/cli-tuis.md"));
}

/// US7.1 and US7.2
#[test]
fn a_line_is_added_at_the_end_of_its_section() {
    let added = priorities::add(
        TEXT,
        Section::Next,
        "Show the agent's last commit on the feature page",
    )
    .unwrap();

    assert!(added.contains(
        "- Ping user when input is needed\n- Show the agent's last commit on the feature page\n\n## Later"
    ));
    let later = priorities::add(TEXT, Section::Later, "An idea\nover two lines").unwrap();
    assert!(later.contains("- Slack\n- An idea over two lines\n\n## Blocked"));
    assert_eq!(priorities::add(TEXT, Section::Next, "  \n "), None);
}

#[test]
fn a_line_is_added_to_an_empty_section() {
    let text = "# Priorities\n\n## Now\n\n## Next\n";

    let added = priorities::add(text, Section::Now, "First").unwrap();

    assert_eq!(added, "# Priorities\n\n## Now\n\n- First\n\n## Next\n");
}

/// US7.3: a swap is one change.
#[test]
fn a_line_moves_above_another() {
    let moved = priorities::move_entry(TEXT, "next-2", Section::Next, 0).unwrap();

    assert_eq!(
        section_texts(&moved, "next"),
        ["Ping user when input is needed", "Git listener process"]
    );
    assert_eq!(priorities::changes(TEXT, &moved), 1);
}

/// US7.4 and review focus 3: an entry moves with its link and nested lines, byte for byte.
#[test]
fn a_line_moves_to_another_section_with_its_nested_lines() {
    let moved = priorities::move_entry(TEXT, "later-1", Section::Next, usize::MAX).unwrap();

    assert!(moved.contains(
        "- Ping user when input is needed\n- [Nice TUI](drafts/cli-tuis.md)\n  - with colours\n\n## Later\n\n- Slack\n"
    ), "{moved}");
    assert_eq!(priorities::changes(TEXT, &moved), 1);
}

/// US7.5
#[test]
fn a_line_is_edited_as_typed() {
    let edited =
        priorities::edit(TEXT, "later-1", "[Nicer TUI](drafts/cli-tuis.md), soon").unwrap();

    assert!(edited.contains("- [Nicer TUI](drafts/cli-tuis.md), soon\n  - with colours\n"));
    let removed = priorities::remove(&edited, "later-1").unwrap();
    assert!(removed.contains("## Later\n\n- Slack\n"));
    assert_eq!(priorities::changes(TEXT, &removed), 1);
}

/// Every edit keeps the rest of this repository's `PRIORITIES.md` byte for byte.
#[test]
fn edits_keep_every_other_line() {
    let text = common::repository_file("specs/PRIORITIES.md");
    let read = priorities::read(&text, None);
    let first_next = read.sections[1].entries[0].id.clone();

    let moved = priorities::move_entry(&text, &first_next, Section::Later, usize::MAX).unwrap();
    let back = priorities::move_entry(
        &moved,
        &format!(
            "later-{}",
            priorities::read(&moved, None).sections[2].entries.len()
        ),
        Section::Next,
        0,
    )
    .unwrap();

    assert_eq!(back, text);
}

/// A repository on `main` with `PRIORITIES.md`.
fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write("specs/PRIORITIES.md", TEXT);
    repo.commit("chore: specs");
    repo
}

fn main_place(repo: &TestRepo) -> place::Place {
    place::reach(&Git::discover(repo.path()).unwrap(), "main").unwrap()
}

/// US7.6 and US7.7
#[test]
fn changes_are_committed_alone_or_discarded() {
    let repo = repo();
    let place = main_place(&repo);
    repo.write("README.md", "# Changed\n");
    let read = actions::read(&place);
    let next = actions::add(&place, Section::Next, "An idea", &read.hash).unwrap();
    actions::move_entry(&place, "next-2", Section::Next, 0, &next).unwrap();

    assert_eq!(actions::read(&place).changes, 2);
    let committed = actions::commit(&place).unwrap();

    assert_eq!(committed.change.subject, "chore: update the priorities");
    assert_eq!(repo.changed_in("main"), ["specs/PRIORITIES.md"]);
    assert_eq!(repo.porcelain(), " M README.md\n");
    assert_eq!(actions::read(&place).changes, 0);

    let read = actions::read(&place);
    actions::remove(&place, "next-1", &read.hash).unwrap();
    actions::discard(&place).unwrap();
    assert_eq!(
        repo.read("specs/PRIORITIES.md"),
        repo.git(&["show", "HEAD:specs/PRIORITIES.md"])
    );
}

#[test]
fn an_edit_over_a_change_made_elsewhere_is_refused() {
    let repo = repo();
    let place = main_place(&repo);
    let read = actions::read(&place);
    repo.write("specs/PRIORITIES.md", &TEXT.replace("Slack", "Slack app"));

    let error = actions::add(&place, Section::Next, "An idea", &read.hash).unwrap_err();

    assert_eq!(
        error.to_string(),
        "PRIORITIES.md changed on disk. Your change was not applied."
    );
    assert!(matches!(error, ActionError::Refused(_)));
}

/// US7.8: from a feature branch, the default branch is reached in its worktree.
#[test]
fn from_a_feature_branch_edits_go_to_the_default_branchs_worktree() {
    let repo = repo();
    repo.switch_new("2026-10-11-web-ui");

    let place = main_place(&repo);
    let read = actions::read(&place);
    actions::add(&place, Section::Next, "An idea", &read.hash).unwrap();

    assert!(place.root.ends_with(".worktrees/main"));
    assert!(
        repo.read(".worktrees/main/specs/PRIORITIES.md")
            .contains("- An idea\n")
    );
    assert_eq!(repo.current_branch(), "2026-10-11-web-ui");
}

/// US4.1: a line drafted by its id.
#[test]
fn a_line_is_drafted_by_its_id() {
    let repo = repo();
    let place = main_place(&repo);

    let drafted = draft::create(&place, "next-1").unwrap();

    assert_eq!(drafted.path, "specs/drafts/git-listener-process.md");
    assert!(
        repo.read(&drafted.path)
            .contains("---\n\n# Git listener process\n")
    );
    assert!(
        repo.read("specs/PRIORITIES.md")
            .contains("- [Git listener process](drafts/git-listener-process.md)\n")
    );
    assert_eq!(repo.subjects("main").len(), 2);
}
