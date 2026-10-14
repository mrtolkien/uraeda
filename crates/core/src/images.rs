//! Attached images: checked, decoded, turned upright, downscaled, and re-encoded as WebP, as the
//! attachments decision says. The only image code of Uraeda; callers pass the bytes they received.

mod animated;
mod webp;

use std::io::Cursor;

use image::imageops::FilterType;
use image::{DynamicImage, ImageDecoder, ImageFormat, ImageReader, Limits};

use webp::Settings;

/// The largest input accepted: 20 MB, counted in MiB.
pub const MAX_BYTES: usize = 20 * 1024 * 1024;

/// The most pixels an input may declare, checked from its header before decoding.
pub const MAX_PIXELS: u64 = 40_000_000;

/// The longest edge of an output, in pixels: larger inputs are downscaled to it.
pub const MAX_EDGE: u32 = 2576;

/// The most memory a decoder may allocate besides the pixels: for reading headers, and the chunks
/// they inflate, such as a PNG's colour profile, which is dropped anyway.
const HEADER_ALLOC: u64 = 16 * 1024 * 1024;

/// Photos: lossy WebP.
const PHOTO: Settings = Settings::Lossy {
    quality: 80.0,
    method: 4,
};

/// Screenshots and everything else: near-lossless WebP.
const SCREENSHOT: Settings = Settings::NearLossless {
    level: 60,
    quality: 75.0,
    method: 4,
};

/// An image ready to save: a WebP file, or an animated GIF holding only its frames.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Encoded {
    pub bytes: Vec<u8>,
    /// `"webp"` or `"gif"`.
    pub extension: &'static str,
    pub width: u32,
    pub height: u32,
}

/// Why an image is refused, worded for the human who added it.
#[derive(Clone, Debug, PartialEq, Eq, thiserror::Error)]
pub enum ImageError {
    #[error("Only PNG, JPEG, GIF, and WebP images can be added: {name} is not one.")]
    Type { name: String },
    #[error("This image is over 20 MB: {name} is {} MB.", megabytes(*.bytes))]
    Size { name: String, bytes: usize },
    #[error("This image is too large: {name} is {width}×{height} pixels.")]
    Pixels {
        name: String,
        width: u32,
        height: u32,
    },
    #[error("This image could not be read: {name}.")]
    Unreadable { name: String },
}

/// Checks and re-encodes an attached image. `name` is the file's name, used only in refusals:
/// the type comes from the first bytes.
pub fn encode(bytes: &[u8], name: &str) -> Result<Encoded, ImageError> {
    let Some(format) = detect(bytes) else {
        return Err(ImageError::Type { name: name.into() });
    };
    if bytes.len() > MAX_BYTES {
        return Err(ImageError::Size {
            name: name.into(),
            bytes: bytes.len(),
        });
    }
    let unreadable = || ImageError::Unreadable { name: name.into() };

    // Reading the header can inflate chunks before the pixels, such as a PNG's colour profile:
    // bounded, so a small file cannot make it allocate gigabytes.
    let (width, height) = reader(bytes, format, alloc(0))
        .into_dimensions()
        .map_err(|_| unreadable())?;
    let pixels = u64::from(width) * u64::from(height);
    if pixels > MAX_PIXELS {
        return Err(ImageError::Pixels {
            name: name.into(),
            width,
            height,
        });
    }

    if format == ImageFormat::Gif
        && let Some(bytes) = animated::strip_gif(bytes).map_err(|_| unreadable())?
    {
        return Ok(Encoded {
            bytes,
            extension: "gif",
            width,
            height,
        });
    }

    // Enough for every pixel at 16 bits per channel, with alpha.
    let mut decoder = reader(bytes, format, alloc(pixels * 8))
        .into_decoder()
        .map_err(|_| unreadable())?;
    // A broken orientation tag leaves the image as stored, rather than refusing it.
    let orientation = decoder
        .orientation()
        .unwrap_or(image::metadata::Orientation::NoTransforms);
    // Downscaled before it is turned: a square bound fits the image either way, and only the
    // smaller copy is rotated.
    let image = DynamicImage::from_decoder(decoder).map_err(|_| unreadable())?;
    let mut image = DynamicImage::ImageRgba8(image.into_rgba8());
    if image.width().max(image.height()) > MAX_EDGE {
        image = image.resize(MAX_EDGE, MAX_EDGE, FilterType::Lanczos3);
    }
    image.apply_orientation(orientation);
    let image = image.into_rgba8();

    let settings = if format == ImageFormat::Jpeg || lossy_webp(bytes) {
        PHOTO
    } else {
        SCREENSHOT
    };
    let (width, height) = image.dimensions();
    let bytes =
        webp::encode_rgba(image.as_raw(), width, height, settings).map_err(|_| unreadable())?;
    Ok(Encoded {
        bytes,
        extension: "webp",
        width,
        height,
    })
}

/// The MIME type of an accepted image, from its first bytes: `None` for anything else.
pub fn mime(bytes: &[u8]) -> Option<&'static str> {
    Some(match detect(bytes)? {
        ImageFormat::Png => "image/png",
        ImageFormat::Jpeg => "image/jpeg",
        ImageFormat::Gif => "image/gif",
        _ => "image/webp",
    })
}

/// The accepted type of the bytes, from their signature.
fn detect(bytes: &[u8]) -> Option<ImageFormat> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some(ImageFormat::Png)
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some(ImageFormat::Jpeg)
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some(ImageFormat::Gif)
    } else if bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" {
        Some(ImageFormat::WebP)
    } else {
        None
    }
}

fn reader(bytes: &[u8], format: ImageFormat, limits: Limits) -> ImageReader<Cursor<&[u8]>> {
    let mut reader = ImageReader::with_format(Cursor::new(bytes), format);
    reader.limits(limits);
    reader
}

/// A decoder's limits: `pixels` bytes for the image, and `HEADER_ALLOC` for the rest.
fn alloc(pixels: u64) -> Limits {
    let mut limits = Limits::default();
    limits.max_alloc = Some(pixels + HEADER_ALLOC);
    limits
}

/// Whether a WebP file holds lossy image data, a `VP8 ` chunk, rather than only `VP8L`.
fn lossy_webp(bytes: &[u8]) -> bool {
    if detect(bytes) != Some(ImageFormat::WebP) {
        return false;
    }
    let mut at: usize = 12;
    while let Some(header) = at.checked_add(8).and_then(|end| bytes.get(at..end)) {
        if &header[..4] == b"VP8 " {
            return true;
        }
        let size = u32::from_le_bytes([header[4], header[5], header[6], header[7]]) as usize;
        at = at
            .saturating_add(8)
            .saturating_add(size)
            .saturating_add(size % 2);
    }
    false
}

/// A size in MB of 1,048,576 bytes, rounded up to one decimal, without a trailing `.0`: a file
/// over 20 MB never reads as 20 MB.
fn megabytes(bytes: usize) -> String {
    let tenths = bytes.saturating_mul(10).div_ceil(1024 * 1024);
    match tenths % 10 {
        0 => format!("{}", tenths / 10),
        tenth => format!("{}.{tenth}", tenths / 10),
    }
}
