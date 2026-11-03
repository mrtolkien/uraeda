mod common;

use std::path::Path;

use common::repo::TestRepo;
use common::texts::{proposal, spec};
use uraeda_core::actions::edited;
use uraeda_core::actions::place::Place;
use uraeda_core::api;
use uraeda_core::files::document::hash;

const FOLDER: &str = "2026-10-11-web-ui";
const SPEC: &str = "specs/2026-10-11-web-ui/spec.md";
const CONTRACT: &str = "specs/2026-10-11-web-ui/contracts/api.md";
const PRIORITIES: &str = "specs/PRIORITIES.md";
const PRIORITIES_TEXT: &str = "# Priorities\n\n## Now\n\n- Dark mode\n";
const DECISION: &str = "specs/decisions/git.md";
const DECISION_TEXT: &str = "# Git\n\n## Context\n\nWhy.\n\n## Decision\n\nWhat.\n";

/// A repository on `main` with its priorities and a decision, and a feature on its own branch.
fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write(PRIORITIES, PRIORITIES_TEXT);
    repo.write(DECISION, DECISION_TEXT);
    repo.write("a.md", "# Outside specs\n");
    repo.write("Cargo.toml", "[package]\n");
    repo.git(&["add", "."]);
    repo.git(&["commit", "--quiet", "--no-verify", "-m", "chore: specs"]);
    repo.switch_new(FOLDER);
    repo.write(&format!("specs/{FOLDER}/proposal.md"), &proposal());
    repo.write(SPEC, &spec("awaiting-human", 1, 0));
    repo.git(&["add", "specs"]);
    repo.git(&["commit", "--quiet", "--no-verify", "-m", "spec"]);
    repo.switch("main");
    repo
}

fn place(root: &Path) -> Place {
    Place {
        root: root.to_path_buf(),
        created: false,
        switched: None,
    }
}

/// Breaks caught: a commit on save, a path not recorded as a buffer's edit, a file's format
/// "fixed" on save.
#[test]
fn a_buffer_save_writes_without_committing() {
    let repo = repo();
    let head = repo.git(&["rev-parse", "HEAD"]);
    let read = api::read_buffer(repo.path(), PRIORITIES).unwrap();
    assert_eq!(read.branch, "main");
    let typed = read.text.replace("## Now\n\n", "## Now\n\n- Global undo\n");

    let saved = api::save_buffer(repo.path(), PRIORITIES, &typed, &read.hash).unwrap();

    assert_eq!(saved, hash(&typed));
    assert_eq!(repo.read(PRIORITIES), typed);
    assert_eq!(repo.git(&["rev-parse", "HEAD"]), head);
    assert_eq!(edited::list(&place(repo.path())), vec![PRIORITIES]);

    // A decision with a section removed breaks its format: it is written as typed all the same.
    let typed = "# Git\n\n## Decision\n\nWhat.\n";
    api::save_buffer(repo.path(), DECISION, typed, &hash(DECISION_TEXT)).unwrap();
    assert_eq!(repo.read(DECISION), typed);
    assert_eq!(repo.git(&["rev-parse", "HEAD"]), head);
    assert_eq!(
        edited::list(&place(repo.path())),
        vec![PRIORITIES, DECISION]
    );
}

/// Break caught: a write over a file changed since the buffer read it.
#[test]
fn a_buffer_save_over_a_changed_file_writes_nothing() {
    let repo = repo();
    let read = api::read_buffer(repo.path(), PRIORITIES).unwrap();
    repo.write(
        PRIORITIES,
        "# Priorities\n\n## Now\n\n- Changed elsewhere\n",
    );

    let error = api::save_buffer(repo.path(), PRIORITIES, "# Mine\n", &read.hash).unwrap_err();

    assert_eq!(error.code, "conflict");
    assert_eq!(
        repo.read(PRIORITIES),
        "# Priorities\n\n## Now\n\n- Changed elsewhere\n"
    );
    assert!(edited::list(&place(repo.path())).is_empty());
}

/// Review focus 2. Break caught: a feature's file, at any depth of its folder, written on the
/// default branch.
#[test]
fn a_buffer_writes_a_features_file_on_its_branch() {
    let repo = repo();
    let read = api::read_buffer(repo.path(), SPEC).unwrap();
    assert_eq!(read.branch, FOLDER);
    let typed = format!("{}More.\n", read.text);

    api::save_buffer(repo.path(), SPEC, &typed, &read.hash).unwrap();
    api::save_buffer(repo.path(), CONTRACT, "# API\n", &hash("")).unwrap();

    let worktree = repo.path().join(".worktrees").join(FOLDER);
    assert_eq!(std::fs::read_to_string(worktree.join(SPEC)).unwrap(), typed);
    assert_eq!(
        std::fs::read_to_string(worktree.join(CONTRACT)).unwrap(),
        "# API\n"
    );
    assert!(!repo.exists(SPEC));
    assert!(!repo.exists(CONTRACT));
    assert_eq!(repo.porcelain(), "");
    assert_eq!(edited::list(&place(&worktree)), vec![CONTRACT, SPEC]);
    assert!(edited::list(&place(repo.path())).is_empty());
    assert_eq!(
        api::read_buffer(repo.path(), CONTRACT).unwrap().text,
        "# API\n"
    );
}

/// Review focus 1. Break caught: a path that climbs out of `specs/`, by `..` or a symlink, read or
/// written.
#[test]
fn a_buffer_refuses_paths_outside_specs() {
    let repo = repo();
    std::fs::create_dir_all(repo.path().join("specs/x")).unwrap();
    let outside = repo.parent().join("outside.md");
    std::fs::write(&outside, "# Outside\n").unwrap();
    std::os::unix::fs::symlink(&outside, repo.path().join("specs/out.md")).unwrap();
    std::os::unix::fs::symlink(
        repo.parent().join("missing.md"),
        repo.path().join("specs/dangling.md"),
    )
    .unwrap();
    std::os::unix::fs::symlink(repo.parent(), repo.path().join("specs/up")).unwrap();

    for (path, previous) in [
        ("Cargo.toml", hash("[package]\n")),
        ("specs/../Cargo.toml", hash("[package]\n")),
        ("specs/x/../../a.md", hash("# Outside specs\n")),
        // Inside `specs/`, but the default branch's file through a feature's folder.
        (
            "specs/2026-10-11-web-ui/../PRIORITIES.md",
            hash(PRIORITIES_TEXT),
        ),
        ("specs/image.png", hash("")),
        ("specs/out.md", hash("# Outside\n")),
        ("specs/dangling.md", hash("")),
        ("specs/up/outside.md", hash("# Outside\n")),
    ] {
        let message = format!("{path} is not a Markdown file of specs/");
        let read = api::read_buffer(repo.path(), path).unwrap_err();
        assert_eq!(read.message, message, "read {path}");
        let saved = api::save_buffer(repo.path(), path, "# Mine\n", &previous).unwrap_err();
        assert_eq!(saved.message, message, "save {path}");
    }
    assert_eq!(std::fs::read_to_string(&outside).unwrap(), "# Outside\n");
    assert!(!repo.parent().join("missing.md").exists());
    assert_eq!(repo.read("a.md"), "# Outside specs\n");
    assert_eq!(repo.read("Cargo.toml"), "[package]\n");
    assert_eq!(repo.read(PRIORITIES), PRIORITIES_TEXT);
    assert!(!repo.path().join(".worktrees").exists());
    assert!(edited::list(&place(repo.path())).is_empty());
}

/// Break caught: the frontmatter stripped from a buffer's text.
#[test]
fn a_buffer_reads_the_whole_file() {
    let repo = repo();

    let read = api::read_buffer(repo.path(), SPEC).unwrap();

    assert!(read.text.starts_with("---\n"), "{}", read.text);
    assert_eq!(read.text, spec("awaiting-human", 1, 0));
}
