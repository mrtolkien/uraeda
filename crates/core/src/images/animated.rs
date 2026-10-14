//! Animated GIFs, kept animated: their frames are copied as they are compressed, and everything
//! else is dropped.

use std::io::Cursor;

use gif::{DecodeOptions, Encoder, Frame};

/// Why an animated GIF could not be copied.
#[derive(Debug, thiserror::Error)]
pub(crate) enum Error {
    #[error(transparent)]
    Decoding(#[from] gif::DecodingError),
    #[error(transparent)]
    Encoding(#[from] gif::EncodingError),
}

/// A GIF of more than one frame, rewritten with only its logical screen, its global palette, its
/// loop count, and its frames, each with its delay, disposal, transparency, and palette: comments,
/// XMP, and every other extension are dropped. Frames are not decoded: their compressed pixels are
/// copied, so the colours are exactly the input's. `None` for a GIF of one frame.
pub(crate) fn strip_gif(bytes: &[u8]) -> Result<Option<Vec<u8>>, Error> {
    let mut options = DecodeOptions::new();
    options.skip_frame_decoding(true);
    // Frames larger than the screen would make the copy allocate past the checked pixel count.
    options.check_frame_consistency(true);
    let mut decoder = options.read_info(Cursor::new(bytes))?;
    let mut frames: Vec<Frame<'static>> = Vec::new();
    while let Some(frame) = decoder.read_next_frame()? {
        frames.push(frame.clone());
    }
    if frames.len() < 2 {
        return Ok(None);
    }

    let palette = decoder.global_palette().unwrap_or_default();
    let mut output = Vec::new();
    let mut encoder = Encoder::new(&mut output, decoder.width(), decoder.height(), palette)?;
    encoder.set_repeat(decoder.repeat())?;
    for frame in &frames {
        encoder.write_lzw_pre_encoded_frame(frame)?;
    }
    encoder.into_inner()?;
    Ok(Some(output))
}
