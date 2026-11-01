//! The link repairs the commit page lists: the markdown files of `specs/` whose only change since
//! `HEAD` is link destinations, or links turned into their words, as a move or a Fix writes them.
//! Found by their content, so nothing is held between the repair and the commit.

use std::fs;

use crate::files::retarget::only_links_changed;
use crate::git::Git;

use super::super::place::Place;

/// The files of `specs/` changed since `HEAD` whose change is links alone, sorted, other than
/// `taken`, the files the list holds already. A file no commit has, or that is gone, is no repair.
pub(super) fn repairs(place: &Place, taken: &[String]) -> Vec<String> {
    let Ok(git) = Git::open(&place.root) else {
        return Vec::new();
    };
    let (Ok(changed), Some(head)) = (git.changed_files(), git.head()) else {
        return Vec::new();
    };
    changed
        .into_iter()
        .filter(|path| path.starts_with("specs/") && path.ends_with(".md"))
        .filter(|path| !taken.contains(path))
        .filter(|path| {
            let committed = git.read_file(head, path).ok().flatten();
            let (Ok(now), Some(Ok(then))) = (
                fs::read_to_string(place.root.join(path)),
                committed.map(String::from_utf8),
            ) else {
                return false;
            };
            now != then && only_links_changed(&then, &now)
        })
        .collect()
}

/// How each of the repairs `paths` reads, for its line and its subject, in the same order: its
/// file's name, or its path from `specs/` when another repair has the same name.
pub(super) fn names(paths: &[String]) -> Vec<&str> {
    fn name(path: &str) -> &str {
        path.rsplit_once('/').map_or(path, |(_, name)| name)
    }
    paths
        .iter()
        .map(|path| {
            let shared = paths
                .iter()
                .filter(|other| name(other) == name(path))
                .count()
                > 1;
            if shared {
                path.strip_prefix("specs/").unwrap_or(path)
            } else {
                name(path)
            }
        })
        .collect()
}
