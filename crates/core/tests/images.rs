mod common;

use std::path::PathBuf;
use std::process::Command;

use common::fixture;
use uraeda_core::images::{self, MAX_BYTES};

fn read(name: &str) -> Vec<u8> {
    std::fs::read(fixture(&format!("images/{name}"))).unwrap()
}

/// The fourcc of every chunk of a RIFF WebP file, in order.
fn webp_chunks(bytes: &[u8]) -> Vec<String> {
    assert_eq!(&bytes[..4], b"RIFF");
    assert_eq!(&bytes[8..12], b"WEBP");
    let mut chunks = Vec::new();
    let mut at = 12;
    while at + 8 <= bytes.len() {
        chunks.push(String::from_utf8_lossy(&bytes[at..at + 4]).into_owned());
        let size = u32::from_le_bytes(bytes[at + 4..at + 8].try_into().unwrap()) as usize;
        at += 8 + size + size % 2;
    }
    chunks
}

fn contains(haystack: &[u8], needle: &[u8]) -> bool {
    haystack
        .windows(needle.len())
        .any(|window| window == needle)
}

/// The extension and size of an encoded image, or the refusal's text.
type Expected = Result<(&'static str, u32, u32), &'static str>;

#[test]
fn attached_images_are_checked_and_reencoded() {
    let rows: [(&str, Expected); 12] = [
        ("desktop.png", Ok(("webp", 1440, 900))),
        ("phone.png", Ok(("webp", 402, 874))),
        // 3000×2000 stored, turned upright by its orientation 6, then downscaled
        ("photo.jpg", Ok(("webp", 1717, 2576))),
        ("animated.gif", Ok(("gif", 64, 48))),
        ("still.gif", Ok(("webp", 64, 48))),
        ("lossy.webp", Ok(("webp", 402, 874))),
        ("lossless.webp", Ok(("webp", 402, 874))),
        (
            "drawing.svg",
            Err("Only PNG, JPEG, GIF, and WebP images can be added: drawing.svg is not one."),
        ),
        (
            "page.png",
            Err("Only PNG, JPEG, GIF, and WebP images can be added: page.png is not one."),
        ),
        (
            "README.md",
            Err("Only PNG, JPEG, GIF, and WebP images can be added: README.md is not one."),
        ),
        (
            "truncated.png",
            Err("This image could not be read: truncated.png."),
        ),
        (
            "bomb.png",
            Err("This image is too large: bomb.png is 20000×20000 pixels."),
        ),
    ];
    for (name, expected) in rows {
        let result = images::encode(&read(name), name);
        match expected {
            Ok((extension, width, height)) => {
                let encoded = result.unwrap_or_else(|error| panic!("{name}: {error}"));
                assert_eq!(
                    (encoded.extension, encoded.width, encoded.height),
                    (extension, width, height),
                    "{name}"
                );
                let decoded = image::load_from_memory(&encoded.bytes).unwrap();
                assert_eq!(
                    (decoded.width(), decoded.height()),
                    (width, height),
                    "{name}"
                );
                if extension == "webp" {
                    assert!(
                        webp_chunks(&encoded.bytes).len() == 1,
                        "{name}: one image chunk"
                    );
                }
            }
            Err(text) => {
                let error = result
                    .err()
                    .unwrap_or_else(|| panic!("{name} was accepted"));
                assert_eq!(error.to_string(), text, "{name}");
            }
        }
    }
}

#[test]
fn an_animated_gif_is_kept_unchanged() {
    let bytes = read("animated.gif");
    assert_eq!(images::encode(&bytes, "animated.gif").unwrap().bytes, bytes);
}

#[test]
fn the_type_comes_from_the_bytes_not_the_name() {
    let encoded = images::encode(&read("desktop.png"), "desktop.jpg").unwrap();
    assert_eq!(webp_chunks(&encoded.bytes), ["VP8L"]);
    let refused = images::encode(&read("page.png"), "page.webp").unwrap_err();
    assert_eq!(
        refused.to_string(),
        "Only PNG, JPEG, GIF, and WebP images can be added: page.webp is not one."
    );
}

#[test]
fn an_image_over_20_mb_is_refused_before_decoding() {
    let mut big = b"\x89PNG\r\n\x1a\n".to_vec();
    big.resize(21 * 1024 * 1024, 0);
    assert_eq!(
        images::encode(&big, "big.png").unwrap_err().to_string(),
        "This image is over 20 MB: big.png is 21 MB."
    );
    big.resize(MAX_BYTES + 200 * 1024, 0);
    assert_eq!(
        images::encode(&big, "big.png").unwrap_err().to_string(),
        "This image is over 20 MB: big.png is 20.2 MB."
    );
    // exactly 20 MB passes the size check, and fails only as unreadable
    big.truncate(MAX_BYTES);
    assert_eq!(
        images::encode(&big, "big.png").unwrap_err().to_string(),
        "This image could not be read: big.png."
    );
}

#[test]
fn an_unknown_type_is_refused_before_its_size() {
    let svg = vec![b' '; MAX_BYTES + 1];
    assert_eq!(
        images::encode(&svg, "huge.svg").unwrap_err().to_string(),
        "Only PNG, JPEG, GIF, and WebP images can be added: huge.svg is not one."
    );
}

#[test]
fn reencoded_images_hold_no_metadata() {
    let photo = read("photo.jpg");
    // the fixture holds what the output must not
    for marker in [
        &b"Exif\0"[..],
        b"UraedaCam 3000",
        b"UraedaPhone",
        b"xmpmeta",
    ] {
        assert!(contains(&photo, marker));
    }
    let encoded = images::encode(&photo, "photo.jpg").unwrap();
    for marker in [
        &b"Exif\0"[..],
        b"EXIF",
        b"XMP ",
        b"xmpmeta",
        b"UraedaCam 3000",
        b"UraedaPhone",
    ] {
        assert!(
            !contains(&encoded.bytes, marker),
            "{}",
            String::from_utf8_lossy(marker)
        );
    }
    assert_eq!(webp_chunks(&encoded.bytes), ["VP8 "]);
}

#[test]
fn photos_are_turned_upright() {
    // The stored image has a red square in its top-left corner; orientation 6 turns it a quarter
    // clockwise, so the square shows in the top-right corner.
    let encoded = images::encode(&read("photo.jpg"), "photo.jpg").unwrap();
    let decoded = image::load_from_memory(&encoded.bytes).unwrap().to_rgb8();
    let [red, green, blue] = decoded.get_pixel(encoded.width - 60, 60).0;
    assert!(red > 180 && green < 80 && blue < 80, "{red} {green} {blue}");
    let [red, ..] = decoded.get_pixel(60, 60).0;
    assert!(red < 100, "the top-left corner is not red: {red}");
}

#[test]
fn photos_are_lossy_and_screenshots_near_lossless() {
    let rows = [
        ("photo.jpg", "VP8 "),
        ("lossy.webp", "VP8 "),
        ("desktop.png", "VP8L"),
        ("lossless.webp", "VP8L"),
        ("still.gif", "VP8L"),
    ];
    for (name, chunk) in rows {
        let encoded = images::encode(&read(name), name).unwrap();
        assert_eq!(webp_chunks(&encoded.bytes), [chunk], "{name}");
    }
    // near-lossless, not lossless: the pixels change, a little
    let png = image::load_from_memory(&read("desktop.png"))
        .unwrap()
        .to_rgba8();
    let encoded = images::encode(&read("desktop.png"), "desktop.png").unwrap();
    let webp = image::load_from_memory(&encoded.bytes).unwrap().to_rgba8();
    let largest = png
        .as_raw()
        .iter()
        .zip(webp.as_raw())
        .map(|(a, b)| a.abs_diff(*b))
        .max()
        .unwrap();
    assert!(largest <= 8, "a channel moved by {largest}");
    assert!(encoded.bytes.len() < read("desktop.png").len() / 2);
}

/// SC-001: the screenshots of finished features, read from this repository's history, shrink to
/// at most 2400 KiB. Run by hand: `cargo test -p uraeda-core --test images -- --ignored`.
#[test]
#[ignore = "reads 94 screenshots from git history, about 7.5 MB"]
fn the_screenshot_corpus_shrinks_to_2400_kib() {
    // the commits that finished the features whose screenshots they deleted
    let commits = ["f30e3f7", "3446a08"];
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let git = |args: &[&str]| {
        let output = Command::new("git")
            .args(args)
            .current_dir(&root)
            .output()
            .unwrap();
        assert!(output.status.success(), "git {args:?}");
        output.stdout
    };
    let (mut count, mut before, mut after) = (0, 0, 0);
    for commit in commits {
        let names = git(&[
            "show",
            "--name-only",
            "--diff-filter=D",
            "--format=",
            commit,
            "--",
            "specs/*/screenshots/*.png",
        ]);
        for path in String::from_utf8(names).unwrap().lines() {
            let png = git(&["show", &format!("{commit}^:{path}")]);
            let encoded = images::encode(&png, path).unwrap();
            count += 1;
            before += png.len();
            after += encoded.bytes.len();
        }
    }
    eprintln!(
        "{count} screenshots: {} KiB as PNG, {} KiB as WebP",
        before / 1024,
        after / 1024
    );
    assert_eq!(count, 94);
    assert!(after <= 2400 * 1024, "{} KiB", after / 1024);
}
