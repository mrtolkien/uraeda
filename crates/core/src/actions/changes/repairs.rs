//! The link repairs the commit page lists: the markdown files of `specs/` whose only change since
//! `HEAD` is link destinations, or links turned into their words, as a move or a Fix writes them.
//! Found by their content, so nothing is held between the repair and the commit.

use std::fs;

use crate::files::retarget::only_links_changed;
use crate::git::Git;

use super::super::place::{self, Place};

/// The files of `specs/` changed since `HEAD` whose change is links alone, sorted, other than
/// `taken`, the files the list holds already. A file no commit has, or that is gone, is no repair.
pub(super) fn repairs(place: &Place, taken: &[String]) -> Vec<String> {
    let Ok(changed) = Git::open(&place.root).and_then(|git| git.changed_files()) else {
        return Vec::new();
    };
    changed
        .into_iter()
        .filter(|path| path.starts_with("specs/") && path.ends_with(".md"))
        .filter(|path| !taken.contains(path))
        .filter(|path| {
            let (Ok(now), Some(then)) = (
                fs::read_to_string(place.root.join(path)),
                place::committed(place, path),
            ) else {
                return false;
            };
            now != then && only_links_changed(&then, &now)
        })
        .collect()
}

/// The name of the file at `path`, for its line and its subject.
pub(super) fn file_name(path: &str) -> &str {
    path.rsplit_once('/').map_or(path, |(_, name)| name)
}
