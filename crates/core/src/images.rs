//! Attached images: checked, decoded, turned upright, downscaled, and re-encoded as WebP, as the
//! attachments decision says. The only image code of Uraeda; callers pass the bytes they received.

mod webp;

use std::io::Cursor;

use image::codecs::gif::GifDecoder;
use image::imageops::FilterType;
use image::{AnimationDecoder, DynamicImage, ImageDecoder, ImageFormat, ImageReader, Limits};

use webp::Settings;

/// The largest input accepted: 20 MB, counted in MiB.
pub const MAX_BYTES: usize = 20 * 1024 * 1024;

/// The most pixels an input may declare, checked from its header before decoding.
pub const MAX_PIXELS: u64 = 40_000_000;

/// The longest edge of an output, in pixels: larger inputs are downscaled to it.
pub const MAX_EDGE: u32 = 2576;

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

/// An image ready to save: a WebP file, or an animated GIF kept as it was.
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
    let unreadable = |_| ImageError::Unreadable { name: name.into() };

    let (width, height) = reader(bytes, format, Limits::no_limits())
        .into_dimensions()
        .map_err(unreadable)?;
    if u64::from(width) * u64::from(height) > MAX_PIXELS {
        return Err(ImageError::Pixels {
            name: name.into(),
            width,
            height,
        });
    }

    if format == ImageFormat::Gif && animated(bytes).map_err(unreadable)? {
        return Ok(Encoded {
            bytes: bytes.to_vec(),
            extension: "gif",
            width,
            height,
        });
    }

    let mut decoder = reader(bytes, format, limits())
        .into_decoder()
        .map_err(unreadable)?;
    // A broken orientation tag leaves the image as stored, rather than refusing it.
    let orientation = decoder
        .orientation()
        .unwrap_or(image::metadata::Orientation::NoTransforms);
    let mut image = DynamicImage::from_decoder(decoder).map_err(unreadable)?;
    image.apply_orientation(orientation);
    let mut image = DynamicImage::ImageRgba8(image.into_rgba8());
    if image.width().max(image.height()) > MAX_EDGE {
        image = image.resize(MAX_EDGE, MAX_EDGE, FilterType::Lanczos3);
    }
    let image = image.into_rgba8();

    let settings = if format == ImageFormat::Jpeg || lossy_webp(bytes) {
        PHOTO
    } else {
        SCREENSHOT
    };
    let (width, height) = image.dimensions();
    let bytes = webp::encode_rgba(image.as_raw(), width, height, settings)
        .map_err(|_| ImageError::Unreadable { name: name.into() })?;
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

/// The decoder's limits: enough for `MAX_PIXELS` at 16 bits per channel, with alpha.
fn limits() -> Limits {
    let mut limits = Limits::default();
    limits.max_alloc = Some(MAX_PIXELS * 8);
    limits
}

/// Whether a GIF holds more than one frame.
fn animated(bytes: &[u8]) -> Result<bool, image::ImageError> {
    let mut decoder = GifDecoder::new(Cursor::new(bytes))?;
    decoder.set_limits(limits())?;
    let mut frames = decoder.into_frames().take(2);
    frames.next().transpose()?;
    Ok(frames.next().transpose()?.is_some())
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

/// A size in MB of 1,048,576 bytes, to one decimal, without a trailing `.0`.
fn megabytes(bytes: usize) -> String {
    let text = format!("{:.1}", bytes as f64 / (1024.0 * 1024.0));
    text.strip_suffix(".0").map(str::to_owned).unwrap_or(text)
}
