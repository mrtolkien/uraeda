//! The files a buffer saved in a checkout, left uncommitted: tool state kept in that checkout's own
//! git folder, so each worktree has its own record, one path from the top level per line. Losing
//! it only turns a buffer's edits back into the lines the Commit page reads from the files.

use std::collections::BTreeSet;
use std::fs;
use std::path::PathBuf;

use crate::git::Git;

use super::ActionError;
use super::place::Place;

/// The record's file, in the git folder of the checkout.
const FILE: &str = "uraeda-edited";

fn file(place: &Place) -> Result<PathBuf, ActionError> {
    Ok(Git::open(&place.root)?.git_dir().join(FILE))
}

fn read(place: &Place) -> BTreeSet<String> {
    file(place)
        .ok()
        .and_then(|file| fs::read_to_string(file).ok())
        .unwrap_or_default()
        .lines()
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect()
}

fn write(place: &Place, paths: &BTreeSet<String>) -> Result<(), ActionError> {
    let file = file(place)?;
    if paths.is_empty() {
        return match fs::remove_file(file) {
            Err(error) if error.kind() != std::io::ErrorKind::NotFound => Err(error.into()),
            _ => Ok(()),
        };
    }
    let text: String = paths.iter().map(|path| format!("{path}\n")).collect();
    fs::write(file, text)?;
    Ok(())
}

/// Records that a buffer saved `path`, from the top level, in the checkout of `place`.
pub fn record(place: &Place, path: &str) -> Result<(), ActionError> {
    let mut paths = read(place);
    if paths.insert(path.to_string()) {
        write(place, &paths)?;
    }
    Ok(())
}

/// The paths a buffer saved in the checkout of `place`, sorted.
pub fn list(place: &Place) -> Vec<String> {
    read(place).into_iter().collect()
}

/// Forgets `paths`, once committed or discarded.
pub fn clear(place: &Place, paths: &[String]) -> Result<(), ActionError> {
    let mut recorded = read(place);
    let before = recorded.len();
    recorded.retain(|path| !paths.contains(path));
    if recorded.len() != before {
        write(place, &recorded)?;
    }
    Ok(())
}
