//! `ura inbox clean`: the images of drafts and of the backlog that no markdown file of their folder
//! links, listed or deleted, with every linked image kept.

mod common;

use common::*;

/// A repository with a draft folder holding a linked image and a stray one, a single-file draft,
/// and a postponed folder with a stray image.
fn repo() -> TestRepo {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n",
    );
    repo.write(
        "specs/drafts/slow-lists/proposal.md",
        "# Slow lists\n\n## What\n\nSlow lists\n\n![shot](images/linked.webp)\n",
    );
    repo.write("specs/drafts/slow-lists/images/linked.webp", "kept");
    repo.write("specs/drafts/slow-lists/images/stray.webp", "stray");
    repo.write("specs/drafts/single.md", "# Single\n");
    repo.write(
        "specs/backlog/later/proposal.md",
        "# Later\n\n## What\n\nLater\n",
    );
    repo.write("specs/backlog/later/images/old.webp", "old");
    repo.commit("chore: drafts");
    repo
}

/// `--dry-run` names each image that nothing links, one path a line on stdout, and deletes nothing.
#[test]
fn a_dry_run_lists_the_unlinked_images_and_deletes_nothing() {
    let repo = repo();

    let output = ura(&repo, &["inbox", "clean", "--dry-run"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(
        output.stdout,
        "specs/backlog/later/images/old.webp\nspecs/drafts/slow-lists/images/stray.webp\n"
    );
    assert!(repo.exists("specs/drafts/slow-lists/images/stray.webp"));
    assert!(repo.exists("specs/backlog/later/images/old.webp"));
}

/// Without `--dry-run`, the unlinked images are deleted, the folder left empty with them, and the
/// linked image stays. The deletion is left uncommitted for the human to commit.
#[test]
fn it_deletes_the_unlinked_images_and_keeps_the_linked_ones() {
    let repo = repo();
    let head = repo.subjects("main");

    let output = ura(&repo, &["inbox", "clean"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(
        output.stdout,
        "specs/backlog/later/images/old.webp\nspecs/drafts/slow-lists/images/stray.webp\n"
    );
    assert_eq!(output.stderr, "removed 2 unlinked images\n");
    assert!(!repo.exists("specs/drafts/slow-lists/images/stray.webp"));
    assert!(!repo.exists("specs/backlog/later/images"));
    assert!(repo.exists("specs/drafts/slow-lists/images/linked.webp"));
    assert_eq!(repo.subjects("main"), head);
}

/// With nothing to clean, it says so and exits 0.
#[test]
fn nothing_to_clean_is_said_so() {
    let repo = repo();
    ura(&repo, &["inbox", "clean"]);

    let output = ura(&repo, &["inbox", "clean"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(output.stdout, "");
    assert_eq!(output.stderr, "no unlinked images\n");
}

/// A repository without a `specs/` folder is refused as the other commands refuse it.
#[test]
fn it_is_refused_without_a_specs_folder() {
    let repo = TestRepo::new();

    let output = ura(&repo, &["inbox", "clean"]);

    assert_eq!(output.code, 1);
    assert!(
        output.stderr.starts_with("ura: no specs/ folder at "),
        "{}",
        output.stderr
    );
}
