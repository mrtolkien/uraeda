//! What `ura status` and `ura serve` read beyond the workspace: the project's setup, and what
//! changed in a file since the human's last review.

use std::path::PathBuf;

use crate::files::frontmatter;
use crate::git::Git;

mod error;
mod setup;
mod since;

pub use error::ApiError;
pub use setup::{SetupItem, read_setup};
pub use since::since_commit;

type Result<T> = std::result::Result<T, ApiError>;

/// The `revision` of a spec or a plan.
fn revision_of(text: &str) -> Option<u32> {
    u32::try_from(frontmatter::parse(text).ok()?.integer("revision")?).ok()
}

/// A file's bytes as text, with what is not UTF-8 replaced.
fn lossy(bytes: Vec<u8>) -> String {
    String::from_utf8(bytes)
        .unwrap_or_else(|error| String::from_utf8_lossy(error.as_bytes()).into_owned())
}

/// The checkout of the default branch: the one that holds it, or this one when there is none.
fn checkout_of(git: &Git, default: Option<&str>) -> Option<PathBuf> {
    match default {
        Some(default) => crate::actions::place::holder(git, default).ok().flatten(),
        None => Some(git.root().to_path_buf()),
    }
}
