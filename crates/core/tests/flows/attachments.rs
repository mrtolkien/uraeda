//! The attachments decision's rules: every attached image becomes one small, safe WebP saved beside
//! its file, types that can carry code are refused, and nothing goes through a symbolic link.

use std::path::PathBuf;

use uraeda_core::api;
use uraeda_core::images::{self, MAX_BYTES, MAX_EDGE};

use crate::common::fixture;
use crate::common::repo::TestRepo;
use crate::common::texts::proposal;

const FEATURE: &str = "2026-10-14-login-banner";
const PROPOSAL: &str = "specs/2026-10-14-login-banner/proposal.md";
const DRAFT: &str = "specs/drafts/login-banner.md";
const PRIORITIES: &str = "# Priorities\n\n## Now\n\n- [Login banner](drafts/login-banner.md)\n";

fn image(name: &str) -> Vec<u8> {
    std::fs::read(fixture(&format!("images/{name}"))).unwrap()
}

/// `main` with a single-file draft linked from the priorities and the inbox, and a feature with
/// its proposal on its own branch.
fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write("specs/PRIORITIES.md", PRIORITIES);
    repo.write(
        "specs/INBOX.md",
        "# Inbox\n\n- [Banner](drafts/login-banner.md)\n",
    );
    repo.write(DRAFT, "# Login banner\n\nA banner.\n");
    repo.commit("chore: specs");
    repo.switch_new(FEATURE);
    repo.write(PROPOSAL, &proposal());
    repo.commit("chore(login-banner): proposal");
    repo.switch("main");
    repo
}

/// Where a path of the feature's branch is on disk: in the worktree made to reach it.
fn on_feature(repo: &TestRepo, path: &str) -> PathBuf {
    repo.path().join(".worktrees").join(FEATURE).join(path)
}

/// The fourcc of every chunk of a RIFF WebP file, in order.
fn chunks(bytes: &[u8]) -> Vec<String> {
    assert_eq!(&bytes[..4], b"RIFF");
    assert_eq!(&bytes[8..12], b"WEBP");
    let mut found = Vec::new();
    let mut at = 12;
    while at + 8 <= bytes.len() {
        found.push(String::from_utf8_lossy(&bytes[at..at + 4]).into_owned());
        let size = u32::from_le_bytes(bytes[at + 4..at + 8].try_into().unwrap()) as usize;
        at += 8 + size + size % 2;
    }
    found
}

#[test]
fn every_attached_image_becomes_one_safe_webp() {
    let accepted = [
        "desktop.png",
        "phone.png",
        "photo.jpg",
        "still.gif",
        "animated.webp",
        "animated.png",
        "lossy.webp",
        "lossless.webp",
        "alpha_lossy.webp",
        "iccp_bomb.png",
    ];
    for name in accepted {
        let encoded =
            images::encode(&image(name), name).unwrap_or_else(|error| panic!("{name}: {error}"));

        assert_eq!(encoded.extension, "webp", "{name}");
        let decoded = image::load_from_memory(&encoded.bytes).unwrap();
        assert!(
            decoded.width().max(decoded.height()) <= MAX_EDGE,
            "{name} is downscaled"
        );
        let found = chunks(&encoded.bytes);
        let carries_metadata = found
            .iter()
            .any(|chunk| ["EXIF", "ICCP", "XMP "].contains(&chunk.as_str()));
        assert!(!carries_metadata, "{name} holds {found:?}");
    }
}

#[test]
fn a_photo_is_turned_upright_and_an_animated_gif_keeps_its_frames() {
    let photo = images::encode(&image("photo.jpg"), "photo.jpg").unwrap();
    let animated = images::encode(&image("animated.gif"), "animated.gif").unwrap();

    assert!(
        photo.height > photo.width,
        "the camera's rotation is applied"
    );
    assert_eq!(animated.extension, "gif");
    let frames = image::codecs::gif::GifDecoder::new(std::io::Cursor::new(animated.bytes)).unwrap();
    assert!(image::AnimationDecoder::into_frames(frames).count() > 1);
}

#[test]
fn what_cannot_be_a_safe_image_is_refused() {
    let svg = image("drawing.svg");
    let png_named_svg = image("desktop.png");
    let mut huge = image("desktop.png");
    huge.resize(MAX_BYTES + 1, 0);
    let refused: [(&str, Vec<u8>); 7] = [
        ("drawing.svg", svg.clone()),
        ("a page that is no image.png", image("page.png")),
        ("README.md", image("README.md")),
        ("truncated.png", image("truncated.png")),
        ("bomb.png", image("bomb.png")),
        ("huge.png", huge),
        ("code.png", svg),
    ];
    for (name, bytes) in refused {
        assert!(images::encode(&bytes, name).is_err(), "{name} was accepted");
    }
    assert!(
        images::encode(&png_named_svg, "drawing.svg").is_ok(),
        "the type comes from the bytes, not the name"
    );
}

#[test]
fn a_refused_image_writes_nothing() {
    let repo = repo();

    let error = api::attach_image(
        repo.path(),
        DRAFT,
        &image("drawing.svg"),
        Some("drawing.svg"),
    );

    assert_eq!(error.unwrap_err().code, "refused");
    assert!(repo.exists(DRAFT), "the draft did not become a folder");
    assert!(!repo.exists("specs/drafts/login-banner"));
    assert_eq!(repo.read("specs/PRIORITIES.md"), PRIORITIES);
    assert_eq!(repo.porcelain(), "");
}

#[test]
fn an_image_is_committed_beside_its_file_and_linked_relatively() {
    let repo = repo();

    let first = api::attach_image(
        repo.path(),
        PROPOSAL,
        &image("desktop.png"),
        Some("Login.png"),
    )
    .unwrap();
    let second = api::attach_image(
        repo.path(),
        PROPOSAL,
        &image("desktop.png"),
        Some("Login.png"),
    )
    .unwrap();
    let pasted = api::attach_image(repo.path(), PROPOSAL, &image("still.gif"), None).unwrap();

    let folder = format!("specs/{FEATURE}/images/");
    for attached in [&first, &second, &pasted] {
        assert!(attached.path.starts_with(&folder), "{}", attached.path);
        let file = attached.path.rsplit('/').next().unwrap();
        assert!(
            attached.link.starts_with("![")
                && attached.link.ends_with(&format!("](images/{file})"))
        );
        assert_eq!(
            &std::fs::read(on_feature(&repo, &attached.path)).unwrap()[8..12],
            b"WEBP"
        );
    }
    assert_ne!(first.path, second.path, "an image never overwrites another");

    let text = format!("{}\n{}\n", proposal(), first.link);
    let read = api::read_text(repo.path(), PROPOSAL).unwrap();
    api::save_text(repo.path(), PROPOSAL, &text, &read.hash).unwrap();
    api::commit_text(repo.path(), PROPOSAL).unwrap();

    let committed = repo.changed_in(FEATURE);
    assert!(
        committed.contains(&first.path),
        "the linked image leaves with its file: {committed:?}"
    );
    assert!(
        !committed.contains(&second.path),
        "an image no file links is not committed"
    );
}

#[test]
fn a_single_file_draft_becomes_a_folder_and_every_link_follows() {
    let repo = repo();

    let attached =
        api::attach_image(repo.path(), DRAFT, &image("still.gif"), Some("login.png")).unwrap();

    let moved = attached.moved.unwrap();
    assert!(!repo.exists(DRAFT));
    assert_eq!(repo.read(&moved), "# Login banner\n\nA banner.\n");
    assert!(repo.exists(&attached.path));
    let target = moved.trim_start_matches("specs/");
    for list in ["specs/PRIORITIES.md", "specs/INBOX.md"] {
        let text = repo.read(list);
        assert!(text.contains(target), "{list} links {target}: {text}");
        assert!(
            !text.contains("login-banner.md"),
            "{list} still links the old file"
        );
    }
}

#[test]
fn only_markdown_files_of_a_workflow_folder_take_images() {
    let repo = repo();
    for path in [
        "specs/../x.md",
        "README.md",
        "specs/PRIORITIES.md",
        "specs/drafts/../PRIORITIES.md",
        "specs/2026-10-14-login-banner/proposal.txt",
        "specs/drafts/nothing/proposal.md",
        "specs/2026-10-14-login-banner/nothere.md",
    ] {
        let result = api::attach_image(repo.path(), path, &image("still.gif"), Some("x.png"));

        assert_eq!(result.expect_err(path).code, "refused", "{path}");
    }
    assert!(!repo.exists("images"));
    assert!(!repo.exists("specs/images"));
    assert_eq!(repo.porcelain(), "");
}

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

    let through_a_folder = api::attach_image(
        repo.path(),
        "specs/drafts/linked/proposal.md",
        &image("still.gif"),
        Some("login.png"),
    );
    let over_a_link = api::attach_image(
        repo.path(),
        "specs/drafts/banner/proposal.md",
        &image("still.gif"),
        Some("login.png"),
    )
    .unwrap();

    assert!(through_a_folder.is_err());
    assert!(!outside.join("login.webp").exists());
    assert!(
        !outside.join("target.webp").exists(),
        "a link is never written through"
    );
    assert_ne!(over_a_link.path, "specs/drafts/banner/images/login.webp");
    for path in [
        "specs/drafts/linked/images/x.webp",
        "specs/drafts/banner/images/x.webp",
    ] {
        assert!(
            api::read_image(repo.path(), path).is_err(),
            "{path} was read through a link"
        );
    }
}

#[test]
fn an_image_is_read_back_by_its_bytes_and_a_text_file_is_not_an_image() {
    let repo = repo();
    let attached = api::attach_image(
        repo.path(),
        PROPOSAL,
        &image("still.gif"),
        Some("login.png"),
    )
    .unwrap();

    let (bytes, kind) = api::read_image(repo.path(), &attached.path).unwrap();

    assert_eq!(kind, "image/webp");
    assert_eq!(&bytes[8..12], b"WEBP");
    for path in [PROPOSAL, "specs/../Cargo.toml", "specs/drafts/gone.webp"] {
        assert!(api::read_image(repo.path(), path).is_err(), "{path}");
    }
}
