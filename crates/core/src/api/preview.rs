//! A checkout's preview, from its own copy of the preview decision.

use std::io::ErrorKind;
use std::path::Path;

use super::{Result, refused};
use crate::files::preview::{Preview, preview_of};

/// The preview of the checkout at `checkout`, from its `specs/decisions/preview.md`: `None` when
/// the file is missing, not `active`, or its fields are wrong.
pub fn preview(checkout: &Path) -> Result<Option<Preview>> {
    let path = checkout.join("specs/decisions/preview.md");
    match std::fs::read_to_string(&path) {
        Ok(text) => Ok(preview_of(&text)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(refused(format!("{}: {error}", path.display()))),
    }
}
