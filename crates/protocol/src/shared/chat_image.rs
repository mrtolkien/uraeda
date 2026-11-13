//! A chat's image, as its upload answers it and as a message or a typed start names it.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// An image kept for a chat message or a typed start: what `POST /r/<name>/attach?chat=1`
/// answers, and what a start's `images` take back.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChatImage {
    /// What names it in the server's store.
    pub id: String,
    /// Its width, in pixels.
    pub width: u32,
    /// Its height, in pixels.
    pub height: u32,
}
