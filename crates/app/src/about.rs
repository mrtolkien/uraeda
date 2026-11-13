//! What the app says about itself.

use nsh_core::prelude::*;

/// What the app knows about its own build.
#[module]
pub(crate) struct About;

#[module(flat)]
impl About {
    /// Uraeda's version, the one of the release this app was built for: `1.3.0`.
    pub(crate) fn version() -> String {
        env!("CARGO_PKG_VERSION").to_owned()
    }
}
