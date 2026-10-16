mod common;

use common::repo::TestRepo;
use common::texts::{proposal, record};
use uraeda_core::actions::commit::Added;
use uraeda_core::actions::priorities as actions;
use uraeda_core::actions::{ActionError, changes, draft, place};
use uraeda_core::api;
use uraeda_core::files::document::hash;
use uraeda_core::files::priorities::{self, EntryChange, Section};
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

/// R7: bullets inside fenced code are not items, in the priorities as in the inbox.
#[test]
fn priorities_skip_fenced_code() {
    let text = "# Priorities\n\n## Now\n\n```md\n- not an entry\n## Later\n```\n\n- An entry\n";

    let texts: Vec<String> = priorities::parse(text)
        .into_iter()
        .map(|e| e.text)
        .collect();
    assert_eq!(texts, ["An entry"]);
    let added = priorities::add(text, Section::Later, "Idea").unwrap();
    assert_eq!(added, format!("{text}\n## Later\n\n- Idea\n"));
}

/// A fence indented under an entry, with a blank line in it, does not hide what follows.
#[test]
fn indented_fences_do_not_hide_later_entries() {
    let text =
        "# Priorities\n\n## Now\n\n- a\n  ```\n  x\n\n  y\n  ```\n- next\n\n## Next\n\n- b\n";

    let entries: Vec<(Section, String)> = priorities::parse(text)
        .into_iter()
        .map(|e| (e.section, e.text))
        .filter(|(_, t)| !t.starts_with('a'))
        .collect();
    assert_eq!(
        entries,
        [
            (Section::Now, "next".to_string()),
            (Section::Next, "b".to_string())
        ]
    );
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

/// Every move keeps the rest of the file byte for byte, on a file written by hand, with blank lines
/// between groups of lines and nested lines: the file without the moved line's lines is the same.
#[test]
fn moves_keep_every_other_line() {
    let text = common::repository_file("fixtures/PRIORITIES-grouped.md");
    let without = |text: &str, lines: &[String]| {
        let mut rest: Vec<&str> = text.split('\n').collect();
        let at = rest
            .windows(lines.len())
            .position(|window| window == lines)
            .unwrap();
        rest.drain(at..at + lines.len());
        rest.join("\n")
    };
    let read = priorities::read(&text, None);
    let entries: Vec<_> = read.sections.iter().flat_map(|s| &s.entries).collect();
    assert!(entries.len() > 20);

    for entry in entries {
        for (section, index) in [(Section::Now, 0), (Section::Later, usize::MAX)] {
            let moved = priorities::move_entry(&text, &entry.id, section, index).unwrap();

            assert_eq!(
                without(&moved, &entry.lines),
                without(&text, &entry.lines),
                "{} moved to {section:?}",
                entry.id
            );
        }
    }
}

#[test]
fn changes_are_named_moves_edits_additions_and_removals() {
    let moved = priorities::move_entry(TEXT, "later-1", Section::Next, 0).unwrap();
    let edited = priorities::edit(
        &moved,
        "now-1",
        "[Web UI, again](/specs/2026-10-11-web-ui/proposal.md)",
    )
    .unwrap();
    let removed = priorities::remove(&edited, "blocked-1").unwrap();
    let added = priorities::add(&removed, Section::Later, "An idea").unwrap();
    let swapped = priorities::move_entry(&added, "next-3", Section::Next, 1).unwrap();

    assert_eq!(
        priorities::diff(TEXT, &swapped),
        [
            EntryChange::Edited {
                section: Section::Now,
                before: "Web UI".to_string(),
                after: "Web UI, again".to_string(),
            },
            EntryChange::Moved {
                from: Section::Later,
                to: Section::Next,
                text: "Nice TUI".to_string(),
            },
            EntryChange::Moved {
                from: Section::Next,
                to: Section::Next,
                text: "Ping user when input is needed".to_string(),
            },
            EntryChange::Added {
                section: Section::Later,
                text: "An idea".to_string(),
            },
            EntryChange::Removed {
                section: Section::Blocked,
                text: "Benchmarks: blocked".to_string(),
            },
        ]
    );
    assert_eq!(priorities::changes(TEXT, &swapped), 5);
}

/// A removal and an addition in different places are two changes, not one edit.
#[test]
fn a_removal_and_an_addition_elsewhere_are_two_changes() {
    let removed = priorities::remove(TEXT, "next-1").unwrap();
    let added = priorities::add(&removed, Section::Later, "An idea").unwrap();

    assert_eq!(priorities::changes(TEXT, &added), 2);
}

/// The commit bar's message for `after`, written over `TEXT` committed.
fn message(after: &str) -> (String, Option<String>) {
    let repo = repo();
    repo.write("specs/PRIORITIES.md", after);
    changes::message(&main_place(&repo))
}

#[test]
fn one_change_is_the_subject() {
    let added = priorities::add(TEXT, Section::Next, "An idea").unwrap();
    let long = priorities::add(
        TEXT,
        Section::Now,
        "Discovery effort level in proposal -> the human can select low, medium, or high",
    )
    .unwrap();

    assert_eq!(
        message(&added),
        ("chore: add \"An idea\" to Next".to_string(), None)
    );
    assert_eq!(
        message(&long).0,
        "chore: add \"Discovery effort level in proposal…\" to Now"
    );
    let removed = priorities::remove(TEXT, "next-1").unwrap();
    assert_eq!(
        message(&removed).0,
        "chore: remove \"Git listener process\""
    );
    let moved = priorities::move_entry(TEXT, "next-1", Section::Later, 0).unwrap();
    assert_eq!(
        message(&moved).0,
        "chore: move \"Git listener process\" to Later"
    );
    let edited = priorities::edit(TEXT, "later-2", "Slack app").unwrap();
    assert_eq!(message(&edited).0, "chore: edit \"Slack app\"");
    assert_eq!(
        message(TEXT.trim_end()),
        ("chore: update the priorities".to_string(), None)
    );
}

#[test]
fn more_changes_are_counted_and_listed_in_the_body() {
    let edited = priorities::edit(TEXT, "next-1", "Git listener process, and triggering").unwrap();
    let swapped = priorities::move_entry(&edited, "later-2", Section::Later, 0).unwrap();

    assert_eq!(
        message(&swapped),
        (
            "chore: edit \"Git listener process, and triggering\", and 1 more".to_string(),
            Some(
                "- Edit in Next: Git listener process -> Git listener process, and triggering\n- Move within Later: Slack"
                    .to_string()
            )
        )
    );
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

/// The priorities' Commit and Discard are the inbox's: a note moved into the priorities is one
/// change, committed with `INBOX.md`, and Discard restores both files.
#[test]
fn the_priorities_commit_holds_the_inbox() {
    let repo = repo();
    repo.write("specs/INBOX.md", "# Inbox\n\n- An idea\n- A typo\n");
    repo.commit("chore: inbox");
    let place = main_place(&repo);
    let inbox = uraeda_core::actions::inbox::read(&place);
    let read = actions::read(&place);
    uraeda_core::actions::inbox::to_priorities(
        &place,
        "note-1",
        Section::Next,
        &inbox.hash,
        &read.hash,
    )
    .unwrap();
    let read = actions::read(&place);
    actions::edit(&place, "next-1", "Git listener", &read.hash).unwrap();

    assert_eq!(actions::read(&place).changes, 2);
    let committed = actions::commit(&place).unwrap();

    assert_eq!(
        committed.change.subject,
        "chore: move \"An idea\" from the inbox to Next, and 1 more"
    );
    assert_eq!(
        committed.change.body.as_deref(),
        Some(
            "- Move from the inbox to Next: An idea\n- Edit in Next: Git listener process -> Git listener"
        )
    );
    assert_eq!(
        repo.changed_in("main"),
        ["specs/INBOX.md", "specs/PRIORITIES.md"]
    );

    let inbox = uraeda_core::actions::inbox::read(&place);
    uraeda_core::actions::inbox::remove(&place, "note-1", Some(&inbox.hash)).unwrap();
    let read = actions::read(&place);
    actions::remove(&place, "next-1", &read.hash).unwrap();
    let read = api::discard_priorities(repo.path()).unwrap();
    assert_eq!(read.changes, 0);
    assert_eq!(repo.porcelain(), "");
}

/// US7.6 and US7.7
#[test]
fn changes_are_committed_alone_or_discarded() {
    let repo = repo();
    let place = main_place(&repo);
    repo.write("README.md", "# Changed\n");
    let read = actions::read(&place);
    let next = actions::add(&place, Section::Next, "An idea", &read.hash).unwrap();
    actions::move_entry(&place, "next-2", Section::Next, 0, &next.hash).unwrap();

    assert_eq!(actions::read(&place).changes, 2);
    let committed = actions::commit(&place).unwrap();

    assert_eq!(
        committed.change.subject,
        "chore: move \"Ping user when input is needed\" within Next, and 1 more"
    );
    assert_eq!(
        committed.change.body.as_deref(),
        Some("- Move within Next: Ping user when input is needed\n- Add to Next: An idea")
    );
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

/// Review focus 1 and 2, and the edge case of two lines with the same text.
#[test]
fn keys() {
    let cases = [
        (
            "- Claude Code runner (triggered manually)",
            vec!["claude-code-runner-triggered-manually"],
        ),
        (
            "- [Git listener process](drafts/git-listener.md)",
            vec!["git-listener"],
        ),
        (
            "- [Web UI for the workflow files](/specs/2026-10-11-web-ui/proposal.md)",
            vec!["web-ui-for-the-workflow-files"],
        ),
        (
            "- Nvim plugin\n- Nvim plugin",
            vec!["nvim-plugin", "nvim-plugin-2"],
        ),
        ("- 🚀\n- …", vec!["line", "line-2"]),
    ];
    for (items, expected) in cases {
        let text = format!("# Priorities\n\n## Now\n\n## Next\n\n{items}\n");
        let read = priorities::read(&text, None);
        let keys: Vec<&str> = read.sections[1]
            .entries
            .iter()
            .map(|e| e.key.as_str())
            .collect();
        assert_eq!(keys, expected, "{items}");
    }
}

/// A key already used in an earlier section counts too.
#[test]
fn keys_are_unique_across_sections() {
    let text = "# Priorities\n\n## Now\n\n- Slack\n\n## Later\n\n- Slack\n";
    let read = priorities::read(text, None);
    assert_eq!(read.sections[0].entries[0].key, "slack");
    assert_eq!(read.sections[2].entries[0].key, "slack-2");
}

/// A repository on `main` with the fixture's `PRIORITIES.md`.
fn fixture_repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        "specs/PRIORITIES.md",
        &std::fs::read_to_string(common::fixture("repo/main/specs/PRIORITIES.md")).unwrap(),
    );
    repo.commit("chore: specs");
    repo
}

/// Undo of a deletion: the entry comes back, nested lines included, byte for byte.
#[test]
fn insert_puts_a_removed_line_back_with_its_nested_lines() {
    let repo = fixture_repo();
    let before = repo.read("specs/PRIORITIES.md");
    let read = api::read_priorities(repo.path()).unwrap();
    let removed = api::remove_priority(repo.path(), "later-1", &read.hash).unwrap();

    api::insert_priority(
        repo.path(),
        "later",
        0,
        &[
            "- Nix + Docker based execution environments".into(),
            "  - with a cache".into(),
        ],
        &removed.hash,
    )
    .unwrap();

    assert_eq!(repo.read("specs/PRIORITIES.md"), before);
}

/// The edge case of an Undo after the file changed: past the end, the entry lands last.
#[test]
fn insert_past_the_end_appends_and_a_stale_hash_is_refused() {
    let repo = fixture_repo();
    let read = api::read_priorities(repo.path()).unwrap();

    let inserted =
        api::insert_priority(repo.path(), "next", 99, &["- Slack".into()], &read.hash).unwrap();

    let next: Vec<&str> = inserted.sections[1]
        .entries
        .iter()
        .map(|e| e.text.as_str())
        .collect();
    assert_eq!(
        next,
        [
            "Claude Code runner (triggered manually)",
            "[Git listener process](drafts/git-listener.md)",
            "Slack"
        ]
    );
    let error = api::insert_priority(repo.path(), "next", 0, &["- Slack".into()], "x").unwrap_err();
    assert_eq!(
        error.to_string(),
        "PRIORITIES.md changed on disk. Your change was not applied."
    );
}

/// The entry of `priorities` whose markdown is `text`.
fn entry<'p>(priorities: &'p priorities::Priorities, text: &str) -> &'p priorities::EntryItem {
    priorities
        .sections
        .iter()
        .flat_map(|section| &section.entries)
        .find(|entry| entry.text == text)
        .unwrap_or_else(|| panic!("no entry {text}"))
}

const DRAFTED: &str = "# Priorities\n\n## Now\n\n## Next\n\n- [Git listener](drafts/git-listener.md)\n- [Benchmarks](backlog/benchmarks/proposal.md)\n- [Missing](drafts/missing.md)\n";

/// US4.2 and US4.3: an entry marks its draft or backlog file only when the file exists.
#[test]
fn an_entry_links_its_existing_draft_or_backlog_file() {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write("specs/PRIORITIES.md", DRAFTED);
    repo.write("specs/drafts/git-listener.md", "# Git listener\n");
    repo.write("specs/backlog/benchmarks/proposal.md", "# Benchmarks\n");
    repo.commit("chore: specs");

    let read = api::read_priorities(repo.path()).unwrap();

    let draft = |text: &str, read: &priorities::Priorities| {
        entry(read, text)
            .draft
            .as_ref()
            .map(|file| (file.path.clone(), file.backlog))
    };
    assert_eq!(
        draft("[Git listener](drafts/git-listener.md)", &read),
        Some(("specs/drafts/git-listener.md".into(), false))
    );
    assert_eq!(
        draft("[Benchmarks](backlog/benchmarks/proposal.md)", &read),
        Some(("specs/backlog/benchmarks/proposal.md".into(), true))
    );
    assert_eq!(draft("[Missing](drafts/missing.md)", &read), None);
    // The file-level reader leaves the join to the workspace.
    assert_eq!(
        draft(
            "[Git listener](drafts/git-listener.md)",
            &priorities::read(DRAFTED, None)
        ),
        None
    );
    // A write's answer is joined too.
    let added = api::add_priority(repo.path(), "later", "Slack", &read.hash).unwrap();
    assert_eq!(
        draft("[Git listener](drafts/git-listener.md)", &added),
        Some(("specs/drafts/git-listener.md".into(), false))
    );
}

const WEB_UI: &str = "2026-10-11-web-ui";

/// The edge case of a started entry whose feature is done: it is no longer running.
#[test]
fn an_entry_names_its_running_feature_until_done() {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        "specs/PRIORITIES.md",
        "# Priorities\n\n## Now\n\n- [Web UI](/specs/2026-10-11-web-ui/proposal.md)\n",
    );
    repo.commit("chore: specs");
    repo.switch_new(WEB_UI);
    repo.write(&format!("specs/{WEB_UI}/proposal.md"), &proposal());
    repo.commit("discovery(web-ui): web UI");
    repo.switch("main");
    let text = "[Web UI](/specs/2026-10-11-web-ui/proposal.md)";

    let read = api::read_priorities(repo.path()).unwrap();

    let running = entry(&read, text).running.clone().expect("running");
    assert_eq!(running.folder, WEB_UI);
    assert!(!running.change);
    let workspace =
        uraeda_core::workspace::Workspace::read(&Git::discover(repo.path()).unwrap()).unwrap();
    let feature = workspace
        .features
        .iter()
        .find(|f| f.folder == WEB_UI)
        .unwrap();
    assert_eq!(running.step.name, feature.step.name.as_str());
    assert_ne!(running.step.name, "done");

    repo.switch(WEB_UI);
    repo.git(&["rm", "-r", "--quiet", &format!("specs/{WEB_UI}")]);
    repo.write(
        &format!("specs/done/{WEB_UI}.md"),
        &record("feature", "Web UI"),
    );
    repo.commit("finish: web ui");
    repo.switch("main");
    repo.git(&["merge", "--quiet", "--no-ff", "--no-edit", WEB_UI]);

    let read = api::read_priorities(repo.path()).unwrap();
    assert_eq!(entry(&read, text).running, None);
}

/// The edge case of a change, not a feature, started: it is running too.
#[test]
fn a_change_is_running_too() {
    let change = "2026-10-14-tasks-reappear";
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    let text = format!("[Tasks reappear](/specs/changes/{change}/proposal.md)");
    repo.write(
        "specs/PRIORITIES.md",
        &format!("# Priorities\n\n## Now\n\n- {text}\n"),
    );
    repo.commit("chore: specs");
    repo.switch_new(&format!("change/{change}"));
    repo.write(
        &format!("specs/changes/{change}/proposal.md"),
        "# Completed tasks reappear\n",
    );
    repo.commit("chore: proposal");
    repo.switch("main");

    let read = api::read_priorities(repo.path()).unwrap();

    let running = entry(&read, &text).running.clone().expect("running");
    assert_eq!(running.folder, change);
    assert!(running.change);
}

const NIX: &str = "Nix + Docker based execution environments";
const NIX_DRAFT: &str = "specs/drafts/nix-docker-based-execution-environments.md";

/// US6.1: the line's children go into the draft's What, after the line, and leave the entry.
#[test]
fn a_drafted_line_takes_its_children() {
    let repo = fixture_repo();
    let place = main_place(&repo);

    let drafted = draft::create(&place, "later-1").unwrap();

    assert_eq!(drafted.path, NIX_DRAFT);
    let text = repo.read(NIX_DRAFT);
    assert!(text.contains(&format!("\n# {NIX}\n")), "{text}");
    assert!(
        text.contains(&format!("## What\n\n{NIX}\n\n- with a cache\n\n## ")),
        "{text}"
    );
    assert!(repo.read("specs/PRIORITIES.md").contains(&format!(
        "## Later\n\n- [{NIX}](drafts/nix-docker-based-execution-environments.md)\n\n## Blocked"
    )));
}

/// US6.2: a child's link points at the same file from the draft's folder.
#[test]
fn a_drafted_child_link_still_resolves() {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        "specs/PRIORITIES.md",
        &format!(
            "# Priorities\n\n## Now\n\n## Later\n\n- {NIX}\n  - [git](/specs/decisions/git.md)\n  - [git](decisions/git.md)\n"
        ),
    );
    repo.commit("chore: specs");
    let place = main_place(&repo);

    draft::create(&place, "later-1").unwrap();

    let text = repo.read(NIX_DRAFT);
    let links: Vec<&str> = text
        .lines()
        .filter_map(|line| line.strip_prefix("- [git](")?.strip_suffix(')'))
        .collect();
    assert_eq!(links.len(), 2, "{text}");
    for link in links {
        assert_eq!(
            uraeda_core::workspace::resolve("specs/drafts", link).as_deref(),
            Some("specs/decisions/git.md"),
            "{link}"
        );
    }
}

/// US6.3: Discard deletes the draft no commit has, and the entry gets its children back.
#[test]
fn discard_deletes_the_draft_and_gives_the_children_back() {
    let repo = fixture_repo();
    let place = main_place(&repo);
    let before = repo.read("specs/PRIORITIES.md");
    draft::create(&place, "later-1").unwrap();

    changes::discard(&place).unwrap();

    assert!(!repo.exists(NIX_DRAFT));
    assert_eq!(repo.read("specs/PRIORITIES.md"), before);
    assert_eq!(repo.porcelain(), "");
}

/// The edge case of a Discard after a draft from a note and one from a line: both drafts go, and
/// both lists are restored.
#[test]
fn discard_after_a_note_draft_and_a_line_draft() {
    let repo = fixture_repo();
    repo.write(
        "specs/INBOX.md",
        &std::fs::read_to_string(common::fixture("repo/main/specs/INBOX.md")).unwrap(),
    );
    repo.commit("chore: inbox");
    let place = main_place(&repo);
    let priorities_before = repo.read("specs/PRIORITIES.md");
    let inbox_before = repo.read("specs/INBOX.md");
    let inbox = api::read_inbox(repo.path()).unwrap();
    let note = inbox
        .categories
        .iter()
        .flat_map(|category| &category.notes)
        .find(|note| note.text == "We need a home icon")
        .unwrap()
        .id
        .clone();
    let read = api::read_priorities(repo.path()).unwrap();
    let note_draft =
        api::note_to_new_draft(repo.path(), &note, "next", &inbox.hash, &read.hash).unwrap();
    draft::create(&place, "later-1").unwrap();

    changes::discard(&place).unwrap();

    assert!(!repo.exists(&note_draft));
    assert!(!repo.exists(NIX_DRAFT));
    assert_eq!(repo.read("specs/PRIORITIES.md"), priorities_before);
    assert_eq!(repo.read("specs/INBOX.md"), inbox_before);
    assert_eq!(repo.porcelain(), "");
}

const SORT: &str = "Sort done features";

/// US3 1: "Add and commit" on a file equal to its commit commits it alone.
#[test]
fn an_add_commits_alone_on_a_clean_file() {
    let repo = repo();
    let read = api::read_priorities(repo.path()).unwrap();

    let (priorities, added) =
        api::add_priority_and_commit(repo.path(), "next", SORT, &read.hash).unwrap();

    assert_eq!(
        added,
        Added {
            committed: true,
            reason: None,
            message: None
        }
    );
    assert_eq!(
        repo.subjects("main")[0],
        "chore: add \"Sort done features\" to Next"
    );
    assert_eq!(repo.changed_in("HEAD"), ["specs/PRIORITIES.md"]);
    assert_eq!(repo.porcelain(), "");
    assert_eq!(repo.hook_runs(), 1);
    assert_eq!(priorities.changes, 0);
    assert_eq!(
        section_texts(&repo.read("specs/PRIORITIES.md"), "next")[2],
        SORT
    );
}

/// US3 3: a file with other changes gets the entry, and no commit.
#[test]
fn an_add_on_a_changed_file_is_not_committed() {
    let repo = repo();
    repo.write("specs/PRIORITIES.md", &TEXT.replace("- Slack\n", ""));
    let read = api::read_priorities(repo.path()).unwrap();

    let (priorities, added) =
        api::add_priority_and_commit(repo.path(), "next", SORT, &read.hash).unwrap();

    assert!(!added.committed);
    assert_eq!(added.reason.as_deref(), Some("other-changes"));
    assert_eq!(repo.subjects("main")[0], "chore: specs");
    assert_eq!(
        section_texts(&repo.read("specs/PRIORITIES.md"), "next")[2],
        SORT
    );
    assert_eq!(priorities.changes, 2);
}

/// Review focus 1: a file staged by the human stays staged, and out of the commit.
#[test]
fn an_add_commits_alone_beside_other_staged_files() {
    let repo = repo();
    repo.write("README.md", "# Test, staged\n");
    repo.git(&["add", "README.md"]);
    let read = api::read_priorities(repo.path()).unwrap();

    let (_, added) = api::add_priority_and_commit(repo.path(), "next", SORT, &read.hash).unwrap();

    assert!(added.committed);
    assert_eq!(repo.changed_in("HEAD"), ["specs/PRIORITIES.md"]);
    assert_eq!(
        repo.git(&["diff", "--cached", "--name-only"]),
        "README.md\n"
    );
    assert_eq!(repo.read("README.md"), "# Test, staged\n");
}

/// The edge case of a hook refusing the commit: the entry stays written, unstaged, and the answer
/// carries the hook's first line.
#[test]
fn a_hook_failure_leaves_the_entry_written() {
    let repo = repo();
    repo.set_hook("echo 'Trailing space in PRIORITIES.md' >&2\necho 'line 9' >&2\nexit 1");
    let read = api::read_priorities(repo.path()).unwrap();

    let (priorities, added) =
        api::add_priority_and_commit(repo.path(), "next", SORT, &read.hash).unwrap();

    assert_eq!(
        added,
        Added {
            committed: false,
            reason: Some("hook-failed".into()),
            message: Some("Trailing space in PRIORITIES.md".into())
        }
    );
    assert_eq!(repo.subjects("main")[0], "chore: specs");
    assert_eq!(repo.git(&["diff", "--cached", "--name-only"]), "");
    assert_eq!(
        section_texts(&repo.read("specs/PRIORITIES.md"), "next")[2],
        SORT
    );
    assert_eq!(priorities.changes, 1);
}

/// US3 6: Undo of a committed add removes the entry, and commits the removal alone.
#[test]
fn undo_of_a_committed_add_commits_the_removal() {
    let repo = repo();
    let read = api::read_priorities(repo.path()).unwrap();
    let (added, _) = api::add_priority_and_commit(repo.path(), "next", SORT, &read.hash).unwrap();
    repo.write("README.md", "# Test, staged\n");
    repo.git(&["add", "README.md"]);

    let undone =
        api::undo_committed_priority(repo.path(), &[format!("- {SORT}")], &added.hash).unwrap();

    assert_eq!(
        repo.subjects("main")[0],
        "chore: remove \"Sort done features\""
    );
    assert_eq!(repo.changed_in("HEAD"), ["specs/PRIORITIES.md"]);
    assert_eq!(repo.read("specs/PRIORITIES.md"), TEXT);
    assert_eq!(
        repo.git(&["diff", "--cached", "--name-only"]),
        "README.md\n"
    );
    assert_eq!(undone.hash, hash(TEXT));
    assert_eq!(undone.changes, 0);
}

/// Review focus 6: Undo over a file changed since the add is refused, as a conflict, and nothing
/// is written or committed.
#[test]
fn undo_after_the_file_changed_is_refused() {
    let repo = repo();
    let read = api::read_priorities(repo.path()).unwrap();
    let (added, _) = api::add_priority_and_commit(repo.path(), "next", SORT, &read.hash).unwrap();
    let changed = repo.read("specs/PRIORITIES.md").replace("- Slack\n", "");
    repo.write("specs/PRIORITIES.md", &changed);

    let error =
        api::undo_committed_priority(repo.path(), &[format!("- {SORT}")], &added.hash).unwrap_err();

    assert_eq!(error.code, "conflict");
    assert_eq!(
        error.message,
        "PRIORITIES.md changed on disk. Your change was not applied."
    );
    assert_eq!(repo.read("specs/PRIORITIES.md"), changed);
    assert_eq!(
        repo.subjects("main")[0],
        "chore: add \"Sort done features\" to Next"
    );
}

/// A file staged by the human, its working copy then put back as committed, still has changes:
/// "Add and commit" writes the entry without committing, and the staged version stays staged.
#[test]
fn an_add_over_a_staged_change_is_not_committed() {
    let repo = repo();
    let staged = TEXT.replace("- Slack\n", "");
    repo.write("specs/PRIORITIES.md", &staged);
    repo.git(&["add", "specs/PRIORITIES.md"]);
    repo.write("specs/PRIORITIES.md", TEXT);
    let read = api::read_priorities(repo.path()).unwrap();

    let (_, added) = api::add_priority_and_commit(repo.path(), "next", SORT, &read.hash).unwrap();

    assert!(!added.committed);
    assert_eq!(added.reason.as_deref(), Some("other-changes"));
    assert_eq!(repo.subjects("main")[0], "chore: specs");
    assert_eq!(repo.git(&["show", ":specs/PRIORITIES.md"]), staged);
    assert_eq!(
        section_texts(&repo.read("specs/PRIORITIES.md"), "next")[2],
        SORT
    );
}

/// Undo of a committed add over a change staged since, the working copy put back as committed,
/// is refused, and the staged version stays staged.
#[test]
fn undo_over_a_staged_change_is_refused() {
    let repo = repo();
    let read = api::read_priorities(repo.path()).unwrap();
    let (added, _) = api::add_priority_and_commit(repo.path(), "next", SORT, &read.hash).unwrap();
    let committed = repo.read("specs/PRIORITIES.md");
    let staged = committed.replace("- Slack\n", "");
    repo.write("specs/PRIORITIES.md", &staged);
    repo.git(&["add", "specs/PRIORITIES.md"]);
    repo.write("specs/PRIORITIES.md", &committed);

    let error =
        api::undo_committed_priority(repo.path(), &[format!("- {SORT}")], &added.hash).unwrap_err();

    assert_eq!(error.code, "conflict");
    assert_eq!(repo.git(&["show", ":specs/PRIORITIES.md"]), staged);
    assert_eq!(repo.read("specs/PRIORITIES.md"), committed);
    assert_eq!(
        repo.subjects("main")[0],
        "chore: add \"Sort done features\" to Next"
    );
}
