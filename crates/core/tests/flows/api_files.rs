//! What the server may read and start: tracked files only, never a hidden file or a link, and a
//! feature starts from a draft of the repository and nothing else.

use uraeda_core::api;
use uraeda_core::workspace::Kind;

use crate::common::fixture;
use crate::common::repo::TestRepo;
use crate::common::texts::proposal;

const FOLDER: &str = "2026-10-11-web-ui";

fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(".env", "SECRET=1\n");
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write("specs/2026-10-11-web-ui/proposal.md", &proposal());
    repo.write("specs/2026-10-11-web-ui/mockups/a.html", "<p>a</p>");
    repo.commit("proposal");
    repo.switch("main");
    repo
}

#[test]
fn only_tracked_files_that_are_not_hidden_are_served_as_text() {
    let repo = repo();
    repo.write("notes.txt", "untracked\n");

    for path in [
        ".env",
        ".git/config",
        "notes.txt",
        "missing.md",
        "specs/../.env",
    ] {
        assert!(api::read_raw(repo.path(), path).is_err(), "{path}");
    }

    assert_eq!(
        api::read_raw(repo.path(), "specs/README.md").unwrap(),
        "# Specs\n"
    );
    assert!(
        api::read_raw(repo.path(), "specs/2026-10-11-web-ui/mockups/a.html").is_ok(),
        "a feature's file from its branch"
    );
}

#[test]
fn a_committed_link_is_never_followed() {
    let repo = repo();
    std::os::unix::fs::symlink(repo.path().join(".env"), repo.path().join("specs/link.md"))
        .unwrap();
    std::os::unix::fs::symlink("../.env", repo.path().join("specs/env.md")).unwrap();
    std::os::unix::fs::symlink(".", repo.path().join("specs/here")).unwrap();
    repo.commit("links");

    for path in ["specs/link.md", "specs/env.md", "specs/here/README.md"] {
        assert!(
            api::read_raw(repo.path(), path).is_err(),
            "{path} was served through a link"
        );
    }
    assert!(api::read_image(repo.path(), "specs/link.md").is_err());

    // A feature's file, read from its checkout, replaced by a link not yet committed.
    repo.switch(FOLDER);
    let mockup = "specs/2026-10-11-web-ui/mockups/a.html";
    std::fs::remove_file(repo.path().join(mockup)).unwrap();
    std::os::unix::fs::symlink(repo.path().join(".env"), repo.path().join(mockup)).unwrap();
    assert!(
        api::read_raw(repo.path(), mockup).is_err(),
        "the checkout's link is not followed"
    );
}

#[test]
fn a_feature_starts_from_a_draft_of_the_repository_and_nothing_else() {
    let repo = repo();
    let outside = repo.parent().join("victim.md");
    std::fs::write(&outside, "# Victim\n\n## What\n\nKeep me.\n").unwrap();

    for draft in [
        outside.to_str().unwrap(),
        "specs/drafts/../../../victim.md",
        "specs/drafts/../README.md",
        "specs/README.md",
    ] {
        assert!(
            api::start_feature(repo.path(), draft, Some("victim"), Kind::Feature).is_err(),
            "{draft}"
        );
    }

    assert!(
        outside.exists() && repo.exists("specs/README.md"),
        "nothing was moved"
    );
    assert_eq!(repo.porcelain(), "");
}

#[test]
fn a_change_typed_as_text_starts_with_its_images_or_not_at_all() {
    let repo = repo();
    let still = std::fs::read(fixture("images/still.gif")).unwrap();
    let drawing = std::fs::read(fixture("images/drawing.svg")).unwrap();
    let before = (
        repo.git(&["for-each-ref"]),
        repo.porcelain(),
        repo.subjects("main"),
    );

    let refused = api::start_change(
        repo.path(),
        "Fix the crash",
        &[still.clone(), drawing],
        Some("crash"),
    );

    assert!(
        refused.is_err(),
        "an image that is no image refuses the whole start"
    );
    assert_eq!(
        (
            repo.git(&["for-each-ref"]),
            repo.porcelain(),
            repo.subjects("main")
        ),
        before
    );
    assert!(!repo.exists(".worktrees"));

    let started = api::start_change(
        repo.path(),
        "Fix the crash\n\nIt crashes on save.",
        &[still],
        Some("crash"),
    )
    .unwrap();

    assert!(
        repo.git(&["branch", "--list", "change/*"])
            .contains("crash"),
        "{started:?}"
    );
    assert_eq!(repo.current_branch(), "main");
    assert_eq!(api::start_kind(Some("change")).ok(), Some(Kind::Change));
    assert!(api::start_kind(Some("bug")).is_err());
}
