//! A safe wrapper around libwebp's encoder: the only `unsafe` code of the core.

use std::ffi::{c_int, c_void};
use std::mem::MaybeUninit;

use libwebp_sys::{
    WEBP_ENCODER_ABI_VERSION, WebPConfig, WebPConfigInitInternal, WebPEncode, WebPEncodingError,
    WebPMemoryWrite, WebPMemoryWriter, WebPMemoryWriterClear, WebPMemoryWriterInit, WebPPicture,
    WebPPictureFree, WebPPictureImportRGBA, WebPPictureInitInternal, WebPPreset,
    WebPValidateConfig,
};

/// How libwebp encodes the pixels.
#[derive(Clone, Copy, Debug)]
pub(crate) enum Settings {
    /// Lossy, `VP8 `, at a quality from 0 to 100.
    Lossy { quality: f32, method: i32 },
    /// Lossless, `VP8L`, with near-lossless preprocessing at a level from 0 (most) to 100 (off).
    NearLossless {
        level: i32,
        quality: f32,
        method: i32,
    },
}

/// Encodes 8-bit RGBA pixels, row by row with no padding, as a WebP file holding no metadata.
/// Fails with libwebp's error code.
pub(crate) fn encode_rgba(
    pixels: &[u8],
    width: u32,
    height: u32,
    settings: Settings,
) -> Result<Vec<u8>, WebPEncodingError> {
    let bad_dimension = Err(WebPEncodingError::VP8_ENC_ERROR_BAD_DIMENSION);
    let (Ok(w), Ok(h)) = (c_int::try_from(width), c_int::try_from(height)) else {
        return bad_dimension;
    };
    let Some(stride) = w.checked_mul(4) else {
        return bad_dimension;
    };
    if pixels.len() != width as usize * height as usize * 4 {
        return bad_dimension;
    }

    let (lossless, quality, method, near_lossless) = match settings {
        Settings::Lossy { quality, method } => (false, quality, method, 100),
        Settings::NearLossless {
            level,
            quality,
            method,
        } => (true, quality, method, level),
    };

    let mut config = MaybeUninit::<WebPConfig>::uninit();
    // SAFETY: `config` points to writable memory the size of a `WebPConfig`, which
    // `WebPConfigInitInternal` fills entirely when it returns non-zero, for this header's ABI.
    let initialized = unsafe {
        WebPConfigInitInternal(
            config.as_mut_ptr(),
            WebPPreset::WEBP_PRESET_DEFAULT,
            quality,
            WEBP_ENCODER_ABI_VERSION as c_int,
        )
    };
    if initialized == 0 {
        return Err(WebPEncodingError::VP8_ENC_ERROR_INVALID_CONFIGURATION);
    }
    // SAFETY: initialized just above.
    let mut config = unsafe { config.assume_init() };
    config.lossless = c_int::from(lossless);
    config.quality = quality;
    config.method = method;
    config.near_lossless = near_lossless;
    // SAFETY: `config` is a valid, initialized `WebPConfig`, only read.
    if unsafe { WebPValidateConfig(&config) } == 0 {
        return Err(WebPEncodingError::VP8_ENC_ERROR_INVALID_CONFIGURATION);
    }

    let mut picture = MaybeUninit::<WebPPicture>::uninit();
    // SAFETY: as for the config: `WebPPictureInitInternal` fills the whole struct, with no buffer
    // allocated yet, when it returns non-zero.
    if unsafe { WebPPictureInitInternal(picture.as_mut_ptr(), WEBP_ENCODER_ABI_VERSION as c_int) }
        == 0
    {
        return Err(WebPEncodingError::VP8_ENC_ERROR_INVALID_CONFIGURATION);
    }
    // SAFETY: initialized just above.
    let picture = unsafe { picture.assume_init() };
    let mut picture = Picture(picture);
    picture.0.use_argb = c_int::from(lossless);
    picture.0.width = w;
    picture.0.height = h;
    // SAFETY: `pixels` holds `height` rows of `stride` bytes, checked above, and outlives the call,
    // which copies them into buffers the picture owns, freed by `Picture`'s drop.
    if unsafe { WebPPictureImportRGBA(&mut picture.0, pixels.as_ptr(), stride) } == 0 {
        return Err(picture.0.error_code);
    }

    let mut writer = MaybeUninit::<WebPMemoryWriter>::uninit();
    // SAFETY: `writer` points to writable memory the size of a `WebPMemoryWriter`, which
    // `WebPMemoryWriterInit` fills entirely, with no buffer allocated yet.
    unsafe { WebPMemoryWriterInit(writer.as_mut_ptr()) };
    // SAFETY: initialized just above.
    let mut writer = Writer(unsafe { writer.assume_init() });
    picture.0.writer = Some(WebPMemoryWrite);
    picture.0.custom_ptr = (&raw mut writer.0).cast::<c_void>();
    // SAFETY: `config` was validated, `picture` holds the imported pixels, and its writer is
    // libwebp's own memory writer, whose state `custom_ptr` points to: `writer`, which is not
    // moved and lives until the end of this function.
    if unsafe { WebPEncode(&config, &mut picture.0) } == 0 {
        return Err(picture.0.error_code);
    }
    let written = &writer.0;
    if written.mem.is_null() {
        return Ok(Vec::new());
    }
    // SAFETY: libwebp's memory writer holds `size` initialized bytes at `mem`, which stay valid
    // until `WebPMemoryWriterClear`, run by `Writer`'s drop after this copy.
    Ok(unsafe { std::slice::from_raw_parts(written.mem, written.size) }.to_vec())
}

/// A picture whose buffers libwebp frees on drop.
struct Picture(WebPPicture);

impl Drop for Picture {
    fn drop(&mut self) {
        // SAFETY: the picture was initialized by `WebPPictureInitInternal`, so its buffers are
        // either null or allocated by libwebp; `WebPPictureFree` accepts both.
        unsafe { WebPPictureFree(&mut self.0) };
    }
}

/// libwebp's memory writer, whose buffer is freed on drop.
struct Writer(WebPMemoryWriter);

impl Drop for Writer {
    fn drop(&mut self) {
        // SAFETY: the writer was initialized by `WebPMemoryWriterInit`, so its buffer is either
        // null or allocated by libwebp; `WebPMemoryWriterClear` frees both.
        unsafe { WebPMemoryWriterClear(&mut self.0) };
    }
}
