//! The core's read cache, as the server times it.

use std::path::Path;

use napi_derive::napi;
use uraeda_core::cache::{self, CacheStats};

/// The reads of git and the answers from memory for the repository at `repo` since its watch
/// started; both 0 without a watch. It reads no workflow file, so it returns at once.
#[napi]
pub fn cache_stats(repo: String) -> CacheStats {
    cache::cache_stats(Path::new(&repo))
}
