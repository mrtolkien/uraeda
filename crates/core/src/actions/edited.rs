//! The files a buffer saved in a checkout, left uncommitted: tool state kept in that checkout's own
//! git folder, so each worktree has its own record, one path from the top level per line, with the
//! id its last commit had for the file at the save. A commit of the file by any route, which
//! changes that id, ends its record: an agent's later edit of it is not the human's. Losing the
//! record only turns a buffer's edits back into the lines the Commit page reads from the files.

use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

use crate::git::Git;

use super::ActionError;
use super::place::Place;

/// The record's file, in the git folder of the checkout.
const FILE: &str = "uraeda-edited";

/// Each path recorded, with the id `HEAD` had for its file at its save, empty when it had none.
type Record = BTreeMap<String, String>;

fn file(place: &Place) -> Result<PathBuf, ActionError> {
    Ok(Git::open(&place.root)?.git_dir().join(FILE))
}

/// The id `HEAD` has for the file at `path`, empty when it has none.
fn committed_id(git: Option<&Git>, path: &str) -> String {
    git.and_then(|git| git.entry_id(git.head()?, path))
        .map(|id| id.to_string())
        .unwrap_or_default()
}

/// The record as written, and the part of it still the human's: each file `HEAD` has as it was
/// at its save.
fn read(place: &Place) -> (Record, Record) {
    let written: Record = file(place)
        .ok()
        .and_then(|file| fs::read_to_string(file).ok())
        .unwrap_or_default()
        .lines()
        .filter(|line| !line.is_empty())
        .map(|line| {
            let (path, id) = line.split_once('\t').unwrap_or((line, ""));
            (path.to_string(), id.to_string())
        })
        .collect();
    let git = Git::open(&place.root).ok();
    let live = written
        .iter()
        .filter(|(path, id)| committed_id(git.as_ref(), path) == **id)
        .map(|(path, id)| (path.clone(), id.clone()))
        .collect();
    (written, live)
}

/// Writes `record` when it differs from what was `written`.
fn write(place: &Place, written: &Record, record: &Record) -> Result<(), ActionError> {
    if written == record {
        return Ok(());
    }
    let file = file(place)?;
    if record.is_empty() {
        return match fs::remove_file(file) {
            Err(error) if error.kind() != std::io::ErrorKind::NotFound => Err(error.into()),
            _ => Ok(()),
        };
    }
    let text: String = record
        .iter()
        .map(|(path, id)| format!("{path}\t{id}\n"))
        .collect();
    // Written whole beside it, then moved over it: a reader never sees half a record.
    let temporary = file.with_extension("tmp");
    fs::write(&temporary, text)?;
    fs::rename(&temporary, &file).inspect_err(|_| {
        let _ = fs::remove_file(&temporary);
    })?;
    Ok(())
}

/// Records that a buffer saved `path`, from the top level, in the checkout of `place`, against its
/// last commit's version of it.
pub fn record(place: &Place, path: &str) -> Result<(), ActionError> {
    let (written, mut record) = read(place);
    let git = Git::open(&place.root).ok();
    record.insert(path.to_string(), committed_id(git.as_ref(), path));
    write(place, &written, &record)
}

/// The paths a buffer saved in the checkout of `place`, sorted, that no commit took since.
pub fn list(place: &Place) -> Vec<String> {
    read(place).1.into_keys().collect()
}

/// Forgets `paths`, once discarded, and the paths a commit took.
pub fn clear(place: &Place, paths: &[String]) -> Result<(), ActionError> {
    let (written, mut record) = read(place);
    record.retain(|path, _| !paths.contains(path));
    write(place, &written, &record)
}
