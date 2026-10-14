mod common;

use std::io::Cursor;
use std::path::PathBuf;
use std::process::Command;
use std::time::{Duration, Instant};

use common::fixture;
use image::codecs::gif::GifDecoder;
use image::{AnimationDecoder, DynamicImage, ImageBuffer, ImageFormat, Luma, Rgb, Rgba, RgbaImage};
use uraeda_core::images::{self, Encoded, ImageError, MAX_BYTES};

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

/// A generated image, as a PNG file.
fn png(image: DynamicImage) -> Vec<u8> {
    let mut bytes = Cursor::new(Vec::new());
    image.write_to(&mut bytes, ImageFormat::Png).unwrap();
    bytes.into_inner()
}

/// The extension and size of an encoded image, or the refusal's text.
type Expected = Result<(&'static str, u32, u32), &'static str>;

/// Checks one row of a table: the encoded image's extension and size, read back from its bytes,
/// and a WebP's chunks, or the refusal's text.
fn check(name: &str, result: Result<Encoded, ImageError>, expected: Expected) {
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
                let chunks = webp_chunks(&encoded.bytes);
                assert!(
                    chunks
                        .iter()
                        .any(|chunk| chunk == "VP8 " || chunk == "VP8L"),
                    "{name}: no image chunk in {chunks:?}"
                );
                assert!(
                    chunks
                        .iter()
                        .all(|chunk| ["VP8X", "ALPH", "VP8 ", "VP8L"].contains(&chunk.as_str())),
                    "{name}: {chunks:?}"
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

#[test]
fn attached_images_are_checked_and_reencoded() {
    let rows: [(&str, Expected); 17] = [
        ("desktop.png", Ok(("webp", 1440, 900))),
        ("phone.png", Ok(("webp", 402, 874))),
        // 3000×2000 stored, turned upright by its orientation 6, then downscaled
        ("photo.jpg", Ok(("webp", 1717, 2576))),
        ("animated.gif", Ok(("gif", 64, 48))),
        ("animated_metadata.gif", Ok(("gif", 16, 12))),
        // the first frame only
        ("animated.webp", Ok(("webp", 16, 12))),
        ("animated.png", Ok(("webp", 16, 12))),
        ("still.gif", Ok(("webp", 64, 48))),
        ("lossy.webp", Ok(("webp", 402, 874))),
        ("lossless.webp", Ok(("webp", 402, 874))),
        ("alpha_lossy.webp", Ok(("webp", 16, 16))),
        // the colour profile is dropped, the pixels kept
        ("iccp_bomb.png", Ok(("webp", 4, 4))),
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
        check(name, images::encode(&read(name), name), expected);
    }
}

#[test]
fn generated_images_are_checked_and_reencoded() {
    let gray = ImageBuffer::from_pixel(40, 30, Luma([128u8]));
    let deep = ImageBuffer::from_pixel(40, 30, Rgb([65535u16, 0, 0]));
    let wide = ImageBuffer::from_pixel(2576, 4, Rgb([0u8, 0, 255]));
    let wider = ImageBuffer::from_pixel(2577, 4, Rgb([0u8, 0, 255]));
    let rows: [(&str, Vec<u8>, Expected); 6] = [
        ("gray.png", png(DynamicImage::ImageLuma8(gray)), Ok(("webp", 40, 30))),
        ("deep.png", png(DynamicImage::ImageRgb16(deep)), Ok(("webp", 40, 30))),
        // exactly the longest edge: kept as it is
        ("wide.png", png(DynamicImage::ImageRgb8(wide)), Ok(("webp", 2576, 4))),
        // one pixel more: downscaled, 4 × 2576 / 2577 rounding to 4
        ("wider.png", png(DynamicImage::ImageRgb8(wider)), Ok(("webp", 2576, 4))),
        (
            "empty.png",
            Vec::new(),
            Err("Only PNG, JPEG, GIF, and WebP images can be added: empty.png is not one."),
        ),
        (
            "sound.webp",
            b"RIFF\x24\0\0\0WAVEfmt \x10\0\0\0\x01\0\x01\0\x44\xac\0\0\x88\x58\x01\0\x02\0\x10\0data\0\0\0\0"
                .to_vec(),
            Err("Only PNG, JPEG, GIF, and WebP images can be added: sound.webp is not one."),
        ),
    ];
    for (name, bytes, expected) in rows {
        check(name, images::encode(&bytes, name), expected);
    }
    // the pixels survive the conversion to 8-bit RGBA
    let deep = ImageBuffer::from_pixel(40, 30, Rgb([65535u16, 0, 0]));
    let encoded = images::encode(&png(DynamicImage::ImageRgb16(deep)), "deep.png").unwrap();
    let [red, green, blue] = image::load_from_memory(&encoded.bytes)
        .unwrap()
        .to_rgb8()
        .get_pixel(20, 15)
        .0;
    assert!(red > 245 && green < 10 && blue < 10, "{red} {green} {blue}");
    let gray = ImageBuffer::from_pixel(40, 30, Luma([128u8]));
    let encoded = images::encode(&png(DynamicImage::ImageLuma8(gray)), "gray.png").unwrap();
    let [red, green, blue] = image::load_from_memory(&encoded.bytes)
        .unwrap()
        .to_rgb8()
        .get_pixel(20, 15)
        .0;
    assert!(
        [red, green, blue]
            .iter()
            .all(|channel| channel.abs_diff(128) <= 4)
    );
}

/// A JPEG, a GIF, and a WebP declaring more than 40 million pixels are refused from their headers,
/// fast, as `bomb.png` is.
#[test]
fn bombs_of_every_type_are_refused_from_their_headers() {
    // photo.jpg, whose frame header declares 20000×20000
    let mut jpeg = read("photo.jpg");
    let mut at = 2;
    loop {
        assert_eq!(jpeg[at], 0xFF);
        let marker = jpeg[at + 1];
        let length = usize::from(u16::from_be_bytes([jpeg[at + 2], jpeg[at + 3]]));
        if (0xC0..=0xC2).contains(&marker) {
            jpeg[at + 5..at + 7].copy_from_slice(&20000u16.to_be_bytes());
            jpeg[at + 7..at + 9].copy_from_slice(&20000u16.to_be_bytes());
            break;
        }
        at += 2 + length;
    }
    // still.gif, whose logical screen declares 10000×5000
    let mut gif = read("still.gif");
    gif[6..8].copy_from_slice(&10000u16.to_le_bytes());
    gif[8..10].copy_from_slice(&5000u16.to_le_bytes());
    // an extended WebP whose canvas, and its lossless image, declare 16383×16383
    let mut webp = b"RIFF\0\0\0\0WEBPVP8X\x0a\0\0\0\0\0\0\0".to_vec();
    webp.extend_from_slice(&(16383u32 - 1).to_le_bytes()[..3]);
    webp.extend_from_slice(&(16383u32 - 1).to_le_bytes()[..3]);
    webp.extend_from_slice(b"VP8L\x10\0\0\0\x2f");
    webp.extend_from_slice(&((16383u32 - 1) | ((16383 - 1) << 14)).to_le_bytes());
    webp.extend_from_slice(&[0; 11]);
    let size = u32::try_from(webp.len() - 8).unwrap();
    webp[4..8].copy_from_slice(&size.to_le_bytes());

    let rows = [
        (
            "bomb.jpg",
            jpeg,
            "This image is too large: bomb.jpg is 20000×20000 pixels.",
        ),
        (
            "bomb.gif",
            gif,
            "This image is too large: bomb.gif is 10000×5000 pixels.",
        ),
        (
            "bomb.webp",
            webp,
            "This image is too large: bomb.webp is 16383×16383 pixels.",
        ),
    ];
    for (name, bytes, text) in rows {
        let start = Instant::now();
        let error = images::encode(&bytes, name).unwrap_err();
        assert_eq!(error.to_string(), text, "{name}");
        assert!(
            start.elapsed() < Duration::from_secs(1),
            "{name}: {:?}",
            start.elapsed()
        );
    }
}

/// An `iCCP` chunk inflating to 64 MiB is never inflated whole. Run in a child process, whose peak
/// resident memory no other test shares.
#[cfg(target_os = "linux")]
#[test]
fn an_iccp_bomb_is_read_in_bounded_memory() {
    const CHILD: &str = "URAEDA_ICCP_BOMB_CHILD";
    let name = "an_iccp_bomb_is_read_in_bounded_memory";
    if std::env::var_os(CHILD).is_some() {
        let result = images::encode(&read("iccp_bomb.png"), "iccp_bomb.png");
        let status = std::fs::read_to_string("/proc/self/status").unwrap();
        let peak = status
            .lines()
            .find_map(|line| line.strip_prefix("VmHWM:"))
            .unwrap();
        println!(
            "result: {:?}",
            result.map(|encoded| (encoded.width, encoded.height))
        );
        println!("peak:{peak}");
        return;
    }
    let output = Command::new(std::env::current_exe().unwrap())
        .args(["--exact", name, "--nocapture", "--test-threads=1"])
        .env(CHILD, "1")
        .output()
        .unwrap();
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(output.status.success(), "{stdout}");
    let peak: u64 = stdout
        .lines()
        .find_map(|line| line.strip_prefix("peak:"))
        .and_then(|peak| peak.trim().strip_suffix(" kB"))
        .unwrap_or_else(|| panic!("{stdout}"))
        .parse()
        .unwrap();
    // the profile is dropped, as every profile is: the image itself is read
    assert!(stdout.contains("result: Ok((4, 4))"), "{stdout}");
    assert!(peak < 40 * 1024, "peak resident memory: {peak} KiB");
}

#[test]
fn transparency_is_kept() {
    // transparent on the left half, opaque blue on the right
    let mut rgba = RgbaImage::from_pixel(16, 16, Rgba([0, 0, 0, 0]));
    for (x, _, pixel) in rgba.enumerate_pixels_mut() {
        if x >= 8 {
            *pixel = Rgba([30, 120, 220, 255]);
        }
    }
    let rows = [
        (
            "alpha.png",
            png(DynamicImage::ImageRgba8(rgba)),
            &["VP8L"][..],
        ),
        (
            "alpha_lossy.webp",
            read("alpha_lossy.webp"),
            &["VP8X", "ALPH", "VP8 "],
        ),
    ];
    for (name, bytes, chunks) in rows {
        let encoded = images::encode(&bytes, name).unwrap();
        assert_eq!(webp_chunks(&encoded.bytes), chunks, "{name}");
        let decoded = image::load_from_memory(&encoded.bytes).unwrap().to_rgba8();
        assert_eq!(decoded.get_pixel(2, 8).0[3], 0, "{name}: transparent");
        let [red, green, blue, alpha] = decoded.get_pixel(13, 8).0;
        assert_eq!(alpha, 255, "{name}: opaque");
        assert!(
            red.abs_diff(30) <= 12 && green.abs_diff(120) <= 12 && blue.abs_diff(220) <= 12,
            "{name}: {red} {green} {blue}"
        );
    }
}

/// An animated WebP or an APNG keeps its first frame only, re-encoded as a still WebP. A lossy
/// animated WebP holds its `VP8 ` chunks inside `ANMF` frames, so it is near-lossless.
#[test]
fn animated_webp_and_apng_keep_their_first_frame() {
    for name in ["animated.webp", "animated.png"] {
        let encoded = images::encode(&read(name), name).unwrap();
        assert_eq!(
            (encoded.extension, encoded.width, encoded.height),
            ("webp", 16, 12),
            "{name}"
        );
        assert_eq!(webp_chunks(&encoded.bytes), ["VP8L"], "{name}");
        let [red, green, blue] = image::load_from_memory(&encoded.bytes)
            .unwrap()
            .to_rgb8()
            .get_pixel(8, 6)
            .0;
        assert!(
            red > 230 && green < 30 && blue < 30,
            "{name}: {red} {green} {blue}"
        );
    }
}

/// The frames of a GIF, as RGBA pixels with their delays.
fn gif_frames(bytes: &[u8]) -> Vec<(Vec<u8>, (u32, u32))> {
    GifDecoder::new(Cursor::new(bytes))
        .unwrap()
        .into_frames()
        .collect_frames()
        .unwrap()
        .into_iter()
        .map(|frame| {
            (
                frame.buffer().as_raw().clone(),
                frame.delay().numer_denom_ms(),
            )
        })
        .collect()
}

#[test]
fn animated_gifs_keep_their_frames_and_lose_their_metadata() {
    let bytes = read("animated.gif");
    let encoded = images::encode(&bytes, "animated.gif").unwrap();
    assert_eq!(gif_frames(&encoded.bytes), gif_frames(&bytes));
    assert!(contains(&encoded.bytes, b"NETSCAPE2.0"), "it still loops");

    let bytes = read("animated_metadata.gif");
    // the fixture holds what the output must not
    for marker in [&b"GPS 48.85N secret"[..], b"XMP DataXMP", b"xmpmeta"] {
        assert!(contains(&bytes, marker));
    }
    let encoded = images::encode(&bytes, "animated_metadata.gif").unwrap();
    assert_eq!(
        (encoded.extension, encoded.width, encoded.height),
        ("gif", 16, 12)
    );
    let frames = gif_frames(&encoded.bytes);
    assert_eq!(frames, gif_frames(&bytes));
    assert_eq!(frames.len(), 3);
    for marker in [&b"GPS"[..], b"48.85", b"secret", b"XMP", b"xmpmeta"] {
        assert!(
            !contains(&encoded.bytes, marker),
            "{}",
            String::from_utf8_lossy(marker)
        );
    }
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
    // a byte over is rounded up, never shown as 20 MB
    big.resize(MAX_BYTES + 1, 0);
    assert_eq!(
        images::encode(&big, "big.png").unwrap_err().to_string(),
        "This image is over 20 MB: big.png is 20.1 MB."
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
    assert!(largest > 0 && largest <= 8, "a channel moved by {largest}");
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
