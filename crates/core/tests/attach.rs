mod common;

use std::path::PathBuf;
use std::sync::Once;

use common::fixture;
use common::repo::TestRepo;
use common::texts::proposal;
use uraeda_core::api;

const FEATURE: &str = "2026-10-14-login-banner";
const PROPOSAL: &str = "specs/2026-10-14-login-banner/proposal.md";
const DRAFT: &str = "specs/drafts/login-banner.md";
const PRIORITIES: &str =
    "# Priorities\n\n## Now\n\n- [Login banner](drafts/login-banner.md), *before* the release\n";

/// The time of every test of this file, set once before any attach: the core reads it from the
/// process's environment, which every test shares.
fn at_10_35_12() {
    static NOW: Once = Once::new();
    // SAFETY: every test calls this first, so no other thread reads the environment while it is set.
    NOW.call_once(|| unsafe { std::env::set_var("URA_NOW", "20261014-103512") });
}

/// `main` with a single-file draft linked from the priorities, and a feature with its proposal on
/// its own branch.
fn repo() -> TestRepo {
    at_10_35_12();
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write("specs/PRIORITIES.md", PRIORITIES);
    repo.write(DRAFT, "# Login banner\n\nA banner.\n");
    repo.commit("chore: specs");
    repo.switch_new(FEATURE);
    repo.write(PROPOSAL, &proposal());
    repo.commit("chore(login-banner): proposal");
    repo.switch("main");
    repo
}

fn image(name: &str) -> Vec<u8> {
    std::fs::read(fixture(&format!("images/{name}"))).unwrap()
}

/// Where a path of the feature's branch is on disk: in the worktree created to reach it.
fn on_feature(repo: &TestRepo, path: &str) -> PathBuf {
    repo.path().join(".worktrees").join(FEATURE).join(path)
}

#[test]
#[allow(non_snake_case)]
fn US1_1_a_dropped_image_is_saved_next_to_the_proposal() {
    let repo = repo();

    let attached = api::attach_image(
        repo.path(),
        PROPOSAL,
        &image("desktop.png"),
        Some("Screenshot 2026-10-14 at 10.35.12.png"),
    )
    .unwrap();

    assert_eq!(
        attached.path,
        "specs/2026-10-14-login-banner/images/screenshot-2026-10-14-at-10-35-12.webp"
    );
    assert_eq!(
        attached.link,
        "![Screenshot 2026-10-14 at 10.35.12](images/screenshot-2026-10-14-at-10-35-12.webp)"
    );
    assert_eq!(attached.moved, None);
    let written = std::fs::read(on_feature(&repo, &attached.path)).unwrap();
    assert_eq!(&written[8..12], b"WEBP");
}

#[test]
#[allow(non_snake_case)]
fn US1_2_a_pasted_image_is_named_by_the_time() {
    let repo = repo();

    let attached = api::attach_image(repo.path(), PROPOSAL, &image("still.gif"), None).unwrap();

    assert_eq!(
        attached.path,
        "specs/2026-10-14-login-banner/images/pasted-20261014-103512.webp"
    );
    assert_eq!(
        attached.link,
        "![pasted image](images/pasted-20261014-103512.webp)"
    );
}

#[test]
fn names_are_lowercase_dashed_and_never_overwrite() {
    let repo = repo();
    let long = format!("{}.png", "a".repeat(70));
    let rows = [
        ("login.png", "login.webp", "login"),
        ("login.png", "login-2.webp", "login"),
        ("login.png", "login-3.webp", "login"),
        ("😀.png", "image.webp", "😀"),
        (
            long.as_str(),
            &format!("{}.webp", "a".repeat(60)),
            &"a".repeat(70),
        ),
        ("a]b.png", "a-b.webp", "a\\]b"),
    ];
    for (name, file, alt) in rows {
        let attached =
            api::attach_image(repo.path(), PROPOSAL, &image("still.gif"), Some(name)).unwrap();
        assert_eq!(
            attached.path,
            format!("specs/2026-10-14-login-banner/images/{file}"),
            "{name}"
        );
        assert_eq!(attached.link, format!("![{alt}](images/{file})"), "{name}");
        assert!(on_feature(&repo, &attached.path).exists(), "{name}");
    }
}

#[test]
#[allow(non_snake_case)]
fn US1_6_a_single_file_draft_becomes_a_folder() {
    let repo = repo();

    let attached =
        api::attach_image(repo.path(), DRAFT, &image("still.gif"), Some("login.png")).unwrap();

    assert_eq!(
        attached.moved.as_deref(),
        Some("specs/drafts/login-banner/proposal.md")
    );
    assert_eq!(attached.path, "specs/drafts/login-banner/images/login.webp");
    assert_eq!(attached.link, "![login](images/login.webp)");
    assert!(!repo.exists(DRAFT));
    assert_eq!(
        repo.read("specs/drafts/login-banner/proposal.md"),
        "# Login banner\n\nA banner.\n"
    );
    assert!(repo.exists("specs/drafts/login-banner/images/login.webp"));
    assert_eq!(
        repo.read("specs/PRIORITIES.md"),
        PRIORITIES.replace("drafts/login-banner.md", "drafts/login-banner/proposal.md")
    );
}

#[test]
fn a_taken_draft_folder_name_gets_a_number() {
    let repo = repo();
    repo.write("specs/drafts/login-banner/proposal.md", "# Another\n");

    let attached =
        api::attach_image(repo.path(), DRAFT, &image("still.gif"), Some("login.png")).unwrap();

    assert_eq!(
        attached.moved.as_deref(),
        Some("specs/drafts/login-banner-2/proposal.md")
    );
    assert_eq!(
        attached.path,
        "specs/drafts/login-banner-2/images/login.webp"
    );
    assert_eq!(
        repo.read("specs/drafts/login-banner/proposal.md"),
        "# Another\n"
    );
    assert!(
        repo.read("specs/PRIORITIES.md")
            .contains("(drafts/login-banner-2/proposal.md)")
    );
}

#[test]
fn a_draft_folder_keeps_its_place() {
    let repo = repo();
    repo.write("specs/drafts/banner/proposal.md", "# Banner\n");

    let attached = api::attach_image(
        repo.path(),
        "specs/drafts/banner/proposal.md",
        &image("still.gif"),
        Some("login.png"),
    )
    .unwrap();

    assert_eq!(attached.moved, None);
    assert_eq!(attached.path, "specs/drafts/banner/images/login.webp");
}

#[test]
fn a_refused_image_writes_nothing() {
    let repo = repo();

    let error = api::attach_image(
        repo.path(),
        DRAFT,
        &image("drawing.svg"),
        Some("drawing.svg"),
    )
    .unwrap_err();

    assert_eq!(error.code, "refused");
    assert_eq!(
        error.message,
        "Only PNG, JPEG, GIF, and WebP images can be added: drawing.svg is not one."
    );
    assert!(repo.exists(DRAFT));
    assert!(!repo.exists("specs/drafts/login-banner"));
    assert_eq!(repo.read("specs/PRIORITIES.md"), PRIORITIES);
}

#[test]
fn paths_outside_a_workflow_folder_are_refused() {
    let repo = repo();
    for path in [
        "specs/../x.md",
        "specs/.hidden/x.md",
        "README.md",
        "specs/PRIORITIES.md",
        "specs/drafts/../PRIORITIES.md",
        "specs/2026-10-14-login-banner/images/x.md",
        "specs/2026-10-14-login-banner/proposal.txt",
    ] {
        let error = api::attach_image(repo.path(), path, &image("still.gif"), Some("x.png"))
            .expect_err(path);
        assert_eq!(error.code, "refused", "{path}");
    }
    assert!(!repo.exists("images"));
    assert!(!repo.exists("specs/images"));
}

#[test]
fn images_are_read_by_their_bytes_only() {
    let repo = repo();
    let attached = api::attach_image(
        repo.path(),
        PROPOSAL,
        &image("still.gif"),
        Some("login.png"),
    )
    .unwrap();
    let drafted =
        api::attach_image(repo.path(), DRAFT, &image("still.gif"), Some("login.png")).unwrap();

    for path in [&attached.path, &drafted.path] {
        let (bytes, kind) = api::read_image(repo.path(), path).unwrap();
        assert_eq!(kind, "image/webp", "{path}");
        assert_eq!(&bytes[8..12], b"WEBP", "{path}");
    }
    for path in [PROPOSAL, "specs/../Cargo.toml", "specs/drafts/gone.webp"] {
        let error = api::read_image(repo.path(), path).expect_err(path);
        assert_eq!(error.code, "refused", "{path}");
        assert_eq!(error.message, format!("{path}: no such file"));
    }
}
