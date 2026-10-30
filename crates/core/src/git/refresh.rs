//! A new worktree's index, refreshed once its files are older than it, so reads stop rehashing them.

use std::path::PathBuf;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// Past the next whole second, since the files' times come from a coarser clock that lags a little.
const MARGIN: Duration = Duration::from_millis(50);

/// Refreshes the index of the worktree just checked out at `path`, in its own thread, once the next
/// whole second has begun.
///
/// Git compares the files' times with the index's in whole seconds: a file written in the second
/// the index was written is racily clean, and stays so through a refresh in that same second. gix
/// then rehashes every such file on each read, and never writes the index back. A refresh in a later
/// second writes them clean. A failure only costs speed, so it is ignored, as is a thread that
/// cannot start. A worktree removed meanwhile is not refreshed: in its folder, or a parent of it,
/// git would find the main checkout and lock its index. The refresh holds the repository's write
/// lock, as the core's writes do, so none of them meets its `index.lock`.
pub(super) fn refresh_later(path: PathBuf) {
    let since_second = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(Duration::ZERO, |now| {
            Duration::from_nanos(now.subsec_nanos().into())
        });
    let wait = Duration::from_secs(1).saturating_sub(since_second) + MARGIN;
    let _ = thread::Builder::new().spawn(move || {
        thread::sleep(wait);
        let _lock = crate::cache::write_lock(&path);
        if path.join(".git").is_file() {
            let _ = super::output_in(&path, "update-index", &["update-index", "-q", "--refresh"]);
        }
    });
}
