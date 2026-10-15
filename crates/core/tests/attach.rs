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
fn us1_1_a_dropped_image_is_saved_next_to_the_proposal() {
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
    let saved = image::load_from_memory(&written).unwrap();
    assert_eq!((saved.width(), saved.height()), (1440, 900));
}

#[test]
fn us1_2_a_pasted_image_is_named_by_the_time() {
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
    // The 60th character is a separator: the cut leaves no trailing `-`.
    let cut = format!("{} bcd.png", "a".repeat(59));
    let cut_alt = format!("{} bcd", "a".repeat(59));
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
        (cut.as_str(), &format!("{}.webp", "a".repeat(59)), &cut_alt),
        (".png", "image-2.webp", "image"),
        (
            "two\nlines \t here.png",
            "two-lines-here.webp",
            "two lines here",
        ),
        ("v1.2", "v1.webp", "v1"),
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
fn us1_6_a_single_file_draft_becomes_a_folder() {
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
        "specs/drafts/nothing/proposal.md",
        "specs/2026-10-14-login-banner/nothere.md",
    ] {
        let error = api::attach_image(repo.path(), path, &image("still.gif"), Some("x.png"))
            .expect_err(path);
        assert_eq!(error.code, "refused", "{path}");
    }
    assert!(!repo.exists("images"));
    assert!(!repo.exists("specs/images"));
    assert!(!repo.exists("specs/drafts/nothing"));
    assert!(!on_feature(&repo, "specs/2026-10-14-login-banner/images").exists());
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

/// `PRIORITIES.md` holding `items` under **Now**.
fn priorities(items: &str) -> String {
    format!("# Priorities\n\n## Now\n\n{items}\n")
}

#[test]
fn every_link_to_a_moved_draft_is_retargeted() {
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
            "- See [the issue](https://example.com/1), then [Login](drafts/login-banner.md)",
            "- See [the issue](https://example.com/1), then [Login](drafts/login-banner/proposal.md)",
        ),
        (
            "- Banner work\n  - [Login](drafts/login-banner.md)",
            "- Banner work\n  - [Login](drafts/login-banner/proposal.md)",
        ),
        (
            "- [Login][r], *before* the release\n\n[r]: drafts/login-banner.md \"t\"",
            "- [Login][r], *before* the release\n\n[r]: drafts/login-banner/proposal.md \"t\"",
        ),
        (
            "- [Login](./drafts/login-banner.md)",
            "- [Login](./drafts/login-banner/proposal.md)",
        ),
        (
            "- [Login](/specs/drafts/login-banner.md#goal)",
            "- [Login](/specs/drafts/login-banner/proposal.md#goal)",
        ),
        (
            "- [`a]b` *Login*](drafts/login-banner.md)",
            "- [`a]b` *Login*](drafts/login-banner/proposal.md)",
        ),
        // Text that is not a link to the draft is left as written.
        (
            "- [Login](drafts/login.md), not drafts/login-banner.md\n- [x](drafts/login-banner.md.bak)",
            "- [Login](drafts/login.md), not drafts/login-banner.md\n- [x](drafts/login-banner.md.bak)",
        ),
    ];
    for (before, after) in rows {
        let repo = repo();
        repo.write("specs/PRIORITIES.md", &priorities(before));

        api::attach_image(repo.path(), DRAFT, &image("still.gif"), Some("login.png")).unwrap();

        assert_eq!(
            repo.read("specs/PRIORITIES.md"),
            priorities(after),
            "{before}"
        );
    }
}

/// Review focus 7: a note linking a draft that becomes a folder links its `proposal.md`, as the
/// priorities' entries do, and the rest of the inbox stays as written.
#[test]
fn a_note_linking_a_moved_draft_is_retargeted() {
    let repo = repo();
    let inbox = "# Inbox\n\n## UI\n\n- [Login banner](drafts/login-banner.md)\n- [Other](drafts/other.md)\n";
    repo.write("specs/INBOX.md", inbox);

    api::attach_image(repo.path(), DRAFT, &image("still.gif"), Some("login.png")).unwrap();

    assert_eq!(
        repo.read("specs/INBOX.md"),
        inbox.replace("drafts/login-banner.md", "drafts/login-banner/proposal.md")
    );
    assert_eq!(
        repo.read("specs/PRIORITIES.md"),
        PRIORITIES.replace("drafts/login-banner.md", "drafts/login-banner/proposal.md")
    );
}

#[test]
fn a_draft_not_linked_from_the_priorities_moves_alone() {
    let repo = repo();
    let text = priorities("- [Other](drafts/other.md)");
    repo.write("specs/PRIORITIES.md", &text);

    let attached =
        api::attach_image(repo.path(), DRAFT, &image("still.gif"), Some("login.png")).unwrap();

    assert_eq!(
        attached.moved.as_deref(),
        Some("specs/drafts/login-banner/proposal.md")
    );
    assert_eq!(repo.read("specs/PRIORITIES.md"), text);
}

#[test]
fn a_missing_priorities_file_stays_missing() {
    let repo = repo();
    repo.remove("specs/PRIORITIES.md");

    let attached =
        api::attach_image(repo.path(), DRAFT, &image("still.gif"), Some("login.png")).unwrap();

    assert_eq!(
        attached.moved.as_deref(),
        Some("specs/drafts/login-banner/proposal.md")
    );
    assert!(repo.exists("specs/drafts/login-banner/images/login.webp"));
    assert!(!repo.exists("specs/PRIORITIES.md"));
}

/// Makes `path` read-only, or returns `false` when the tests run as root, which writes anyway.
#[cfg(unix)]
fn read_only(path: &std::path::Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    let mode = if path.is_dir() { 0o555 } else { 0o444 };
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(mode)).unwrap();
    let probe = if path.is_dir() {
        std::fs::write(path.join(".probe"), "").is_err()
    } else {
        std::fs::OpenOptions::new().append(true).open(path).is_err()
    };
    let _ = std::fs::remove_file(path.join(".probe"));
    probe
}

#[cfg(unix)]
fn writable(path: &std::path::Path) {
    use std::os::unix::fs::PermissionsExt;
    let mode = if path.is_dir() { 0o755 } else { 0o644 };
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(mode)).unwrap();
}

#[cfg(unix)]
#[test]
fn a_failed_move_leaves_the_draft_as_it_was() {
    let repo = repo();
    let file = repo.path().join("specs/PRIORITIES.md");
    if !read_only(&file) {
        return;
    }

    let error =
        api::attach_image(repo.path(), DRAFT, &image("still.gif"), Some("login.png")).unwrap_err();
    writable(&file);

    assert_eq!(error.code, "refused");
    assert!(
        error.message.starts_with("The image could not be saved: ") && error.message.ends_with('.'),
        "{}",
        error.message
    );
    assert_eq!(repo.read(DRAFT), "# Login banner\n\nA banner.\n");
    assert!(!repo.exists("specs/drafts/login-banner"));
    assert_eq!(repo.read("specs/PRIORITIES.md"), PRIORITIES);
}

/// The priorities' link is put back when the inbox's cannot be written: no list links a path
/// that does not exist.
#[cfg(unix)]
#[test]
fn a_failed_inbox_write_leaves_both_lists_as_they_were() {
    let repo = repo();
    let inbox = "# Inbox\n\n- [Login banner](drafts/login-banner.md)\n";
    repo.write("specs/INBOX.md", inbox);
    let file = repo.path().join("specs/INBOX.md");
    if !read_only(&file) {
        return;
    }

    let error =
        api::attach_image(repo.path(), DRAFT, &image("still.gif"), Some("login.png")).unwrap_err();
    writable(&file);

    assert_eq!(error.code, "refused");
    assert_eq!(repo.read(DRAFT), "# Login banner\n\nA banner.\n");
    assert!(!repo.exists("specs/drafts/login-banner"));
    assert_eq!(repo.read("specs/PRIORITIES.md"), PRIORITIES);
    assert_eq!(repo.read("specs/INBOX.md"), inbox);
}

#[cfg(unix)]
#[test]
fn a_draft_that_cannot_get_a_folder_stays_a_file() {
    let repo = repo();
    let drafts = repo.path().join("specs/drafts");
    if !read_only(&drafts) {
        return;
    }

    let error =
        api::attach_image(repo.path(), DRAFT, &image("still.gif"), Some("login.png")).unwrap_err();
    writable(&drafts);

    assert_eq!(error.code, "refused");
    assert!(
        error.message.starts_with("The image could not be saved: "),
        "{}",
        error.message
    );
    assert!(repo.exists(DRAFT));
    assert!(!repo.exists("specs/drafts/login-banner"));
    assert_eq!(repo.read("specs/PRIORITIES.md"), PRIORITIES);
}

#[cfg(unix)]
#[test]
fn images_are_never_written_or_read_through_a_symbolic_link() {
    use std::os::unix::fs::symlink;
    let repo = repo();
    let outside = repo.path().join("outside");
    std::fs::create_dir(&outside).unwrap();
    std::fs::copy(fixture("images/lossless.webp"), outside.join("x.webp")).unwrap();
    repo.write("specs/drafts/linked/proposal.md", "# Linked\n");
    symlink(&outside, repo.path().join("specs/drafts/linked/images")).unwrap();
    repo.write("specs/drafts/banner/proposal.md", "# Banner\n");
    std::fs::create_dir(repo.path().join("specs/drafts/banner/images")).unwrap();
    symlink(
        outside.join("target.webp"),
        repo.path().join("specs/drafts/banner/images/login.webp"),
    )
    .unwrap();
    symlink(
        outside.join("x.webp"),
        repo.path().join("specs/drafts/banner/images/x.webp"),
    )
    .unwrap();

    let error = api::attach_image(
        repo.path(),
        "specs/drafts/linked/proposal.md",
        &image("still.gif"),
        Some("login.png"),
    )
    .unwrap_err();
    assert_eq!(error.code, "refused");
    assert_eq!(
        error.message,
        "The image could not be saved: specs/drafts/linked/images goes through a symbolic link."
    );
    assert!(!outside.join("login.webp").exists());

    let attached = api::attach_image(
        repo.path(),
        "specs/drafts/banner/proposal.md",
        &image("still.gif"),
        Some("login.png"),
    )
    .unwrap();
    assert_eq!(attached.path, "specs/drafts/banner/images/login-2.webp");
    assert!(!outside.join("target.webp").exists());

    for path in [
        "specs/drafts/linked/images/x.webp",
        "specs/drafts/banner/images/x.webp",
    ] {
        let error = api::read_image(repo.path(), path)
            .map(|_| ())
            .expect_err(path);
        assert_eq!(error.message, format!("{path}: no such file"));
    }
}

#[cfg(unix)]
#[test]
fn windows_separators_are_refused() {
    let repo = repo();
    for path in ["specs/drafts/a:b.webp", "specs/drafts/a\\b.webp"] {
        std::fs::copy(fixture("images/lossless.webp"), repo.path().join(path)).unwrap();
        let error = api::read_image(repo.path(), path)
            .map(|_| ())
            .expect_err(path);
        assert_eq!(error.message, format!("{path}: no such file"));
    }
    std::fs::write(repo.path().join("specs/drafts/a:b.md"), "# A\n").unwrap();
    let error = api::attach_image(
        repo.path(),
        "specs/drafts/a:b.md",
        &image("still.gif"),
        Some("x.png"),
    )
    .unwrap_err();
    assert_eq!(error.code, "refused");
    assert!(!repo.exists("specs/drafts/a:b"));
}
