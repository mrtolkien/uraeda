//! An image named by its file, and a draft that moves into a folder for it: the name is made safe
//! and never overwrites, and every link to the draft follows it.

use uraeda_core::api;

use crate::common::fixture;
use crate::common::repo::TestRepo;
use crate::common::texts::proposal;

const FEATURE: &str = "2026-10-14-login-banner";
const PROPOSAL: &str = "specs/2026-10-14-login-banner/proposal.md";
const DRAFT: &str = "specs/drafts/login-banner.md";

fn image() -> Vec<u8> {
    std::fs::read(fixture("images/still.gif")).unwrap()
}

/// `main` with a single-file draft and a feature with its proposal on its own branch.
fn repo(priorities: &str) -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write("specs/PRIORITIES.md", priorities);
    repo.write(DRAFT, "# Login banner\n\nA banner.\n");
    repo.commit("chore: specs");
    repo.switch_new(FEATURE);
    repo.write(PROPOSAL, &proposal());
    repo.commit("chore(login-banner): proposal");
    repo.switch("main");
    repo
}

#[test]
fn an_image_file_is_named_lowercase_dashed_cut_and_never_over_another() {
    let repo = repo("# Priorities\n\n## Now\n");
    let long = format!("{}.png", "a".repeat(70));
    let rows = [
        (
            "Screenshot 2026-10-14 at 10.35.12.png",
            "screenshot-2026-10-14-at-10-35-12",
        ),
        ("two\nlines \t here.png", "two-lines-here"),
        ("a]b.png", "a-b"),
        ("😀.png", "image"),
        (long.as_str(), &"a".repeat(60)),
    ];
    for (name, expected) in rows {
        let attached = api::attach_image(repo.path(), PROPOSAL, &image(), Some(name)).unwrap();

        assert_eq!(
            attached.path,
            format!("specs/{FEATURE}/images/{expected}.webp"),
            "{name:?}"
        );
    }
    let first = api::attach_image(repo.path(), PROPOSAL, &image(), Some("login.png")).unwrap();
    let second = api::attach_image(repo.path(), PROPOSAL, &image(), Some("login.png")).unwrap();
    assert_ne!(
        first.path, second.path,
        "the second login.png is a file of its own"
    );
}

#[test]
fn every_form_of_link_to_a_draft_follows_it_into_its_folder() {
    let rows = [
        (
            "- [Login](<drafts/login-banner.md>)",
            "- [Login](<drafts/login-banner/proposal.md>)",
        ),
        (
            "- [Login](drafts/login-banner.md \"The banner\")",
            "- [Login](drafts/login-banner/proposal.md \"The banner\")",
        ),
        (
            "- See [it](https://example.com/1), then [Login](drafts/login-banner.md)",
            "- See [it](https://example.com/1), then [Login](drafts/login-banner/proposal.md)",
        ),
        (
            "- Banner work\n  - [Login](drafts/login-banner.md)",
            "- Banner work\n  - [Login](drafts/login-banner/proposal.md)",
        ),
        (
            "- [Login][r]\n\n[r]: drafts/login-banner.md \"t\"",
            "- [Login][r]\n\n[r]: drafts/login-banner/proposal.md \"t\"",
        ),
        (
            "- [Login](./drafts/login-banner.md)",
            "- [Login](./drafts/login-banner/proposal.md)",
        ),
        (
            "- [Login](/specs/drafts/login-banner.md#goal)",
            "- [Login](/specs/drafts/login-banner/proposal.md#goal)",
        ),
        // Text that is no link to the draft is left as written.
        (
            "- [Login](drafts/login.md), not drafts/login-banner.md\n- [x](drafts/login-banner.md.bak)",
            "- [Login](drafts/login.md), not drafts/login-banner.md\n- [x](drafts/login-banner.md.bak)",
        ),
    ];
    for (before, after) in rows {
        let repo = repo(&format!("# Priorities\n\n## Now\n\n{before}\n"));

        let attached = api::attach_image(repo.path(), DRAFT, &image(), Some("login.png")).unwrap();

        assert_eq!(
            attached.moved.as_deref(),
            Some("specs/drafts/login-banner/proposal.md")
        );
        assert_eq!(
            repo.read("specs/PRIORITIES.md"),
            format!("# Priorities\n\n## Now\n\n{after}\n"),
            "{before}"
        );
    }
}

#[test]
fn a_taken_folder_name_is_never_taken_over() {
    let repo = repo("# Priorities\n\n## Now\n\n- [Login](drafts/login-banner.md)\n");
    repo.write("specs/drafts/login-banner/proposal.md", "# Another\n");

    let attached = api::attach_image(repo.path(), DRAFT, &image(), Some("login.png")).unwrap();

    assert_ne!(
        attached.moved.as_deref(),
        Some("specs/drafts/login-banner/proposal.md")
    );
    assert_eq!(
        repo.read("specs/drafts/login-banner/proposal.md"),
        "# Another\n"
    );
    assert!(
        repo.read("specs/PRIORITIES.md").contains(
            attached
                .moved
                .as_deref()
                .unwrap()
                .trim_start_matches("specs/")
        )
    );
}
