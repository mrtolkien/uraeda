//! The chat images of a message, as their upload answered them: checked, and found in the
//! data folder.

use uraeda_protocol::ChatImage;

use crate::files::chat_images::ChatImages;
use crate::live::Fault;
use crate::runner::refusals;
use crate::runner::send::{Image, check_images};
use crate::shared::Shared;

/// The longest edge of a WebP the core encodes, in pixels: it downscales larger inputs.
const MAX_EDGE: u32 = 2576;

/// The most pixels the core accepts, which an animated GIF, kept as it came, may reach.
const MAX_PIXELS: u64 = 40_000_000;

/// The longest edge a GIF can hold: its header stores each edge in 16 bits.
const GIF_EDGE: u32 = 65_535;

/// Whether a size is one the core could have given an image of this id: at most 2576 pixels on
/// each edge for a WebP, and for an animated GIF, which the core keeps as it came, at most 40
/// million pixels.
fn sized(image: &ChatImage) -> bool {
    let (width, height) = (image.width, image.height);
    if width == 0 || height == 0 {
        return false;
    }
    match image.id.ends_with(".gif") {
        true => {
            let pixels = u64::from(width) * u64::from(height);
            width <= GIF_EDGE && height <= GIF_EDGE && pixels <= MAX_PIXELS
        }
        false => width <= MAX_EDGE && height <= MAX_EDGE,
    }
}

/// The chat images of a message, with their files' paths in the data folder, an image given
/// twice kept once. Checked before any session work, as the sessions check them again: each a
/// size the core could have given, at most 10, to an agent that reads images, and not with the
/// workflow's message. An image whose file is gone is refused.
pub(super) fn sent(
    shared: &Shared,
    images: Option<Vec<ChatImage>>,
    workflow: bool,
    reads_images: bool,
) -> Result<Vec<Image>, Fault> {
    let mut unique: Vec<ChatImage> = Vec::new();
    for image in images.unwrap_or_default() {
        if !sized(&image) {
            let refusal = "an image's size is two positive integers, within the core's limits";
            return Err(Fault::refused(refusal));
        }
        if !unique.iter().any(|known| known.id == image.id) {
            unique.push(image);
        }
    }
    check_images(unique.len(), workflow, reads_images)?;
    let store = ChatImages::of(shared);
    let found = unique.into_iter().map(|image| {
        let gone = || Fault::refused(refusals::IMAGE_GONE);
        let path = store.path(&image.id).ok_or_else(gone)?;
        Ok(Image { image, path })
    });
    found.collect()
}
