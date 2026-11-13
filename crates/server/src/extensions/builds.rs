//! The pages' build counter: the number of the last page built, in the data folder.
//!
//! A client refuses a page whose build is older than one it ran (NSH's `Error::Rollback`), so
//! a build's number only grows, across server restarts too. One counter serves every
//! extension: it is read, raised, and written whole before a page is signed with its number, by
//! the loader's thread alone, in the one server of its data folder.

use std::fs::{self, File};
use std::io::{self, Write as _};
use std::path::Path;

use super::signing;

/// The counter's file, in the data folder's `extensions/`: the last build's number, as text.
const FILE: &str = "page-build";

/// The next build's number, kept before it is given: a number is never given twice, even when
/// the server is killed right after.
///
/// # Errors
///
/// When the counter cannot be read or written, or holds no number: starting again from 1
/// would give builds a client refuses.
pub(super) fn next(data_dir: &Path) -> io::Result<u64> {
    let folder = signing::folder(data_dir)?;
    let path = folder.join(FILE);
    let last = match fs::read_to_string(&path) {
        Ok(text) => text.trim().parse::<u64>().map_err(io::Error::other)?,
        Err(error) if error.kind() == io::ErrorKind::NotFound => 0,
        Err(error) => return Err(error),
    };
    let next = last + 1;
    // Written whole beside it, then renamed: a crash never leaves half a number.
    let partial = folder.join(format!("{FILE}.partial"));
    let mut file = File::create(&partial)?;
    file.write_all(next.to_string().as_bytes())?;
    file.sync_all()?;
    fs::rename(&partial, &path)?;
    Ok(next)
}
